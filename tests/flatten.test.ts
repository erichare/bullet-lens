import { describe, it, expect } from "vitest";
import { flattenSignature } from "@/lib/flatten";

function linspace(n: number, start: number, end: number): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = start + (end - start) * (i / (n - 1));
  return out;
}

describe("flattenSignature", () => {
  it("removes a linear trend to near-zero residual", () => {
    const n = 200;
    const x = linspace(n, 0, 1);
    const z = new Float32Array(n);
    for (let i = 0; i < n; i++) z[i] = 3 * x[i] + 5;

    const out = flattenSignature(x, z, {
      method: "polynomial",
      degree: 1,
      trimFrac: 0.1,
    });
    expect(out.x.length).toBe(Math.ceil(n * 0.9) - Math.floor(n * 0.1));
    for (let i = 0; i < out.z.length; i++) {
      expect(Math.abs(out.z[i])).toBeLessThan(1e-4);
    }
  });

  it("removes a quadratic trend cleanly", () => {
    const n = 300;
    const x = linspace(n, -1, 1);
    const z = new Float32Array(n);
    for (let i = 0; i < n; i++) z[i] = 2 * x[i] * x[i] - 0.5 * x[i] + 1;

    const out = flattenSignature(x, z, {
      method: "polynomial",
      degree: 2,
      trimFrac: 0.1,
    });
    for (let i = 0; i < out.z.length; i++) {
      expect(Math.abs(out.z[i])).toBeLessThan(1e-3);
    }
  });

  it("preserves high-frequency signal when trend is quadratic", () => {
    const n = 400;
    const x = linspace(n, 0, 1);
    const z = new Float32Array(n);
    // Low-freq parabola + high-freq sinusoid we want to keep.
    for (let i = 0; i < n; i++) {
      const trend = 10 * (x[i] - 0.5) ** 2;
      const signal = 0.3 * Math.sin(40 * x[i]);
      z[i] = trend + signal;
    }

    const out = flattenSignature(x, z, {
      method: "polynomial",
      degree: 2,
      trimFrac: 0.1,
    });
    // Sinusoid amplitude should survive basically intact.
    let maxAbs = 0;
    for (let i = 0; i < out.z.length; i++) {
      maxAbs = Math.max(maxAbs, Math.abs(out.z[i]));
    }
    expect(maxAbs).toBeGreaterThan(0.25);
    expect(maxAbs).toBeLessThan(0.35);
  });

  it("trims the endpoint region by the requested fraction", () => {
    const n = 100;
    const x = linspace(n, 0, 1);
    const z = new Float32Array(n);

    const out = flattenSignature(x, z, {
      method: "polynomial",
      degree: 2,
      trimFrac: 0.2,
    });
    expect(out.x.length).toBe(Math.ceil(n * 0.8) - Math.floor(n * 0.2));
    expect(out.x[0]).toBeGreaterThanOrEqual(0.19);
    expect(out.x[out.x.length - 1]).toBeLessThanOrEqual(0.81);
  });

  it("propagates NaN input samples to NaN output residuals", () => {
    const n = 120;
    const x = linspace(n, 0, 1);
    const z = new Float32Array(n);
    for (let i = 0; i < n; i++) z[i] = 2 * x[i] + 1;
    z[60] = NaN;

    const out = flattenSignature(x, z, {
      method: "polynomial",
      degree: 1,
      trimFrac: 0.1,
    });
    const nanPos = 60 - Math.floor(n * 0.1);
    expect(Number.isNaN(out.z[nanPos])).toBe(true);
  });

  it("returns empty arrays when insufficient samples remain after trim", () => {
    const x = new Float32Array([0, 0.5, 1]);
    const z = new Float32Array([0, 1, 2]);
    const out = flattenSignature(x, z, {
      method: "polynomial",
      degree: 3,
      trimFrac: 0.4,
    });
    expect(out.x.length).toBe(0);
    expect(out.z.length).toBe(0);
    expect(out.coeffs.length).toBe(0);
  });

  it("uses LOESS by default for a local smooth baseline", () => {
    const n = 240;
    const x = linspace(n, 0, 1);
    const z = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const slowCurve = 0.5 * Math.sin(2 * Math.PI * x[i]) + 0.25 * x[i];
      const striae = 0.08 * Math.sin(70 * Math.PI * x[i]);
      z[i] = slowCurve + striae;
    }

    const out = flattenSignature(x, z, { trimFrac: 0, spanFrac: 0.22 });

    expect(out.method).toBe("loess");
    expect(out.x.length).toBe(n);
    expect(out.baseline.length).toBe(n);

    let residualMean = 0;
    let maxResidual = 0;
    for (let i = 0; i < out.z.length; i++) {
      residualMean += out.z[i];
      maxResidual = Math.max(maxResidual, Math.abs(out.z[i]));
    }
    residualMean /= out.z.length;

    expect(Math.abs(residualMean)).toBeLessThan(0.02);
    expect(maxResidual).toBeGreaterThan(0.04);
    expect(maxResidual).toBeLessThan(0.18);
  });

  it("can hide flattened edge guard bands", () => {
    const n = 100;
    const x = linspace(n, 0, 1);
    const z = new Float32Array(n);
    for (let i = 0; i < n; i++) z[i] = Math.sin(x[i] * Math.PI);

    const out = flattenSignature(x, z, {
      trimFrac: 0,
      spanFrac: 0.2,
      edgeGuardFrac: 0.05,
    });

    for (let i = 0; i < 5; i++) {
      expect(Number.isNaN(out.z[i])).toBe(true);
      expect(Number.isNaN(out.z[out.z.length - 1 - i])).toBe(true);
    }
    expect(Number.isFinite(out.z[10])).toBe(true);
    expect(Number.isFinite(out.z[out.z.length - 11])).toBe(true);
  });

  it("can adaptively extend edge guard bands until residuals settle", () => {
    const n = 120;
    const x = linspace(n, 0, 1);
    const z = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      z[i] = 0.02 * Math.sin(i);
      if (i < 12) z[i] -= 4 - i * 0.25;
      if (i >= n - 10) z[i] -= 4 - (n - 1 - i) * 0.25;
    }

    const out = flattenSignature(x, z, {
      method: "polynomial",
      degree: 1,
      trimFrac: 0,
      edgeGuardFrac: 0.02,
      edgeSettleSigma: 3,
      edgeSettleRun: 6,
    });

    expect(Number.isNaN(out.z[10])).toBe(true);
    expect(Number.isFinite(out.z[30])).toBe(true);
    expect(Number.isNaN(out.z[n - 10])).toBe(true);
    expect(Number.isFinite(out.z[n - 30])).toBe(true);
  });
});
