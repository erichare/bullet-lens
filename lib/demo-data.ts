/**
 * Curated demo lands from the NIST Ballistics Toolmarks Research Database
 * (NBTRD, aka NRBTD). These two lands come from the Hamby consecutively-rifled
 * barrel study (set 252): same barrel, different bullets, same land number —
 * i.e., a canonical "known match" pair used widely in forensic research.
 *
 * IDs and URLs originate from the CSAFE-ISU/nbtrd R package:
 *   https://github.com/CSAFE-ISU/nbtrd/blob/master/R/download.R
 *
 * The raw downloads live at
 *   https://tsapps.nist.gov/NRBTD/Studies/BulletMeasurement/DownloadMeasurement/<guid>
 * and do not send CORS headers, so the browser cannot fetch them directly.
 * The app proxies them through `/api/demo/[id]` (server-side fetch, cached on
 * Vercel's edge) to sidestep CORS without exposing the client to anything new.
 */
export interface DemoLand {
  /** Stable route slug used in `/api/demo/[id]`. */
  id: string;
  /** Filename used when constructing the synthetic `File` for the parser. */
  filename: string;
  /** Human-readable label for UI. */
  label: string;
  /** NBTRD measurement GUID (upstream URL is derived from this). */
  measurementId: string;
}

export const NBTRD_MEASUREMENT_BASE =
  "https://tsapps.nist.gov/NRBTD/Studies/BulletMeasurement/DownloadMeasurement/";

/**
 * Two known-match lands — Hamby 252, Barrel 1, Bullets 1 & 2, Land 2 on each.
 * Because they came from the same barrel, their striae should align along the
 * seam in merged compare view.
 */
export const DEMO_MATCHING_PAIR: readonly DemoLand[] = [
  {
    id: "hamby252-b1-bullet1-land2",
    filename: "Hamby252_Barrel1_Bullet1_Land2.x3p",
    label: "Hamby 252 — Barrel 1, Bullet 1, Land 2",
    measurementId: "a9f59fe1-f64b-487b-9f73-322ea0133a74",
  },
  {
    id: "hamby252-b1-bullet2-land2",
    filename: "Hamby252_Barrel1_Bullet2_Land2.x3p",
    label: "Hamby 252 — Barrel 1, Bullet 2, Land 2",
    measurementId: "b2b25004-364c-4468-b835-fd563b190a27",
  },
] as const;

/** Lookup by slug — used by the proxy route to validate incoming requests. */
export const DEMO_LAND_BY_ID: Readonly<Record<string, DemoLand>> =
  Object.fromEntries(DEMO_MATCHING_PAIR.map((l) => [l.id, l]));
