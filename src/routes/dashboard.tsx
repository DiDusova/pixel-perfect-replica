import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DIRECTIONS, Q1_OPTIONS, Q1_SHORT, UNSURE, type Phase } from "@/lib/survey";

type Search = { s?: string; phase?: Phase };
type Row = { id: string; q1: string; q2: string; q3: string[]; task: string | null };

export const Route = createFileRoute("/dashboard")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    s: typeof s["s"] === "string" ? s["s"] : undefined,
    phase: s["phase"] === "after" ? "after" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Live-результаты — Карта возможностей ИИ" },
      { name: "description", content: "Результаты опроса группы в реальном времени для показа на экране." },
      { property: "og:title", content: "Live-результаты — Карта возможностей ИИ" },
      { property: "og:description", content: "Результаты опроса группы в реальном времени." },
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
          .select("id,q1,q2,q3,task")
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
  const count = (fn: (r: Row) => boolean) => rows.filter(fn).length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  const q1 = Q1_OPTIONS.map((o) => ({ ...o, n: count((r) => r.q1 === o.id) }));
  const q2 = [...DIRECTIONS, UNSURE].map((d) => ({ ...d, n: count((r) => r.q2 === d.id) }));
  const q3 = useMemo(
    () => DIRECTIONS.map((d) => ({ ...d, n: rows.filter((r) => r.q3.includes(d.id)).length })).sort((a, b) => b.n - a.n),
    [rows],
  );
  const q3max = Math.max(1, ...q3.map((x) => x.n));
  const q1max = Math.max(1, ...q1.map((x) => x.n));
  const tasks = rows.filter((r) => r.task).map((r) => r.task as string);
  const topQ2 = Math.max(...q2.map((x) => x.n));

  return (
    <main className="min-h-screen px-8 py-10 lg:px-16">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="flex items-center gap-2 text-lg font-semibold text-muted-foreground">
            <span className="h-3 w-3 animate-pulse rounded-full bg-primary" /> Live · {title} {phase === "after" && "· после занятия"}
          </p>
          <h1 className="mt-2 text-4xl font-semibold lg:text-5xl">Карта возможностей ИИ</h1>
        </div>
        <div className="rounded-3xl bg-highlight px-8 py-4 text-right">
          <div className="text-lg font-semibold">Ответили</div>
          <div key={total} className="animate-pop font-display text-6xl font-bold tabular-nums">{total}</div>
        </div>
      </header>

      <section className="mt-12">
        <h2 className="text-2xl font-semibold lg:text-3xl">Что группе интереснее всего</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {q2.map((d) => (
            <div key={d.id} className={`rounded-3xl border-2 bg-card p-6 transition-colors ${d.n > 0 && d.n === topQ2 ? "border-primary bg-accent" : "border-border"}`}>
              <div className="flex items-start justify-between">
                <span className="text-4xl">{d.emoji}</span>
                <span className="font-display text-4xl font-bold tabular-nums">{pct(d.n)}%</span>
              </div>
              <div className="mt-4 text-xl font-bold leading-snug">{d.title}</div>
              <div className="mt-1 text-lg text-muted-foreground">{d.n} отв.</div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-14 grid gap-12 xl:grid-cols-2">
        <section>
          <h2 className="text-2xl font-semibold lg:text-3xl">Как группа сейчас использует ИИ</h2>
          <div className="mt-6 flex h-72 items-end gap-4">
            {q1.map((o) => (
              <div key={o.id} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className="font-display text-2xl font-bold tabular-nums">{o.n}</span>
                <div className="w-full rounded-t-2xl bg-primary transition-all duration-700" style={{ height: `${(o.n / q1max) * 100}%`, minHeight: 6 }} />
                <span className="h-12 text-center text-base font-semibold leading-tight">{Q1_SHORT[o.id]}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold lg:text-3xl">Что ещё хочется увидеть</h2>
          <ol className="mt-6 space-y-4">
            {q3.map((d, i) => (
              <li key={d.id} className="flex items-center gap-4">
                <span className="w-6 font-display text-xl font-bold text-muted-foreground">{i + 1}</span>
                <span className="text-3xl">{d.emoji}</span>
                <div className="flex-1">
                  <div className="text-lg font-semibold leading-tight">{d.title}</div>
                  <div className="mt-2 h-3 rounded-full bg-secondary">
                    <div className="h-3 rounded-full bg-primary transition-all duration-700" style={{ width: `${(d.n / q3max) * 100}%` }} />
                  </div>
                </div>
                <span className="w-10 text-right font-display text-2xl font-bold tabular-nums">{d.n}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {tasks.length > 0 && (
        <section className="mt-14">
          <h2 className="text-2xl font-semibold lg:text-3xl">Рабочие задачи участников</h2>
          <div className="mt-6 columns-1 gap-4 md:columns-2 xl:columns-3">
            {tasks.map((t, i) => (
              <p key={i} className="mb-4 break-inside-avoid rounded-2xl bg-card p-5 text-xl leading-snug">«{t}»</p>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
