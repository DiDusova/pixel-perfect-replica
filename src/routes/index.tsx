import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ATTITUDES, INTERESTS, LEVELS, SURVEY_VERSION, TASK_EXAMPLES, type Phase } from "@/lib/survey";

type Search = { s?: string | undefined; phase?: Phase | undefined };

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    s: typeof s["s"] === "string" ? s["s"] : undefined,
    phase: s["phase"] === "after" ? "after" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Карта возможностей ИИ — опрос" },
      { name: "description", content: "Опрос на одну минуту: как вы используете ИИ и чему хотите научиться." },
      { property: "og:title", content: "Карта возможностей ИИ — опрос" },
      { property: "og:description", content: "Опрос на одну минуту: как вы используете ИИ и чему хотите научиться." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Survey,
});

const STEPS = 4;

function Survey() {
  const { s = "demo", phase = "before" } = Route.useSearch();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<string | null>(null);
  const [attitude, setAttitude] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [task, setTask] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const loadSession = async (): Promise<string | null> => {
    const { data, error } = await supabase.from("survey_sessions").select("id").eq("slug", s).maybeSingle();
    if (data) {
      setSessionId(data.id);
      return data.id;
    }
    if (!error) setMissing(true);
    return null;
  };

  useEffect(() => {
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s]);

  const toggle = (id: string) =>
    setInterests((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (id === "unsure") return ["unsure"];
      return [...prev.filter((x) => x !== "unsure"), id];
    });

  const submit = async () => {
    if (sending || !level || !attitude) return;
    setSending(true);
    setError(null);
    try {
      const sid = sessionId ?? (await loadSession());
      if (!sid) throw new Error("no session");
      const { data, error } = await supabase
        .from("responses")
        .insert({
          session_id: sid,
          phase,
          survey_version: SURVEY_VERSION, // always explicit; DEFAULT 1 exists only for legacy rows
          interaction_level: level,
          ai_attitude: attitude,
          learning_interests: interests,
          work_tasks: task.trim() || null,
        })
        .select("id")
        .abortSignal(AbortSignal.timeout(15000))
        .single();
      if (error || !data?.id) throw error ?? new Error("no id");
      navigate({ to: "/result/$id", params: { id: data.id } });
    } catch {
      setSending(false);
      setError("Не получилось отправить. Проверьте интернет и нажмите ещё раз.");
    }
  };

  if (missing) {
    return <Shell><p className="text-center text-muted-foreground">Опрос не найден. Проверьте ссылку.</p></Shell>;
  }

  return (
    <Shell>
      {step > 0 && (
        <div className="mb-8 flex items-center gap-4">
          <button onClick={() => setStep(step - 1)} className="rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-secondary">
            ← Назад
          </button>
          <div className="flex flex-1 gap-1.5">
            {Array.from({ length: STEPS }, (_, k) => k + 1).map((i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-primary" : "bg-border"}`} />
            ))}
          </div>
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">{step} из {STEPS}</span>
        </div>
      )}

      {step === 0 && (
        <div key="s0" className="animate-rise flex flex-1 flex-col justify-center">
          <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-highlight px-3 py-1 text-sm font-semibold">⏱ около минуты</span>
          <h1 className="text-3xl font-semibold leading-tight sm:text-5xl">Что вам сейчас интересно в работе с ИИ?</h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Четыре коротких вопроса. Здесь нет правильных ответов — интересно увидеть, как группа сейчас представляет возможности ИИ.
          </p>
          <PrimaryButton className="mt-10" onClick={() => setStep(1)}>Начать</PrimaryButton>
        </div>
      )}

      {step === 1 && (
        <div key="s1" className="animate-rise">
          <h2 className="text-2xl font-semibold leading-snug sm:text-3xl">Как вы сейчас взаимодействуете с ИИ?</h2>
          <p className="mt-2 text-muted-foreground">Выберите вариант, который лучше всего описывает ваш текущий способ работы.</p>
          <ol className="relative mt-6 space-y-3">
            <span aria-hidden className="absolute bottom-6 left-[1.85rem] top-6 w-0.5 bg-border" />
            {LEVELS.map((o, i) => (
              <li key={o.id}>
                <button data-selected={level === o.id} onClick={() => setLevel(o.id)} className="choice-card relative items-start gap-4 p-4">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold transition-colors ${level === o.id ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{i + 1}</span>
                  <span>
                    <span className="block text-base font-bold">{o.title}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{o.desc}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <PrimaryButton className="mt-8" disabled={!level} onClick={() => setStep(2)}>Дальше</PrimaryButton>
        </div>
      )}

      {step === 2 && (
        <div key="s2" className="animate-rise">
          <h2 className="text-2xl font-semibold leading-snug sm:text-3xl">А как вы сейчас относитесь к ИИ?</h2>
          <p className="mt-2 text-muted-foreground">Выберите вариант, который вам ближе.</p>
          <div className="mt-6 space-y-3">
            {ATTITUDES.map((o) => (
              <button key={o.id} data-selected={attitude === o.id} onClick={() => setAttitude(o.id)} className="choice-card items-start gap-4 p-4">
                <span className="text-3xl leading-none">{o.emoji}</span>
                <span>
                  <span className="block text-base font-bold">«{o.title}»</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{o.desc}</span>
                </span>
              </button>
            ))}
          </div>
          <PrimaryButton className="mt-8" disabled={!attitude} onClick={() => setStep(3)}>Дальше</PrimaryButton>
        </div>
      )}

      {step === 3 && (
        <div key="s3" className="animate-rise">
          <h2 className="text-2xl font-semibold leading-snug sm:text-3xl">Что вам хотелось бы научиться создавать или делать с помощью ИИ?</h2>
          <p className="mt-2 text-muted-foreground">Можно выбрать несколько направлений.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {INTERESTS.map(({ id, title, Icon }) => {
              const on = interests.includes(id);
              return (
                <button key={id} data-selected={on} onClick={() => toggle(id)} className="choice-card items-center gap-4 p-4">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors ${on ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="flex-1 font-semibold leading-snug">{title}</span>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                    {on && <Check className="animate-pop h-4 w-4" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
          <PrimaryButton className="mt-8" disabled={interests.length === 0} onClick={() => setStep(4)}>Дальше</PrimaryButton>
        </div>
      )}

      {step === 4 && (
        <div key="s4" className="animate-rise">
          <h2 className="text-2xl font-semibold leading-snug sm:text-3xl">Какие рабочие задачи вам больше всего хотелось бы упростить с помощью ИИ?</h2>
          <p className="mt-2 text-muted-foreground">Напишите свободным текстом одну или несколько задач.</p>
          <div className="mt-5 rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
            <p className="font-semibold">Например:</p>
            <ul className="mt-2 space-y-1.5 italic">
              {TASK_EXAMPLES.map((e) => <li key={e}>— {e}</li>)}
            </ul>
          </div>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value.slice(0, 2000))}
            rows={6}
            placeholder="Напишите свои задачи…"
            className="mt-5 w-full rounded-2xl border-2 border-border bg-card p-4 text-base outline-none focus:border-primary"
          />
          {error && <p className="mt-4 text-destructive">{error}</p>}
          <PrimaryButton className="mt-6" disabled={sending} onClick={submit}>
            {sending ? "Отправляем…" : "Отправить"}
          </PrimaryButton>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 py-8 sm:py-14">{children}</main>;
}

function PrimaryButton({ className = "", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className={`w-full rounded-full bg-primary px-8 py-5 text-lg font-bold text-primary-foreground transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-35 disabled:active:scale-100 sm:w-auto sm:min-w-56 ${className}`}
    />
  );
}
