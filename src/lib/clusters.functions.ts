import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Cluster = { name: string; count: number; phrases: string[] };

const Input = z.object({ tasks: z.array(z.string().max(2000)).max(300) });

export const clusterTasks = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<{ clusters: Cluster[]; error?: string }> => {
    const tasks = data.tasks.map((t) => t.trim()).filter(Boolean);
    if (tasks.length === 0) return { clusters: [] };
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { clusters: [], error: "AI не настроен" };

    const numbered = tasks.map((t, i) => `[${i}] ${t}`).join("\n");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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
    if (!res.ok) {
      const body = await res.text();
      console.error(`AI clustering failed [${res.status}]: ${body}`);
      if (res.status === 429) return { clusters: [], error: "Слишком много запросов к ИИ, попробуем позже" };
      if (res.status === 402) return { clusters: [], error: "Закончились кредиты ИИ" };
      return { clusters: [], error: "Не удалось сгруппировать задачи" };
    }
    const json = (await res.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return { clusters: [], error: "Пустой ответ ИИ" };
    let parsed: { clusters?: { name: string; participants: number[]; phrases: string[] }[] };
    try {
      parsed = JSON.parse(args);
    } catch {
      return { clusters: [], error: "Не удалось прочитать ответ ИИ" };
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
