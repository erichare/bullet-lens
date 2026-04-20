import { describe, it, expect } from "vitest";
import { parseX3p, decimate, transposeScan } from "@/lib/x3p";
import { asFile, buildSyntheticX3p } from "./fixtures/build-x3p";

describe("parseX3p", () => {
  it("round-trips a float64 synthetic scan", async () => {
    const { zipBytes, sizeX, sizeY, increment, truthZ } = buildSyntheticX3p({
      sizeX: 32,
      sizeY: 24,
    });
    const scan = await parseX3p(asFile(zipBytes, "round-trip.x3p"));

    expect(scan.name).toBe("round-trip.x3p");
    expect(scan.meta.sizeX).toBe(sizeX);
    expect(scan.meta.sizeY).toBe(sizeY);
    expect(scan.widthMeters).toBeCloseTo((sizeX - 1) * increment, 12);
    expect(scan.heightMeters).toBeCloseTo((sizeY - 1) * increment, 12);

    // Every cell should decode within float32 precision of the truth.
    expect(scan.z.length).toBe(sizeX * sizeY);
    for (let i = 0; i < scan.z.length; i++) {
      expect(scan.z[i]).toBeCloseTo(truthZ[i], 7);
    }

    expect(scan.validCount).toBe(sizeX * sizeY);
    expect(scan.zMin).toBeLessThan(scan.zMax);
    expect(Number.isFinite(scan.zMean)).toBe(true);
  });

  it("decodes float32 payloads", async () => {
    const { zipBytes, truthZ } = buildSyntheticX3p({
      sizeX: 16,
      sizeY: 12,
      dataType: "F",
    });
    const scan = await parseX3p(asFile(zipBytes));
    for (let i = 0; i < truthZ.length; i++) {
      expect(scan.z[i]).toBeCloseTo(truthZ[i], 6);
    }
  });

  it("decodes int16 payloads with CZ.Increment applied", async () => {
    const { zipBytes, truthZ } = buildSyntheticX3p({
      sizeX: 16,
      sizeY: 12,
      dataType: "I",
    });
    const scan = await parseX3p(asFile(zipBytes));
    // int16 with 1e-9 increment rounds at 1 nm resolution.
    for (let i = 0; i < truthZ.length; i++) {
      expect(scan.z[i]).toBeCloseTo(truthZ[i], 8);
    }
  });

  it("preserves NaN cells and excludes them from stats", async () => {
    const nanIndices = [0, 5, 10, 100];
    const { zipBytes } = buildSyntheticX3p({
      sizeX: 16,
      sizeY: 16,
      nanIndices,
    });
    const scan = await parseX3p(asFile(zipBytes));
    for (const idx of nanIndices) {
      expect(Number.isNaN(scan.z[idx])).toBe(true);
    }
    expect(scan.validCount).toBe(16 * 16 - nanIndices.length);
    expect(Number.isFinite(scan.zMin)).toBe(true);
    expect(Number.isFinite(scan.zMax)).toBe(true);
  });

  it("recovers from undeclared namespace prefixes", async () => {
    const { zipBytes } = buildSyntheticX3p({
      sizeX: 16,
      sizeY: 12,
      withBadNamespace: true,
    });
    const scan = await parseX3p(asFile(zipBytes));
    expect(scan.meta.sizeX).toBe(16);
    expect(scan.meta.sizeY).toBe(12);
    expect(scan.validCount).toBe(16 * 12);
  });

  it("reads Record2 metadata when present", async () => {
    const { zipBytes } = buildSyntheticX3p({ sizeX: 8, sizeY: 8 });
    const scan = await parseX3p(asFile(zipBytes));
    expect(scan.meta.instrument).toBe("Synthetic Test Scanner");
    expect(scan.meta.probingSystem).toBe("synthetic-probe");
    expect(scan.meta.creationDate).toBe("2024-01-15T12:00:00");
  });

  it("throws on non-ZIP input", async () => {
    const bogus = new Uint8Array([1, 2, 3, 4, 5]);
    await expect(parseX3p(asFile(bogus, "bogus.x3p"))).rejects.toThrow(
      /failed to unzip/,
    );
  });
});

describe("decimate", () => {
  it("passes through when grid already fits under maxPoints", async () => {
    const { zipBytes } = buildSyntheticX3p({ sizeX: 16, sizeY: 16 });
    const scan = await parseX3p(asFile(zipBytes));
    const out = decimate(scan, 1_000_000);
    expect(out.nx).toBe(16);
    expect(out.ny).toBe(16);
    expect(out.strideX).toBe(1);
    expect(out.strideY).toBe(1);
    expect(out.z.length).toBe(16 * 16);
  });

  it("reduces cell count below the cap for oversized grids", async () => {
    const { zipBytes } = buildSyntheticX3p({ sizeX: 200, sizeY: 200 });
    const scan = await parseX3p(asFile(zipBytes));
    const cap = 5_000;
    const out = decimate(scan, cap);
    expect(out.nx * out.ny).toBeLessThanOrEqual(cap);
    expect(out.strideX).toBeGreaterThan(1);
    expect(out.strideY).toBe(out.strideX);
  });

  it("preserves NaN sentinel when sampling masked cells", async () => {
    const idx = 5 * 16 + 7;
    const { zipBytes } = buildSyntheticX3p({
      sizeX: 16,
      sizeY: 16,
      nanIndices: [idx],
    });
    const scan = await parseX3p(asFile(zipBytes));
    const out = decimate(scan, 1_000_000);
    expect(Number.isNaN(out.z[idx])).toBe(true);
  });
});

describe("transposeScan", () => {
  it("swaps sizeX/sizeY, axis metadata, and physical extents", async () => {
    const { zipBytes } = buildSyntheticX3p({ sizeX: 8, sizeY: 12 });
    const scan = await parseX3p(asFile(zipBytes, "t.x3p"));
    const t = transposeScan(scan);

    expect(t.meta.sizeX).toBe(scan.meta.sizeY);
    expect(t.meta.sizeY).toBe(scan.meta.sizeX);
    expect(t.widthMeters).toBeCloseTo(scan.heightMeters, 12);
    expect(t.heightMeters).toBeCloseTo(scan.widthMeters, 12);
    expect(t.meta.cx).toBe(scan.meta.cy);
    expect(t.meta.cy).toBe(scan.meta.cx);
  });

  it("places original (i, j) at transposed (j, i)", async () => {
    const { zipBytes } = buildSyntheticX3p({ sizeX: 5, sizeY: 3 });
    const scan = await parseX3p(asFile(zipBytes, "t.x3p"));
    const t = transposeScan(scan);

    for (let j = 0; j < scan.meta.sizeY; j++) {
      for (let i = 0; i < scan.meta.sizeX; i++) {
        const orig = scan.z[j * scan.meta.sizeX + i];
        // After transpose, (i, j) becomes (j, i) — i.e., new col = old row.
        const transposed = t.z[i * t.meta.sizeX + j];
        if (Number.isFinite(orig)) {
          expect(transposed).toBeCloseTo(orig, 7);
        } else {
          expect(Number.isNaN(transposed)).toBe(true);
        }
      }
    }
  });

  it("is an involution: transposing twice returns the original layout", async () => {
    const { zipBytes } = buildSyntheticX3p({ sizeX: 7, sizeY: 4 });
    const scan = await parseX3p(asFile(zipBytes, "t.x3p"));
    const tt = transposeScan(transposeScan(scan));
    expect(tt.meta.sizeX).toBe(scan.meta.sizeX);
    expect(tt.meta.sizeY).toBe(scan.meta.sizeY);
    for (let k = 0; k < scan.z.length; k++) {
      if (Number.isFinite(scan.z[k])) {
        expect(tt.z[k]).toBeCloseTo(scan.z[k], 7);
      }
    }
  });

  it("flips the direction of high-frequency stripes (proxy for striae)", async () => {
    // Baseline fixture produces ripples along X (striae-like). After
    // transpose those ripples should move from row-direction to col-direction.
    const { zipBytes } = buildSyntheticX3p({ sizeX: 16, sizeY: 8 });
    const scan = await parseX3p(asFile(zipBytes, "t.x3p"));
    const t = transposeScan(scan);

    const hf = (arr: Float32Array) => {
      let e = 0;
      let n = 0;
      for (let i = 1; i < arr.length; i++) {
        const a = arr[i - 1];
        const b = arr[i];
        if (Number.isFinite(a) && Number.isFinite(b)) {
          const d = b - a;
          e += d * d;
          n++;
        }
      }
      return n ? e / n : 0;
    };

    // Sample mid-row and mid-column of original vs transposed.
    const origRow = new Float32Array(scan.meta.sizeX);
    for (let i = 0; i < scan.meta.sizeX; i++) {
      origRow[i] = scan.z[Math.floor(scan.meta.sizeY / 2) * scan.meta.sizeX + i];
    }
    const tRow = new Float32Array(t.meta.sizeX);
    for (let i = 0; i < t.meta.sizeX; i++) {
      tRow[i] = t.z[Math.floor(t.meta.sizeY / 2) * t.meta.sizeX + i];
    }

    // Where ripples ran along X (rows) in the original, after transpose rows
    // should be smooth — so tRow has less high-freq energy than origRow.
    expect(hf(origRow)).toBeGreaterThan(hf(tRow));
  });
});
