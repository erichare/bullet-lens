"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RotateCcw, ArrowDown, ArrowUp, Move, SquareStack } from "lucide-react";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { ViewPreset } from "@/lib/store";

interface PresetDef {
  id: ViewPreset;
  label: string;
  position: [number, number, number];
  icon: React.ReactNode;
}

// Camera positions for the single-land view (flat surface centered at origin)
const LAND_PRESETS: Record<ViewPreset, [number, number, number]> = {
  perspective: [8, 6, 8],
  top: [0, 14, 0.001],
  bottom: [0, -14, 0.001],
  front: [0, 0, 14],
  side: [14, 0, 0],
};

// Camera positions for the stitched-bullet view (cylinder along Y axis)
const BULLET_PRESETS: Record<ViewPreset, [number, number, number]> = {
  perspective: [10, 8, 12],
  top: [0, 22, 0.001],
  bottom: [0, -22, 0.001],
  front: [0, 0, 18],
  side: [18, 0, 0],
};

// Camera positions for the merged visual-compare view (two lands stacked
// vertically — long X axis stays ~10 units, short Y axis is doubled to ~6-7
// units).
const COMPARE_PRESETS: Record<ViewPreset, [number, number, number]> = {
  perspective: [4, 4, 14],
  top: [0, 16, 0.001],
  bottom: [0, -16, 0.001],
  front: [0, 0, 14],
  side: [14, 0, 0],
};

const PRESET_DEFS: Omit<PresetDef, "position">[] = [
  { id: "perspective", label: "Reset", icon: <RotateCcw className="h-3 w-3" /> },
  { id: "top", label: "Top", icon: <ArrowDown className="h-3 w-3" /> },
  { id: "bottom", label: "Bottom", icon: <ArrowUp className="h-3 w-3" /> },
  { id: "front", label: "Front", icon: <SquareStack className="h-3 w-3" /> },
  { id: "side", label: "Side", icon: <Move className="h-3 w-3" /> },
];

/**
 * Renders inside the R3F Canvas. Listens for viewPreset changes in the store
 * and smoothly animates the camera to the corresponding preset position.
 */
export function CameraController({
  mode,
}: {
  mode: "land" | "bullet" | "compare";
}) {
  const { camera } = useThree();
  const controls = useThree((s) => s.controls) as unknown as {
    target: THREE.Vector3;
    update: () => void;
  } | null;
  const viewPreset = useApp((s) => s.viewPreset);
  const tick = useApp((s) => s.viewResetTick);

  const targetPos = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3(0, 0, 0));
  const animating = useRef(false);

  useEffect(() => {
    const presets =
      mode === "bullet"
        ? BULLET_PRESETS
        : mode === "compare"
          ? COMPARE_PRESETS
          : LAND_PRESETS;
    const [x, y, z] = presets[viewPreset];
    targetPos.current.set(x, y, z);
    targetLook.current.set(0, 0, 0);
    animating.current = true;
  }, [viewPreset, tick, mode]);

  useFrame((_, dt) => {
    if (!animating.current) return;
    const s = Math.min(1, dt * 4.5);
    camera.position.lerp(targetPos.current, s);
    if (controls && controls.target) {
      controls.target.lerp(targetLook.current, s);
      controls.update();
    } else {
      camera.lookAt(targetLook.current);
    }
    const dist = camera.position.distanceTo(targetPos.current);
    if (dist < 0.03) {
      camera.position.copy(targetPos.current);
      if (controls && controls.target) {
        controls.target.copy(targetLook.current);
        controls.update();
      }
      animating.current = false;
    }
  });

  return null;
}

/** Overlay toolbar rendered outside the Canvas, in normal DOM. */
export function ViewPresetsToolbar({
  className,
}: {
  className?: string;
}) {
  const viewPreset = useApp((s) => s.viewPreset);
  const setViewPreset = useApp((s) => s.setViewPreset);
  return (
    <div
      className={cn(
        "pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center gap-0.5 overflow-x-auto rounded-xl border border-white/10 bg-[#0d0906]/75 p-1 text-[11px] text-slate-300 shadow-lg backdrop-blur",
        className,
      )}
    >
      {PRESET_DEFS.map((p) => (
        <button
          key={p.id}
          onClick={() => setViewPreset(p.id)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 transition sm:px-2.5",
            viewPreset === p.id
              ? "bg-amber-400/15 text-amber-200"
              : "text-slate-300 hover:bg-white/[0.05] hover:text-slate-100",
          )}
          title={`${p.label} view`}
        >
          {p.icon}
          {p.label}
        </button>
      ))}
    </div>
  );
}
