import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Cluster = { name: string; count: number; phrases: string[] };

const Input = z.object({ tasks: z.array(z.string().max(2000)).max(300) });

// --- Локальная группировка без внешнего ИИ (self-hosted fallback) ---

const STOPWORDS = new Set([
  "и", "в", "на", "с", "по", "для", "из", "к", "о", "об", "от", "до", "за", "при",
  "не", "что", "как", "это", "чтобы", "или", "а", "но", "the", "a", "an", "of",
  "мне", "мой", "моя", "мои", "свои", "свой", "своих", "их", "ихний", "быстрее",
  "проще", "легче", "нужно", "надо", "хочу", "хотелось", "бы", "же", "у", "во",
]);

function stem(word: string): string {
  // Грубое отсечение окончаний для русских слов: достаточно для объединения
  // «презентации/презентацию/презентаций», «отчёты/отчета/отчётов».
  let w = word;
  if (w.length > 5) w = w.slice(0, -2);
  else if (w.length > 4) w = w.slice(0, -1);
  return w;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .split(/[^a-zа-я0-9]+/i)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    .map(stem);
}

// Один ответ может содержать несколько задач — режем по перечислениям.
function splitTasks(text: string): string[] {
  return text
    .split(/[;.\n]|\s+и\s+(?=[а-яa-z])/i)
    .map((s) => s.replace(/^[\s,]+|[\s,]+$/g, ""))
    .filter((s) => s.length >= 3);
}

function localCluster(tasks: string[]): Cluster[] {
  // Частотные слова по всем ответам (по участникам, не по упоминаниям).
  const wordParticipants = new Map<string, Set<number>>();
  const wordOriginal = new Map<string, string>();
  const participantPhrases: string[][] = tasks.map(splitTasks);

  participantPhrases.forEach((phrases, pi) => {
    const seen = new Set<string>();
    for (const phrase of phrases) {
      for (const tok of tokenize(phrase)) {
        if (!seen.has(tok)) {
          seen.add(tok);
          if (!wordParticipants.has(tok)) wordParticipants.set(tok, new Set());
          wordParticipants.get(tok)!.add(pi);
          if (!wordOriginal.has(tok)) wordOriginal.set(tok, tok);
        }
      }
    }
  });

  // Берём слова, которые встретились минимум у 2 участников (или топ-10, если все по одному).
  const entries = [...wordParticipants.entries()].sort(
    (a, b) => b[1].size - a[1].size,
  );
  const minCount = (entries[0]?.[1].size ?? 0) > 1 ? 2 : 1;
  const keywords = entries
    .filter(([, set]) => set.size >= minCount)
    .slice(0, 10)
    .map(([w]) => w);

  const clusters: Cluster[] = [];
  const used = new Set<number>();

  for (const kw of keywords) {
    const parts = wordParticipants.get(kw)!;
    const free = [...parts].filter((p) => !used.has(p));
    if (free.length === 0) continue;
    free.forEach((p) => used.add(p));

    // Название кластера: самая частая короткая фраза, содержащая ключевое слово.
    const phraseVotes = new Map<string, number>();
    for (const p of free) {
      for (const phrase of participantPhrases[p] ?? []) {
        if (tokenize(phrase).includes(kw)) {
          const short = phrase.split(/\s+/).slice(0, 3).join(" ").replace(/[,:;—-]+$/, "");
          phraseVotes.set(short, (phraseVotes.get(short) ?? 0) + 1);
        }
      }
    }
    const name =
      [...phraseVotes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
      wordOriginal.get(kw) ??
      kw;

    const phrases: string[] = [];
    for (const p of free) {
      for (const phrase of participantPhrases[p] ?? []) {
        if (tokenize(phrase).includes(kw) && phrases.length < 3) {
          phrases.push(phrase.split(/\s+/).slice(0, 8).join(" ").slice(0, 80));
        }
      }
    }

    clusters.push({
      name: (name.charAt(0).toUpperCase() + name.slice(1)).slice(0, 60),
      count: free.length,
      phrases,
    });
  }

  // Участники без кластера — в «Другие задачи».
  const rest = tasks.map((_, i) => i).filter((i) => !used.has(i));
  if (rest.length > 0) {
    clusters.push({
      name: "Другие задачи",
      count: rest.length,
      phrases: rest
        .slice(0, 3)
        .map((i) => (tasks[i] ?? "").split(/\s+/).slice(0, 8).join(" ").slice(0, 80)),
    });
  }

  return clusters.sort((a, b) => b.count - a.count);
}

// --- Server function ---

export const clusterTasks = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<{ clusters: Cluster[]; error?: string }> => {
    const tasks = data.tasks.map((t) => t.trim()).filter(Boolean);
    if (tasks.length === 0) return { clusters: [] };

    // Режим 1 (Lovable): Lovable AI Gateway с управляемым ключом.
    // Режим 2 (self-hosted + AI_API_KEY): GPTunneL — OpenAI-compatible API,
    // ключ передаётся в Authorization без приставки Bearer.
    // Режим 3 (self-hosted без ключа): локальная группировка без внешнего ИИ.
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const externalKey = process.env["AI_API_KEY"];
    let apiUrl: string;
    let apiAuth: string;
    let apiModel: string;
    if (lovableKey) {
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      apiAuth = `Bearer ${lovableKey}`;
      apiModel = "google/gemini-3-flash-preview";
    } else if (externalKey) {
      apiUrl = "https://gptunnel.ru/v1/chat/completions";
      apiAuth = externalKey; // GPTunneL принимает ключ без Bearer
      apiModel = "gpt-4o-mini";
    } else {
      return { clusters: localCluster(tasks) };
    }

    const numbered = tasks.map((t, i) => `[${i}] ${t}`).join("\n");
    let res: Response;
    try {
    res = await fetch(apiUrl, {
      method: "POST",
      signal: AbortSignal.timeout(20000),
      headers: { Authorization: apiAuth, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: apiModel,
        messages: [
          {
            role: "system",
            content:
              "Ты аналитик. Тебе дают пронумерованные ответы участников о рабочих задачах, которые они хотят упростить с помощью ИИ. Один ответ может содержать несколько задач. Разбей ответы на смыслы и объедини похожие формулировки разных участников в смысловые кластеры с короткими понятными названиями на русском (2–4 слова). Для каждого кластера укажи номера участников, которые его упомянули, и 1–3 короткие фразы-примера из их ответов (дословно или почти дословно, до 6 слов). Не выдумывай темы, которых нет в ответах.",
          },
          { role: "user", content: numbered },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_clusters",
              parameters: {
                type: "object",
                properties: {
                  clusters: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        participants: { type: "array", items: { type: "integer" } },
                        phrases: { type: "array", items: { type: "string" } },
                      },
                      required: ["name", "participants", "phrases"],
                    },
                  },
                },
                required: ["clusters"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_clusters" } },
      }),
    });
    } catch {
      return { clusters: localCluster(tasks) };
    }
    if (!res.ok) {
      const body = await res.text();
      console.error(`AI clustering failed [${res.status}]: ${body}`);
            return { clusters: localCluster(tasks) };
    }
    const json = (await res.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return { clusters: localCluster(tasks) };
    let parsed: { clusters?: { name: string; participants: number[]; phrases: string[] }[] };
    try {
      parsed = JSON.parse(args);
    } catch {
      return { clusters: localCluster(tasks) };
    }
    const clusters = (parsed.clusters ?? [])
      .map((c) => ({
        name: String(c.name).slice(0, 60),
        count: new Set((c.participants ?? []).filter((i) => i >= 0 && i < tasks.length)).size,
        phrases: (c.phrases ?? []).slice(0, 3).map((p) => String(p).slice(0, 80)),
      }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count);
    return { clusters };
  });
