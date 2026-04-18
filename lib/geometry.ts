import * as THREE from "three";
import { sampleColor, type ColormapName } from "./colormap";
import type { X3pScan } from "./x3p";
import { decimate } from "./x3p";

export interface SurfaceBuildResult {
  geometry: THREE.BufferGeometry;
  /** Physical extents in rendering units (scene scaled so max horizontal = 10). */
  width: number;
  height: number;
  scale: number;
  zMinCenter: number;
  zMaxCenter: number;
}

const TARGET_MAX_DIM = 10; // scene units for the larger horizontal axis

/**
 * Build a flat (planar) surface BufferGeometry from an x3p scan.
 * Vertices lie in the XY plane with height along Z, colored by a colormap.
 * NaN cells cause their surrounding triangles to be dropped.
 */
export function buildLandGeometry(
  scan: X3pScan,
  colormap: ColormapName,
  zExaggeration: number,
  maxPoints = 400_000,
  /**
   * Optional shared physical scale (in meters) used to normalize multiple
   * scans onto a common scene scale — useful for the merged compare view so
   * two lands are rendered at the SAME physical size regardless of their
   * individual dimensions.
   */
  sharedMaxPhys?: number,
): SurfaceBuildResult {
  const { nx, ny, z } = decimate(scan, maxPoints);

  const physW = scan.widthMeters;
  const physH = scan.heightMeters;
  const maxPhys = sharedMaxPhys ?? (Math.max(physW, physH) || 1);
  const scale = TARGET_MAX_DIM / maxPhys;
  const width = physW * scale;
  const height = physH * scale;

  // Center Z around its median so the surface sits near z=0
  let zValid = 0;
  let zSum = 0;
  for (let i = 0; i < z.length; i++) {
    const v = z[i];
    if (Number.isFinite(v)) {
      zSum += v;
      zValid++;
    }
  }
  const zCenter = zValid ? zSum / zValid : 0;
  // Exaggerate Z visually relative to horizontal extent.
  const zScale = scale * zExaggeration * 50;

  const vertexCount = nx * ny;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const validMask = new Uint8Array(vertexCount);

  // Find z range of centered data
  let zMinCenter = Infinity;
  let zMaxCenter = -Infinity;
  for (let i = 0; i < z.length; i++) {
    const v = z[i];
    if (Number.isFinite(v)) {
      const d = v - zCenter;
      if (d < zMinCenter) zMinCenter = d;
      if (d > zMaxCenter) zMaxCenter = d;
    }
  }
  if (!Number.isFinite(zMinCenter)) {
    zMinCenter = -1e-6;
    zMaxCenter = 1e-6;
  }
  const zRange = zMaxCenter - zMinCenter || 1e-9;

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const idx = j * nx + i;
      const x = (i / (nx - 1) - 0.5) * width;
      const y = (j / (ny - 1) - 0.5) * height;
      const zRaw = z[idx];
      const valid = Number.isFinite(zRaw);
      validMask[idx] = valid ? 1 : 0;
      const zCentered = valid ? zRaw - zCenter : 0;
      positions[idx * 3] = x;
      positions[idx * 3 + 1] = y;
      positions[idx * 3 + 2] = zCentered * zScale;
      const t = valid ? (zCentered - zMinCenter) / zRange : 0;
      const [r, g, b] = sampleColor(colormap, t);
      colors[idx * 3] = r;
      colors[idx * 3 + 1] = g;
      colors[idx * 3 + 2] = b;
      uvs[idx * 2] = i / (nx - 1);
      uvs[idx * 2 + 1] = j / (ny - 1);
    }
  }

  const triangles: number[] = [];
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = j * nx + i + 1;
      const c = (j + 1) * nx + i;
      const d = (j + 1) * nx + i + 1;
      if (validMask[a] && validMask[b] && validMask[c]) {
        triangles.push(a, c, b);
      }
      if (validMask[b] && validMask[c] && validMask[d]) {
        triangles.push(b, c, d);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(
    triangles.length < 65536
      ? new THREE.Uint16BufferAttribute(triangles, 1)
      : new THREE.Uint32BufferAttribute(triangles, 1),
  );
  geometry.computeVertexNormals();

  return { geometry, width, height, scale, zMinCenter, zMaxCenter };
}

/**
 * Build a cylindrical section for one land in a stitched-bullet view. The land
 * occupies an angular range [theta0, theta0+deltaTheta] around the Y axis.
 *
 * The X axis of the scan maps to angular position; Y axis maps to vertical
 * position on the cylinder. Height values displace the surface radially
 * outward from a base radius.
 */
export interface StitchedBuildOptions {
  baseRadius: number;
  theta0: number; // radians
  deltaTheta: number; // radians — angular width of this land
  verticalScale: number; // scene units per meter (Y axis)
  zExaggeration: number;
  colormap: ColormapName;
}

/**
 * Separate a 2D scan into a low-frequency baseline (the bullet's natural arc
 * curvature across X) and a high-frequency detail signal (striae). The
 * baseline is a smoothed 1D profile taken as the mean over Y per X column,
 * then smoothed with a moving-average window ~4% of nx.
 *
 * This lets the stitched-bullet view render the physical curvature at a
 * fixed scale while independently amplifying the striae detail.
 */
function detrendBaseline(
  z: Float32Array,
  nx: number,
  ny: number,
): { baseline: Float32Array; baselineMean: number } {
  const colMean = new Float32Array(nx);
  const colCount = new Int32Array(nx);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const v = z[j * nx + i];
      if (Number.isFinite(v)) {
        colMean[i] += v;
        colCount[i] += 1;
      }
    }
  }
  for (let i = 0; i < nx; i++) {
    colMean[i] = colCount[i] > 0 ? colMean[i] / colCount[i] : NaN;
  }

  // Fill any NaN columns by linear interpolation between neighbours so the
  // smoother doesn't break.
  for (let i = 0; i < nx; i++) {
    if (!Number.isFinite(colMean[i])) {
      let left = i - 1;
      while (left >= 0 && !Number.isFinite(colMean[left])) left--;
      let right = i + 1;
      while (right < nx && !Number.isFinite(colMean[right])) right++;
      const lv = left >= 0 ? colMean[left] : undefined;
      const rv = right < nx ? colMean[right] : undefined;
      if (lv !== undefined && rv !== undefined) {
        const t = (i - left) / (right - left);
        colMean[i] = lv + t * (rv - lv);
      } else if (lv !== undefined) {
        colMean[i] = lv;
      } else if (rv !== undefined) {
        colMean[i] = rv;
      } else {
        colMean[i] = 0;
      }
    }
  }

  // Moving-average smoothing — window wide enough to erase striae but narrow
  // enough to preserve the overall arc.
  const win = Math.max(11, Math.floor(nx * 0.04));
  const half = Math.floor(win / 2);
  const baseline = new Float32Array(nx);
  let runningSum = 0;
  for (let i = 0; i < Math.min(win, nx); i++) runningSum += colMean[i];
  for (let i = 0; i < nx; i++) {
    const left = Math.max(0, i - half);
    const right = Math.min(nx - 1, i + half);
    let sum = 0;
    for (let k = left; k <= right; k++) sum += colMean[k];
    baseline[i] = sum / (right - left + 1);
  }

  let meanSum = 0;
  for (let i = 0; i < nx; i++) meanSum += baseline[i];
  const baselineMean = meanSum / nx;

  return { baseline, baselineMean };
}

export function buildStitchedLandGeometry(
  scan: X3pScan,
  opts: StitchedBuildOptions,
  maxPoints = 250_000,
): THREE.BufferGeometry {
  const { nx, ny, z } = decimate(scan, maxPoints);
  const { baseRadius, theta0, deltaTheta, verticalScale, zExaggeration, colormap } = opts;

  // Separate bullet's natural curvature (baseline) from striae (detail) so
  // that Z exaggeration can amplify the striae without distorting the
  // physical curvature of the bullet.
  const { baseline, baselineMean } = detrendBaseline(z, nx, ny);

  // Ranges — baseline only spans X, detail spans the whole matrix.
  let baselineMin = Infinity;
  let baselineMax = -Infinity;
  for (let i = 0; i < nx; i++) {
    const v = baseline[i] - baselineMean;
    if (v < baselineMin) baselineMin = v;
    if (v > baselineMax) baselineMax = v;
  }
  if (!Number.isFinite(baselineMin)) {
    baselineMin = -1e-6;
    baselineMax = 1e-6;
  }
  const baselineRange = baselineMax - baselineMin || 1e-9;

  let detailMin = Infinity;
  let detailMax = -Infinity;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const v = z[j * nx + i];
      if (!Number.isFinite(v)) continue;
      const d = v - baseline[i];
      if (d < detailMin) detailMin = d;
      if (d > detailMax) detailMax = d;
    }
  }
  if (!Number.isFinite(detailMin)) {
    detailMin = -1e-6;
    detailMax = 1e-6;
  }
  const detailRange = detailMax - detailMin || 1e-9;

  // Fixed curvature amplitude (natural bullet arc) + exaggerable striae.
  const baselineAmp = baseRadius * 0.05;
  const detailAmp = baseRadius * 0.03 * zExaggeration;

  const physH = scan.heightMeters;
  const heightScene = physH * verticalScale;

  const vertexCount = nx * ny;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const validMask = new Uint8Array(vertexCount);

  for (let j = 0; j < ny; j++) {
    const yScene = (j / (ny - 1) - 0.5) * heightScene;
    for (let i = 0; i < nx; i++) {
      const idx = j * nx + i;
      const t = i / (nx - 1);
      const theta = theta0 + t * deltaTheta;
      const zRaw = z[idx];
      const valid = Number.isFinite(zRaw);
      validMask[idx] = valid ? 1 : 0;
      const bCentered = baseline[i] - baselineMean;
      const detail = valid ? zRaw - baseline[i] : 0;
      const r =
        baseRadius +
        baselineAmp * (bCentered / baselineRange) +
        detailAmp * (detail / detailRange);
      positions[idx * 3] = Math.cos(theta) * r;
      positions[idx * 3 + 1] = yScene;
      positions[idx * 3 + 2] = Math.sin(theta) * r;
      // Color by detail so striae are visually emphasised regardless of zExag.
      const tColor = valid ? (detail - detailMin) / detailRange : 0;
      const [cr, cg, cb] = sampleColor(colormap, tColor);
      colors[idx * 3] = cr;
      colors[idx * 3 + 1] = cg;
      colors[idx * 3 + 2] = cb;
    }
  }

  const triangles: number[] = [];
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = j * nx + i + 1;
      const c = (j + 1) * nx + i;
      const d = (j + 1) * nx + i + 1;
      if (validMask[a] && validMask[b] && validMask[c]) {
        triangles.push(a, b, c);
      }
      if (validMask[b] && validMask[c] && validMask[d]) {
        triangles.push(b, d, c);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(
    triangles.length < 65536
      ? new THREE.Uint16BufferAttribute(triangles, 1)
      : new THREE.Uint32BufferAttribute(triangles, 1),
  );
  geometry.computeVertexNormals();
  return geometry;
}

/** Extract a horizontal crosscut (signature row) at Y fraction 0..1. */
export function extractCrosscut(
  scan: X3pScan,
  yFrac: number,
): { x: Float32Array; z: Float32Array; yMeters: number } {
  const { sizeX, sizeY } = scan.meta;
  const j = Math.max(0, Math.min(sizeY - 1, Math.round(yFrac * (sizeY - 1))));
  const xs = new Float32Array(sizeX);
  const zs = new Float32Array(sizeX);
  const incX = scan.meta.cx.increment || 1;
  const incY = scan.meta.cy.increment || 1;
  for (let i = 0; i < sizeX; i++) {
    xs[i] = i * incX;
    zs[i] = scan.z[j * sizeX + i];
  }
  return { x: xs, z: zs, yMeters: j * incY };
}
