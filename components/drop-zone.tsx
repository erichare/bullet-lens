"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { parseX3p } from "@/lib/x3p";
import { cn } from "@/lib/utils";

interface Props {
  compact?: boolean;
}

export default function DropZone({ compact = false }: Props) {
  const [hover, setHover] = useState(false);
  const { addScans, setError, setLoading, loading } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (list: FileList | File[]) => {
      const files = Array.from(list).filter((f) =>
        f.name.toLowerCase().endsWith(".x3p"),
      );
      if (!files.length) {
        setError("No .x3p files detected in the drop.");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const parsed = await Promise.all(
          files.map((f) => parseX3p(f).catch((err: Error) => ({ err, name: f.name }))),
        );
        const ok = parsed.filter(
          (p): p is Awaited<ReturnType<typeof parseX3p>> => "z" in p,
        );
        const failed = parsed.filter(
          (p): p is { err: Error; name: string } => "err" in p,
        );
        if (ok.length) addScans(ok);
        if (failed.length) {
          setError(
            `Failed to parse ${failed.length} file${failed.length === 1 ? "" : "s"}: ${failed
              .map((f) => f.name)
              .slice(0, 3)
              .join(", ")}`,
          );
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [addScans, setError, setLoading],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setHover(false);
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  if (compact) {
    return (
      <>
        <button
          onClick={() => inputRef.current?.click()}
          className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/10"
        >
          <Upload className="h-4 w-4" />
          Add .x3p
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".x3p"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "group relative mx-auto flex w-full max-w-2xl cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed px-10 py-10 text-center transition-all duration-300",
        hover
          ? "border-amber-400/50 bg-amber-400/5 shadow-[0_0_60px_-10px_rgba(228,169,74,0.45)]"
          : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]",
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-500/0 via-amber-500/5 to-emerald-500/0 opacity-70" />
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-inner">
        <Upload className="h-7 w-7 text-amber-300" />
      </div>
      <h3 className="relative mt-6 text-xl font-medium tracking-tight text-slate-100">
        Drop .x3p files here
      </h3>
      <p className="relative mt-2 max-w-md text-sm text-slate-400">
        A single land for inspection, or several to stitch into a full bullet.
        Files stay in your browser unless you run Model compare.
      </p>
      {loading && (
        <p className="relative mt-4 text-xs text-amber-300">Parsing…</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".x3p"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
    </div>
  );
}
