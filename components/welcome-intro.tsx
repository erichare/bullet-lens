"use client";

import { Sparkles, Layers, Box, LineChart } from "lucide-react";

import DemoButton, { DemoAttribution } from "./demo-button";

export default function WelcomeIntro() {
  return (
    <div className="w-full max-w-2xl text-center">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-slate-300">
        <Sparkles className="h-3 w-3 text-amber-300" />
        Forensic topography, in your browser
      </div>
      <h1 className="mt-5 font-serif text-4xl font-normal leading-[1.05] tracking-tight text-[color:var(--ink)] sm:text-5xl md:text-6xl">
        See a bullet&rsquo;s{" "}
        <span className="bg-gradient-to-br from-amber-200 via-amber-400 to-orange-500 bg-clip-text italic text-transparent">
          fingerprint
        </span>
        .
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-slate-400">
        Every fired bullet carries a microscopic signature — striations left by
        the rifling inside the gun barrel. Drop an{" "}
        <span className="font-mono text-slate-200">.x3p</span> scan below to
        explore one interactively, or drop several from a single bullet to see
        them stitched around a virtual barrel.
      </p>

      <div className="mt-5 flex flex-col items-center">
        <DemoButton />
        <DemoAttribution />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 text-left">
        <FeatureCard
          icon={<Layers className="h-4 w-4 text-amber-300" />}
          title="Single land"
          body="Inspect one 3D surface scan. Orbit, zoom, and pick a crosscut line."
        />
        <FeatureCard
          icon={<Box className="h-4 w-4 text-emerald-300" />}
          title="Full bullet"
          body="Stitch multiple scans into a cylinder to see the whole bullet in context."
        />
        <FeatureCard
          icon={<LineChart className="h-4 w-4 text-orange-300" />}
          title="Signature"
          body="Extract the 1D height profile that forensic algorithms compare."
        />
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition hover:border-white/10 hover:bg-white/[0.04]">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5">
        {icon}
      </div>
      <div className="mt-3 text-sm font-medium text-slate-100">{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-slate-400">{body}</div>
    </div>
  );
}
