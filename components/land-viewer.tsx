"use client";

import { Suspense, useEffect, useMemo } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import type { X3pScan } from "@/lib/x3p";
import type { ColormapName } from "@/lib/colormap";
import { buildLandGeometry } from "@/lib/geometry";
import { CameraController } from "./view-presets";
import { useApp } from "@/lib/store";

interface Props {
  scan: X3pScan;
  colormap: ColormapName;
  zExaggeration: number;
  showWireframe: boolean;
  crosscutY: number;
}

function LandContent({
  scan,
  colormap,
  zExaggeration,
  showWireframe,
  crosscutY,
}: Props) {
  const build = useMemo(
    () => buildLandGeometry(scan, colormap, zExaggeration),
    [scan, colormap, zExaggeration],
  );

  useEffect(() => () => build.geometry.dispose(), [build]);

  const setCrosscutY = useApp((s) => s.setCrosscutY);
  const setHighlightX = useApp((s) => s.setHighlightX);
  const highlightX = useApp((s) => s.highlightX);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!e.uv) return;
    e.stopPropagation();
    setCrosscutY(e.uv.y);
    setHighlightX(e.uv.x);
  };

  const handlePointerOver = () => {
    document.body.style.cursor = "crosshair";
  };
  const handlePointerOut = () => {
    document.body.style.cursor = "";
  };

  const yLine = (crosscutY - 0.5) * build.height;
  const xLine = highlightX !== null ? (highlightX - 0.5) * build.width : null;

  return (
    <>
      <mesh
        geometry={build.geometry}
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

      {/* Y crosscut indicator — horizontal line across width */}
      <mesh position={[0, yLine, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[build.width * 1.05, 0.03]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.9} />
      </mesh>

      {/* X highlight indicator — vertical line along height (optional) */}
      {xLine !== null && (
        <>
          <mesh position={[xLine, 0, 0]} rotation={[Math.PI / 2, 0, Math.PI / 2]}>
            <planeGeometry args={[build.height * 1.05, 0.03]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.9} />
          </mesh>
          {/* Intersection marker at the crosshair point */}
          <mesh position={[xLine, yLine, 0]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshBasicMaterial color="#fde68a" />
          </mesh>
        </>
      )}
    </>
  );
}

function SceneBackground() {
  const { scene } = useThree();
  useEffect(() => {
    scene.background = new THREE.Color("#17130e");
  }, [scene]);
  return null;
}

export default function LandViewer(props: Props) {
  return (
    <Canvas
      camera={{ position: [8, 6, 8], fov: 42, near: 0.1, far: 200 }}
      dpr={[1, 2]}
      shadows
      gl={{ antialias: true, alpha: false }}
    >
      <SceneBackground />
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
        <LandContent {...props} />
      </Suspense>

      <Grid
        cellColor="#2a2018"
        sectionColor="#4a3a26"
        args={[20, 20]}
        position={[0, -2.5, 0]}
        fadeDistance={40}
        fadeStrength={1.5}
        infiniteGrid
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI * 0.95}
        minDistance={2}
        maxDistance={40}
      />
      <CameraController mode="land" />
    </Canvas>
  );
}
