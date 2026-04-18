import { unzipSync, strFromU8 } from "fflate";

export type X3pDataType = "I" | "L" | "F" | "D";

export interface X3pAxis {
  axisType: string;
  dataType: X3pDataType | null;
  increment: number;
  offset: number;
}

export interface X3pMetadata {
  sizeX: number;
  sizeY: number;
  sizeZ: number;
  cx: X3pAxis;
  cy: X3pAxis;
  cz: X3pAxis;
  creationDate?: string;
  instrument?: string;
  probingSystem?: string;
}

export interface X3pScan {
  name: string;
  meta: X3pMetadata;
  /** Height values in meters, length = sizeX * sizeY, row-major with X fastest. NaN = invalid. */
  z: Float32Array;
  /** Physical extent in meters */
  widthMeters: number;
  heightMeters: number;
  /** Useful stats */
  zMin: number;
  zMax: number;
  zMean: number;
  validCount: number;
}

const TEXT_DECODER = new TextDecoder("utf-8");

function parseAxis(el: Element | null): X3pAxis {
  if (!el) {
    return { axisType: "", dataType: null, increment: 1, offset: 0 };
  }
  const axisType = el.querySelector("AxisType")?.textContent?.trim() ?? "";
  const dataTypeRaw = el.querySelector("DataType")?.textContent?.trim() as
    | X3pDataType
    | undefined;
  const incrementStr = el.querySelector("Increment")?.textContent?.trim();
  const offsetStr = el.querySelector("Offset")?.textContent?.trim();
  return {
    axisType,
    dataType: dataTypeRaw ?? null,
    increment: incrementStr ? Number(incrementStr) : 1,
    offset: offsetStr ? Number(offsetStr) : 0,
  };
}

function stripNamespacePrefixes(xml: string): string {
  // Some x3p writers emit `<p:Foo>` tags with an undeclared `p:` namespace
  // prefix — technically invalid XML that strict parsers reject. Strip any
  // `prefix:` from tag names and from end tags to recover.
  return xml
    .replace(/<(\/?)[A-Za-z_][\w.-]*:([A-Za-z_])/g, "<$1$2")
    .replace(/xmlns:[A-Za-z_][\w.-]*="[^"]*"/g, "");
}

function parseXmlTolerant(xml: string): Document {
  const parser = new DOMParser();
  let doc = parser.parseFromString(xml, "application/xml");
  let err = doc.querySelector("parsererror");
  if (err) {
    // Retry with namespace prefixes stripped. This recovers files like those
    // emitted by Sensofar S neox scanners with `<p:ISO5436_2>`.
    const cleaned = stripNamespacePrefixes(xml);
    doc = parser.parseFromString(cleaned, "application/xml");
    err = doc.querySelector("parsererror");
  }
  if (err) {
    throw new Error("x3p main.xml parse error: " + err.textContent);
  }
  return doc;
}

function parseMetadataXml(xml: string): X3pMetadata {
  const doc = parseXmlTolerant(xml);

  const dim = doc.querySelector("MatrixDimension");
  const sizeX = Number(dim?.querySelector("SizeX")?.textContent ?? "0");
  const sizeY = Number(dim?.querySelector("SizeY")?.textContent ?? "0");
  const sizeZ = Number(dim?.querySelector("SizeZ")?.textContent ?? "1");

  const cx = parseAxis(doc.querySelector("Axes > CX"));
  const cy = parseAxis(doc.querySelector("Axes > CY"));
  const cz = parseAxis(doc.querySelector("Axes > CZ"));

  const creationDate =
    doc.querySelector("Record2 > Date")?.textContent?.trim() ??
    doc.querySelector("Record2 > CreationDate")?.textContent?.trim();
  const instrument = doc
    .querySelector("Record2 > Instrument > Model")
    ?.textContent?.trim();
  const probingSystem = doc
    .querySelector("Record2 > ProbingSystem > Identification")
    ?.textContent?.trim();

  if (!sizeX || !sizeY) {
    throw new Error(`x3p has invalid matrix dimensions: ${sizeX}x${sizeY}`);
  }

  return {
    sizeX,
    sizeY,
    sizeZ,
    cx,
    cy,
    cz,
    creationDate,
    instrument,
    probingSystem,
  };
}

function decodeBinaryZ(
  bin: Uint8Array,
  dataType: X3pDataType,
  count: number,
): Float32Array {
  const buf = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
  const dv = new DataView(buf);
  const out = new Float32Array(count);
  let offset = 0;
  switch (dataType) {
    case "D": {
      for (let i = 0; i < count; i++) {
        out[i] = dv.getFloat64(offset, true);
        offset += 8;
      }
      break;
    }
    case "F": {
      for (let i = 0; i < count; i++) {
        out[i] = dv.getFloat32(offset, true);
        offset += 4;
      }
      break;
    }
    case "I": {
      for (let i = 0; i < count; i++) {
        out[i] = dv.getInt16(offset, true);
        offset += 2;
      }
      break;
    }
    case "L": {
      for (let i = 0; i < count; i++) {
        out[i] = dv.getInt32(offset, true);
        offset += 4;
      }
      break;
    }
    default:
      throw new Error(`unsupported x3p DataType: ${dataType}`);
  }
  return out;
}

function decodeTextZ(xml: string, count: number): Float32Array {
  const doc = parseXmlTolerant(xml);
  const dataList = doc.querySelector("DataList") ?? doc.querySelector("DataListX3p");
  if (!dataList) {
    throw new Error("x3p text-encoded matrix missing DataList");
  }
  const out = new Float32Array(count);
  const nodes = dataList.querySelectorAll("Datum");
  for (let i = 0; i < Math.min(count, nodes.length); i++) {
    const text = nodes[i].textContent?.trim() ?? "";
    out[i] = text === "" || text.toLowerCase() === "nan" ? NaN : Number(text);
  }
  return out;
}

export async function parseX3p(file: File): Promise<X3pScan> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(buf);
  } catch (err) {
    throw new Error(`failed to unzip ${file.name}: ${(err as Error).message}`);
  }

  let xml: string | null = null;
  let binFile: { name: string; data: Uint8Array } | null = null;
  let textMatrixXml: string | null = null;

  for (const [name, data] of Object.entries(zip)) {
    const lname = name.toLowerCase();
    if (lname.endsWith("main.xml")) {
      xml = strFromU8(data);
    } else if (lname.endsWith(".bin")) {
      if (!binFile) binFile = { name, data };
    } else if (lname.endsWith(".xml") && !xml) {
      xml = strFromU8(data);
    }
  }

  if (!xml) {
    throw new Error(`${file.name} is missing main.xml`);
  }

  const meta = parseMetadataXml(xml);
  const count = meta.sizeX * meta.sizeY;
  const dtype = meta.cz.dataType ?? "D";

  let z: Float32Array;
  if (binFile) {
    z = decodeBinaryZ(binFile.data, dtype, count);
  } else if (textMatrixXml) {
    z = decodeTextZ(textMatrixXml, count);
  } else {
    const embedded = xml.match(/<DataList>([\s\S]*?)<\/DataList>/);
    if (embedded) {
      z = decodeTextZ(`<root>${embedded[0]}</root>`, count);
    } else {
      throw new Error(`${file.name} has no data payload (expected .bin)`);
    }
  }

  const incX = meta.cx.increment || 1;
  const incY = meta.cy.increment || 1;
  const zScale = meta.cz.dataType === "I" || meta.cz.dataType === "L"
    ? meta.cz.increment || 1
    : 1;

  let zMin = Infinity;
  let zMax = -Infinity;
  let sum = 0;
  let validCount = 0;
  for (let i = 0; i < z.length; i++) {
    const raw = z[i];
    if (!Number.isFinite(raw)) {
      z[i] = NaN;
      continue;
    }
    const v = raw * zScale;
    z[i] = v;
    if (v < zMin) zMin = v;
    if (v > zMax) zMax = v;
    sum += v;
    validCount++;
  }
  if (validCount === 0) {
    zMin = 0;
    zMax = 0;
  }

  return {
    name: file.name,
    meta,
    z,
    widthMeters: (meta.sizeX - 1) * incX,
    heightMeters: (meta.sizeY - 1) * incY,
    zMin,
    zMax,
    zMean: validCount ? sum / validCount : 0,
    validCount,
  };
}

/**
 * Decimate an x3p surface to at most `maxPoints` cells while preserving aspect.
 * Returns a dense (no NaN skipped) grid — NaN cells are replaced by neighbor
 * average to keep the geometry manifold.
 */
export function decimate(
  scan: X3pScan,
  maxPoints = 400_000,
): { nx: number; ny: number; z: Float32Array; strideX: number; strideY: number } {
  const { sizeX, sizeY, z } = { ...scan.meta, z: scan.z };
  const total = sizeX * sizeY;
  let stride = 1;
  while (Math.ceil(sizeX / stride) * Math.ceil(sizeY / stride) > maxPoints) {
    stride++;
  }
  const nx = Math.ceil(sizeX / stride);
  const ny = Math.ceil(sizeY / stride);
  const out = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const srcX = Math.min(i * stride, sizeX - 1);
      const srcY = Math.min(j * stride, sizeY - 1);
      const v = z[srcY * sizeX + srcX];
      out[j * nx + i] = Number.isFinite(v) ? v : NaN;
    }
  }
  if (total === 0) {
    // no-op
  }
  return { nx, ny, z: out, strideX: stride, strideY: stride };
}
