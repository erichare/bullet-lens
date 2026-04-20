import { describe, it, expect } from "vitest";

import {
  DEMO_LANDS,
  DEMO_LAND_BY_ID,
  DEFAULT_MATCHING_PAIR,
  NBTRD_MEASUREMENT_BASE,
} from "@/lib/demo-data";

describe("demo-data", () => {
  it("exposes all 12 lands (2 bullets × 6 lands)", () => {
    expect(DEMO_LANDS).toHaveLength(12);
    const byBullet = new Map<number, number>();
    for (const l of DEMO_LANDS) {
      byBullet.set(l.bullet, (byBullet.get(l.bullet) ?? 0) + 1);
    }
    expect(byBullet.get(1)).toBe(6);
    expect(byBullet.get(2)).toBe(6);
  });

  it("covers lands 1..6 on both bullets", () => {
    for (const bullet of [1, 2] as const) {
      const lands = DEMO_LANDS.filter((l) => l.bullet === bullet).map((l) => l.land);
      expect([...lands].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  it("gives every land a unique slug, filename, and measurement id", () => {
    const ids = DEMO_LANDS.map((l) => l.id);
    const filenames = DEMO_LANDS.map((l) => l.filename);
    const measurementIds = DEMO_LANDS.map((l) => l.measurementId);
    expect(new Set(ids).size).toBe(DEMO_LANDS.length);
    expect(new Set(filenames).size).toBe(DEMO_LANDS.length);
    expect(new Set(measurementIds).size).toBe(DEMO_LANDS.length);
  });

  it("uses web-safe slugs (no uppercase, no slashes)", () => {
    for (const land of DEMO_LANDS) {
      expect(land.id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("uses NIST-looking GUIDs for measurement ids", () => {
    for (const land of DEMO_LANDS) {
      expect(land.measurementId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    }
  });

  it("populates the id lookup table so the proxy allowlist stays in sync", () => {
    expect(Object.keys(DEMO_LAND_BY_ID).sort()).toEqual(
      [...DEMO_LANDS.map((l) => l.id)].sort(),
    );
    for (const land of DEMO_LANDS) {
      expect(DEMO_LAND_BY_ID[land.id]).toBe(land);
    }
  });

  it("points the upstream base at NBTRD", () => {
    expect(NBTRD_MEASUREMENT_BASE).toMatch(
      /^https:\/\/tsapps\.nist\.gov\/NRBTD\//,
    );
  });

  it("default matching pair references lands from different bullets", () => {
    const a = DEMO_LAND_BY_ID[DEFAULT_MATCHING_PAIR.aId];
    const b = DEMO_LAND_BY_ID[DEFAULT_MATCHING_PAIR.bId];
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a.bullet).not.toBe(b.bullet);
  });
});
