import { describe, it, expect } from "vitest";
import { parseX3p } from "@/lib/x3p";
import {
  buildLandGeometry,
  buildStitchedLandGeometry,
  extractCrosscut,
} from "@/lib/geometry";
import { asFile, buildSyntheticX3p } from "./fixtures/build-x3p";

describe("extractCrosscut", () => {
  it("picks a valid row in the Z matrix", async () => {
    const { zipBytes, sizeX, sizeY, increment } = buildSyntheticX3p({
      sizeX: 40,
      sizeY: 20,
    });
    const scan = await parseX3p(asFile(zipBytes));
    const row = extractCrosscut(scan, 0.5);
    expect(row.x.length).toBe(sizeX);
    expect(row.z.length).toBe(sizeX);
    // Y is measured from the bottom edge; middle row lands at j=floor((sizeY-1)/2).
    const j = Math.round(0.5 * (sizeY - 1));
    expect(row.yMeters).toBeCloseTo(j * increment, 12);
    // X positions are monotonically increasing and match increment. Float32
    // storage limits precision to ~7 decimal digits, so only require the
    // delta to match to 10 fractional digits.
    for (let i = 1; i < row.x.length; i++) {
      expect(row.x[i] - row.x[i - 1]).toBeCloseTo(increment, 10);
    }
  });

  it("clamps yFrac outside [0,1] to the nearest valid row", async () => {
    const { zipBytes } = buildSyntheticX3p({ sizeX: 20, sizeY: 10 });
    const scan = await parseX3p(asFile(zipBytes));
    const low = extractCrosscut(scan, -10);
    const first = extractCrosscut(scan, 0);
    expect(low.yMeters).toBe(first.yMeters);

    const hi = extractCrosscut(scan, 10);
    const last = extractCrosscut(scan, 1);
    expect(hi.yMeters).toBe(last.yMeters);
  });
});

describe("buildLandGeometry", () => {
  it("returns a geometry whose positions match the grid cell count", async () => {
    const { zipBytes } = buildSyntheticX3p({ sizeX: 24, sizeY: 18 });
    const scan = await parseX3p(asFile(zipBytes));
    const { geometry, width, height, scale } = buildLandGeometry(
      scan,
      "viridis",
      1,
    );

    const pos = geometry.getAttribute("position");
    expect(pos.count).toBe(24 * 18);
    expect(pos.itemSize).toBe(3);

    const color = geometry.getAttribute("color");
    expect(color.count).toBe(pos.count);

    // Scale normalizes largest horizontal extent to 10 scene units.
    expect(Math.max(width, height)).toBeCloseTo(10, 5);
    expect(scale).toBeGreaterThan(0);
  });

  it("omits triangles touching NaN cells", async () => {
    // Mask the entire first row; first 2*(sizeX-1) triangles should vanish.
    const sizeX = 16;
    const sizeY = 12;
    const nanIndices: number[] = [];
    for (let i = 0; i < sizeX; i++) nanIndices.push(i);
    const { zipBytes } = buildSyntheticX3p({ sizeX, sizeY, nanIndices });
    const scan = await parseX3p(asFile(zipBytes));

    const cleanZ = new Float32Array(scan.z.length);
    const clean = buildLandGeometry(
      { ...scan, z: cleanZ, validCount: cleanZ.length },
      "viridis",
      1,
    );
    const masked = buildLandGeometry(scan, "viridis", 1);

    const cleanIdx = clean.geometry.getIndex();
    const maskedIdx = masked.geometry.getIndex();
    expect(cleanIdx).not.toBeNull();
    expect(maskedIdx).not.toBeNull();
    expect(maskedIdx!.count).toBeLessThan(cleanIdx!.count);
  });

  it("honors sharedMaxPhys for cross-scan scaling consistency", async () => {
    const smallBytes = buildSyntheticX3p({ sizeX: 20, sizeY: 20 }).zipBytes;
    const bigBytes = buildSyntheticX3p({
      sizeX: 20,
      sizeY: 20,
      increment: 5e-6,
    }).zipBytes;
    const small = await parseX3p(asFile(smallBytes, "small.x3p"));
    const big = await parseX3p(asFile(bigBytes, "big.x3p"));
    const sharedMaxPhys = Math.max(
      small.widthMeters,
      small.heightMeters,
      big.widthMeters,
      big.heightMeters,
    );

    const aSolo = buildLandGeometry(small, "viridis", 1);
    const aShared = buildLandGeometry(
      small,
      "viridis",
      1,
      undefined,
      sharedMaxPhys,
    );
    // Shared scaling shrinks the smaller scan relative to its solo rendering.
    expect(aShared.width).toBeLessThan(aSolo.width);
  });
});

describe("buildStitchedLandGeometry", () => {
  it("produces positions on the cylindrical section", async () => {
    const { zipBytes } = buildSyntheticX3p({ sizeX: 30, sizeY: 20 });
    const scan = await parseX3p(asFile(zipBytes));
    const baseRadius = 4.5;
    const geo = buildStitchedLandGeometry(scan, {
      baseRadius,
      theta0: 0,
      deltaTheta: Math.PI / 6,
      verticalScale: 1,
      zExaggeration: 1,
      colormap: "cividis",
    });
    const pos = geo.getAttribute("position");
    expect(pos.count).toBe(30 * 20);

    // Each vertex sits within a narrow band around baseRadius.
    const radii: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      radii.push(Math.hypot(x, z));
    }
    const minR = Math.min(...radii);
    const maxR = Math.max(...radii);
    expect(minR).toBeGreaterThan(baseRadius * 0.85);
    expect(maxR).toBeLessThan(baseRadius * 1.15);
  });
});
