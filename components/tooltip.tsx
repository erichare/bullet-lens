"use client";

import { useState, type ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  content: ReactNode;
  className?: string;
}

export function InfoHint({ content, className }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((v) => !v)}
    >
      <HelpCircle className="h-3 w-3 cursor-help text-slate-500 transition hover:text-slate-300" />
      {open && (
        <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-56 -translate-x-1/2 rounded-lg border border-white/10 bg-[#0d0906]/95 px-3 py-2 text-[11px] leading-relaxed text-slate-200 shadow-xl backdrop-blur">
          {content}
        </span>
      )}
    </span>
  );
}
