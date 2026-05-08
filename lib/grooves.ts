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
  regionXStart?: number;
  regionXEnd?: number;
  regionYStart?: number;
  regionYEnd?: number;
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
  const regionXStart = numericValue(record, ["region_x_start"]);
  const regionXEnd = numericValue(record, ["region_x_end"]);
  if (
    (left !== undefined && right !== undefined) ||
    (regionXStart !== undefined && regionXEnd !== undefined)
  ) {
    rows.push(record);
    return;
  }

  const beforeRegions = rows.length;
  collectGrooveRows(record.land_regions, rows);
  collectGrooveRows(record.regions, rows);
  if (rows.length > beforeRegions) return;

  collectGrooveRows(record.rows, rows);
  collectGrooveRows(record.grooves, rows);
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

    const left = numericValue(row, [
      "region_x_start",
      "left_groove",
      "left",
      "x0",
      "start",
    ]);
    const right = numericValue(row, [
      "region_x_end",
      "right_groove",
      "right",
      "x1",
      "end",
    ]);
    if (left === undefined || right === undefined) continue;

    const region: GrooveRegion = {
      scanName: scan.name,
      filename: stringValue(row, "filename"),
      land: numericValue(row, ["land", "land_index"]),
      leftGroove: left,
      rightGroove: right,
      crosscutY: numericValue(row, ["crosscut_y", "y", "row"]),
      regionXStart: numericValue(row, ["region_x_start"]),
      regionXEnd: numericValue(row, ["region_x_end"]),
      regionYStart: numericValue(row, ["region_y_start"]),
      regionYEnd: numericValue(row, ["region_y_end"]),
      source: stringValue(row, "source"),
      method: stringValue(row, "boundary_method") ?? stringValue(row, "groove_method"),
    };
    byScan[scan.name] = [...(byScan[scan.name] ?? []), region];
  }
  return byScan;
}

function clampFraction(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function coordinateToFraction(
  value: number,
  sourceSize: number,
  sourceExtentMeters: number,
): number {
  const sourceExtentMicrons = Math.abs(sourceExtentMeters * 1e6);
  if (value >= 0 && value <= 1) return value;
  if (sourceExtentMicrons > 0 && value <= sourceExtentMicrons * 1.05) {
    return clampFraction(value / sourceExtentMicrons);
  }
  return clampFraction(value / Math.max(1, sourceSize - 1));
}

function coordinateRangeToFractions(
  start: number,
  end: number,
  sourceSize: number,
  sourceExtentMeters: number,
): [number, number] {
  const sourceExtentMicrons = Math.abs(sourceExtentMeters * 1e6);
  const maxAbs = Math.max(Math.abs(start), Math.abs(end));
  let denominator = Math.max(1, sourceSize - 1);
  if (maxAbs > 0 && maxAbs <= 1) denominator = 1;
  else if (sourceExtentMicrons > 0 && maxAbs <= sourceExtentMicrons * 1.05) {
    denominator = sourceExtentMicrons;
  }
  const a = clampFraction(start / denominator);
  const b = clampFraction(end / denominator);
  return [Math.min(a, b), Math.max(a, b)];
}

export function grooveRegionToDisplayRect(
  region: GrooveRegion,
  scan: X3pScan,
): GrooveRegionRect {
  const [sourceX0, sourceX1] = coordinateRangeToFractions(
    region.regionXStart ?? region.leftGroove,
    region.regionXEnd ?? region.rightGroove,
    scan.orientation.sourceSizeX,
    scan.orientation.sourceWidthMeters,
  );
  const hasRegionY =
    region.regionYStart !== undefined &&
    region.regionYEnd !== undefined &&
    region.regionYStart !== region.regionYEnd;
  const [sourceY0, sourceY1] = hasRegionY
    ? coordinateRangeToFractions(
        region.regionYStart!,
        region.regionYEnd!,
        scan.orientation.sourceSizeY,
        scan.orientation.sourceHeightMeters,
      )
    : [0, 1];

  if (scan.orientation.transposed) {
    const crosscutX =
      region.crosscutY === undefined
        ? undefined
        : coordinateToFraction(
            region.crosscutY,
            scan.orientation.sourceSizeY,
            scan.orientation.sourceHeightMeters,
          );
    return { x0: sourceY0, x1: sourceY1, y0: sourceX0, y1: sourceX1, crosscutX };
  }

  const crosscutY =
    region.crosscutY === undefined
      ? undefined
      : coordinateToFraction(
          region.crosscutY,
          scan.orientation.sourceSizeY,
          scan.orientation.sourceHeightMeters,
        );
  return { x0: sourceX0, x1: sourceX1, y0: sourceY0, y1: sourceY1, crosscutY };
}
