"use client";

import { DEMO_LANDS, type DemoLand } from "./demo-data";
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

/**
 * Run `work` over `items` with at most `limit` active at once. Preserves input
 * ordering in the result. Used to avoid hammering the upstream NBTRD origin
 * with a dozen simultaneous requests on cold cache.
 */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T, index: number) => Promise<R>,
  onProgress?: (completed: number, total: number) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let completed = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (true) {
        const idx = nextIndex++;
        if (idx >= items.length) return;
        results[idx] = await work(items[idx], idx);
        completed += 1;
        onProgress?.(completed, items.length);
      }
    },
  );
  await Promise.all(runners);
  return results;
}

/**
 * Fetch and parse all 12 demo lands (both bullets, 6 lands each). Runs with
 * bounded concurrency so the first-time cold-cache user doesn't open 12
 * simultaneous NBTRD connections.
 */
export async function loadAllDemoLands(
  onProgress?: (completed: number, total: number) => void,
): Promise<X3pScan[]> {
  return mapWithConcurrency(DEMO_LANDS, 4, fetchDemoLand, onProgress);
}
