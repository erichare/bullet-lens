"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

import { useApp } from "@/lib/store";
import { loadAllDemoLands } from "@/lib/demo-loader";
import { DEFAULT_MATCHING_PAIR, DEMO_LANDS } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

/**
 * Loads all 12 Hamby 252 Barrel-1 lands (both bullets × 6 lands each) via
 * `/api/demo`, then drops the user into the merged compare view with A/B set
 * to our best-guess match. Users can swap A/B from the scans panel once all
 * lands are loaded to find the real match themselves.
 */
export default function DemoButton() {
  const { addScans, setMode, setError, setCompareLayout, setCompareFlipA, setCompareIndex } =
    useApp();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    setProgress({ done: 0, total: DEMO_LANDS.length });
    setError(null);
    try {
      const scans = await loadAllDemoLands((done, total) => {
        setProgress({ done, total });
      });
      if (scans.length < 2) {
        throw new Error("Demo loaded fewer than 2 lands");
      }
      addScans(scans);

      // Index of each default land inside the just-added batch.
      const aIdx = DEMO_LANDS.findIndex((l) => l.id === DEFAULT_MATCHING_PAIR.aId);
      const bIdx = DEMO_LANDS.findIndex((l) => l.id === DEFAULT_MATCHING_PAIR.bId);
      setCompareIndex("A", aIdx >= 0 ? aIdx : 0);
      setCompareIndex("B", bIdx >= 0 ? bIdx : 1);

      setMode("compare");
      setCompareLayout("merged");
      setCompareFlipA(true);
    } catch (err) {
      setError(
        `Could not load demo: ${(err as Error).message}. Check your network and try again.`,
      );
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const buttonLabel = (() => {
    if (!loading) return "Try a matching pair (demo)";
    if (progress) return `Fetching NBTRD demo… ${progress.done}/${progress.total}`;
    return "Fetching NBTRD demo…";
  })();

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={cn(
        "group relative inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-100 shadow-[0_0_40px_-12px_rgba(228,169,74,0.6)] transition",
        "hover:border-amber-300/60 hover:bg-amber-400/15 hover:text-amber-50",
        "disabled:cursor-wait disabled:opacity-70",
      )}
      aria-label="Load all 12 NIST NBTRD Hamby 252 lands and start comparing"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-amber-200" />
      ) : (
        <Sparkles className="h-4 w-4 text-amber-200 transition group-hover:text-amber-100" />
      )}
      <span>{buttonLabel}</span>
    </button>
  );
}

/** Small caption shown under the button explaining where the data comes from. */
export function DemoAttribution() {
  return (
    <p className="mt-2 max-w-md text-center text-[11px] leading-relaxed text-slate-500">
      Twelve lands from the{" "}
      <a
        href="https://tsapps.nist.gov/NRBTD/Studies/Search"
        target="_blank"
        rel="noreferrer noopener"
        className="underline decoration-slate-700 underline-offset-2 hover:text-slate-300"
      >
        NIST NBTRD
      </a>{" "}
      Hamby 252 study — Barrel 1, Bullets 1 &amp; 2 (6 lands each). Two are
      pre-selected as a likely match; swap any A/B pair from the scans panel
      to explore the rest.
    </p>
  );
}
