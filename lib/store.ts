"use client";

import { create } from "zustand";
import type { X3pScan } from "./x3p";
import type { ColormapName } from "./colormap";

export type ViewMode = "land" | "bullet" | "compare";
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
  viewPreset: ViewPreset;
  viewResetTick: number; // incremented to retrigger transitions
  error: string | null;
  loading: boolean;

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
  setViewPreset: (v: ViewPreset) => void;
  setError: (e: string | null) => void;
  setLoading: (v: boolean) => void;
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
  viewPreset: "perspective",
  viewResetTick: 0,
  error: null,
  loading: false,

  addScans: (newScans) =>
    set((s) => ({
      scans: [...s.scans, ...newScans],
      mode: s.scans.length + newScans.length > 1 ? s.mode : "land",
      activeIndex: s.scans.length, // focus first of new batch
      highlightX: null,
    })),
  removeScan: (idx) =>
    set((s) => {
      const next = s.scans.filter((_, i) => i !== idx);
      return {
        scans: next,
        activeIndex: Math.min(s.activeIndex, Math.max(0, next.length - 1)),
      };
    }),
  clearScans: () => set({ scans: [], activeIndex: 0, error: null }),
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
  setViewPreset: (viewPreset) =>
    set((s) => ({ viewPreset, viewResetTick: s.viewResetTick + 1 })),
  setError: (error) => set({ error }),
  setLoading: (loading) => set({ loading }),
}));
