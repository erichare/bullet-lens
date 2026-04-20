import { describe, it, expect } from "vitest";

import {
  DEMO_MATCHING_PAIR,
  DEMO_LAND_BY_ID,
  NBTRD_MEASUREMENT_BASE,
} from "@/lib/demo-data";

describe("demo-data", () => {
  it("exposes exactly two lands for the matching-pair demo", () => {
    expect(DEMO_MATCHING_PAIR).toHaveLength(2);
  });

  it("gives every land a unique slug, filename, and measurement id", () => {
    const ids = DEMO_MATCHING_PAIR.map((l) => l.id);
    const filenames = DEMO_MATCHING_PAIR.map((l) => l.filename);
    const measurementIds = DEMO_MATCHING_PAIR.map((l) => l.measurementId);
    expect(new Set(ids).size).toBe(DEMO_MATCHING_PAIR.length);
    expect(new Set(filenames).size).toBe(DEMO_MATCHING_PAIR.length);
    expect(new Set(measurementIds).size).toBe(DEMO_MATCHING_PAIR.length);
  });

  it("uses web-safe slugs (no uppercase, no slashes)", () => {
    for (const land of DEMO_MATCHING_PAIR) {
      expect(land.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("uses NIST-looking GUIDs for measurement ids", () => {
    for (const land of DEMO_MATCHING_PAIR) {
      expect(land.measurementId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    }
  });

  it("populates the id lookup table so the proxy allowlist stays in sync", () => {
    expect(Object.keys(DEMO_LAND_BY_ID).sort()).toEqual(
      [...DEMO_MATCHING_PAIR.map((l) => l.id)].sort(),
    );
    for (const land of DEMO_MATCHING_PAIR) {
      expect(DEMO_LAND_BY_ID[land.id]).toBe(land);
    }
  });

  it("points the upstream base at NBTRD", () => {
    expect(NBTRD_MEASUREMENT_BASE).toMatch(
      /^https:\/\/tsapps\.nist\.gov\/NRBTD\//,
    );
  });
});
