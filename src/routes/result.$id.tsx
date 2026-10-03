import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { INTERESTS, Q1_OPTIONS } from "@/lib/survey";

export const Route = createFileRoute("/result/$id")({
  head: () => ({
    meta: [
      { title: "Ваша карта интереса — Карта возможностей ИИ" },
      { name: "description", content: "Ваша отправная точка в работе с ИИ." },
      { property: "og:title", content: "Ваша карта интереса" },
      { property: "og:description", content: "Ваша отправная точка в работе с ИИ." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Result,
});

type Resp = { current_ai_usage: string | null; learning_interests: string[] | null; work_tasks: string | null };

function Result() {
  const { id } = Route.useParams();
  const [data, setData] = useState<Resp | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    supabase
      .from("responses")
      .select("current_ai_usage,learning_interests,work_tasks")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => (error || !data ? setFailed(true) : setData(data)));
  }, [id]);

  const usage = Q1_OPTIONS.find((o) => o.id === data?.current_ai_usage);
  const chosen = INTERESTS.filter((i) => data?.learning_interests?.includes(i.id));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 py-8 sm:py-14">
      {failed && <p className="text-center text-muted-foreground">Не удалось загрузить ответ.</p>}
      {!data && !failed && <p className="text-center text-muted-foreground">Загружаем…</p>}
      {data && (
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
                {chosen.map(({ id, title, Icon }) => (
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
              {data.work_tasks ? (
                <p className="whitespace-pre-line text-base leading-relaxed">{data.work_tasks}</p>
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

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border-2 border-border bg-card p-5">
      <h2 className="mb-3 font-sans text-sm font-bold uppercase tracking-wide text-muted-foreground">{label}</h2>
      {children}
    </section>
  );
}
