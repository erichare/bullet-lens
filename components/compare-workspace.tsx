"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  FileJson,
  Images,
  Loader2,
} from "lucide-react";

import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

const DEFAULT_API_BASE =
  process.env.NEXT_PUBLIC_BULLET_COMPARE_API_BASE ||
  "https://bulletanalyzrresearch-production.up.railway.app";
const POLL_INTERVAL_MS = 900;
const STALE_JOB_WARNING_MS = 90_000;

type HealthResponse = {
  ok?: boolean;
  model?: {
    version?: string;
    model_loaded?: boolean;
  };
};

type CompareEvent = {
  state?: string;
  message?: string;
  stage?: string;
  progress?: number;
  at_utc?: string;
  detail?: unknown;
};

type JobStatus = {
  ok?: boolean;
  state?: "queued" | "running" | "complete" | "failed" | string;
  stage?: string;
  request_id?: string;
  job_id?: string;
  message?: string;
  progress?: number;
  detail?: unknown;
  events?: CompareEvent[];
  result?: CompareResult;
  error?: { message?: string } | string;
  created_at_utc?: string;
  updated_at_utc?: string;
};

type CompareResult = {
  request_id?: string;
  decision?: {
    match_probability?: number;
    is_match?: boolean;
    threshold?: number;
  };
  features?: Array<Record<string, unknown>> | Record<string, unknown>;
  artifacts?: Record<string, string>;
  algorithm?: unknown;
  model?: unknown;
  inputs?: unknown;
  details?: unknown;
  workspace?: unknown;
};

type TabId = "artifacts" | "features" | "provenance";

const tabs: Array<{ id: TabId; label: string; icon: ReactNode }> = [
  { id: "artifacts", label: "Images", icon: <Images className="h-3.5 w-3.5" /> },
  { id: "features", label: "Features", icon: <FileJson className="h-3.5 w-3.5" /> },
  {
    id: "provenance",
    label: "Provenance",
    icon: <Activity className="h-3.5 w-3.5" />,
  },
];

export default function CompareWorkspace() {
  const { scans, compareIndexA, compareIndexB } = useApp();
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState("{}");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [status, setStatus] = useState<JobStatus>({
    state: "idle",
    message: "Waiting for loaded evidence",
    progress: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("artifacts");
  const pollRef = useRef<number | null>(null);

  const evidence = useMemo(
    () => buildEvidence(scans, compareIndexA, compareIndexB),
    [scans, compareIndexA, compareIndexB],
  );
  const filesA = evidence.filesA;
  const filesB = evidence.filesB;

  useEffect(() => {
    if (busy || result) return;
    setStatus((current) => ({
      ...current,
      state: "idle",
      message:
        filesA.length && filesB.length
          ? "Ready to run model compare"
          : "Waiting for loaded evidence",
      progress: 0,
    }));
  }, [filesA.length, filesB.length, busy, result]);

  const normalizedApiBase = useMemo(
    () => apiBase.trim().replace(/\/+$/, ""),
    [apiBase],
  );

  const resolveApiUrl = useCallback(
    (path: string) => {
      if (/^https?:\/\//i.test(path)) return path;
      const base = normalizedApiBase || window.location.origin;
      return `${base}${path.startsWith("/") ? path : `/${path}`}`;
    },
    [normalizedApiBase],
  );

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      window.clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => clearPoll, [clearPoll]);

  const refreshHealth = useCallback(async () => {
    setHealthError(null);
    try {
      const response = await fetch(resolveApiUrl("/health"));
      const nextHealth = await readApiJson<HealthResponse>(response);
      if (nextHealth.ok === false) {
        throw new Error("API health check failed");
      }
      setHealth(nextHealth);
    } catch (err) {
      setHealth(null);
      setHealthError((err as Error).message || "API unavailable");
    }
  }, [resolveApiUrl]);

  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  const pollJob = useCallback(
    async (statusUrl: string) => {
      const response = await fetch(resolveApiUrl(statusUrl));
      const nextStatus = await readApiJson<JobStatus>(response);
      if (nextStatus.ok === false) {
        throw new Error(readError(nextStatus.error) || "Could not read job status");
      }

      setStatus(nextStatus);

      if (nextStatus.state === "complete") {
        setResult(nextStatus.result ?? null);
        setBusy(false);
        pollRef.current = null;
        return;
      }

      if (nextStatus.state === "failed") {
        throw new Error(readError(nextStatus.error) || "Comparison failed");
      }

      const staleMs = getStatusAgeMs(nextStatus);
      if (
        (nextStatus.state === "queued" || nextStatus.state === "running") &&
        staleMs !== null &&
        staleMs > STALE_JOB_WARNING_MS
      ) {
        const lastStage = nextStatus.stage || readLastEvent(nextStatus.events)?.stage;
        setError(
          `No API progress for ${formatDuration(staleMs)}${
            lastStage ? ` at ${lastStage}` : ""
          }. The job is still marked ${nextStatus.state}, so polling will continue.`,
        );
      } else {
        setError(null);
      }

      pollRef.current = window.setTimeout(() => {
        pollJob(statusUrl).catch((err) => {
          setError((err as Error).message);
          setBusy(false);
        });
      }, POLL_INTERVAL_MS);
    },
    [resolveApiUrl],
  );

  const startComparison = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!filesA.length || !filesB.length) {
      setError("Load at least two .x3p scans before running model compare.");
      return;
    }
    clearPoll();
    setBusy(true);
    setError(null);
    setResult(null);
    setActiveTab("artifacts");
    setStatus({
      state: "uploading",
      message: "Uploading files",
      progress: 0.03,
      events: [{ message: "Uploading files", at_utc: new Date().toISOString() }],
    });

    const data = new FormData();
    filesA.forEach((file) => data.append("bullet_a", file));
    filesB.forEach((file) => data.append("bullet_b", file));
    data.append("metadata", metadata || "{}");

    try {
      const response = await fetch(resolveApiUrl("/jobs"), {
        method: "POST",
        body: data,
        // Do not set Content-Type; the browser supplies the multipart boundary.
      });
      const job = await readApiJson<JobStatus & { status_url?: string }>(response);
      if (job.ok === false) {
        throw new Error(readError(job.error) || "Could not start comparison");
      }
      setStatus({
        state: job.state,
        request_id: job.request_id,
        job_id: job.job_id,
        message: "Comparison queued",
        progress: 0.05,
        events: [{ message: "Comparison queued", at_utc: new Date().toISOString() }],
      });
      await pollJob(job.status_url || `/jobs/${job.job_id || job.request_id}`);
    } catch (err) {
      setError((err as Error).message);
      setStatus((current) => ({
        ...current,
        state: "failed",
        message: (err as Error).message,
      }));
      setBusy(false);
    }
  };

  const probability = result?.decision?.match_probability;
  const hasProbability = typeof probability === "number" && !Number.isNaN(probability);
  const decisionText = result
    ? result.decision?.is_match === true
      ? "Above decision threshold"
      : result.decision?.is_match === false
        ? "Below decision threshold"
        : "No model score returned"
    : status.message || "Waiting for loaded evidence";
  const progress = Math.max(0, Math.min(1, Number(status.progress || 0)));
  const canSubmit = filesA.length > 0 && filesB.length > 0 && !busy;

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid w-full max-w-[1480px] gap-4 px-4 py-5 lg:px-6">
        <section className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-[#0d0906]/55 p-4 backdrop-blur md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-300">
              Forensic model service
            </div>
            <h1 className="font-serif text-4xl leading-none tracking-tight text-[color:var(--ink)] sm:text-5xl">
              Model compare
            </h1>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              {healthError
                ? "API unavailable"
                : health?.model?.model_loaded
                  ? `Model ${health.model.version || "loaded"}`
                  : "Feature extraction only"}
            </p>
          </div>

          <div className="grid gap-2 sm:min-w-[360px]">
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="compareApiBase">
                Comparison API
              </label>
              <input
                id="compareApiBase"
                value={apiBase}
                onChange={(event) => setApiBase(event.target.value)}
                onBlur={refreshHealth}
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-amber-400/45 focus:ring-4 focus:ring-amber-400/10"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={refreshHealth}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.07]"
              >
                Check
              </button>
            </div>
            <div
              className={cn(
                "flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold",
                health?.ok
                  ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
                  : "border-rose-300/25 bg-rose-400/10 text-rose-100",
              )}
            >
              {health?.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5" />
              )}
              {health?.ok ? "Ready" : healthError || "Checking"}
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]">
          <form
            onSubmit={startComparison}
            className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-black/25 backdrop-blur lg:sticky lg:top-4 lg:self-start"
          >
            <div className="grid gap-1 px-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                    Loaded evidence
                  </span>
                  <strong className="mt-1 block text-lg leading-tight text-slate-100">
                    Two comparison sets
                  </strong>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-slate-500">
                {evidence.strategy}
              </p>
            </div>

            <EvidenceSet
              label="Bullet A"
              files={filesA}
              accent="amber"
            />
            <EvidenceSet
              label="Bullet B"
              files={filesB}
              accent="emerald"
            />

            {evidence.warning && (
              <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-100/90">
                {evidence.warning}
              </div>
            )}

            <label className="grid gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                Case metadata
              </span>
              <textarea
                rows={5}
                value={metadata}
                onChange={(event) => setMetadata(event.target.value)}
                spellCheck={false}
                className="min-h-28 resize-y rounded-2xl border border-white/10 bg-[#0d0906]/55 px-3 py-3 font-mono text-xs leading-relaxed text-slate-200 outline-none transition focus:border-amber-400/45 focus:ring-4 focus:ring-amber-400/10"
              />
            </label>

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-1 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-amber-300/50 bg-gradient-to-br from-[#f2c066] to-[#d9912f] px-4 py-3 text-sm font-bold text-[#17130e] shadow-lg shadow-amber-500/10 transition hover:border-amber-200/80 hover:shadow-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Comparison running" : "Run model compare"}
            </button>
          </form>

          <section className="min-h-[700px] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/25 backdrop-blur">
            <div className="border-b border-white/10 bg-[#0d0906]/35 p-5">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                Match probability
              </span>
              <strong
                className={cn(
                  "mt-2 block w-fit text-6xl font-black leading-none tracking-normal sm:text-8xl",
                  hasProbability
                    ? "bg-gradient-to-br from-[#fff0bd] via-[#e4a94a] to-[#cc7e27] bg-clip-text text-transparent"
                    : "text-slate-600",
                )}
              >
                {formatProbability(probability)}
              </strong>
              <p className="mt-2 text-sm font-semibold text-slate-400">
                {error || decisionText}
              </p>
            </div>

            <div className="grid border-b border-white/10 md:grid-cols-3">
              <Metric label="Request" value={result?.request_id || status.request_id || "--"} />
              <Metric
                label="Threshold"
                value={
                  typeof result?.decision?.threshold === "number"
                    ? result.decision.threshold.toFixed(3)
                    : "--"
                }
              />
              <Metric label="Coverage" value={readCoverage(result?.features)} />
            </div>

            <section className="grid gap-3 border-b border-white/10 bg-[#0d0906]/32 p-5">
              <div className="flex items-center justify-between gap-4">
                <span className="font-bold text-slate-100">
                  {status.message || "Idle"}
                </span>
                <strong className="font-mono text-xs text-[color:var(--muted)]">
                  {Math.round(progress * 100)}%
                </strong>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[color:var(--accent-emerald)] to-[color:var(--accent)] shadow-[0_0_28px_rgba(228,169,74,0.35)] transition-[width] duration-200"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <ol className="grid gap-2">
                {(status.events || []).slice(-6).map((item, index, events) => (
                  <li
                    key={`${item.message || item.stage}-${index}`}
                    className={cn(
                      "grid grid-cols-[10px_minmax(0,1fr)_auto] items-baseline gap-2 text-sm text-[color:var(--muted)]",
                      index === events.length - 1 &&
                        status.state !== "complete" &&
                        "font-semibold text-slate-100",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 rounded-full bg-white/20",
                        index === events.length - 1 &&
                          status.state !== "complete" &&
                          "bg-amber-400 shadow-[0_0_0_5px_rgba(228,169,74,0.14)]",
                      )}
                    />
                    <span className="min-w-0 truncate">
                      {item.message || item.stage || "Working"}
                    </span>
                    <time className="font-mono text-xs text-slate-500">
                      {formatEventTime(item.at_utc)}
                    </time>
                  </li>
                ))}
              </ol>
            </section>

            <nav className="flex overflow-x-auto border-b border-white/10 bg-[#0d0906]/42">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 border-r border-white/10 px-4 py-3 text-sm font-semibold transition",
                    activeTab === tab.id
                      ? "bg-white/[0.06] text-slate-100"
                      : "text-[color:var(--muted)] hover:bg-white/[0.035] hover:text-slate-200",
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="p-4">
              {activeTab === "artifacts" && (
                <ArtifactGrid artifacts={result?.artifacts} resolveUrl={resolveApiUrl} />
              )}
              {activeTab === "features" && (
                <JsonPanel value={result?.features || {}} empty={!result} />
              )}
              {activeTab === "provenance" && (
                <JsonPanel
                  empty={!result}
                  value={{
                    algorithm: result?.algorithm,
                    model: result?.model,
                    inputs: result?.inputs,
                    details: result?.details,
                    workspace: result?.workspace,
                  }}
                />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function EvidenceSet({
  label,
  files,
  accent,
}: {
  label: string;
  files: File[];
  accent: "amber" | "emerald";
}) {
  return (
    <section
      className={cn(
        "relative grid min-h-28 content-start gap-2 overflow-hidden rounded-2xl border bg-white/[0.018] p-4",
        accent === "amber" &&
          "bg-[linear-gradient(135deg,rgba(228,169,74,0.04),rgba(133,169,145,0.02))]",
        accent === "emerald" &&
          "bg-[linear-gradient(135deg,rgba(133,169,145,0.04),rgba(228,169,74,0.02))]",
        files.length
          ? "border-white/15"
          : "border-dashed border-amber-400/25",
      )}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
        {label}
      </span>
      <strong className="text-xl leading-tight text-slate-100">
        {files.length ? `${files.length} file${files.length === 1 ? "" : "s"}` : "No loaded files"}
      </strong>
      {files.length ? (
        <ul className="max-h-28 space-y-1 overflow-y-auto pr-1 text-xs text-slate-400">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="truncate font-mono" title={file.name}>
              {file.name}
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-xs leading-relaxed text-slate-500">
          Load scans in the main viewer, then assign A/B from Visual compare if
          filenames do not identify Bullet 1 and Bullet 2.
        </span>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1 border-white/10 bg-[#0d0906]/18 p-4 md:border-r md:last:border-r-0">
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--muted)]">
        {label}
      </span>
      <strong className="[overflow-wrap:anywhere] font-mono text-sm text-slate-100">
        {value}
      </strong>
    </div>
  );
}

function ArtifactGrid({
  artifacts,
  resolveUrl,
}: {
  artifacts?: Record<string, string>;
  resolveUrl: (path: string) => string;
}) {
  const entries = Object.entries(artifacts || {});

  if (!entries.length) {
    return (
      <EmptyState
        title="No images yet"
        body="Run a comparison to see aligned surfaces, signatures, and model artifacts."
      />
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {entries.map(([key, url]) => (
        <article
          key={key}
          className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d0906]/38"
        >
          <h2 className="border-b border-white/10 px-3 py-2 text-sm font-semibold capitalize text-slate-200">
            {key.replaceAll("_", " ")}
          </h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveUrl(url)}
            alt={key.replaceAll("_", " ")}
            className="block h-auto w-full bg-[#f4efe3]"
          />
        </article>
      ))}
    </div>
  );
}

function JsonPanel({ value, empty }: { value: unknown; empty?: boolean }) {
  if (empty) {
    return (
      <EmptyState
        title="No data yet"
        body="Feature and provenance JSON will appear after the API returns a result."
      />
    );
  }

  return (
    <pre className="max-h-[560px] overflow-auto rounded-2xl border border-white/10 bg-[#0d0906]/45 p-4 font-mono text-xs leading-relaxed text-slate-300">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
      <div>
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-amber-200">
          <Images className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <p className="mt-1 max-w-sm text-sm text-slate-500">{body}</p>
      </div>
    </div>
  );
}

function formatProbability(value: unknown) {
  if (typeof value !== "number" || Number.isNaN(value)) return "--";
  return `${Math.round(value * 1000) / 10}%`;
}

function buildEvidence(
  scans: ReturnType<typeof useApp.getState>["scans"],
  compareIndexA: number,
  compareIndexB: number,
): {
  filesA: File[];
  filesB: File[];
  strategy: string;
  warning?: string;
} {
  const withFiles = scans
    .map((scan, index) => ({ scan, index, file: scan.sourceFile }))
    .filter((item): item is { scan: typeof scans[number]; index: number; file: File } =>
      Boolean(item.file),
    );

  const groupedA = withFiles
    .filter(({ scan }) => inferBulletNumber(scan.name) === 1)
    .map(({ file }) => file);
  const groupedB = withFiles
    .filter(({ scan }) => inferBulletNumber(scan.name) === 2)
    .map(({ file }) => file);

  if (groupedA.length && groupedB.length) {
    return {
      filesA: groupedA,
      filesB: groupedB,
      strategy: "Using loaded scans grouped by Bullet 1 and Bullet 2 filenames.",
    };
  }

  const slotA = withFiles.find(({ index }) => index === compareIndexA)?.file;
  const slotB = withFiles.find(({ index }) => index === compareIndexB)?.file;
  if (slotA && slotB && compareIndexA !== compareIndexB) {
    return {
      filesA: [slotA],
      filesB: [slotB],
      strategy: "Using the current A/B selections from Visual compare.",
      warning:
        "Could not infer full bullet bundles from filenames, so Model compare will submit the selected A/B lands only.",
    };
  }

  return {
    filesA: [],
    filesB: [],
    strategy: "Load at least two scans before running Model compare.",
    warning:
      "Loaded scans must retain their original File objects. Re-add the scans if this session was restored from derived data.",
  };
}

function inferBulletNumber(name: string): 1 | 2 | null {
  if (/(^|[^a-z0-9])bullet[_\s-]*1([^0-9]|$)/i.test(name)) return 1;
  if (/(^|[^a-z0-9])bullet[_\s-]*2([^0-9]|$)/i.test(name)) return 2;
  if (/(^|[^a-z0-9])b[_\s-]*1([^0-9]|$)/i.test(name)) return 1;
  if (/(^|[^a-z0-9])b[_\s-]*2([^0-9]|$)/i.test(name)) return 2;
  return null;
}

function readCoverage(features: CompareResult["features"] | undefined) {
  if (Array.isArray(features)) {
    const coverage = features[0]?.overlap_lands;
    return typeof coverage === "number" || typeof coverage === "string"
      ? coverage
      : "--";
  }
  if (features && typeof features === "object" && "overlap_lands" in features) {
    const coverage = features.overlap_lands;
    return typeof coverage === "number" || typeof coverage === "string"
      ? coverage
      : "--";
  }
  return "--";
}

function readError(error: JobStatus["error"]) {
  if (!error) return null;
  return typeof error === "string" ? error : error.message || null;
}

async function readApiJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `${response.status} ${response.statusText}`);
  }
  try {
    return JSON.parse(text || "{}") as T;
  } catch {
    throw new Error(`API returned invalid JSON: ${text.slice(0, 160)}`);
  }
}

function readLastEvent(events: CompareEvent[] | undefined) {
  return events?.[events.length - 1];
}

function getStatusAgeMs(status: JobStatus) {
  const timestamp = status.updated_at_utc || readLastEvent(status.events)?.at_utc;
  const updatedAt = parseApiTime(timestamp);
  if (!updatedAt) return null;
  return Date.now() - updatedAt.getTime();
}

function parseApiTime(value?: string) {
  if (!value) return null;
  const parsed = value.includes(" UTC") ? value.replace(" UTC", "Z") : value;
  const date = new Date(parsed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function formatEventTime(value?: string) {
  const date = parseApiTime(value);
  if (!date) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
