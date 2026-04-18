"use client";

import { X, FileDigit } from "lucide-react";
import { useApp } from "@/lib/store";
import { formatCount, formatMicrons, cn } from "@/lib/utils";
import { COLORMAPS } from "@/lib/colormap";

export default function MetadataPanel() {
  const {
    scans,
    activeIndex,
    setActiveIndex,
    removeScan,
    colormap,
    setColormap,
    zExagLand,
    setZExagLand,
    zExagBullet,
    setZExagBullet,
    showWireframe,
    setShowWireframe,
    crosscutY,
    setCrosscutY,
    landCoverage,
    setLandCoverage,
    compareIndexA,
    compareIndexB,
    setCompareIndex,
    mode,
  } = useApp();

  const compareMode = mode === "compare";
  const active = compareMode ? scans[compareIndexA] : scans[activeIndex];

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col gap-4 border-l border-white/5 bg-[#0d0906]/60 p-4 backdrop-blur">
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Scans
        </h2>
        <ul className="mt-2 space-y-1">
          {scans.map((scan, i) => {
            const isActive = !compareMode && i === activeIndex;
            const isA = compareMode && i === compareIndexA;
            const isB = compareMode && i === compareIndexB;
            return (
              <li
                key={`${scan.name}-${i}`}
                className={cn(
                  "group flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition",
                  isActive || isA || isB
                    ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
                    : "border-white/5 bg-white/[0.02] text-slate-300 hover:border-white/10 hover:bg-white/[0.05]",
                )}
              >
                <button
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => {
                    if (compareMode) setCompareIndex("A", i);
                    else setActiveIndex(i);
                  }}
                  title={scan.name}
                >
                  <FileDigit className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate font-mono text-xs">{scan.name}</span>
                </button>
                {compareMode && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <SlotChip
                      label="A"
                      active={isA}
                      onClick={() => setCompareIndex("A", i)}
                    />
                    <SlotChip
                      label="B"
                      active={isB}
                      onClick={() => setCompareIndex("B", i)}
                    />
                  </div>
                )}
                <button
                  onClick={() => removeScan(i)}
                  className="rounded p-1 text-slate-500 opacity-0 transition hover:bg-white/10 hover:text-slate-200 group-hover:opacity-100"
                  aria-label={`Remove ${scan.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {active && (
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Metadata
          </h2>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <MetaRow label="Size" value={`${active.meta.sizeX} × ${active.meta.sizeY}`} />
            <MetaRow label="Points" value={formatCount(active.meta.sizeX * active.meta.sizeY)} />
            <MetaRow label="Width" value={formatMicrons(active.widthMeters)} />
            <MetaRow label="Height" value={formatMicrons(active.heightMeters)} />
            <MetaRow label="dx" value={formatMicrons(active.meta.cx.increment)} />
            <MetaRow label="dy" value={formatMicrons(active.meta.cy.increment)} />
            <MetaRow label="z min" value={formatMicrons(active.zMin)} />
            <MetaRow label="z max" value={formatMicrons(active.zMax)} />
            <MetaRow label="z mean" value={formatMicrons(active.zMean)} />
            <MetaRow label="valid" value={formatCount(active.validCount)} />
            {active.meta.instrument && (
              <MetaRow label="Instrument" value={active.meta.instrument} full />
            )}
            {active.meta.creationDate && (
              <MetaRow label="Date" value={active.meta.creationDate.slice(0, 10)} full />
            )}
          </dl>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Appearance
        </h2>
        <LabeledRange
          label="Z exaggeration"
          value={mode === "bullet" ? zExagBullet : zExagLand}
          min={0.01}
          max={mode === "bullet" ? 50 : 8}
          step={0.01}
          format={(v) => (v < 0.1 ? `${v.toFixed(2)}×` : `${v.toFixed(1)}×`)}
          onChange={mode === "bullet" ? setZExagBullet : setZExagLand}
        />
        {mode === "land" && (
          <LabeledRange
            label="Crosscut Y"
            value={crosscutY}
            min={0}
            max={1}
            step={0.005}
            format={(v) => `${(v * 100).toFixed(1)}%`}
            onChange={setCrosscutY}
          />
        )}
        {mode === "bullet" && (
          <LabeledRange
            label="Land coverage"
            value={landCoverage}
            min={0.4}
            max={1}
            step={0.01}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={setLandCoverage}
          />
        )}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-slate-400">
            <span>Colormap</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {COLORMAPS.map((cm) => (
              <button
                key={cm.id}
                onClick={() => setColormap(cm.id)}
                className={cn(
                  "rounded-md border px-2 py-1 text-[11px] transition",
                  colormap === cm.id
                    ? "border-amber-400/40 bg-amber-400/10 text-amber-100"
                    : "border-white/5 bg-white/[0.02] text-slate-300 hover:border-white/10 hover:bg-white/[0.05]",
                )}
              >
                {cm.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={showWireframe}
            onChange={(e) => setShowWireframe(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 text-amber-400"
          />
          Show wireframe
        </label>
      </div>
    </aside>
  );
}

function SlotChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-semibold transition",
        active
          ? "bg-amber-400 text-[#17130e]"
          : "border border-white/10 bg-white/[0.03] text-slate-400 hover:border-amber-400/40 hover:text-amber-200",
      )}
    >
      {label}
    </button>
  );
}

function MetaRow({
  label,
  value,
  full,
}: {
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <>
      <dt className={cn("text-slate-500", full && "col-span-2")}>
        {label}
      </dt>
      <dd
        className={cn(
          "font-mono text-slate-200",
          full && "col-span-2 truncate",
        )}
      >
        {value}
      </dd>
    </>
  );
}

function LabeledRange({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span className="font-mono text-slate-300">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-amber-400"
      />
    </div>
  );
}
