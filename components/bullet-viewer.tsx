"use client";

import { Suspense, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { X3pScan } from "@/lib/x3p";
import type { ColormapName } from "@/lib/colormap";
import { buildStitchedLandGeometry } from "@/lib/geometry";
import { CameraController } from "./view-presets";

interface Props {
  scans: X3pScan[];
  colormap: ColormapName;
  zExaggeration: number;
  showWireframe: boolean;
  landCoverage: number;
}

function Cylinder({ radius, height }: { radius: number; height: number }) {
  return (
    <mesh position={[0, 0, 0]}>
      <cylinderGeometry args={[radius * 0.985, radius * 0.985, height, 128, 1, true]} />
      <meshStandardMaterial
        color="#1a1510"
        metalness={0.7}
        roughness={0.35}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function StitchedLand({
  scan,
  baseRadius,
  theta0,
  deltaTheta,
  verticalScale,
  zExaggeration,
  colormap,
  showWireframe,
}: {
  scan: X3pScan;
  baseRadius: number;
  theta0: number;
  deltaTheta: number;
  verticalScale: number;
  zExaggeration: number;
  colormap: ColormapName;
  showWireframe: boolean;
}) {
  const geometry = useMemo(
    () =>
      buildStitchedLandGeometry(scan, {
        baseRadius,
        theta0,
        deltaTheta,
        verticalScale,
        zExaggeration,
        colormap,
      }),
    [scan, baseRadius, theta0, deltaTheta, verticalScale, zExaggeration, colormap],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        vertexColors
        side={THREE.DoubleSide}
        metalness={0.3}
        roughness={0.45}
        wireframe={showWireframe}
      />
    </mesh>
  );
}

export default function BulletViewer(props: Props) {
  const { scans, colormap, zExaggeration, showWireframe, landCoverage } = props;

  const layout = useMemo(() => {
    if (scans.length === 0) return null;
    const maxHeightMeters = Math.max(...scans.map((s) => s.heightMeters));
    const verticalScale = 8 / (maxHeightMeters || 1);
    const n = scans.length;
    const coverage = Math.min(1, Math.max(0.1, landCoverage));
    const deltaTheta = (coverage * Math.PI * 2) / n;
    const baseRadius = 4.5;
    return { verticalScale, baseRadius, deltaTheta, n };
  }, [scans, landCoverage]);

  if (!layout) {
    return (
      <div className="flex h-full w-full items-center justify-center text-slate-400">
        Drop multiple .x3p files to build a stitched bullet.
      </div>
    );
  }

  const { verticalScale, baseRadius, deltaTheta, n } = layout;
  const gap = (2 * Math.PI - deltaTheta * n) / n;

  return (
    <Canvas
      camera={{ position: [10, 8, 12], fov: 40, near: 0.1, far: 200 }}
      dpr={[1, 2]}
      shadows
      gl={{ antialias: true, alpha: false }}
    >
      <color attach="background" args={["#17130e"]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[12, 14, 8]} intensity={1.3} castShadow />
      <directionalLight position={[-10, 6, -8]} intensity={0.5} color="#fcd9a3" />
      <hemisphereLight args={["#3a2c1d", "#0b0805", 0.55]} />

      <Suspense fallback={null}>
        <Cylinder radius={baseRadius} height={(Math.max(...scans.map(s => s.heightMeters)) * verticalScale)} />
        {scans.map((scan, i) => {
          const theta0 = i * (deltaTheta + gap);
          return (
            <StitchedLand
              key={`${scan.name}-${i}`}
              scan={scan}
              baseRadius={baseRadius}
              theta0={theta0}
              deltaTheta={deltaTheta}
              verticalScale={verticalScale}
              zExaggeration={zExaggeration}
              colormap={colormap}
              showWireframe={showWireframe}
            />
          );
        })}
      </Suspense>

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={50}
      />
      <CameraController mode="bullet" />
    </Canvas>
  );
}
