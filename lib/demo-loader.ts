"use client";

import { DEMO_MATCHING_PAIR, type DemoLand } from "./demo-data";
import { parseX3p, transposeScan, type X3pScan } from "./x3p";

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
  const scan = await parseX3p(file);
  // NBTRD Hamby scans are stored with striae running along the matrix's X
  // axis; this app renders striae along Y. Transpose so striae come out
  // vertical in the viewer and the crosscut cuts across them as intended.
  return transposeScan(scan);
}

/** Fetches and parses both demo lands in parallel. */
export async function loadDemoMatchingPair(): Promise<X3pScan[]> {
  return Promise.all(DEMO_MATCHING_PAIR.map(fetchDemoLand));
}
