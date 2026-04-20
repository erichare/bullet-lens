"use client";

import { DEMO_MATCHING_PAIR, type DemoLand } from "./demo-data";
import { parseX3p, type X3pScan } from "./x3p";

async function fetchDemoLand(land: DemoLand): Promise<X3pScan> {
  const res = await fetch(`/api/demo/${land.id}`);
  if (!res.ok) {
    throw new Error(
      `Could not load demo land "${land.label}" (${res.status} ${res.statusText})`,
    );
  }
  const blob = await res.blob();
  const file = new File([blob], land.filename, {
    type: "application/octet-stream",
  });
  return parseX3p(file);
}

/** Fetches and parses both demo lands in parallel. */
export async function loadDemoMatchingPair(): Promise<X3pScan[]> {
  return Promise.all(DEMO_MATCHING_PAIR.map(fetchDemoLand));
}
