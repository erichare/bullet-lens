import { zipSync, strToU8 } from "fflate";

/**
 * Generate a minimal, valid `.x3p` archive in memory for tests.
 *
 * The resulting Uint8Array is a ZIP containing `main.xml` + `bindata.bin`,
 * matching the structure produced by real scanners. Keep this small and
 * deterministic — the goal is to exercise the parser end-to-end without
 * shipping binary fixtures.
 */
export interface BuildX3pOptions {
  sizeX?: number;
  sizeY?: number;
  /** Axis increment in meters (x and y). */
  increment?: number;
  /** Binary data type: D=float64, F=float32, I=int16, L=int32. Default "D". */
  dataType?: "D" | "F" | "I" | "L";
  /**
   * Indices (0..sizeX*sizeY) to mark as NaN in the output. Float types get
   * `NaN`; integer types get a sentinel 0 (caller can adjust).
   */
  nanIndices?: number[];
  /**
   * If true, emit an undeclared `p:` namespace prefix on every tag so the
   * parser's fallback strip-retry path is exercised.
   */
  withBadNamespace?: boolean;
  /**
   * Optional per-cell height value generator. Returns meters. Default is
   * a sinusoidal stripe pattern that mimics bullet striae.
   */
  generator?: (i: number, j: number, sizeX: number, sizeY: number) => number;
}

function defaultGenerator(
  i: number,
  j: number,
  sizeX: number,
  _sizeY: number,
): number {
  // Amplitude ~2 microns; 6 stripes across X. Small Y-dependent tilt.
  const stripe = Math.sin((i / sizeX) * Math.PI * 6) * 2e-6;
  const tilt = (j - _sizeY / 2) * 1e-8;
  return stripe + tilt;
}

function buildMainXml(
  sizeX: number,
  sizeY: number,
  increment: number,
  dataType: "D" | "F" | "I" | "L",
  withBadNamespace: boolean,
): string {
  const zIncrement = dataType === "I" || dataType === "L" ? 1e-9 : 1;
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<ISO5436_2>
  <Record1>
    <Axes>
      <CX><AxisType>I</AxisType><DataType>D</DataType><Increment>${increment}</Increment><Offset>0</Offset></CX>
      <CY><AxisType>I</AxisType><DataType>D</DataType><Increment>${increment}</Increment><Offset>0</Offset></CY>
      <CZ><AxisType>A</AxisType><DataType>${dataType}</DataType><Increment>${zIncrement}</Increment><Offset>0</Offset></CZ>
    </Axes>
  </Record1>
  <Record2>
    <Date>2024-01-15T12:00:00</Date>
    <Instrument><Model>Synthetic Test Scanner</Model></Instrument>
    <ProbingSystem><Identification>synthetic-probe</Identification></ProbingSystem>
  </Record2>
  <Record3>
    <MatrixDimension>
      <SizeX>${sizeX}</SizeX>
      <SizeY>${sizeY}</SizeY>
      <SizeZ>1</SizeZ>
    </MatrixDimension>
  </Record3>
</ISO5436_2>`;

  if (!withBadNamespace) return body;
  // Add a p: prefix to every element in the document without declaring the
  // namespace. Simulates what Sensofar writers emit.
  return body.replace(/<(\/?)([A-Z][A-Za-z0-9_]*)/g, "<$1p:$2");
}

function encodeBinary(
  values: Float64Array,
  dataType: "D" | "F" | "I" | "L",
  nanIndices: Set<number>,
): Uint8Array {
  const bytesPerSample =
    dataType === "D" ? 8 : dataType === "F" ? 4 : dataType === "L" ? 4 : 2;
  const buf = new ArrayBuffer(values.length * bytesPerSample);
  const dv = new DataView(buf);
  for (let i = 0; i < values.length; i++) {
    const isNan = nanIndices.has(i);
    switch (dataType) {
      case "D":
        dv.setFloat64(i * 8, isNan ? NaN : values[i], true);
        break;
      case "F":
        dv.setFloat32(i * 4, isNan ? NaN : values[i], true);
        break;
      case "I": {
        // Store raw value scaled by 1e9 so round-trip yields meters.
        const raw = isNan ? 0 : Math.round(values[i] / 1e-9);
        dv.setInt16(i * 2, raw, true);
        break;
      }
      case "L": {
        const raw = isNan ? 0 : Math.round(values[i] / 1e-9);
        dv.setInt32(i * 4, raw, true);
        break;
      }
    }
  }
  return new Uint8Array(buf);
}

export interface BuiltX3p {
  zipBytes: Uint8Array;
  sizeX: number;
  sizeY: number;
  increment: number;
  dataType: "D" | "F" | "I" | "L";
  /** Ground-truth values (meters) used to generate the file. */
  truthZ: Float64Array;
  nanIndices: number[];
}

export function buildSyntheticX3p(opts: BuildX3pOptions = {}): BuiltX3p {
  const sizeX = opts.sizeX ?? 32;
  const sizeY = opts.sizeY ?? 24;
  const increment = opts.increment ?? 1.5625e-6;
  const dataType = opts.dataType ?? "D";
  const nanIndices = opts.nanIndices ?? [];
  const generator = opts.generator ?? defaultGenerator;

  const values = new Float64Array(sizeX * sizeY);
  for (let j = 0; j < sizeY; j++) {
    for (let i = 0; i < sizeX; i++) {
      values[j * sizeX + i] = generator(i, j, sizeX, sizeY);
    }
  }

  const nanSet = new Set(nanIndices);
  const xml = buildMainXml(
    sizeX,
    sizeY,
    increment,
    dataType,
    opts.withBadNamespace ?? false,
  );
  const bin = encodeBinary(values, dataType, nanSet);

  // Vitest's jsdom environment provides a `Uint8Array` whose realm differs
  // from the one fflate closes over, so fflate's `instanceof Uint8Array`
  // check fails and zipSync mis-treats the buffer as a nested object.
  // Re-wrapping with the local realm's constructor forces a match.
  const xmlBytes = new Uint8Array(strToU8(xml));
  const binBytes = new Uint8Array(bin);

  const zipBytes = zipSync({
    "main.xml": xmlBytes,
    "bindata.bin": binBytes,
  });

  return {
    zipBytes,
    sizeX,
    sizeY,
    increment,
    dataType,
    truthZ: values,
    nanIndices: [...nanSet].sort((a, b) => a - b),
  };
}

/**
 * Wrap a Uint8Array as a duck-typed `File` for the browser-style
 * `parseX3p(file)` API. We avoid `new File(...)` because jsdom's File
 * implementation does not provide `arrayBuffer()` in all versions — the
 * parser only needs `name` + `arrayBuffer()`, so a plain object suffices.
 */
export function asFile(bytes: Uint8Array, name = "synthetic.x3p"): File {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const fileLike = {
    name,
    async arrayBuffer(): Promise<ArrayBuffer> {
      return copy.buffer.slice(
        copy.byteOffset,
        copy.byteOffset + copy.byteLength,
      ) as ArrayBuffer;
    },
  };
  return fileLike as unknown as File;
}
