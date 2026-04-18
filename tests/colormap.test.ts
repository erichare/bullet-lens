import { describe, it, expect } from "vitest";
import { COLORMAPS, sampleColor } from "@/lib/colormap";

describe("sampleColor", () => {
  it("returns values in [0,1] for every colormap at endpoints and middle", () => {
    for (const { id } of COLORMAPS) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const rgb = sampleColor(id, t);
        expect(rgb).toHaveLength(3);
        for (const channel of rgb) {
          expect(channel).toBeGreaterThanOrEqual(0);
          expect(channel).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("clamps out-of-range inputs", () => {
    const lo = sampleColor("viridis", -0.5);
    const zero = sampleColor("viridis", 0);
    expect(lo).toEqual(zero);

    const hi = sampleColor("viridis", 2);
    const one = sampleColor("viridis", 1);
    expect(hi).toEqual(one);
  });

  it("returns the stop-zero color for NaN input", () => {
    const nanSample = sampleColor("plasma", NaN);
    const zeroSample = sampleColor("plasma", 0);
    expect(nanSample).toEqual(zeroSample);
  });

  it("interpolates linearly between adjacent stops", () => {
    // bone has a pure black → pure white gradient. t=0.5 should sit around 0.5.
    const mid = sampleColor("bone", 0.5);
    for (const c of mid) {
      expect(c).toBeGreaterThan(0.3);
      expect(c).toBeLessThan(0.7);
    }
  });

  it("produces distinct colors for distinct inputs", () => {
    const a = sampleColor("cividis", 0.1);
    const b = sampleColor("cividis", 0.9);
    const dist =
      Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    expect(dist).toBeGreaterThan(0.5);
  });
});

describe("COLORMAPS registry", () => {
  it("exposes every colormap referenced by sampleColor", () => {
    for (const { id, label } of COLORMAPS) {
      expect(typeof id).toBe("string");
      expect(typeof label).toBe("string");
      // Sampling must succeed without throwing.
      expect(() => sampleColor(id, 0.5)).not.toThrow();
    }
  });
});
