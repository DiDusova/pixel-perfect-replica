import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Download, Maximize2, Minimize2, QrCode, X } from "lucide-react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { INTERESTS, Q1_OPTIONS, type Phase } from "@/lib/survey";
import { clusterTasks, type Cluster } from "@/lib/clusters.functions";

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
          .from("responses")
          .select("id,q1:current_ai_usage,interests:learning_interests,task:work_tasks")
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
  const tasksKey = tasks.join("\u0001");

  const runCluster = useServerFn(clusterTasks);
  const [clusters, setClusters] = useState<Cluster[] | null>(null);
  const [clusterError, setClusterError] = useState<string | null>(null);
  const [clusterLoading, setClusterLoading] = useState(false);
  useEffect(() => {
    if (tasks.length === 0) { setClusters([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setClusterLoading(true);
      try {
        const res = await runCluster({ data: { tasks } });
        if (cancelled) return;
        setClusterError(res.error ?? null);
        if (!res.error) setClusters(res.clusters);
      } catch {
        if (!cancelled) setClusterError("Не удалось сгруппировать задачи");
      } finally {
        if (!cancelled) setClusterLoading(false);
      }
    }, 1500);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasksKey]);

  const [qrOpen, setQrOpen] = useState(false);
  const [present, setPresent] = useState(false);
  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) setPresent(false); };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  useEffect(() => {
    document.documentElement.style.fontSize = present ? "clamp(16px, 1.25vw, 26px)" : "";
    return () => { document.documentElement.style.fontSize = ""; };
  }, [present]);
  const togglePresent = async () => {
    if (!present) {
      setPresent(true);
      try { await document.documentElement.requestFullscreen?.(); } catch { /* iframe may block; keep enlarged layout */ }
    } else {
      setPresent(false);
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <main className={present ? "min-h-screen px-10 py-6" : "mx-auto min-h-screen max-w-[1600px] px-8 py-10 lg:px-16"}>
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="flex items-center gap-2 text-lg font-semibold text-muted-foreground">
            <span className="h-3 w-3 animate-pulse rounded-full bg-primary" /> Live · {title} {phase === "after" && "· после занятия"}
          </p>
          <h1 className="mt-2 text-4xl font-semibold lg:text-5xl">Карта возможностей ИИ — наша группа</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!present && (
            <button onClick={() => setQrOpen(true)} className="flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-lg font-semibold text-primary-foreground hover:opacity-90">
              <QrCode className="h-5 w-5" /> Показать QR-код
            </button>
          )}
          <button
            onClick={togglePresent}
            aria-label={present ? "Выйти из полноэкранного режима" : "На весь экран"}
            className={present ? "rounded-full p-3 text-muted-foreground opacity-40 hover:bg-secondary hover:opacity-100" : "flex items-center gap-2 rounded-full border-2 border-border px-5 py-3 text-lg font-semibold hover:bg-secondary"}
          >
            {present ? <Minimize2 className="h-5 w-5" /> : <><Maximize2 className="h-5 w-5" /> На весь экран</>}
          </button>
          <div className="rounded-3xl bg-highlight px-8 py-4">
            <span className="text-2xl font-semibold">Ответили: </span>
            <span key={total} className="animate-pop inline-block font-display text-6xl font-bold tabular-nums">{total}</span>
            <span className="text-2xl font-semibold"> чел.</span>
          </div>
        </div>
      </header>
      {qrOpen && <QrModal slug={s} phase={phase} onClose={() => setQrOpen(false)} />}

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
        <h2 className="text-3xl font-semibold">Какие рабочие задачи звучат чаще всего</h2>
        <p className="mt-2 text-xl text-muted-foreground">Карта тем, которые участники хотят упростить с помощью ИИ</p>
        <BubbleMap clusters={clusters} loading={clusterLoading} error={clusterError} hasTasks={tasks.length > 0} />
      </section>
    </main>
  );
}

const BUBBLE_TONES = [
  "bg-primary text-primary-foreground",
  "bg-highlight text-foreground",
  "bg-accent text-accent-foreground",
  "bg-secondary text-secondary-foreground",
];

function BubbleMap({ clusters, loading, error, hasTasks }: { clusters: Cluster[] | null; loading: boolean; error: string | null; hasTasks: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!hasTasks) return <p className="mt-6 text-xl text-muted-foreground">Пока нет ответов</p>;
  if (!clusters) {
    return <p className="mt-6 text-xl text-muted-foreground">{error ?? (loading ? "ИИ группирует ответы по смыслу…" : "Готовим карту тем…")}</p>;
  }
  const top = clusters.slice(0, 8);
  const rest = clusters.slice(8);
  const max = Math.max(1, ...top.map((c) => c.count));
  const min = Math.min(...top.map((c) => c.count));
  const size = (n: number) => (max === min ? 15 : 11 + ((n - min) / (max - min)) * 9); // rem
  return (
    <div className="mt-8">
      {(loading || error) && <p className="mb-4 text-base text-muted-foreground">{error ?? "Обновляем карту…"}</p>}
      <div className="flex flex-wrap items-center justify-center gap-6">
        {top.map((c, i) => {
          const d = size(c.count);
          const isOpen = open === c.name;
          return (
            <button
              key={c.name}
              onClick={() => setOpen(isOpen ? null : c.name)}
              style={{ width: `${d}rem`, height: `${d}rem`, animationDelay: `${i * 70}ms` }}
              className={`animate-pop flex shrink-0 flex-col items-center justify-center rounded-full border border-border/40 p-6 text-center shadow-lg transition-transform hover:scale-105 ${BUBBLE_TONES[i % BUBBLE_TONES.length]}`}
            >
              <span className="text-xl font-bold leading-tight">{c.name}</span>
              <span className="mt-1 font-display text-3xl font-bold tabular-nums">{c.count}</span>
              <span className="text-sm font-semibold opacity-80">{people(c.count)}</span>
              <span className="mt-2 line-clamp-3 text-sm leading-snug opacity-80">
                например: {(isOpen ? c.phrases : c.phrases.slice(0, 2)).map((p) => `«${p}»`).join(", ")}
              </span>
            </button>
          );
        })}
      </div>
      {rest.length > 0 && (
        <div className="mt-8 rounded-3xl border-2 border-border bg-card p-6">
          <h3 className="text-xl font-semibold">Другие темы</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {rest.map((c) => (
              <span key={c.name} className="rounded-full bg-secondary px-4 py-2 text-base font-semibold">{c.name} · {c.count}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function people(n: number) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "человек";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "человека";
  return "человек";
}

function QrModal({ slug, phase, onClose }: { slug: string; phase: Phase; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [svg, setSvg] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams({ s: slug });
    if (phase === "after") params.set("phase", "after");
    const u = `${window.location.origin}/?${params.toString()}`;
    setUrl(u);
    QRCode.toString(u, { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then(setSvg);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slug, phase, onClose]);
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const download = async () => {
    const dataUrl = await QRCode.toDataURL(url, { width: 1200, margin: 2 });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `qr-${slug}.png`;
    a.click();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-6" onClick={onClose}>
      <div className="relative flex max-h-full w-full max-w-3xl flex-col items-center overflow-auto rounded-[2rem] bg-card p-10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Закрыть" className="absolute right-5 top-5 rounded-full p-2 hover:bg-secondary"><X className="h-7 w-7" /></button>
        <h2 className="text-center text-4xl font-semibold">Наведите камеру телефона на QR-код</h2>
        <div className="mt-8 aspect-square w-full max-w-[min(32rem,60vh)] rounded-3xl bg-background p-4 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-6 break-all text-center font-mono text-xl">{url}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button onClick={copy} className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-lg font-semibold text-primary-foreground hover:opacity-90">
            <Copy className="h-5 w-5" /> {copied ? "Скопировано" : "Скопировать ссылку"}
          </button>
          <button onClick={download} className="flex items-center gap-2 rounded-full border-2 border-border px-6 py-3 text-lg font-semibold hover:bg-secondary">
            <Download className="h-5 w-5" /> Скачать QR
          </button>
        </div>
      </div>
    </div>
  );
}
