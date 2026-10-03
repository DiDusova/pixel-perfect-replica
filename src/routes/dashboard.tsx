import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Download, FileDown, Link2, Maximize2, Minimize2, QrCode, X } from "lucide-react";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { ATTITUDES, INTERESTS, LEVELS, SURVEY_VERSION, type Phase } from "@/lib/survey";
import { clusterTasks, type Cluster } from "@/lib/clusters.functions";

type Search = { s?: string | undefined; phase?: Phase | undefined };
type Row = { id: string; session_id: string; created_at: string; level: string | null; attitude: string | null; interests: string[]; task: string | null };

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
          .select("id,session_id,created_at,level:interaction_level,attitude:ai_attitude,interests:learning_interests,task:work_tasks")
          .eq("session_id", sess.id)
          .eq("phase", phase)
          .eq("survey_version", SURVEY_VERSION)
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
  const levels = LEVELS.map((o) => ({ ...o, n: rows.filter((r) => r.level === o.id).length }));
  const maxLevel = Math.max(1, ...levels.map((l) => l.n));
  const attitudes = ATTITUDES.map((o) => ({ ...o, n: rows.filter((r) => r.attitude === o.id).length }));
  const maxAtt = Math.max(1, ...attitudes.map((a) => a.n));
  const interests = INTERESTS.map((i) => ({ ...i, n: rows.filter((r) => r.interests?.includes(i.id)).length })).sort((a, b) => b.n - a.n);
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
  const [linkCopied, setLinkCopied] = useState(false);
  const participantUrl = () => {
    const params = new URLSearchParams({ s });
    if (phase === "after") params.set("phase", "after");
    return `${window.location.origin}/?${params.toString()}`;
  };
  const copyLink = async () => {
    await navigator.clipboard.writeText(participantUrl());
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };
  const downloadCsv = () => {
    const esc = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const header = ["response_id", "session_id", "session_slug", "phase", "created_at", "survey_version", "interaction_level", "ai_attitude", "learning_interests", "work_tasks"];
    const lines = rows.map((r) =>
      [r.id, r.session_id, s, phase, r.created_at, String(SURVEY_VERSION), r.level ?? "", r.attitude ?? "", (r.interests ?? []).join(";"), r.task ?? ""].map(esc).join(",")
    );
    const csv = "\uFEFF" + [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ai-map-${s}-${phase}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
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
            <>
              <button onClick={() => setQrOpen(true)} className="flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-lg font-semibold text-primary-foreground hover:opacity-90">
                <QrCode className="h-5 w-5" /> Показать QR-код
              </button>
              <button onClick={copyLink} className="flex items-center gap-2 rounded-full border-2 border-border px-5 py-3 text-lg font-semibold hover:bg-secondary">
                <Link2 className="h-5 w-5" /> {linkCopied ? "Скопировано" : "Скопировать ссылку участникам"}
              </button>
              <button onClick={downloadCsv} className="flex items-center gap-2 rounded-full border-2 border-border px-5 py-3 text-lg font-semibold hover:bg-secondary">
                <FileDown className="h-5 w-5" /> Скачать ответы CSV
              </button>
            </>
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
        <h2 className="text-3xl font-semibold">Где мы сейчас</h2>
        <p className="mt-2 text-xl text-muted-foreground">Как участники взаимодействуют с ИИ</p>
        <div className="relative mt-10 grid grid-cols-5 items-end gap-4">
          <span aria-hidden className="absolute inset-x-[10%] bottom-[4.5rem] h-1.5 rounded-full bg-border" />
          {levels.map((l, i) => {
            const d = 3 + (l.n / maxLevel) * 6; // rem
            return (
              <div key={l.id} className="relative flex flex-col items-center text-center" title={`${pct(l.n)}%`}>
                <span className="mb-3 font-display text-5xl font-bold tabular-nums">{l.n}</span>
                <div className="flex h-36 items-end">
                  <span className="rounded-full bg-primary transition-all duration-700"
                    style={{ width: `${d}rem`, height: `${d}rem`, opacity: l.n ? 0.35 + 0.65 * (l.n / maxLevel) : 0.12 }} />
                </div>
                <span className="mt-3 flex h-8 w-8 items-center justify-center rounded-full bg-foreground font-display text-sm font-bold text-background">{i + 1}</span>
                <span className="mt-2 text-xl font-semibold leading-tight">{l.short}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-16 rounded-[2rem] bg-secondary p-8">
        <h2 className="text-3xl font-semibold">Как мы относимся к ИИ</h2>
        <div className="mt-8 flex items-center gap-6">
          <span className="w-32 shrink-0 text-xl font-semibold text-muted-foreground">Не вижу смысла</span>
          <div className="relative flex flex-1 items-center justify-between">
            <span aria-hidden className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-border via-accent to-primary" />
            {attitudes.map((a) => {
              const d = 3.5 + (a.n / maxAtt) * 6;
              return (
                <div key={a.id} className="relative z-10 flex w-40 flex-col items-center" title={`${pct(a.n)}%`}>
                  <div className="flex h-40 items-center">
                    <span className="flex items-center justify-center rounded-full border-4 border-card bg-highlight shadow-md transition-all duration-700"
                      style={{ width: `${d}rem`, height: `${d}rem`, opacity: a.n ? 1 : 0.4 }}>
                      <span className="font-display text-3xl font-bold tabular-nums">{a.n}</span>
                    </span>
                  </div>
                  <span className="text-3xl">{a.emoji}</span>
                  <span className="mt-1 text-center text-lg font-semibold leading-tight">{a.short}</span>
                </div>
              );
            })}
          </div>
          <span className="w-24 shrink-0 text-right text-xl font-semibold text-muted-foreground">Обожаю</span>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-3xl font-semibold">Куда мы хотим двигаться</h2>
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
              <div className="mt-1 text-lg text-muted-foreground">{n} {people(n)}</div>
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
  const size = (n: number) => (max === min ? 16 : 14 + ((n - min) / (max - min)) * 8); // rem
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
