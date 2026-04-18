"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const GLOSSARY: { term: string; short: string; detail: string }[] = [
  {
    term: "Bullet",
    short: "A fired projectile — not the whole cartridge.",
    detail:
      "When examined forensically, we look at the side surface of a fired bullet. As it spins down a gun barrel, the barrel's interior rifling carves a characteristic pattern into the bullet's soft metal jacket.",
  },
  {
    term: "Land",
    short: "A raised strip engraved onto the bullet by a groove in the barrel.",
    detail:
      "Inside a rifled barrel, the raised portions are called lands and the recessed portions grooves. On the bullet, these are reversed: the barrel's grooves leave raised 'land-engraved areas' on the bullet, and the barrel's lands leave recessed 'groove-engraved areas'. Most bullets have 5–7 lands around their circumference.",
  },
  {
    term: "Striations",
    short: "Fine parallel lines on the land surface — the fingerprint.",
    detail:
      "Microscopic tool marks transferred from the barrel onto the bullet as it spins past. These sub-micron-scale ridges and valleys are what get compared between two bullets to determine whether they came from the same gun.",
  },
  {
    term: "x3p file",
    short: "ISO 5436-2 format for 3D surface scans.",
    detail:
      "A zipped container with XML metadata and a binary matrix of height values (Z) sampled on a regular XY grid. Typical resolution is ~1.5 µm per pixel in X and Y; Z is measured in nanometers.",
  },
  {
    term: "Crosscut",
    short: "A 1D height profile taken across the land at one Y position.",
    detail:
      "Slice the 3D land horizontally and you get a signature curve — the classic forensic 'signal'. Two signals from the same land on different bullets should look similar if they came from the same gun.",
  },
  {
    term: "Z exaggeration",
    short: "Visual amplification of surface height.",
    detail:
      "The height variation on a land is measured in micrometers, while its width is in millimeters — about 1000× smaller. Without exaggeration, the surface would look perfectly flat. The Z slider multiplies the visual height to make striations visible.",
  },
];

export default function LearnPanel() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const modal = (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d0906]/95 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <div>
                <h2 className="text-lg font-medium text-slate-100">
                  What am I looking at?
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  A quick tour of forensic bullet surfaces and the x3p format.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="text-sm leading-relaxed text-slate-300">
                When a gun is fired, the barrel&apos;s rifling carves distinctive
                marks into the soft metal of the bullet. If you zoom in far
                enough, those marks form a surface topography as unique as a
                fingerprint. Bullet Lens lets you explore that topography
                interactively.
              </p>

              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                <Stat label="Typical bullet diameter" value="≈ 9 mm" />
                <Stat label="Land width" value="≈ 2.5 mm" />
                <Stat label="Striation depth" value="≈ 1 µm" />
              </div>

              <h3 className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Glossary
              </h3>
              <dl className="mt-3 space-y-3">
                {GLOSSARY.map((g) => (
                  <Entry key={g.term} {...g} />
                ))}
              </dl>

              <h3 className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                How to use this viewer
              </h3>
              <ol className="mt-3 space-y-2 text-sm text-slate-300">
                <li className="flex gap-2">
                  <span className="text-amber-400">1.</span>
                  <span>
                    <b className="text-slate-100">Drop one .x3p</b> to inspect
                    a single land in 3D. Drag to orbit, scroll to zoom.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-400">2.</span>
                  <span>
                    <b className="text-slate-100">Drop several .x3p</b> files
                    from the same bullet to see them stitched around a virtual
                    barrel in the <i>Bullet</i> view.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-400">3.</span>
                  <span>
                    Move the <b className="text-slate-100">Crosscut Y</b>{" "}
                    slider to extract the 1D signature at any vertical
                    position — this is the curve forensic algorithms compare.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-400">4.</span>
                  <span>
                    Increase <b className="text-slate-100">Z exaggeration</b>{" "}
                    to make the microscopic striations visible — the real
                    surface is only a few microns tall against millimeters of
                    width.
                  </span>
                </li>
              </ol>

              <p className="mt-6 text-xs text-slate-500">
                Files never leave your browser. All parsing, decimation, and
                rendering runs locally via WebGL.
              </p>
            </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs text-slate-300 transition hover:border-white/20 hover:bg-white/[0.05]"
        title="What am I looking at?"
      >
        <BookOpen className="h-3.5 w-3.5" />
        Learn
      </button>
      {open && createPortal(modal, document.body)}
    </>
  );
}

function Entry({
  term,
  short,
  detail,
}: {
  term: string;
  short: string;
  detail: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      className={cn(
        "rounded-xl border border-white/5 bg-white/[0.02] p-3 transition",
        expanded && "border-white/10 bg-white/[0.04]",
      )}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-2 text-left"
      >
        <ChevronRight
          className={cn(
            "mt-1 h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform",
            expanded && "rotate-90",
          )}
        />
        <div className="flex-1">
          <dt className="text-sm font-medium text-slate-100">{term}</dt>
          <dd className="mt-0.5 text-xs text-slate-400">{short}</dd>
        </div>
      </button>
      {expanded && (
        <p className="ml-5 mt-2 text-xs leading-relaxed text-slate-300">
          {detail}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-4">
      <div className="text-sm font-mono text-amber-200">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
    </div>
  );
}
