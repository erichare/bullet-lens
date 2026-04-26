"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  Layers,
  Box,
  AlertCircle,
  Columns2,
  FlipHorizontal2,
} from "lucide-react";
import dynamic from "next/dynamic";

import { useApp } from "@/lib/store";
import CompareWorkspace from "./compare-workspace";
import DropZone from "./drop-zone";
import MetadataPanel from "./metadata-panel";
import CrosscutPlot from "./crosscut-plot";
import LearnPanel from "./learn-panel";
import ScaleOverlay from "./scale-overlay";
import WelcomeIntro from "./welcome-intro";
import { ViewPresetsToolbar } from "./view-presets";
import { cn } from "@/lib/utils";

const LandViewer = dynamic(() => import("./land-viewer"), { ssr: false });
const BulletViewer = dynamic(() => import("./bullet-viewer"), { ssr: false });
const MergedCompareViewer = dynamic(() => import("./merged-compare-viewer"), {
  ssr: false,
});

export default function AppShell() {
  const {
    scans,
    activeIndex,
    mode,
    colormap,
    zExagLand,
    zExagBullet,
    showWireframe,
    crosscutY,
    landCoverage,
    compareIndexA,
    compareIndexB,
    compareLayout,
    compareOffset,
    compareFlipA,
    compareFlipB,
    error,
    setError,
  } = useApp();

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error, setError]);

  const active = scans[activeIndex];
  const hasAny = scans.length > 0;
  // Clamp compare indices to valid range
  const safeA = Math.min(Math.max(0, compareIndexA), Math.max(0, scans.length - 1));
  const safeB = Math.min(Math.max(0, compareIndexB), Math.max(0, scans.length - 1));
  const scanA = scans[safeA];
  const scanB = scans[safeB];

  return (
    <div className="relative flex h-dvh w-screen flex-col bg-[#17130e] text-slate-100">
      <TopBar />

      {mode === "model" ? (
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <ViewerModeBar />
          <CompareWorkspace />
        </main>
      ) : !hasAny ? (
        <main className="relative flex flex-1 flex-col overflow-y-auto">
          <BackgroundOrbs />
          <div className="relative z-10 m-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 py-8">
            <WelcomeIntro />
            <DropZone />
          </div>
        </main>
      ) : (
        <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          <div className="relative flex min-w-0 flex-1 flex-col">
            <ViewerModeBar showFileActions />

            <div className="relative h-[52svh] min-h-[340px] shrink-0 sm:h-[58svh] lg:min-h-0 lg:flex-1">
              {mode === "land" && active && (
                <>
                  <LandViewer
                    scan={active}
                    colormap={colormap}
                    zExaggeration={zExagLand}
                    showWireframe={showWireframe}
                    crosscutY={crosscutY}
                  />
                  <ScaleOverlay scan={active} />
                  <AxesLegend />
                  <div className="pointer-events-none absolute bottom-3 right-3 z-10 sm:bottom-4 sm:right-4">
                    <ViewPresetsToolbar />
                  </div>
                </>
              )}
              {mode === "bullet" && (
                <>
                  <BulletViewer
                    scans={scans}
                    colormap={colormap}
                    zExaggeration={zExagBullet}
                    showWireframe={showWireframe}
                    landCoverage={landCoverage}
                  />
                  <BulletViewLegend count={scans.length} />
                  <div className="pointer-events-none absolute bottom-3 right-3 z-10 sm:bottom-4 sm:right-4">
                    <ViewPresetsToolbar />
                  </div>
                </>
              )}
              {mode === "compare" && scanA && scanB && compareLayout === "split" && (
                <div className="flex h-full w-full flex-col sm:flex-row">
                  <div className="relative min-h-0 min-w-0 flex-1 border-b border-white/10 sm:border-b-0 sm:border-r">
                    <LandViewer
                      scan={scanA}
                      colormap={colormap}
                      zExaggeration={zExagLand}
                      showWireframe={showWireframe}
                      crosscutY={crosscutY}
                    />
                    <CompareLabel slot="A" name={scanA.name} />
                    <ScaleOverlay scan={scanA} />
                  </div>
                  <div className="relative min-w-0 flex-1">
                    <LandViewer
                      scan={scanB}
                      colormap={colormap}
                      zExaggeration={zExagLand}
                      showWireframe={showWireframe}
                      crosscutY={crosscutY}
                    />
                    <CompareLabel slot="B" name={scanB.name} />
                    <ScaleOverlay scan={scanB} />
                  </div>
                  <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 sm:bottom-4">
                    <ViewPresetsToolbar />
                  </div>
                </div>
              )}
              {mode === "compare" && scanA && scanB && compareLayout === "merged" && (
                <div className="relative h-full w-full">
                  <MergedCompareViewer
                    scanA={scanA}
                    scanB={scanB}
                    colormap={colormap}
                    zExaggeration={zExagLand}
                    showWireframe={showWireframe}
                    crosscutY={crosscutY}
                    xOffset={compareOffset}
                    flipA={compareFlipA}
                    flipB={compareFlipB}
                  />
                  <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 flex min-w-0 items-center gap-2 sm:left-4 sm:right-auto sm:top-4">
                    <CompareLabel slot="A" name={scanA.name} inline />
                    <CompareLabel slot="B" name={scanB.name} inline />
                  </div>
                  <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 sm:bottom-4">
                    <ViewPresetsToolbar />
                  </div>
                </div>
              )}
            </div>

            {mode === "land" && active && (
              <div className="h-44 shrink-0 border-t border-white/5 bg-[#0d0906]/60 p-2 backdrop-blur sm:h-48">
                <div className="px-3 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Crosscut signature
                </div>
                <div className="h-[calc(100%-22px)]">
                  <CrosscutPlot
                    scan={active}
                    yFrac={crosscutY}
                    colormap={colormap}
                  />
                </div>
              </div>
            )}

            {mode === "compare" && scanA && scanB && (
              <div className="flex h-[28rem] shrink-0 flex-col border-t border-white/5 bg-[#0d0906]/60 p-2 backdrop-blur sm:h-56 sm:flex-row">
                <div className="relative min-h-0 min-w-0 flex-1 border-b border-white/10 pb-1 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-1">
                  <div className="px-3 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                    <span className="mr-1.5 rounded bg-amber-400 px-1 py-0.5 text-[9px] font-bold text-[#17130e]">
                      A
                    </span>
                    Crosscut signature
                  </div>
                  <div className="h-[calc(100%-22px)]">
                    <CrosscutPlot
                      scan={scanA}
                      yFrac={crosscutY}
                      colormap={colormap}
                    />
                  </div>
                </div>
                <div className="relative min-h-0 min-w-0 flex-1 pt-1 sm:pl-1 sm:pt-0">
                  <div className="px-3 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/80">
                    <span className="mr-1.5 rounded bg-amber-400 px-1 py-0.5 text-[9px] font-bold text-[#17130e]">
                      B
                    </span>
                    Crosscut signature
                  </div>
                  <div className="h-[calc(100%-22px)]">
                    <CrosscutPlot
                      scan={scanB}
                      yFrac={crosscutY}
                      colormap={colormap}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <MetadataPanel />
        </main>
      )}

      {error && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-6 mx-auto flex w-fit items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100 shadow-xl backdrop-blur">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  );
}

function TopBar() {
  const { clearScans, scans } = useApp();
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-[#0d0906]/80 px-3 py-3 backdrop-blur sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <svg
          width="30"
          height="30"
          viewBox="0 0 30 30"
          className="shrink-0"
          aria-hidden
        >
          <defs>
            <radialGradient id="logo-g" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f3c775" />
              <stop offset="60%" stopColor="#c98c33" />
              <stop offset="100%" stopColor="#7a4f12" />
            </radialGradient>
          </defs>
          {[2.5, 5.5, 8.5, 11.5].map((r, i) => (
            <circle
              key={i}
              cx="15"
              cy="15"
              r={r}
              fill="none"
              stroke="url(#logo-g)"
              strokeOpacity={0.85 - i * 0.12}
              strokeWidth={0.9}
            />
          ))}
          <circle cx="15" cy="15" r="1.4" fill="#f3c775" />
        </svg>
        <div className="min-w-0">
          <div className="truncate font-serif text-[17px] leading-none tracking-tight text-[color:var(--ink)]">
            Bullet Lens
          </div>
          <div className="mt-1 hidden text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted)] min-[360px]:block">
            x3p topography viewer
          </div>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:flex-none">
        <LearnPanel />
        {scans.length > 0 && (
          <button
            onClick={clearScans}
            className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs text-slate-300 transition hover:border-white/20 hover:bg-white/[0.05]"
          >
            Clear all
          </button>
        )}
      </div>
    </header>
  );
}

function ViewerModeBar({ showFileActions = false }: { showFileActions?: boolean }) {
  const {
    scans,
    mode,
    setMode,
    compareLayout,
    setCompareLayout,
    compareOffset,
    setCompareOffset,
    compareFlipA,
    setCompareFlipA,
    compareFlipB,
    setCompareFlipB,
  } = useApp();
  const canBullet = scans.length >= 2;
  const canCompare = scans.length >= 2;

  return (
    <div className="relative z-10 flex flex-col gap-2 border-b border-white/5 bg-[#0d0906]/60 px-3 py-2 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div className="flex w-full min-w-0 items-center gap-1 overflow-x-auto rounded-xl border border-white/5 bg-white/[0.02] p-1 sm:w-auto">
        <ModeButton
          active={mode === "land"}
          onClick={() => setMode("land")}
          icon={<Layers className="h-3.5 w-3.5" />}
          label="Single land"
        />
        {canBullet && (
          <ModeButton
            active={mode === "bullet"}
            onClick={() => setMode("bullet")}
            icon={<Box className="h-3.5 w-3.5" />}
            label={`Bullet (${scans.length})`}
          />
        )}
        {canCompare && (
          <>
            <ModeButton
              active={mode === "compare"}
              onClick={() => setMode("compare")}
              icon={<Columns2 className="h-3.5 w-3.5" />}
              label="Visual compare"
            />
            <ModeButton
              active={mode === "model"}
              onClick={() => setMode("model")}
              icon={<Activity className="h-3.5 w-3.5" />}
              label="Model compare"
            />
          </>
        )}
      </div>
      {showFileActions && (
        <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-end">
          {mode === "compare" && canCompare && (
            <CompareLayoutBar
              layout={compareLayout}
              setLayout={setCompareLayout}
              flipA={compareFlipA}
              setFlipA={setCompareFlipA}
              flipB={compareFlipB}
              setFlipB={setCompareFlipB}
              offset={compareOffset}
              setOffset={setCompareOffset}
            />
          )}
          <DropZone compact />
        </div>
      )}
    </div>
  );
}

function AxesLegend() {
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-10 hidden max-w-[calc(100%-1.5rem)] rounded-xl border border-white/10 bg-[#0d0906]/70 px-3 py-2 text-[11px] text-slate-300 backdrop-blur min-[420px]:block sm:right-4 sm:top-4">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Axes
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
        X - along the land (≈ mm)
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
        Y - along the bullet (≈ mm)
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-orange-300" />
        Z - surface height (≈ µm)
      </div>
    </div>
  );
}

function CompareLabel({
  slot,
  name,
  inline,
}: {
  slot: "A" | "B";
  name: string;
  inline?: boolean;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none z-10 flex min-w-0 max-w-xs items-center gap-2 rounded-xl border border-white/10 bg-[#0d0906]/80 px-3 py-1.5 text-[11px] text-slate-200 backdrop-blur",
        !inline && "absolute left-4 top-4",
      )}
    >
      <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-[#17130e]">
        {slot}
      </span>
      <span className="truncate font-mono text-[11px] text-slate-300" title={name}>
        {name}
      </span>
    </div>
  );
}

function CompareLayoutBar({
  layout,
  setLayout,
  flipA,
  setFlipA,
  flipB,
  setFlipB,
  offset,
  setOffset,
}: {
  layout: "split" | "merged";
  setLayout: (v: "split" | "merged") => void;
  flipA: boolean;
  setFlipA: (v: boolean) => void;
  flipB: boolean;
  setFlipB: (v: boolean) => void;
  offset: number;
  setOffset: (v: number) => void;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:flex-nowrap sm:overflow-x-auto">
      <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5 text-[11px]">
        <button
          onClick={() => setLayout("split")}
          className={cn(
            "rounded-md px-2 py-1 transition",
            layout === "split"
              ? "bg-white/10 text-slate-100"
              : "text-slate-400 hover:text-slate-200",
          )}
        >
          Split
        </button>
        <button
          onClick={() => setLayout("merged")}
          className={cn(
            "rounded-md px-2 py-1 transition",
            layout === "merged"
              ? "bg-white/10 text-slate-100"
              : "text-slate-400 hover:text-slate-200",
          )}
        >
          Merged
        </button>
      </div>
      {layout === "merged" && (
        <>
          <button
            onClick={() => setFlipA(!flipA)}
            className={cn(
              "flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] transition",
              flipA
                ? "border-amber-400/40 bg-amber-400/10 text-amber-100"
                : "border-white/10 bg-white/[0.03] text-slate-300 hover:text-slate-100",
            )}
            title="Flip A vertically (top-bottom mirror)"
          >
            <FlipHorizontal2 className="h-3 w-3 rotate-90" />
            Flip A
          </button>
          <button
            onClick={() => setFlipB(!flipB)}
            className={cn(
              "flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] transition",
              flipB
                ? "border-amber-400/40 bg-amber-400/10 text-amber-100"
                : "border-white/10 bg-white/[0.03] text-slate-300 hover:text-slate-100",
            )}
            title="Flip B vertically (top-bottom mirror)"
          >
            <FlipHorizontal2 className="h-3 w-3 rotate-90" />
            Flip B
          </button>
          <div className="flex min-w-[9rem] flex-1 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 sm:min-w-0 sm:flex-none">
            <label className="hidden text-[10px] uppercase tracking-wider text-slate-500 min-[420px]:block">
              B&nbsp;slide
            </label>
            <input
              type="range"
              min={-0.5}
              max={0.5}
              step={0.005}
              value={offset}
              onChange={(e) => setOffset(Number(e.target.value))}
              className="h-1 min-w-16 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-amber-400 sm:w-28 sm:flex-none"
              title="Slide B left/right to align striae across the seam"
            />
            <span className="w-10 text-right font-mono text-[10px] text-slate-300">
              {(offset * 100).toFixed(0)}%
            </span>
            {offset !== 0 && (
              <button
                onClick={() => setOffset(0)}
                className="text-[10px] text-slate-500 hover:text-slate-300"
                title="Reset slide"
              >
                ×
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function BulletViewLegend({ count }: { count: number }) {
  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[calc(100%-1.5rem)] rounded-xl border border-white/10 bg-[#0d0906]/70 px-3 py-2 text-[11px] text-slate-300 backdrop-blur sm:left-4 sm:top-4 sm:max-w-xs">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Stitched bullet
      </div>
      <div className="leading-relaxed text-slate-300">
        {count} land{count === 1 ? "" : "s"}{" "}arranged around a virtual barrel.
        Gaps between lands represent where the barrel&apos;s lands left
        recessed grooves.
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  disabled,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition",
        active
          ? "bg-white/10 text-slate-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
          : "text-slate-400 hover:text-slate-200",
        disabled && "cursor-not-allowed opacity-40 hover:text-slate-400",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function BackgroundOrbs() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-40"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <radialGradient id="topoGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(228, 169, 74, 0.12)" />
          <stop offset="70%" stopColor="rgba(228, 169, 74, 0)" />
        </radialGradient>
        <radialGradient id="topoGlow2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(106, 165, 138, 0.10)" />
          <stop offset="70%" stopColor="rgba(106, 165, 138, 0)" />
        </radialGradient>
      </defs>
      <rect x="-15%" y="-10%" width="60%" height="80%" fill="url(#topoGlow)" />
      <rect x="55%" y="30%" width="60%" height="80%" fill="url(#topoGlow2)" />
      {[...Array(14)].map((_, i) => (
        <ellipse
          key={i}
          cx="50%"
          cy="52%"
          rx={`${50 + i * 18}`}
          ry={`${30 + i * 11}`}
          fill="none"
          stroke="rgba(234, 225, 206, 0.035)"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}
