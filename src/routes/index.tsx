import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { INTERESTS, Q1_OPTIONS, TASK_EXAMPLES, type Phase } from "@/lib/survey";

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

function Survey() {
  const { s = "demo", phase = "before" } = Route.useSearch();
  const [step, setStep] = useState(0);
  const [q1, setQ1] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [task, setTask] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    supabase.from("survey_sessions").select("id").eq("slug", s).maybeSingle().then(({ data }) => {
      if (data) setSessionId(data.id);
      else setMissing(true);
    });
  }, [s]);

  const toggle = (id: string) =>
    setInterests((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (id === "unsure") return ["unsure"];
      return [...prev.filter((x) => x !== "unsure"), id];
    });

  const submit = async () => {
    if (!sessionId || !q1) return;
    setSending(true);
    setError(null);
    const { error } = await supabase.from("survey_responses").insert({
      session_id: sessionId, phase, q1, interests, task: task.trim() || null,
    });
    setSending(false);
    if (error) setError("Не получилось отправить. Попробуйте ещё раз.");
    else setStep(4);
  };

  if (missing) {
    return <Shell><p className="text-center text-muted-foreground">Опрос не найден. Проверьте ссылку.</p></Shell>;
  }

  return (
    <Shell>
      {step > 0 && step < 4 && (
        <div className="mb-8 flex items-center gap-4">
          <button onClick={() => setStep(step - 1)} className="rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-secondary">
            ← Назад
          </button>
          <div className="flex flex-1 gap-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-primary" : "bg-border"}`} />
            ))}
          </div>
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">{step} из 3</span>
        </div>
      )}

      {step === 0 && (
        <div key="s0" className="animate-rise flex flex-1 flex-col justify-center">
          <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-highlight px-3 py-1 text-sm font-semibold">⏱ меньше минуты</span>
          <h1 className="text-3xl font-semibold leading-tight sm:text-5xl">Что вам сейчас интересно в работе с ИИ?</h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Короткий опрос займёт меньше минуты. Здесь нет правильных ответов — интересно увидеть, как группа сейчас представляет возможности ИИ.
          </p>
          <PrimaryButton className="mt-10" onClick={() => setStep(1)}>Начать</PrimaryButton>
        </div>
      )}

      {step === 1 && (
        <div key="s1" className="animate-rise">
          <h2 className="text-2xl font-semibold leading-snug sm:text-3xl">Как вы сейчас в основном используете ИИ?</h2>
          <div className="mt-6 space-y-3">
            {Q1_OPTIONS.map((o) => (
              <button key={o.id} data-selected={q1 === o.id} onClick={() => setQ1(o.id)} className="choice-card items-center gap-4 p-5">
                <Radio on={q1 === o.id} />
                <span>
                  <span className="block text-base font-medium">{o.label}</span>
                  {o.hint && <span className="block text-sm text-muted-foreground">{o.hint}</span>}
                </span>
              </button>
            ))}
          </div>
          <PrimaryButton className="mt-8" disabled={!q1} onClick={() => setStep(2)}>Дальше</PrimaryButton>
        </div>
      )}

      {step === 2 && (
        <div key="s2" className="animate-rise">
          <h2 className="text-2xl font-semibold leading-snug sm:text-3xl">Что вам хотелось бы научиться создавать или делать с помощью ИИ?</h2>
          <p className="mt-2 text-muted-foreground">Выберите все направления, которые вам интересны.</p>
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
          <PrimaryButton className="mt-8" disabled={interests.length === 0} onClick={() => setStep(3)}>Дальше</PrimaryButton>
        </div>
      )}

      {step === 3 && (
        <div key="s3" className="animate-rise">
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
          <PrimaryButton className="mt-6" disabled={sending || !sessionId} onClick={submit}>
            {sending ? "Отправляем…" : "Отправить"}
          </PrimaryButton>
        </div>
      )}

      {step === 4 && q1 && <PersonalDashboard q1={q1} interests={interests} task={task.trim()} />}
    </Shell>
  );
}

function PersonalDashboard({ q1, interests, task }: { q1: string; interests: string[]; task: string }) {
  const usage = Q1_OPTIONS.find((o) => o.id === q1);
  return (
    <div className="animate-rise">
      <span className="inline-flex items-center gap-2 rounded-full bg-highlight px-3 py-1 text-sm font-semibold">
        <Check className="h-4 w-4" strokeWidth={3} /> Ответ принят
      </span>
      <h1 className="mt-5 text-3xl font-semibold sm:text-4xl">Ваша карта интереса</h1>
      <p className="mt-3 text-lg text-muted-foreground">Вот как сейчас выглядит ваша отправная точка.</p>

      <div className="mt-8 space-y-4">
        <Block label="Как я сейчас использую ИИ">
          <p className="text-lg font-semibold">{usage?.label}</p>
        </Block>
        <Block label="Что мне хотелось бы освоить">
          <div className="grid gap-2">
            {INTERESTS.filter((i) => interests.includes(i.id)).map(({ id, title, Icon }) => (
              <div key={id} className="flex items-center gap-3 rounded-xl bg-secondary p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="font-semibold leading-snug">{title}</span>
              </div>
            ))}
          </div>
        </Block>
        <Block label="Что мне хотелось бы упростить">
          {task ? <p className="whitespace-pre-line text-base leading-relaxed">{task}</p> : <p className="text-muted-foreground">Пока без ответа</p>}
        </Block>
      </div>

      <p className="mt-10 text-center text-lg font-semibold">А теперь посмотрим, как выглядит общая картина группы.</p>
      <p className="mt-3 text-center text-sm text-muted-foreground">Кстати, этот опрос тоже создан с помощью ИИ.</p>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border-2 border-border bg-card p-5">
      <h2 className="mb-3 font-sans text-sm font-bold uppercase tracking-wide text-muted-foreground">{label}</h2>
      {children}
    </section>
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

function Radio({ on }: { on: boolean }) {
  return (
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${on ? "border-primary" : "border-border"}`}>
      {on && <span className="animate-pop h-3 w-3 rounded-full bg-primary" />}
    </span>
  );
}
