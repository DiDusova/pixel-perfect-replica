import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DIRECTIONS, Q1_OPTIONS, UNSURE, type Phase } from "@/lib/survey";

type Search = { s?: string | undefined; phase?: Phase | undefined };

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    s: typeof s["s"] === "string" ? s["s"] : undefined,
    phase: s["phase"] === "after" ? "after" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Карта возможностей ИИ — опрос" },
      { name: "description", content: "Опрос на одну минуту: как вы используете ИИ и что хотите увидеть на занятии." },
      { property: "og:title", content: "Карта возможностей ИИ — опрос" },
      { property: "og:description", content: "Опрос на одну минуту: как вы используете ИИ и что хотите увидеть." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Survey,
});

const MAX_EXTRA = 3;

function Survey() {
  const { s = "demo", phase = "before" } = Route.useSearch();
  const [step, setStep] = useState(0);
  const [q1, setQ1] = useState<string | null>(null);
  const [q2, setQ2] = useState<string | null>(null);
  const [q3, setQ3] = useState<string[]>([]);
  const [taskOpen, setTaskOpen] = useState(false);
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

  const toggleExtra = (id: string) =>
    setQ3((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= MAX_EXTRA ? prev : [...prev, id]));

  const submit = async () => {
    if (!sessionId || !q1 || !q2) return;
    setSending(true);
    setError(null);
    const { error } = await supabase.from("survey_responses").insert({
      session_id: sessionId, phase, q1, q2, q3, task: task.trim() || null,
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
          <button onClick={() => setStep(step - 1)} className="rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-secondary" aria-label="Назад">
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
          <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-highlight px-3 py-1 text-sm font-semibold">
            ⏱ меньше минуты
          </span>
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
              <button key={o.id} data-selected={q1 === o.id} onClick={() => setQ1(o.id)} className="choice-card items-center gap-4 p-5 text-base font-medium">
                <Radio on={q1 === o.id} />
                {o.label}
              </button>
            ))}
          </div>
          <PrimaryButton className="mt-8" disabled={!q1} onClick={() => setStep(2)}>Дальше</PrimaryButton>
        </div>
      )}

      {step === 2 && (
        <div key="s2" className="animate-rise">
          <h2 className="text-xl font-semibold leading-snug sm:text-2xl">
            Если представить, что ИИ умеет гораздо больше, чем просто отвечать на вопросы — что из этого вам сейчас кажется наиболее интересным?
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">Выберите один вариант</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[...DIRECTIONS, UNSURE].map((d) => (
              <DirectionCard key={d.id} d={d} selected={q2 === d.id} onClick={() => setQ2(d.id)} />
            ))}
          </div>
          <PrimaryButton className="mt-8" disabled={!q2} onClick={() => setStep(3)}>Дальше</PrimaryButton>
        </div>
      )}

      {step === 3 && (
        <div key="s3" className="animate-rise">
          <h2 className="text-2xl font-semibold leading-snug sm:text-3xl">А что ещё вам было бы особенно интересно увидеть сегодня?</h2>
          <p className="mt-3 inline-flex rounded-full bg-secondary px-3 py-1 text-sm font-semibold">
            Выбрано <span key={q3.length} className="animate-pop mx-1 inline-block tabular-nums text-primary">{q3.length}</span> из {MAX_EXTRA}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {DIRECTIONS.map((d) => (
              <DirectionCard
                key={d.id}
                d={d}
                selected={q3.includes(d.id)}
                disabled={!q3.includes(d.id) && q3.length >= MAX_EXTRA}
                onClick={() => toggleExtra(d.id)}
              />
            ))}
          </div>

          <div className="mt-6">
            {!taskOpen ? (
              <button onClick={() => setTaskOpen(true)} className="rounded-full px-1 py-2 font-semibold text-primary hover:underline">
                + Хочу добавить свою рабочую задачу
              </button>
            ) : (
              <label className="animate-rise block">
                <span className="font-semibold">Если бы ИИ мог помочь вам с одной рабочей задачей — что бы это было?</span>
                <textarea
                  value={task}
                  onChange={(e) => setTask(e.target.value.slice(0, 500))}
                  rows={3}
                  placeholder="Необязательно"
                  className="mt-3 w-full rounded-xl border-2 border-border bg-card p-4 text-base outline-none focus:border-primary"
                />
              </label>
            )}
          </div>

          {error && <p className="mt-4 text-destructive">{error}</p>}
          <PrimaryButton className="mt-8" disabled={sending || !sessionId} onClick={submit}>
            {sending ? "Отправляем…" : "Отправить"}
          </PrimaryButton>
          {q3.length === 0 && <p className="mt-3 text-center text-sm text-muted-foreground">Можно выбрать до трёх или пропустить</p>}
        </div>
      )}

      {step === 4 && (
        <div key="s4" className="animate-rise flex flex-1 flex-col justify-center text-center">
          <div className="animate-pop mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-highlight text-4xl">✓</div>
          <h1 className="text-3xl font-semibold sm:text-4xl">Спасибо! Ответ принят.</h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Через несколько минут посмотрим, что выбрала вся группа — и какие способы работы с ИИ вообще существуют.
          </p>
          <p className="mt-10 text-sm font-medium text-muted-foreground">Кстати, этот опрос тоже создан с помощью ИИ.</p>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 py-8 sm:py-14">{children}</main>
  );
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

function DirectionCard({
  d, selected, disabled, onClick,
}: { d: { emoji: string; title: string; desc: string }; selected: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button data-selected={selected} onClick={onClick} disabled={disabled} className="choice-card flex-col gap-2 p-5 disabled:opacity-40">
      <span className={`text-3xl transition-transform ${selected ? "scale-110" : ""}`}>{d.emoji}</span>
      <span className="font-bold leading-snug">{d.title}</span>
      <span className="text-sm text-muted-foreground">{d.desc}</span>
    </button>
  );
}
