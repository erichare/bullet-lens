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

    const out = flattenSignature(x, z, { degree: 1, trimFrac: 0.1 });
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

    const out = flattenSignature(x, z, { degree: 2, trimFrac: 0.1 });
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

    const out = flattenSignature(x, z, { degree: 2, trimFrac: 0.1 });
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

    const out = flattenSignature(x, z, { degree: 2, trimFrac: 0.2 });
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

    const out = flattenSignature(x, z, { degree: 1, trimFrac: 0.1 });
    const nanPos = 60 - Math.floor(n * 0.1);
    expect(Number.isNaN(out.z[nanPos])).toBe(true);
  });

  it("returns empty arrays when insufficient samples remain after trim", () => {
    const x = new Float32Array([0, 0.5, 1]);
    const z = new Float32Array([0, 1, 2]);
    const out = flattenSignature(x, z, { degree: 3, trimFrac: 0.4 });
    expect(out.x.length).toBe(0);
    expect(out.z.length).toBe(0);
    expect(out.coeffs.length).toBe(0);
  });
});
