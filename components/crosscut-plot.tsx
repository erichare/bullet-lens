"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Waves } from "lucide-react";
import type { X3pScan } from "@/lib/x3p";
import { extractCrosscut } from "@/lib/geometry";
import { sampleColor, type ColormapName } from "@/lib/colormap";
import { flattenSignature } from "@/lib/flatten";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

interface Props {
  scan: X3pScan;
  yFrac: number;
  colormap: ColormapName;
}

export default function CrosscutPlot({ scan, yFrac, colormap }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const highlightX = useApp((s) => s.highlightX);
  const setHighlightX = useApp((s) => s.setHighlightX);
  const flatten = useApp((s) => s.flatten);
  const setFlatten = useApp((s) => s.setFlatten);

  const rawSeries = useMemo(() => extractCrosscut(scan, yFrac), [scan, yFrac]);
  const series = useMemo(() => {
    if (!flatten) return rawSeries;
    const flat = flattenSignature(rawSeries.x, rawSeries.z, {
      trimFrac: 0.1,
      degree: 2,
    });
    if (flat.x.length === 0) return rawSeries;
    return { x: flat.x, z: flat.z, yMeters: rawSeries.yMeters };
  }, [rawSeries, flatten]);

  const padRef = useRef({ l: 48, r: 12, t: 14, b: 28 });

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const { l, r } = padRef.current;
      const pw = rect.width - l - r;
      const xFrac = (x - l) / pw;
      if (xFrac < 0 || xFrac > 1) return;
      setHighlightX(xFrac);
    },
    [setHighlightX],
  );

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

      const { x, z } = series;
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

      // gridlines
      ctx.strokeStyle = "rgba(200, 183, 145, 0.10)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = pad.t + (i / 4) * ph;
        ctx.beginPath();
        ctx.moveTo(pad.l, y);
        ctx.lineTo(pad.l + pw, y);
        ctx.stroke();
      }

      // axis labels
      ctx.fillStyle = "rgba(200, 183, 145, 0.8)";
      ctx.font = "11px ui-sans-serif, system-ui, -apple-system";
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let i = 0; i <= 4; i++) {
        const y = pad.t + (i / 4) * ph;
        const zVal = zMax - (i / 4) * zRange;
        ctx.fillText(`${(zVal * 1e6).toFixed(1)} µm`, pad.l - 6, y);
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let i = 0; i <= 4; i++) {
        const xv = pad.l + (i / 4) * pw;
        const xmm = ((x[0] + (i / 4) * (x[x.length - 1] - x[0])) * 1000).toFixed(2);
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
        const xPix = pad.l + (i / (x.length - 1)) * pw;
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
      if (highlightX !== null) {
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
        const xMeters = x[0] + highlightX * (x[x.length - 1] - x[0]);
        const xLabel = `${(xMeters * 1000).toFixed(3)} mm`;
        ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = "rgba(253, 230, 138, 0.95)";
        const labelX = Math.min(pad.l + pw - 70, hx + 4);
        ctx.fillText(xLabel, labelX, pad.t + 2);
      }

      // frame
      ctx.strokeStyle = "rgba(200, 183, 145, 0.22)";
      ctx.strokeRect(pad.l, pad.t, pw, ph);
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [series, colormap, highlightX]);

  return (
    <div className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-crosshair"
        onClick={handleClick}
      />
      <div className="absolute right-3 top-2 flex items-center gap-2">
        <button
          onClick={() => setFlatten(!flatten)}
          className={cn(
            "flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] transition",
            flatten
              ? "border-amber-400/50 bg-amber-400/15 text-amber-100"
              : "border-white/10 bg-black/30 text-slate-300 hover:border-white/20 hover:bg-black/50",
          )}
          title="Detrend the signature by subtracting a quadratic polynomial fit; groove regions (outer 10%) are trimmed."
        >
          <Waves className="h-3 w-3" />
          Flatten
        </button>
        <div className="pointer-events-none text-xs text-slate-400">
          y = {(series.yMeters * 1000).toFixed(3)} mm
        </div>
      </div>
      {highlightX !== null && (
        <button
          onClick={() => setHighlightX(null)}
          className="absolute right-3 bottom-3 rounded-md border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] text-slate-300 transition hover:border-white/20 hover:bg-black/60"
        >
          clear marker
        </button>
      )}
    </div>
  );
}
