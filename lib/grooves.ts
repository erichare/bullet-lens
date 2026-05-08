import type { X3pScan } from "./x3p";
import { DEFAULT_API_BASE, resolveApiUrl } from "./api";

const GROOVE_API_BASE =
  process.env.NEXT_PUBLIC_BULLET_GROOVES_API_BASE || "";

export const GROOVE_REGION_COLOR = "#38bdf8";

export interface GrooveRegion {
  scanName: string;
  filename?: string;
  land?: number;
  leftGroove: number;
  rightGroove: number;
  crosscutY?: number;
  source?: string;
  method?: string;
}

export type GrooveRegionsByScan = Record<string, GrooveRegion[]>;

export interface GrooveRegionRect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  crosscutX?: number;
  crosscutY?: number;
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function stringValue(record: UnknownRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numericValue(
  record: UnknownRecord,
  keys: readonly string[],
): number | undefined {
  for (const key of keys) {
    const value = record[key];
    const num = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(num)) return num;
  }
  return undefined;
}

function normalizeFilename(name: string): string {
  return name.split(/[\\/]/).pop()?.toLowerCase() ?? name.toLowerCase();
}

function selectedDetection(response: UnknownRecord): UnknownRecord | null {
  const detections = asRecord(response.groove_detections);
  if (!detections) return null;
  const selected = asRecord(detections.selected);
  const key = selected ? stringValue(selected, "key") : undefined;
  return key ? asRecord(detections[key]) : null;
}

function collectGrooveRows(value: unknown, rows: UnknownRecord[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectGrooveRows(item, rows);
    return;
  }

  const record = asRecord(value);
  if (!record) return;

  const left = numericValue(record, ["left_groove", "left", "x0", "start"]);
  const right = numericValue(record, ["right_groove", "right", "x1", "end"]);
  if (left !== undefined && right !== undefined) {
    rows.push(record);
    return;
  }

  collectGrooveRows(record.grooves, rows);
  collectGrooveRows(record.regions, rows);
  collectGrooveRows(record.land_regions, rows);
}

function findScanForRow(
  row: UnknownRecord,
  scans: readonly X3pScan[],
): X3pScan | undefined {
  const filename =
    stringValue(row, "filename") ??
    stringValue(row, "file") ??
    stringValue(row, "scan_name");
  if (filename) {
    const normalized = normalizeFilename(filename);
    const exact = scans.find((scan) => scan.name === filename);
    if (exact) return exact;
    const basename = scans.find((scan) => normalizeFilename(scan.name) === normalized);
    if (basename) return basename;
  }

  const land = numericValue(row, ["land", "land_index"]);
  if (land !== undefined) {
    const index = Math.round(land) - 1;
    if (index >= 0 && index < scans.length) return scans[index];
  }

  return scans.length === 1 ? scans[0] : undefined;
}

export async function requestGrooveDetection(
  scans: readonly X3pScan[],
  apiBase = DEFAULT_API_BASE,
): Promise<unknown> {
  const form = new FormData();
  let fileCount = 0;
  for (const scan of scans) {
    if (!scan.sourceFile) continue;
    form.append("bullet", scan.sourceFile, scan.sourceFile.name || scan.name);
    fileCount += 1;
  }
  if (!fileCount) {
    throw new Error("No original .x3p files are available for land detection.");
  }
  form.append("groove_method", "auto");
  form.append("metadata", JSON.stringify({ case_id: "bullet-lens" }));

  const res = await fetch(
    resolveApiUrl(GROOVE_API_BASE || apiBase, "/grooves"),
    {
      method: "POST",
      body: form,
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Land detection failed (${res.status} ${res.statusText})${body ? `: ${body.slice(0, 180)}` : ""}`,
    );
  }

  const json = await res.json();
  const record = asRecord(json);
  if (record?.ok === false) {
    throw new Error(
      stringValue(record, "error") ?? "Land detection endpoint returned ok=false.",
    );
  }
  return json;
}

export function grooveRequestId(response: unknown): string | null {
  const record = asRecord(response);
  return record ? stringValue(record, "request_id") ?? null : null;
}

export function extractGrooveRegions(
  response: unknown,
  scans: readonly X3pScan[],
): GrooveRegionsByScan {
  const root = asRecord(response);
  if (!root) return {};

  const rows: UnknownRecord[] = [];
  const selected = selectedDetection(root);
  collectGrooveRows(selected, rows);
  if (!rows.length) collectGrooveRows(root.land_regions, rows);
  if (!rows.length) collectGrooveRows(root.groove_detections, rows);

  const byScan: GrooveRegionsByScan = {};
  for (const row of rows) {
    const scan = findScanForRow(row, scans);
    if (!scan) continue;

    const left = numericValue(row, ["left_groove", "left", "x0", "start"]);
    const right = numericValue(row, ["right_groove", "right", "x1", "end"]);
    if (left === undefined || right === undefined) continue;

    const region: GrooveRegion = {
      scanName: scan.name,
      filename: stringValue(row, "filename"),
      land: numericValue(row, ["land", "land_index"]),
      leftGroove: left,
      rightGroove: right,
      crosscutY: numericValue(row, ["crosscut_y", "y", "row"]),
      source: stringValue(row, "source"),
      method: stringValue(row, "boundary_method") ?? stringValue(row, "groove_method"),
    };
    byScan[scan.name] = [...(byScan[scan.name] ?? []), region];
  }
  return byScan;
}

function coordinateToFraction(value: number, sourceSize: number): number {
  return Math.min(1, Math.max(0, value / Math.max(1, sourceSize - 1)));
}

export function grooveRegionToDisplayRect(
  region: GrooveRegion,
  scan: X3pScan,
): GrooveRegionRect {
  const left = coordinateToFraction(
    region.leftGroove,
    scan.orientation.sourceSizeX,
  );
  const right = coordinateToFraction(
    region.rightGroove,
    scan.orientation.sourceSizeX,
  );
  const low = Math.min(left, right);
  const high = Math.max(left, right);

  if (scan.orientation.transposed) {
    const crosscutX =
      region.crosscutY === undefined
        ? undefined
        : coordinateToFraction(region.crosscutY, scan.orientation.sourceSizeY);
    return { x0: 0, x1: 1, y0: low, y1: high, crosscutX };
  }

  const crosscutY =
    region.crosscutY === undefined
      ? undefined
      : coordinateToFraction(region.crosscutY, scan.orientation.sourceSizeY);
  return { x0: low, x1: high, y0: 0, y1: 1, crosscutY };
}
