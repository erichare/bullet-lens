import { describe, it, expect } from "vitest";
import { formatMicrons, formatCount } from "@/lib/utils";

describe("formatMicrons", () => {
  it("formats sub-micron values in nm", () => {
    expect(formatMicrons(5e-10)).toBe("1 nm"); // 0.5 nm rounds to 1 nm
    expect(formatMicrons(1e-9)).toBe("1 nm");
    expect(formatMicrons(500e-9)).toBe("500 nm");
  });

  it("formats micrometer-scale values in µm", () => {
    expect(formatMicrons(1e-6)).toBe("1.0 µm");
    expect(formatMicrons(12.34e-6)).toBe("12.3 µm");
    expect(formatMicrons(999e-6)).toBe("999.0 µm");
  });

  it("switches to mm for millimeter-scale values", () => {
    expect(formatMicrons(1e-3)).toBe("1.00 mm");
    expect(formatMicrons(5.678e-3)).toBe("5.68 mm");
  });

  it("handles negatives symmetrically", () => {
    expect(formatMicrons(-12e-6)).toBe("-12.0 µm");
  });
});

describe("formatCount", () => {
  it("passes through small integers", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(42)).toBe("42");
    expect(formatCount(999)).toBe("999");
  });

  it("abbreviates thousands", () => {
    expect(formatCount(1_000)).toBe("1.0k");
    expect(formatCount(12_500)).toBe("12.5k");
  });

  it("abbreviates millions", () => {
    expect(formatCount(1_000_000)).toBe("1.00M");
    expect(formatCount(2_345_000)).toBe("2.35M");
  });
});
