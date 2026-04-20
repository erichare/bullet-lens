"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";

import { useApp } from "@/lib/store";
import { loadDemoMatchingPair } from "@/lib/demo-loader";
import { DEMO_MATCHING_PAIR } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

/**
 * Fetches the two known-match Hamby 252 lands via /api/demo, then drops them
 * straight into the compare view. Gives new users a one-click way to see the
 * app without hunting for `.x3p` files.
 */
export default function DemoButton() {
  const { addScans, setMode, setError, setCompareLayout, setCompareFlipA } =
    useApp();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const scans = await loadDemoMatchingPair();
      if (scans.length < 2) {
        throw new Error("Demo loaded fewer than 2 lands");
      }
      addScans(scans);
      // Merged compare view with A flipped is the canonical setup for viewing
      // two matching lands across a seam.
      setMode("compare");
      setCompareLayout("merged");
      setCompareFlipA(true);
    } catch (err) {
      setError(
        `Could not load demo: ${(err as Error).message}. Check your network and try again.`,
      );
    } finally {
      setLoading(false);
    }
  };

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
      aria-label="Load a matching pair of bullet lands from the NIST NBTRD"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-amber-200" />
      ) : (
        <Sparkles className="h-4 w-4 text-amber-200 transition group-hover:text-amber-100" />
      )}
      <span>
        {loading ? "Fetching NBTRD demo…" : "Try a matching pair (demo)"}
      </span>
    </button>
  );
}

/** Small caption shown under the button explaining where the data comes from. */
export function DemoAttribution() {
  return (
    <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500">
      Two lands from the{" "}
      <a
        href="https://tsapps.nist.gov/NRBTD/Studies/Search"
        target="_blank"
        rel="noreferrer noopener"
        className="underline decoration-slate-700 underline-offset-2 hover:text-slate-300"
      >
        NIST NBTRD
      </a>{" "}
      Hamby 252 study — Barrel 1, Bullets 1 &amp; 2 (Land 2 on each).
      <span className="sr-only">
        {DEMO_MATCHING_PAIR.map((l) => l.label).join(" and ")}
      </span>
    </p>
  );
}
