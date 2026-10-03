import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { INTERESTS, Q1_OPTIONS, type Phase, type TaskCluster } from "@/lib/survey";

type Search = { s?: string | undefined; phase?: Phase | undefined };
type Row = { id: string; q1: string; interests: string[]; task: string | null };

export const Route = createFileRoute("/dashboard")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    s: typeof s["s"] === "string" ? s["s"] : undefined,
    phase: s["phase"] === "after" ? "after" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Наша группа — Карта возможностей ИИ" },
      { name: "description", content: "Анонимные результаты опроса группы в реальном времени для показа на экране." },
      { property: "og:title", content: "Наша группа — Карта возможностей ИИ" },
      { property: "og:description", content: "Анонимные результаты опроса группы в реальном времени." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { s = "demo", phase = "before" } = Route.useSearch();
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: sess } = await supabase.from("survey_sessions").select("id,title").eq("slug", s).maybeSingle();
      if (!sess) return;
      setTitle(sess.title);
      const load = async () => {
        const { data } = await supabase
          .from("survey_responses")
          .select("id,q1,interests,task")
          .eq("session_id", sess.id)
          .eq("phase", phase)
          .order("created_at", { ascending: false });
        setRows((data as Row[]) ?? []);
      };
      await load();
      channel = supabase
        .channel(`responses-${sess.id}-${phase}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "survey_responses", filter: `session_id=eq.${sess.id}` }, load)
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [s, phase]);

  const total = rows.length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const q1 = Q1_OPTIONS.map((o) => ({ ...o, n: rows.filter((r) => r.q1 === o.id).length }));
  const interests = INTERESTS.map((i) => ({ ...i, n: rows.filter((r) => r.interests?.includes(i.id)).length }));
  const tasks = rows.filter((r) => r.task).map((r) => r.task as string);
  // Future: replace with AI-generated clusters for this group.
  const clusters: TaskCluster[] | null = null;

  return (
    <main className="mx-auto min-h-screen max-w-[1600px] px-8 py-10 lg:px-16">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="flex items-center gap-2 text-lg font-semibold text-muted-foreground">
            <span className="h-3 w-3 animate-pulse rounded-full bg-primary" /> Live · {title} {phase === "after" && "· после занятия"}
          </p>
          <h1 className="mt-2 text-4xl font-semibold lg:text-5xl">Карта возможностей ИИ — наша группа</h1>
        </div>
        <div className="rounded-3xl bg-highlight px-8 py-4">
          <span className="text-2xl font-semibold">Ответили: </span>
          <span key={total} className="animate-pop inline-block font-display text-6xl font-bold tabular-nums">{total}</span>
          <span className="text-2xl font-semibold"> чел.</span>
        </div>
      </header>

      {total === 0 && <p className="mt-16 text-center text-2xl text-muted-foreground">Ждём первые ответы…</p>}

      <section className="mt-14">
        <h2 className="text-3xl font-semibold">Как мы сейчас используем ИИ</h2>
        <div className="mt-6 space-y-4">
          {q1.map((o) => (
            <div key={o.id} className="grid grid-cols-[minmax(0,22rem)_1fr_auto] items-center gap-6">
              <span className="text-xl font-semibold leading-tight">{o.label}</span>
              <div className="h-10 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${pct(o.n)}%` }} />
              </div>
              <span className="w-40 text-right font-display text-3xl font-bold tabular-nums">
                {o.n} <span className="text-xl text-muted-foreground">· {pct(o.n)}%</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-3xl font-semibold">Чему мы хотим научиться</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {interests.map(({ id, title, Icon, n }) => (
            <div key={id} className="rounded-3xl border-2 border-border bg-card p-6">
              <div className="flex items-start justify-between">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                  <Icon className="h-7 w-7" strokeWidth={1.75} />
                </span>
                <span className="font-display text-5xl font-bold tabular-nums">{pct(n)}%</span>
              </div>
              <div className="mt-5 text-xl font-bold leading-snug">{title}</div>
              <div className="mt-1 text-lg text-muted-foreground">{n} выбр.</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-3xl font-semibold">Какие рабочие задачи мы хотим упростить</h2>
        {clusters ? <ClusterView clusters={clusters} total={tasks.length} /> : <TaskList tasks={tasks} />}
      </section>
    </main>
  );
}

function TaskList({ tasks }: { tasks: string[] }) {
  if (tasks.length === 0) return <p className="mt-6 text-xl text-muted-foreground">Пока нет ответов</p>;
  return (
    <div className="mt-6 columns-1 gap-4 md:columns-2 xl:columns-3">
      {tasks.map((t, i) => (
        <p key={i} className="mb-4 whitespace-pre-line break-inside-avoid rounded-2xl border-2 border-border bg-card p-5 text-xl leading-snug">{t}</p>
      ))}
    </div>
  );
}

function ClusterView({ clusters, total }: { clusters: TaskCluster[]; total: number }) {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {clusters.map((c) => (
        <div key={c.title} className="rounded-3xl border-2 border-border bg-card p-6">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="text-2xl font-semibold">{c.title}</h3>
            <span className="font-display text-3xl font-bold">{total ? Math.round((c.count / total) * 100) : 0}%</span>
          </div>
          <p className="text-lg text-muted-foreground">{c.count} отв.</p>
          <ul className="mt-4 space-y-2 text-lg">{c.examples.map((e) => <li key={e}>— {e}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}
