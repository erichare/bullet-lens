"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Layers, Waves } from "lucide-react";
import type { X3pScan } from "@/lib/x3p";
import { extractCrosscut } from "@/lib/geometry";
import { sampleColor, type ColormapName } from "@/lib/colormap";
import { flattenSignature } from "@/lib/flatten";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  buildGrooveCacheKey,
  extractGrooveRegions,
  grooveRegionToDisplayRect,
  grooveRequestId,
  requestGrooveDetection,
} from "@/lib/grooves";
import {
  FULL_SIGNATURE_RANGE,
  MIN_SIGNATURE_RANGE_WIDTH,
  clampSignatureFraction,
  clampSignatureRange,
  fractionInSignatureRange,
  sliceSignatureRange,
  type SignatureRange,
} from "@/lib/signature-range";

interface Props {
  scan: X3pScan;
  yFrac: number;
  colormap: ColormapName;
}

type RangeDragState = {
  edge: "left" | "right";
  pointerId: number;
};

const HANDLE_HIT_PX = 10;

export default function CrosscutPlot({ scan, yFrac, colormap }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const highlightX = useApp((s) => s.highlightX);
  const setHighlightX = useApp((s) => s.setHighlightX);
  const flatten = useApp((s) => s.flatten);
  const setFlatten = useApp((s) => s.setFlatten);
  const scans = useApp((s) => s.scans);
  const setError = useApp((s) => s.setError);
  const grooveLoading = useApp((s) => s.grooveLoading);
  const setGrooveLoading = useApp((s) => s.setGrooveLoading);
  const setGrooveRegions = useApp((s) => s.setGrooveRegions);
  const scanGrooveRegions = useApp((s) => s.grooveRegionsByScan[scan.name]);
  const grooveVisible = useApp((s) => s.grooveVisible);
  const setGrooveVisible = useApp((s) => s.setGrooveVisible);
  const showCachedGrooveRegions = useApp((s) => s.showCachedGrooveRegions);
  const grooveCache = useApp((s) => s.grooveCache);
  const apiBase = useApp((s) => s.apiBase);
  const grooveCropRange = useApp(
    (s) => s.grooveCropRangesByScan[scan.name] ?? FULL_SIGNATURE_RANGE,
  );
  const setGrooveCropRange = useApp((s) => s.setGrooveCropRange);
  const grooveCacheKey = useMemo(() => buildGrooveCacheKey(scans), [scans]);
  const hasGrooveRegions = grooveVisible && Boolean(scanGrooveRegions?.length);
  const hasCachedGrooves = Boolean(grooveCache[grooveCacheKey]);
  const canDetectGrooves = scans.some((s) => s.sourceFile);
  const selectionRange = useMemo(
    () => clampSignatureRange(grooveCropRange),
    [grooveCropRange],
  );
  const selectionRangeRef = useRef<SignatureRange>(selectionRange);
  const dragRef = useRef<RangeDragState | null>(null);

  const rawSeries = useMemo(() => extractCrosscut(scan, yFrac), [scan, yFrac]);
  const croppedSeries = useMemo(
    () => sliceSignatureRange(rawSeries.x, rawSeries.z, selectionRange),
    [rawSeries, selectionRange],
  );
  const series = useMemo(() => {
    if (!flatten) {
      return {
        x: croppedSeries.x,
        z: croppedSeries.z,
        yMeters: rawSeries.yMeters,
      };
    }
    const flat = flattenSignature(croppedSeries.x, croppedSeries.z, {
      trimFrac: 0,
      spanFrac: 0.18,
      edgeGuardFrac: 0.09,
      edgeSettleSigma: 3.5,
      edgeSettleRun: 12,
    });
    if (flat.x.length === 0) {
      return {
        x: croppedSeries.x,
        z: croppedSeries.z,
        yMeters: rawSeries.yMeters,
      };
    }
    return { x: flat.x, z: flat.z, yMeters: rawSeries.yMeters };
  }, [croppedSeries, rawSeries.yMeters, flatten]);

  useEffect(() => {
    selectionRangeRef.current = selectionRange;
  }, [selectionRange]);
  const grooveRects = useMemo(() => {
    if (!grooveVisible || !scanGrooveRegions?.length) return [];
    return scanGrooveRegions.map((region) =>
      grooveRegionToDisplayRect(region, scan),
    );
  }, [grooveVisible, scanGrooveRegions, scan]);

  const padRef = useRef({ l: 48, r: 12, t: 14, b: 28 });

  const canvasPoint = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const { l, r, t, b } = padRef.current;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pw = Math.max(1, rect.width - l - r);
    const ph = Math.max(1, rect.height - t - b);
    const xFrac = (x - l) / pw;
    return {
      x,
      y,
      pw,
      ph,
      xFrac,
      clampedXFrac: clampSignatureFraction(xFrac),
      inPlotY: y >= t && y <= t + ph,
      inPlotX: xFrac >= 0 && xFrac <= 1,
    };
  }, []);

  const edgeAtX = useCallback((x: number, pw: number) => {
    const { l } = padRef.current;
    const range = selectionRangeRef.current;
    const leftX = l + range.x0 * pw;
    const rightX = l + range.x1 * pw;
    if (Math.abs(x - leftX) <= HANDLE_HIT_PX) return "left";
    if (Math.abs(x - rightX) <= HANDLE_HIT_PX) return "right";
    return null;
  }, []);

  const moveRangeEdge = useCallback(
    (edge: "left" | "right", xFrac: number) => {
      const range = selectionRangeRef.current;
      const next =
        edge === "left"
          ? {
              x0: Math.min(
                clampSignatureFraction(xFrac),
                range.x1 - MIN_SIGNATURE_RANGE_WIDTH,
              ),
              x1: range.x1,
            }
          : {
              x0: range.x0,
              x1: Math.max(
                clampSignatureFraction(xFrac),
                range.x0 + MIN_SIGNATURE_RANGE_WIDTH,
              ),
            };
      setGrooveCropRange(scan.name, next);
    },
    [scan.name, setGrooveCropRange],
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const point = canvasPoint(e);
      if (!point?.inPlotY) return;

      const edge = edgeAtX(point.x, point.pw);
      if (edge) {
        dragRef.current = { edge, pointerId: e.pointerId };
        e.currentTarget.setPointerCapture(e.pointerId);
        moveRangeEdge(edge, point.clampedXFrac);
        e.preventDefault();
        return;
      }

      if (
        point.inPlotX &&
        fractionInSignatureRange(point.xFrac, selectionRangeRef.current)
      ) {
        setHighlightX(point.xFrac);
      }
    },
    [canvasPoint, edgeAtX, moveRangeEdge, setHighlightX],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const point = canvasPoint(e);
      if (!point) return;

      const drag = dragRef.current;
      if (drag?.pointerId === e.pointerId) {
        moveRangeEdge(drag.edge, point.clampedXFrac);
        e.preventDefault();
        return;
      }

      if (!point.inPlotY) {
        e.currentTarget.style.cursor = "";
        return;
      }
      const edge = edgeAtX(point.x, point.pw);
      if (edge) {
        e.currentTarget.style.cursor = "ew-resize";
      } else if (
        point.inPlotX &&
        fractionInSignatureRange(point.xFrac, selectionRangeRef.current)
      ) {
        e.currentTarget.style.cursor = "crosshair";
      } else {
        e.currentTarget.style.cursor = "";
      }
    },
    [canvasPoint, edgeAtX, moveRangeEdge],
  );

  const stopRangeDrag = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;
      if (drag?.pointerId !== e.pointerId) return;
      dragRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    [],
  );

  const handleDetectLands = useCallback(async () => {
    if (grooveVisible) {
      setGrooveVisible(false);
      return;
    }

    if (hasCachedGrooves && showCachedGrooveRegions(grooveCacheKey)) {
      return;
    }

    if (!canDetectGrooves) {
      setError("No original .x3p files are available for land detection.");
      return;
    }

    setGrooveLoading(true);
    setError(null);
    try {
      const response = await requestGrooveDetection(scans, apiBase);
      const regions = extractGrooveRegions(response, scans);
      setGrooveRegions(regions, grooveRequestId(response), grooveCacheKey);

      const regionCount = Object.values(regions).reduce(
        (sum, scanRegions) => sum + scanRegions.length,
        0,
      );
      if (!regionCount) {
        setError("The grooves endpoint returned no land boundaries to draw.");
      }
    } catch (err) {
      setError((err as Error).message || "Could not detect land regions.");
    } finally {
      setGrooveLoading(false);
    }
  }, [
    canDetectGrooves,
    apiBase,
    grooveCacheKey,
    grooveVisible,
    hasCachedGrooves,
    scans,
    setError,
    setGrooveLoading,
    setGrooveRegions,
    setGrooveVisible,
    showCachedGrooveRegions,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      const w = rect.width;
      const h = rect.height;

      // background gradient (warm graphite)
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "rgba(31, 26, 19, 0.9)");
      bg.addColorStop(1, "rgba(13, 9, 6, 0.95)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const compact = w < 520;
      const tiny = w < 380;
      padRef.current = compact
        ? { l: tiny ? 34 : 40, r: 8, t: 14, b: 24 }
        : { l: 48, r: 12, t: 14, b: 28 };

      const { x, z } = series;
      const fullX = rawSeries.x;
      const fullX0 = fullX[0] ?? 0;
      const fullX1 = fullX.length > 1 ? fullX[fullX.length - 1] : fullX0;
      const fullXSpan = fullX1 - fullX0 || 1;
      let zMin = Infinity;
      let zMax = -Infinity;
      for (let i = 0; i < z.length; i++) {
        const v = z[i];
        if (Number.isFinite(v)) {
          if (v < zMin) zMin = v;
          if (v > zMax) zMax = v;
        }
      }
      if (!Number.isFinite(zMin)) {
        zMin = -1;
        zMax = 1;
      }
      const zRange = zMax - zMin || 1e-9;

      const pad = padRef.current;
      const pw = w - pad.l - pad.r;
      const ph = h - pad.t - pad.b;
      const tickCount = tiny ? 2 : compact ? 3 : 4;

      // gridlines
      ctx.strokeStyle = "rgba(200, 183, 145, 0.10)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= tickCount; i++) {
        const y = pad.t + (i / tickCount) * ph;
        ctx.beginPath();
        ctx.moveTo(pad.l, y);
        ctx.lineTo(pad.l + pw, y);
        ctx.stroke();
      }

      const rangeX0 = pad.l + selectionRange.x0 * pw;
      const rangeX1 = pad.l + selectionRange.x1 * pw;

      ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
      ctx.fillRect(pad.l, pad.t, Math.max(0, rangeX0 - pad.l), ph);
      ctx.fillRect(
        rangeX1,
        pad.t,
        Math.max(0, pad.l + pw - rangeX1),
        ph,
      );

      ctx.fillStyle = "rgba(56, 189, 248, 0.07)";
      ctx.fillRect(rangeX0, pad.t, Math.max(1, rangeX1 - rangeX0), ph);

      if (grooveRects.length) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(rangeX0, pad.t, Math.max(1, rangeX1 - rangeX0), ph);
        ctx.clip();
        for (const rect of grooveRects) {
          const clippedX0 = Math.max(rect.x0, selectionRange.x0);
          const clippedX1 = Math.min(rect.x1, selectionRange.x1);
          if (clippedX1 <= clippedX0) continue;

          const x0 = pad.l + clippedX0 * pw;
          const x1 = pad.l + clippedX1 * pw;
          const barX = Math.min(x0, x1);
          const barW = Math.max(1, Math.abs(x1 - x0));

          ctx.fillStyle = "rgba(56, 189, 248, 0.16)";
          ctx.fillRect(barX, pad.t, barW, ph);

          ctx.strokeStyle = "rgba(56, 189, 248, 0.86)";
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.moveTo(barX, pad.t);
          ctx.lineTo(barX, pad.t + ph);
          ctx.moveTo(barX + barW, pad.t);
          ctx.lineTo(barX + barW, pad.t + ph);
          ctx.stroke();
        }
        ctx.restore();
      }

      // axis labels
      ctx.fillStyle = "rgba(200, 183, 145, 0.8)";
      ctx.font = `${compact ? 9 : 11}px ui-sans-serif, system-ui, -apple-system`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let i = 0; i <= tickCount; i++) {
        const y = pad.t + (i / tickCount) * ph;
        const zVal = zMax - (i / tickCount) * zRange;
        ctx.fillText(`${(zVal * 1e6).toFixed(1)} µm`, pad.l - 6, y);
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let i = 0; i <= tickCount; i++) {
        const xv = pad.l + (i / tickCount) * pw;
        const xmm = ((fullX0 + (i / tickCount) * fullXSpan) * 1000).toFixed(2);
        ctx.fillText(`${xmm} mm`, xv, pad.t + ph + 6);
      }

      // line with colormap
      const step = Math.max(1, Math.floor(x.length / pw / 2));
      ctx.lineWidth = 1.8;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      let prev: { x: number; y: number; v: number } | null = null;
      for (let i = 0; i < x.length; i += step) {
        const v = z[i];
        if (!Number.isFinite(v)) {
          prev = null;
          continue;
        }
        const xPix = pad.l + ((x[i] - fullX0) / fullXSpan) * pw;
        const yPix = pad.t + (1 - (v - zMin) / zRange) * ph;
        if (prev) {
          const t = ((prev.v + v) * 0.5 - zMin) / zRange;
          const [r, g, b] = sampleColor(colormap, t);
          ctx.strokeStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, 0.95)`;
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(xPix, yPix);
          ctx.stroke();
        }
        prev = { x: xPix, y: yPix, v };
      }

      // highlight X marker — vertical line at clicked position (matches 3D crosshair)
      if (
        highlightX !== null &&
        fractionInSignatureRange(highlightX, selectionRange)
      ) {
        const hx = pad.l + highlightX * pw;
        ctx.strokeStyle = "rgba(251, 191, 36, 0.9)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(hx, pad.t);
        ctx.lineTo(hx, pad.t + ph);
        ctx.stroke();
        ctx.setLineDash([]);

        // label showing physical X in mm
        const xMeters = fullX0 + highlightX * fullXSpan;
        const xLabel = `${(xMeters * 1000).toFixed(3)} mm`;
        ctx.font = `${compact ? 9 : 10}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = "rgba(253, 230, 138, 0.95)";
        const labelX = Math.min(pad.l + pw - (compact ? 58 : 70), hx + 4);
        ctx.fillText(xLabel, labelX, pad.t + 2);
      }

      ctx.strokeStyle = "rgba(56, 189, 248, 0.92)";
      ctx.lineWidth = 1.4;
      ctx.strokeRect(rangeX0, pad.t, Math.max(1, rangeX1 - rangeX0), ph);
      ctx.fillStyle = "rgba(125, 211, 252, 0.95)";
      const handleHeight = Math.min(24, Math.max(14, ph * 0.24));
      const handleY = pad.t + ph * 0.5 - handleHeight * 0.5;
      for (const handleX of [rangeX0, rangeX1]) {
        ctx.fillRect(handleX - 1.5, handleY, 3, handleHeight);
        ctx.fillRect(handleX - 4.5, handleY + handleHeight * 0.25, 1, handleHeight * 0.5);
        ctx.fillRect(handleX + 3.5, handleY + handleHeight * 0.25, 1, handleHeight * 0.5);
      }

      // frame
      ctx.strokeStyle = "rgba(200, 183, 145, 0.22)";
      ctx.strokeRect(pad.l, pad.t, pw, ph);
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [series, rawSeries, selectionRange, colormap, highlightX, grooveRects]);

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="h-full w-full touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopRangeDrag}
        onPointerCancel={stopRangeDrag}
        onPointerLeave={(e) => {
          if (!dragRef.current) e.currentTarget.style.cursor = "";
        }}
      />
      <div className="absolute right-2 top-2 flex max-w-[calc(100%-3rem)] items-center gap-1.5 sm:right-3 sm:gap-2">
        <button
          onClick={() => setFlatten(!flatten)}
          className={cn(
            "flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] transition sm:px-2",
            flatten
              ? "border-amber-400/50 bg-amber-400/15 text-amber-100"
              : "border-white/10 bg-black/30 text-slate-300 hover:border-white/20 hover:bg-black/50",
          )}
          title="Detrend the selected rectangle by subtracting a LOESS baseline; endpoint guard bands are hidden."
        >
          <Waves className="h-3 w-3" />
          Flatten
        </button>
        <button
          onClick={handleDetectLands}
          disabled={grooveLoading || !canDetectGrooves}
          aria-hidden
          tabIndex={-1}
          className={cn(
            "hidden items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] transition sm:px-2",
            hasGrooveRegions
              ? "border-sky-400/60 bg-sky-400/15 text-sky-100"
              : hasCachedGrooves
                ? "border-sky-400/40 bg-black/30 text-slate-300 hover:border-sky-400/60 hover:bg-sky-400/10 hover:text-sky-100"
              : "border-sky-400/35 bg-black/30 text-slate-300 hover:border-sky-400/60 hover:bg-sky-400/10 hover:text-sky-100",
            (grooveLoading || !canDetectGrooves) &&
              "cursor-not-allowed opacity-60 hover:bg-black/30 hover:text-slate-300",
          )}
          title={
            grooveVisible
              ? "Hide cached land regions."
              : hasCachedGrooves
                ? "Show cached land regions."
                : "Detect land regions with the configured API."
          }
        >
          <Layers className="h-3 w-3" />
          {grooveLoading ? "Land(s)..." : "Land(s)"}
        </button>
        <div className="pointer-events-none truncate text-[10px] text-slate-400 sm:text-xs">
          y = {(series.yMeters * 1000).toFixed(3)} mm
        </div>
      </div>
      {highlightX !== null && (
        <button
          onClick={() => setHighlightX(null)}
          className="absolute bottom-2 right-2 rounded-md border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] text-slate-300 transition hover:border-white/20 hover:bg-black/60 sm:bottom-3 sm:right-3"
        >
          clear marker
        </button>
      )}
    </div>
  );
}
