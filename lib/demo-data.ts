/**
 * Curated demo lands from the NIST Ballistics Toolmarks Research Database
 * (NBTRD, aka NRBTD). All 12 lands from the Hamby 252 study — Barrel 1,
 * Bullets 1 & 2, six lands each.
 *
 * Land numbering here reflects the NBTRD scan order, NOT a cross-bullet
 * match. The actual matching pair (which Land N on Bullet 1 lines up with
 * which Land M on Bullet 2) depends on the rotational offset between how the
 * two bullets were loaded; it has to be determined empirically (e.g., via
 * cross-correlation of signatures, or by a trained examiner). The
 * `DEFAULT_MATCHING_PAIR` below is our best initial guess for the welcome
 * screen's "Try a matching pair" CTA and should be updated if the real match
 * is known.
 *
 * IDs and URLs originate from the CSAFE-ISU/nbtrd R package:
 *   https://github.com/CSAFE-ISU/nbtrd/blob/master/R/download.R
 *
 * The raw downloads live at
 *   https://tsapps.nist.gov/NRBTD/Studies/BulletMeasurement/DownloadMeasurement/<guid>
 * and do not send CORS headers, so the browser cannot fetch them directly.
 * The app proxies them through `/api/demo/[id]` (server-side fetch, cached on
 * Vercel's edge) to sidestep CORS.
 */
export interface DemoLand {
  /** Stable route slug used in `/api/demo/[id]`. */
  id: string;
  /** Filename used when constructing the synthetic `File` for the parser. */
  filename: string;
  /** Short UI label, e.g. "Bullet 1 · Land 2". */
  label: string;
  /** NBTRD measurement GUID (upstream URL is derived from this). */
  measurementId: string;
  /** Which of the two bullets in the demo set this land comes from. */
  bullet: 1 | 2;
  /** NBTRD-assigned land index (1..6) — scan order, not match order. */
  land: 1 | 2 | 3 | 4 | 5 | 6;
}

export const NBTRD_MEASUREMENT_BASE =
  "https://tsapps.nist.gov/NRBTD/Studies/BulletMeasurement/DownloadMeasurement/";

/**
 * All 12 demo lands. Keep the array ordering stable (Bullet 1 lands 1..6,
 * then Bullet 2 lands 1..6) — the UI sorts and renders in this order.
 */
export const DEMO_LANDS: readonly DemoLand[] = [
  // Barrel 1, Bullet 1 (lands 1..6)
  {
    id: "hamby252-b1-bullet1-land1",
    filename: "Hamby252_Barrel1_Bullet1_Land1.x3p",
    label: "Bullet 1 · Land 1",
    measurementId: "43567404-1611-4b40-ae74-a1e440e79f6a",
    bullet: 1,
    land: 1,
  },
  {
    id: "hamby252-b1-bullet1-land2",
    filename: "Hamby252_Barrel1_Bullet1_Land2.x3p",
    label: "Bullet 1 · Land 2",
    measurementId: "a9f59fe1-f64b-487b-9f73-322ea0133a74",
    bullet: 1,
    land: 2,
  },
  {
    id: "hamby252-b1-bullet1-land3",
    filename: "Hamby252_Barrel1_Bullet1_Land3.x3p",
    label: "Bullet 1 · Land 3",
    measurementId: "2ea4efe4-beeb-4291-993d-ae7726c624f4",
    bullet: 1,
    land: 3,
  },
  {
    id: "hamby252-b1-bullet1-land4",
    filename: "Hamby252_Barrel1_Bullet1_Land4.x3p",
    label: "Bullet 1 · Land 4",
    measurementId: "6bb13db8-01ca-4cd4-ba5d-1c5670f1c204",
    bullet: 1,
    land: 4,
  },
  {
    id: "hamby252-b1-bullet1-land5",
    filename: "Hamby252_Barrel1_Bullet1_Land5.x3p",
    label: "Bullet 1 · Land 5",
    measurementId: "2110e6c2-f801-458f-941a-9740804aa162",
    bullet: 1,
    land: 5,
  },
  {
    id: "hamby252-b1-bullet1-land6",
    filename: "Hamby252_Barrel1_Bullet1_Land6.x3p",
    label: "Bullet 1 · Land 6",
    measurementId: "eaa73b31-8f9c-4b7f-a1c8-48e4da3ff9e0",
    bullet: 1,
    land: 6,
  },
  // Barrel 1, Bullet 2 (lands 1..6)
  {
    id: "hamby252-b1-bullet2-land1",
    filename: "Hamby252_Barrel1_Bullet2_Land1.x3p",
    label: "Bullet 2 · Land 1",
    measurementId: "979bf3f5-2bf4-43ab-aa14-66e79e0cbc99",
    bullet: 2,
    land: 1,
  },
  {
    id: "hamby252-b1-bullet2-land2",
    filename: "Hamby252_Barrel1_Bullet2_Land2.x3p",
    label: "Bullet 2 · Land 2",
    measurementId: "b2b25004-364c-4468-b835-fd563b190a27",
    bullet: 2,
    land: 2,
  },
  {
    id: "hamby252-b1-bullet2-land3",
    filename: "Hamby252_Barrel1_Bullet2_Land3.x3p",
    label: "Bullet 2 · Land 3",
    measurementId: "554c40d8-8857-4b1c-a28f-fda9b347999b",
    bullet: 2,
    land: 3,
  },
  {
    id: "hamby252-b1-bullet2-land4",
    filename: "Hamby252_Barrel1_Bullet2_Land4.x3p",
    label: "Bullet 2 · Land 4",
    measurementId: "da019fc2-3a19-4da5-b1d7-ec059cd095f2",
    bullet: 2,
    land: 4,
  },
  {
    id: "hamby252-b1-bullet2-land5",
    filename: "Hamby252_Barrel1_Bullet2_Land5.x3p",
    label: "Bullet 2 · Land 5",
    measurementId: "d6dfaef6-f066-4b76-bf42-f0e8c06d6241",
    bullet: 2,
    land: 5,
  },
  {
    id: "hamby252-b1-bullet2-land6",
    filename: "Hamby252_Barrel1_Bullet2_Land6.x3p",
    label: "Bullet 2 · Land 6",
    measurementId: "a172932e-121c-4bee-9477-ae2454f0b513",
    bullet: 2,
    land: 6,
  },
] as const;

/**
 * Default A/B pair to select after the demo loads. Placeholder — the actual
 * rotational offset between Bullet 1 and Bullet 2 isn't obvious from metadata
 * and needs to be either verified against published Hamby match keys or
 * computed from signatures. Update this when the correct match is known.
 */
export const DEFAULT_MATCHING_PAIR: { readonly aId: string; readonly bId: string } = {
  aId: "hamby252-b1-bullet1-land3",
  bId: "hamby252-b1-bullet2-land5",
};

/** Lookup by slug — used by the proxy route to validate incoming requests. */
export const DEMO_LAND_BY_ID: Readonly<Record<string, DemoLand>> =
  Object.fromEntries(DEMO_LANDS.map((l) => [l.id, l]));
