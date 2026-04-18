"use client";

import type { X3pScan } from "@/lib/x3p";

interface Props {
  scan: X3pScan;
}

/**
 * Pick a "nice" number (1, 2, 5 × 10^n) close to, but less than, target.
 */
function niceNumber(target: number): number {
  if (target <= 0) return 1;
  const exp = Math.floor(Math.log10(target));
  const base = target / 10 ** exp;
  let nice: number;
  if (base < 1.5) nice = 1;
  else if (base < 3.5) nice = 2;
  else if (base < 7.5) nice = 5;
  else nice = 10;
  return nice * 10 ** exp;
}

function formatLength(meters: number): string {
  const um = meters * 1e6;
  if (um >= 1000) return `${(um / 1000).toFixed(um >= 10000 ? 0 : 1)} mm`;
  if (um >= 1) return `${um.toFixed(um >= 100 ? 0 : 1)} µm`;
  return `${(um * 1000).toFixed(0)} nm`;
}

export default function ScaleOverlay({ scan }: Props) {
  // Target about 20% of the visible width, assuming a 900px-wide canvas.
  const approxPixelsWide = 900;
  const targetFraction = 0.18;
  const targetMeters = scan.widthMeters * targetFraction;
  const barMeters = niceNumber(targetMeters);
  const pixelFraction = (barMeters / scan.widthMeters) * targetFraction * (1 / targetFraction);
  const barPx = Math.round(approxPixelsWide * (barMeters / scan.widthMeters));

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div
          className="relative h-0.5 bg-slate-200"
          style={{ width: `${Math.min(240, Math.max(60, barPx))}px` }}
        >
          <div className="absolute -top-1 left-0 h-2 w-px bg-slate-200" />
          <div className="absolute -top-1 right-0 h-2 w-px bg-slate-200" />
        </div>
        <span className="font-mono text-xs text-slate-200">
          {formatLength(barMeters)}
        </span>
      </div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
        Scan: {formatLength(scan.widthMeters)} × {formatLength(scan.heightMeters)}
      </div>
    </div>
  );
}
