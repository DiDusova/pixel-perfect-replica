import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ATTITUDES, INTERESTS, LEVELS, nextStep } from "@/lib/survey";

export const Route = createFileRoute("/result/$id")({
  head: () => ({
    meta: [
      { title: "Ваша карта возможностей ИИ" },
      { name: "description", content: "Ваша текущая точка, направления интереса и возможный следующий шаг." },
      { property: "og:title", content: "Ваша карта возможностей ИИ" },
      { property: "og:description", content: "Ваша текущая точка, направления интереса и возможный следующий шаг." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Result,
});

type Resp = {
  survey_version: number | null;
  interaction_level: string | null;
  ai_attitude: string | null;
  learning_interests: string[] | null;
  work_tasks: string | null;
};

function Result() {
  const { id } = Route.useParams();
  const [data, setData] = useState<Resp | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    supabase
      .from("responses")
      .select("survey_version,interaction_level,ai_attitude,learning_interests,work_tasks")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => (error || !data ? setFailed(true) : setData(data as Resp)));
  }, [id]);

  const legacy = data && data.survey_version !== 2;
  const interests = data?.learning_interests ?? [];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 py-8 sm:py-14">
      {failed && <p className="text-center text-muted-foreground">Не удалось загрузить ответ.</p>}
      {!data && !failed && <p className="text-center text-muted-foreground">Загружаем…</p>}
      {legacy && <p className="text-center text-muted-foreground">Это ответ из предыдущей версии опроса — новая карта для него недоступна.</p>}
      {data && !legacy && (
        <div className="animate-rise">
          <span className="inline-flex items-center gap-2 rounded-full bg-highlight px-3 py-1 text-sm font-semibold">
            <Check className="h-4 w-4" strokeWidth={3} /> Ответ принят
          </span>
          <h1 className="mt-5 text-3xl font-semibold sm:text-4xl">Ваша карта возможностей ИИ</h1>
          <p className="mt-3 text-lg text-muted-foreground">Ваша текущая точка, направления интереса и возможный следующий шаг.</p>

          <div className="mt-8 space-y-4">
            <Block label="Где вы сейчас">
              <Route5 items={LEVELS.map((l) => l.short)} active={LEVELS.findIndex((l) => l.id === data.interaction_level)} />
              <h3 className="mb-3 mt-8 font-sans text-sm font-bold uppercase tracking-wide text-muted-foreground">Ваше отношение к ИИ</h3>
              <AttitudeScale active={ATTITUDES.findIndex((a) => a.id === data.ai_attitude)} />
            </Block>

            <Block label="Ваш компас интересов">
              {interests.includes("unsure") ? (
                <p className="rounded-2xl bg-secondary p-5 text-lg">Вы пока исследуете возможности — это нормальная отправная точка.</p>
              ) : (
                <Compass chosen={interests} />
              )}
            </Block>

            <section className="rounded-3xl bg-primary p-6 text-primary-foreground">
              <h2 className="mb-3 font-sans text-sm font-bold uppercase tracking-wide opacity-80">Ваш возможный следующий шаг</h2>
              <p className="text-lg font-semibold leading-relaxed">{nextStep(data.interaction_level, interests)}</p>
            </section>

            <Block label="Что вы хотите упростить">
              {data.work_tasks ? (
                <>
                  <p className="whitespace-pre-line rounded-2xl bg-highlight/40 p-5 text-base leading-relaxed">{data.work_tasks}</p>
                  <p className="mt-3 text-sm text-muted-foreground">Эту задачу можно будет использовать как отправную точку для практики.</p>
                </>
              ) : (
                <p className="text-muted-foreground">Пока без ответа</p>
              )}
            </Block>
          </div>

          <p className="mt-10 text-center text-lg font-semibold">А теперь посмотрим, как выглядит общая картина группы.</p>
          <p className="mt-3 text-center text-sm text-muted-foreground">Кстати, этот опрос тоже создан с помощью ИИ.</p>
        </div>
      )}
    </main>
  );
}

function Route5({ items, active }: { items: string[]; active: number }) {
  return (
    <ol className="relative space-y-0">
      {items.map((t, i) => {
        const done = i < active, here = i === active;
        return (
          <li key={t} className="relative flex items-center gap-4 pb-5 last:pb-0">
            {i < items.length - 1 && (
              <span aria-hidden className={`absolute left-[1.1rem] top-9 h-[calc(100%-1.75rem)] w-1 rounded-full ${i < active ? "bg-primary" : "bg-border"}`} />
            )}
            <span className={`relative z-10 flex shrink-0 items-center justify-center rounded-full font-display font-bold transition-all ${
              here ? "h-10 w-10 bg-primary text-primary-foreground ring-4 ring-accent" : done ? "h-9 w-9 bg-accent text-accent-foreground" : "h-9 w-9 border-2 border-border bg-card text-muted-foreground"
            }`}>
              {here ? <MapPin className="h-5 w-5" /> : done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
            </span>
            <span className={here ? "text-lg font-bold" : done ? "font-semibold" : "text-muted-foreground"}>{t}</span>
            {here && <span className="rounded-full bg-highlight px-3 py-1 text-xs font-bold">Вы сейчас здесь</span>}
          </li>
        );
      })}
    </ol>
  );
}

function AttitudeScale({ active }: { active: number }) {
  return (
    <div>
      <div className="relative flex items-center justify-between">
        <span aria-hidden className="absolute inset-x-4 top-1/2 h-1 -translate-y-1/2 rounded-full bg-border" />
        {ATTITUDES.map((a, i) => (
          <span key={a.id} className={`relative z-10 flex items-center justify-center rounded-full transition-all ${
            i === active ? "h-14 w-14 bg-primary text-2xl shadow-lg" : "h-9 w-9 border-2 border-border bg-card text-base opacity-60"
          }`}>{a.emoji}</span>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        {ATTITUDES.map((a, i) => (
          <span key={a.id} className={`w-14 text-center leading-tight ${i === active ? "font-bold text-foreground" : ""}`}>{a.short}</span>
        ))}
      </div>
    </div>
  );
}

function Compass({ chosen }: { chosen: string[] }) {
  const dirs = INTERESTS.filter((i) => i.id !== "unsure");
  const R = 38; // % radius
  return (
    <div className="relative mx-auto aspect-square w-full max-w-sm">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-border)" strokeDasharray="1.5 2" />
        {dirs.map((d, i) => {
          if (!chosen.includes(d.id)) return null;
          const a = (i / dirs.length) * Math.PI * 2 - Math.PI / 2;
          return <line key={d.id} x1="50" y1="50" x2={50 + R * Math.cos(a)} y2={50 + R * Math.sin(a)} stroke="var(--color-primary)" strokeWidth="0.8" />;
        })}
      </svg>
      <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-foreground text-center font-display text-sm font-bold text-background">Я + ИИ</div>
      {dirs.map(({ id, short, Icon }, i) => {
        const a = (i / dirs.length) * Math.PI * 2 - Math.PI / 2;
        const on = chosen.includes(id);
        return (
          <div key={id} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-center"
            style={{ left: `${50 + R * Math.cos(a)}%`, top: `${50 + R * Math.sin(a)}%` }}>
            <span className={`flex items-center justify-center rounded-2xl transition-all ${on ? "h-14 w-14 bg-primary text-primary-foreground shadow-lg" : "h-10 w-10 border-2 border-border bg-card text-muted-foreground"}`}>
              <Icon className={on ? "h-6 w-6" : "h-4 w-4"} strokeWidth={1.75} />
            </span>
            <span className={`w-24 text-xs leading-tight ${on ? "font-bold" : "text-muted-foreground"}`}>{short}</span>
          </div>
        );
      })}
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border-2 border-border bg-card p-5">
      <h2 className="mb-4 font-sans text-sm font-bold uppercase tracking-wide text-muted-foreground">{label}</h2>
      {children}
    </section>
  );
}
