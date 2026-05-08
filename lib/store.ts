"use client";

import { create } from "zustand";
import type { X3pScan } from "./x3p";
import type { ColormapName } from "./colormap";
import type {
  GrooveDetectionCacheEntry,
  GrooveRegionsByScan,
} from "./grooves";
import { DEFAULT_API_BASE } from "./api";

export type ViewMode = "land" | "bullet" | "compare" | "model";
export type ViewPreset = "perspective" | "top" | "bottom" | "front" | "side";
export type CompareSlot = "A" | "B";
export type CompareLayout = "split" | "merged";

interface AppState {
  scans: X3pScan[];
  activeIndex: number;
  mode: ViewMode;
  colormap: ColormapName;
  /** Z exaggeration used for flat-land views (single-land and compare). */
  zExagLand: number;
  /** Z exaggeration used for the stitched-bullet view. */
  zExagBullet: number;
  showWireframe: boolean;
  crosscutY: number; // 0..1 fraction along Y
  landCoverage: number; // 0..1 — fraction of the circle each land occupies of its fair share
  highlightX: number | null; // 0..1 fraction along X (set by clicking the signature or 3D)
  compareIndexA: number;
  compareIndexB: number;
  compareLayout: CompareLayout;
  /**
   * Horizontal slide of B relative to A in merged (stacked) view, as a fraction
   * of B's width (-0.5..0.5). Used to dial in striae alignment across the seam.
   */
  compareOffset: number;
  compareFlipA: boolean; // whether to mirror A vertically (top-bottom flip) in merged view
  compareFlipB: boolean; // whether to mirror B vertically (top-bottom flip) in merged view
  flatten: boolean; // whether to detrend the crosscut signature (polynomial fit removed)
  grooveRegionsByScan: GrooveRegionsByScan;
  grooveRequestId: string | null;
  grooveLoading: boolean;
  grooveVisible: boolean;
  grooveCacheKey: string | null;
  grooveCache: Record<string, GrooveDetectionCacheEntry>;
  viewPreset: ViewPreset;
  viewResetTick: number; // incremented to retrigger transitions
  error: string | null;
  loading: boolean;
  apiBase: string;

  addScans: (scans: X3pScan[]) => void;
  removeScan: (idx: number) => void;
  clearScans: () => void;
  setActiveIndex: (i: number) => void;
  setMode: (m: ViewMode) => void;
  setColormap: (c: ColormapName) => void;
  setZExagLand: (v: number) => void;
  setZExagBullet: (v: number) => void;
  setShowWireframe: (v: boolean) => void;
  setCrosscutY: (v: number) => void;
  setLandCoverage: (v: number) => void;
  setHighlightX: (v: number | null) => void;
  setCompareIndex: (slot: CompareSlot, idx: number) => void;
  setCompareLayout: (v: CompareLayout) => void;
  setCompareOffset: (v: number) => void;
  setCompareFlipA: (v: boolean) => void;
  setCompareFlipB: (v: boolean) => void;
  setFlatten: (v: boolean) => void;
  setGrooveRegions: (
    regions: GrooveRegionsByScan,
    requestId?: string | null,
    cacheKey?: string | null,
  ) => void;
  setGrooveLoading: (v: boolean) => void;
  setGrooveVisible: (v: boolean) => void;
  showCachedGrooveRegions: (cacheKey: string) => boolean;
  setViewPreset: (v: ViewPreset) => void;
  setError: (e: string | null) => void;
  setLoading: (v: boolean) => void;
  setApiBase: (v: string) => void;
}

export const useApp = create<AppState>((set) => ({
  scans: [],
  activeIndex: 0,
  mode: "land",
  colormap: "cividis",
  zExagLand: 0.1,
  zExagBullet: 5,
  showWireframe: false,
  crosscutY: 0.5,
  landCoverage: 0.92,
  highlightX: null,
  compareIndexA: 0,
  compareIndexB: 1,
  compareLayout: "split",
  compareOffset: 0,
  compareFlipA: true,
  compareFlipB: false,
  flatten: false,
  grooveRegionsByScan: {},
  grooveRequestId: null,
  grooveLoading: false,
  grooveVisible: false,
  grooveCacheKey: null,
  grooveCache: {},
  viewPreset: "perspective",
  viewResetTick: 0,
  error: null,
  loading: false,
  apiBase: DEFAULT_API_BASE,

  addScans: (newScans) =>
    set((s) => ({
      scans: [...s.scans, ...newScans],
      mode: s.scans.length + newScans.length > 1 ? s.mode : "land",
      activeIndex: s.scans.length, // focus first of new batch
      highlightX: null,
      grooveRegionsByScan: {},
      grooveRequestId: null,
      grooveVisible: false,
      grooveCacheKey: null,
    })),
  removeScan: (idx) =>
    set((s) => {
      const next = s.scans.filter((_, i) => i !== idx);
      const nextNames = new Set(next.map((scan) => scan.name));
      const grooveRegionsByScan = Object.fromEntries(
        Object.entries(s.grooveRegionsByScan).filter(([name]) =>
          nextNames.has(name),
        ),
      );
      const nextMode =
        next.length < 2 && s.mode !== "land" ? "land" : s.mode;
      return {
        scans: next,
        activeIndex: Math.min(s.activeIndex, Math.max(0, next.length - 1)),
        mode: nextMode,
        grooveRegionsByScan,
        grooveVisible: false,
        grooveCacheKey: null,
      };
    }),
  clearScans: () =>
    set({
      scans: [],
      activeIndex: 0,
      mode: "land",
      error: null,
      grooveRegionsByScan: {},
      grooveRequestId: null,
      grooveLoading: false,
      grooveVisible: false,
      grooveCacheKey: null,
      grooveCache: {},
    }),
  setActiveIndex: (i) => set({ activeIndex: i }),
  setMode: (mode) => set({ mode }),
  setColormap: (colormap) => set({ colormap }),
  setZExagLand: (zExagLand) => set({ zExagLand }),
  setZExagBullet: (zExagBullet) => set({ zExagBullet }),
  setShowWireframe: (showWireframe) => set({ showWireframe }),
  setCrosscutY: (crosscutY) => set({ crosscutY }),
  setLandCoverage: (landCoverage) => set({ landCoverage }),
  setHighlightX: (highlightX) => set({ highlightX }),
  setCompareIndex: (slot, idx) =>
    set(() => (slot === "A" ? { compareIndexA: idx } : { compareIndexB: idx })),
  setCompareLayout: (compareLayout) => set({ compareLayout }),
  setCompareOffset: (compareOffset) => set({ compareOffset }),
  setCompareFlipA: (compareFlipA) => set({ compareFlipA }),
  setCompareFlipB: (compareFlipB) => set({ compareFlipB }),
  setFlatten: (flatten) => set({ flatten }),
  setGrooveRegions: (
    grooveRegionsByScan,
    grooveRequestId = null,
    grooveCacheKey = null,
  ) =>
    set((s) => ({
      grooveRegionsByScan,
      grooveRequestId,
      grooveVisible: true,
      grooveCacheKey,
      grooveCache: grooveCacheKey
        ? {
            ...s.grooveCache,
            [grooveCacheKey]: {
              regions: grooveRegionsByScan,
              requestId: grooveRequestId,
            },
          }
        : s.grooveCache,
    })),
  setGrooveLoading: (grooveLoading) => set({ grooveLoading }),
  setGrooveVisible: (grooveVisible) => set({ grooveVisible }),
  showCachedGrooveRegions: (grooveCacheKey) => {
    let found = false;
    set((s) => {
      const cached = s.grooveCache[grooveCacheKey];
      if (!cached) return {};
      found = true;
      return {
        grooveRegionsByScan: cached.regions,
        grooveRequestId: cached.requestId,
        grooveCacheKey,
        grooveVisible: true,
      };
    });
    return found;
  },
  setViewPreset: (viewPreset) =>
    set((s) => ({ viewPreset, viewResetTick: s.viewResetTick + 1 })),
  setError: (error) => set({ error }),
  setLoading: (loading) => set({ loading }),
  setApiBase: (apiBase) => set({ apiBase }),
}));
