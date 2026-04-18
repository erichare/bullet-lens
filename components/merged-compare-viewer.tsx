"use client";

import { Suspense, useEffect, useMemo } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import type { X3pScan } from "@/lib/x3p";
import type { ColormapName } from "@/lib/colormap";
import { buildLandGeometry } from "@/lib/geometry";
import { CameraController } from "./view-presets";
import { useApp } from "@/lib/store";

interface Props {
  scanA: X3pScan;
  scanB: X3pScan;
  colormap: ColormapName;
  zExaggeration: number;
  showWireframe: boolean;
  crosscutY: number;
  /**
   * Horizontal slide of B relative to A, as a fraction of B's width
   * (-0.5..0.5). Lets the examiner dial in striae alignment across the seam.
   */
  xOffset: number;
  flipA: boolean;
  flipB: boolean;
}

const SEAM_GAP = 0.15; // scene units between A (top) and B (bottom)

function MergedContent({
  scanA,
  scanB,
  colormap,
  zExaggeration,
  showWireframe,
  crosscutY,
  xOffset,
  flipA,
  flipB,
}: Props) {
  const sharedMaxPhys = useMemo(
    () =>
      Math.max(
        scanA.widthMeters,
        scanA.heightMeters,
        scanB.widthMeters,
        scanB.heightMeters,
      ),
    [scanA, scanB],
  );

  const buildA = useMemo(
    () =>
      buildLandGeometry(scanA, colormap, zExaggeration, undefined, sharedMaxPhys),
    [scanA, colormap, zExaggeration, sharedMaxPhys],
  );
  const buildB = useMemo(
    () =>
      buildLandGeometry(scanB, colormap, zExaggeration, undefined, sharedMaxPhys),
    [scanB, colormap, zExaggeration, sharedMaxPhys],
  );

  useEffect(
    () => () => {
      buildA.geometry.dispose();
      buildB.geometry.dispose();
    },
    [buildA, buildB],
  );

  const setCrosscutY = useApp((s) => s.setCrosscutY);
  const setHighlightX = useApp((s) => s.setHighlightX);
  const highlightX = useApp((s) => s.highlightX);

  const handlePointerOver = () => {
    document.body.style.cursor = "crosshair";
  };
  const handlePointerOut = () => {
    document.body.style.cursor = "";
  };
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!e.uv) return;
    e.stopPropagation();
    setCrosscutY(e.uv.y);
    setHighlightX(e.uv.x);
  };

  // Stacked layout: A on top, B on bottom. Seam runs along X at y=0.
  const aY = +buildA.height / 2 + SEAM_GAP / 2;
  const bY = -buildB.height / 2 - SEAM_GAP / 2;
  const bX = xOffset * buildB.width;

  // Y crosscut lines (horizontal) — at scan fraction crosscutY.
  // For each panel, if flipped vertically the scan row maps to the mirrored Y.
  const yLineA =
    aY + (flipA ? -1 : 1) * (crosscutY - 0.5) * buildA.height;
  const yLineB =
    bY + (flipB ? -1 : 1) * (crosscutY - 0.5) * buildB.height;

  // X highlight lines (vertical)
  const xLineA =
    highlightX !== null ? (highlightX - 0.5) * buildA.width : null;
  // B is not flipped in X when stacked, so the scan fraction maps directly.
  const xLineB =
    highlightX !== null ? bX + (highlightX - 0.5) * buildB.width : null;

  const maxWidth = Math.max(buildA.width, buildB.width + Math.abs(bX) * 2);

  return (
    <>
      <group position={[0, aY, 0]} scale={[1, flipA ? -1 : 1, 1]}>
        <mesh
          geometry={buildA.geometry}
          castShadow
          receiveShadow
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <meshStandardMaterial
            vertexColors
            side={THREE.DoubleSide}
            metalness={0.15}
            roughness={0.55}
            wireframe={showWireframe}
          />
        </mesh>
      </group>

      <group position={[bX, bY, 0]} scale={[1, flipB ? -1 : 1, 1]}>
        <mesh
          geometry={buildB.geometry}
          castShadow
          receiveShadow
          onClick={handleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <meshStandardMaterial
            vertexColors
            side={THREE.DoubleSide}
            metalness={0.15}
            roughness={0.55}
            wireframe={showWireframe}
          />
        </mesh>
      </group>

      {/* Horizontal Y crosscut bar, one per scan */}
      <mesh position={[0, yLineA, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[buildA.width * 1.05, 0.03]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.9} />
      </mesh>
      <mesh position={[bX, yLineB, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[buildB.width * 1.05, 0.03]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.9} />
      </mesh>

      {/* Vertical X highlight lines */}
      {xLineA !== null && (
        <mesh
          position={[xLineA, aY, 0]}
          rotation={[Math.PI / 2, 0, Math.PI / 2]}
        >
          <planeGeometry args={[buildA.height * 1.05, 0.03]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.9} />
        </mesh>
      )}
      {xLineB !== null && (
        <mesh
          position={[xLineB, bY, 0]}
          rotation={[Math.PI / 2, 0, Math.PI / 2]}
        >
          <planeGeometry args={[buildB.height * 1.05, 0.03]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.9} />
        </mesh>
      )}

      {/* Seam indicator — a faint horizontal amber line between A and B */}
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[maxWidth * 1.05, 0.03]} />
        <meshBasicMaterial color="#e4a94a" transparent opacity={0.45} />
      </mesh>
    </>
  );
}

export default function MergedCompareViewer(props: Props) {
  return (
    <Canvas
      camera={{ position: [4, 4, 14], fov: 42, near: 0.1, far: 200 }}
      dpr={[1, 2]}
      shadows
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={["#17130e"]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[10, 14, 8]}
        intensity={1.4}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-8, 5, -6]} intensity={0.45} color="#fcd9a3" />
      <hemisphereLight args={["#3a2c1d", "#0b0805", 0.6]} />

      <Suspense fallback={null}>
        <MergedContent {...props} />
      </Suspense>

      <Grid
        cellColor="#2a2018"
        sectionColor="#4a3a26"
        args={[30, 30]}
        position={[0, -6, 0]}
        fadeDistance={50}
        fadeStrength={1.5}
        infiniteGrid
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI * 0.95}
        minDistance={3}
        maxDistance={60}
      />
      <CameraController mode="compare" />
    </Canvas>
  );
}
