"use client";

import { Suspense, useEffect, useMemo } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import type { X3pScan } from "@/lib/x3p";
import type { ColormapName } from "@/lib/colormap";
import { buildLandGeometry } from "@/lib/geometry";
import {
  GROOVE_REGION_COLOR,
  grooveRegionToDisplayRect,
  type GrooveRegion,
} from "@/lib/grooves";
import { CameraController } from "./view-presets";
import { useApp } from "@/lib/store";
import {
  FULL_SIGNATURE_RANGE,
  fractionToRangeLocal,
  signatureRangeWidth,
  type SignatureRange,
} from "@/lib/signature-range";

interface Props {
  scan: X3pScan;
  colormap: ColormapName;
  zExaggeration: number;
  showWireframe: boolean;
  crosscutY: number;
}

const EMPTY_GROOVE_REGIONS: GrooveRegion[] = [];

function LandContent({
  scan,
  colormap,
  zExaggeration,
  showWireframe,
  crosscutY,
}: Props) {
  const setCrosscutY = useApp((s) => s.setCrosscutY);
  const setHighlightX = useApp((s) => s.setHighlightX);
  const highlightX = useApp((s) => s.highlightX);
  const grooveCropRange = useApp(
    (s) => s.grooveCropRangesByScan[scan.name] ?? FULL_SIGNATURE_RANGE,
  );
  const grooveVisible = useApp((s) => s.grooveVisible);
  const grooveRegions = useApp(
    (s) => s.grooveRegionsByScan[scan.name] ?? EMPTY_GROOVE_REGIONS,
  );

  const build = useMemo(
    () =>
      buildLandGeometry(
        scan,
        colormap,
        zExaggeration,
        undefined,
        undefined,
        grooveCropRange,
      ),
    [scan, colormap, zExaggeration, grooveCropRange],
  );

  useEffect(() => () => build.geometry.dispose(), [build]);

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
  const highlightLocalX =
    highlightX !== null ? fractionToRangeLocal(highlightX, build.xRange) : null;
  const xLine =
    highlightLocalX !== null ? (highlightLocalX - 0.5) * build.width : null;
  const overlayZ = Math.max(
    0.04,
    build.zMaxCenter * build.scale * zExaggeration * 50 + 0.025,
  );

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

      {grooveVisible &&
        grooveRegions.map((region, index) => (
          <GrooveRegionOverlay
            key={`${region.scanName}-${region.leftGroove}-${region.rightGroove}-${index}`}
            region={region}
            scan={scan}
            width={build.width}
            height={build.height}
            z={overlayZ}
            xRange={build.xRange}
          />
        ))}

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

function GrooveRegionOverlay({
  region,
  scan,
  width,
  height,
  z,
  xRange,
}: {
  region: GrooveRegion;
  scan: X3pScan;
  width: number;
  height: number;
  z: number;
  xRange: SignatureRange;
}) {
  const rect = grooveRegionToDisplayRect(region, scan);
  const clippedX0 = Math.max(rect.x0, xRange.x0);
  const clippedX1 = Math.min(rect.x1, xRange.x1);
  if (clippedX1 <= clippedX0) return null;

  const localWidth = signatureRangeWidth(xRange) || 1;
  const localX0 = (clippedX0 - xRange.x0) / localWidth;
  const localX1 = (clippedX1 - xRange.x0) / localWidth;
  const regionWidth = Math.max(0, (localX1 - localX0) * width);
  const regionHeight = Math.max(0, (rect.y1 - rect.y0) * height);
  if (regionWidth <= 0 || regionHeight <= 0) return null;

  const x = ((localX0 + localX1) * 0.5 - 0.5) * width;
  const y = ((rect.y0 + rect.y1) * 0.5 - 0.5) * height;
  const border = Math.max(0.025, Math.min(width, height) * 0.004);
  const borderZ = z + 0.004;

  return (
    <group>
      <mesh position={[x, y, z]} renderOrder={10}>
        <planeGeometry args={[regionWidth, regionHeight]} />
        <meshBasicMaterial
          color={GROOVE_REGION_COLOR}
          transparent
          opacity={0.18}
          depthWrite={false}
          depthTest={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[x, y - regionHeight / 2, borderZ]} renderOrder={11}>
        <planeGeometry args={[regionWidth, border]} />
        <meshBasicMaterial
          color={GROOVE_REGION_COLOR}
          transparent
          opacity={0.9}
          depthWrite={false}
          depthTest={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[x, y + regionHeight / 2, borderZ]} renderOrder={11}>
        <planeGeometry args={[regionWidth, border]} />
        <meshBasicMaterial
          color={GROOVE_REGION_COLOR}
          transparent
          opacity={0.9}
          depthWrite={false}
          depthTest={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[x - regionWidth / 2, y, borderZ]} renderOrder={11}>
        <planeGeometry args={[border, regionHeight]} />
        <meshBasicMaterial
          color={GROOVE_REGION_COLOR}
          transparent
          opacity={0.9}
          depthWrite={false}
          depthTest={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[x + regionWidth / 2, y, borderZ]} renderOrder={11}>
        <planeGeometry args={[border, regionHeight]} />
        <meshBasicMaterial
          color={GROOVE_REGION_COLOR}
          transparent
          opacity={0.9}
          depthWrite={false}
          depthTest={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export default function LandViewer(props: Props) {
  return (
    <Canvas
      camera={{ position: [8, 6, 8], fov: 42, near: 0.1, far: 200 }}
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
