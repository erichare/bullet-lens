# The `.x3p` file format (ISO 5436-2)

`.x3p` is an open container for 3D surface topography data, defined by
[ISO 5436-2](https://www.iso.org/standard/54622.html). It's the de-facto
interchange format for confocal and interferometric measurements in both
industrial metrology and forensic firearms analysis (bullets, cartridge
cases, tool marks).

This note documents the pieces Bullet Lens actually reads, plus the
real-world quirks the parser handles.

---

## Container

An `.x3p` file is a **ZIP archive** containing:

```
main.xml                    — metadata + axis definitions (required)
<something>.bin             — binary Z matrix (typical)
data.xml                    — text-encoded Z matrix (alternative)
md5checksum.hex             — optional integrity check
```

Bullet Lens unzips with `fflate.unzipSync` and looks up entries by filename
suffix (`main.xml`, `.bin`), case-insensitive. See
[`lib/x3p.ts:parseX3p`](../lib/x3p.ts).

---

## `main.xml` — metadata

The XML declares the matrix dimensions, axis scaling, and any optional
Record2 metadata (instrument, creation date, probing system).

Minimal structure:

```xml
<ISO5436_2>
  <Record3>
    <MatrixDimension>
      <SizeX>512</SizeX>
      <SizeY>128</SizeY>
      <SizeZ>1</SizeZ>
    </MatrixDimension>
  </Record3>
  <Record1>
    <Axes>
      <CX><AxisType>I</AxisType><DataType>D</DataType>
          <Increment>1.5625e-6</Increment><Offset>0</Offset></CX>
      <CY><AxisType>I</AxisType><DataType>D</DataType>
          <Increment>1.5625e-6</Increment><Offset>0</Offset></CY>
      <CZ><AxisType>A</AxisType><DataType>D</DataType>
          <Increment>1</Increment><Offset>0</Offset></CZ>
    </Axes>
  </Record1>
  <Record2>
    <Date>2015-07-20T14:32:11</Date>
    <Instrument><Model>Confocal XYZ</Model></Instrument>
    <ProbingSystem><Identification>Standard</Identification></ProbingSystem>
  </Record2>
</ISO5436_2>
```

### Axis types

Each axis element (`CX`, `CY`, `CZ`) contributes:

| Field | Meaning |
| --- | --- |
| `AxisType` | `I` (incremental) or `A` (absolute). Not used for rendering. |
| `DataType` | The binary encoding of values — see below. |
| `Increment` | Physical step per sample, in **meters** (so typical values look like `1.5625e-6`). |
| `Offset` | Physical offset; Bullet Lens ignores this because we render relative. |

`Increment` on `CX` and `CY` determines physical width/height; on `CZ` it
becomes a multiplier when the data is stored as integers (`I` / `L`) so
that `raw * increment` lands in meters.

---

## Z-matrix encodings

Bullet Lens accepts **three** storage paths; they're tried in order:

### 1. External `.bin` (most common)

A single sibling file in the ZIP, whose name ends in `.bin`. Content is
little-endian, row-major (`X` fastest, `Y` outer), of size
`sizeX * sizeY * bytes_per_sample`. `DataType` on `CZ` picks the sample
type:

| `DataType` | Size | JS DataView call |
| --- | --- | --- |
| `D` | 8 B  | `getFloat64(offset, true)` (little-endian) |
| `F` | 4 B  | `getFloat32(offset, true)` |
| `I` | 2 B  | `getInt16(offset, true)`   |
| `L` | 4 B  | `getInt32(offset, true)`   |

For the integer types, the raw value is multiplied by `CZ.Increment` to
recover meters.

### 2. External `data.xml` `<DataList>`

Plain-text fallback — a `<DataList>` with one `<Datum>` per cell:

```xml
<DataList>
  <Datum>0.000012</Datum>
  <Datum>NaN</Datum>
  <Datum>0.000011</Datum>
  ...
</DataList>
```

Empty strings and `NaN` tokens are mapped to `Float32Array` `NaN`.

### 3. Embedded `<DataList>` inside `main.xml`

Some writers inline the data list rather than shipping a separate
`data.xml`. Bullet Lens greps `main.xml` for `<DataList>…</DataList>` and
decodes it with the same text path.

---

## NaN handling

A cell value of `NaN` (or any non-finite raw value) means **no valid
measurement**. Causes range from out-of-focus pixels on a confocal to
deliberate masking by the scan operator. Bullet Lens:

- Preserves `NaN` through parsing (`zMin`/`zMax`/`zMean` are computed from
  finite cells only).
- Drops any triangle touching a `NaN` vertex from the mesh, so the surface
  renders with genuine holes rather than spike artifacts.
- Linearly interpolates across NaN columns inside
  [`detrendBaseline`](../lib/geometry.ts) when computing the bullet-view
  baseline, so a handful of missing columns don't corrupt the global
  curvature fit.

---

## Real-world quirks we handle

### Undeclared namespace prefixes

Some scanners (e.g. Sensofar S neox) emit elements like `<p:ISO5436_2>`
without a matching `xmlns:p=…` declaration. Strict XML parsers reject this
as malformed. Our `stripNamespacePrefixes()` regex rewrites tags in a
reparse attempt:

```ts
xml
  .replace(/<(\/?)[A-Za-z_][\w.-]*:([A-Za-z_])/g, "<$1$2")
  .replace(/xmlns:[A-Za-z_][\w.-]*="[^"]*"/g, "");
```

This is ugly but tightly scoped, and only runs after the first parse
attempt already failed.

### Case-insensitive filename lookup

Windows-authored archives sometimes use `Main.xml` or `DATA.BIN`. Our
lookup lowercases the entry name before matching.

### Fallback `DataType`

If `CZ.DataType` is missing, we default to `D` (float64). This matches the
x3p convention for bullet-forensics datasets.

---

## What we explicitly do *not* do

- **No writing.** This is a read-only viewer. If you need to modify a
  scan, round-trip through the R package.
- **No `md5checksum.hex` verification.** We ignore it — assume the ZIP
  layer already caught corruption.
- **No handling of Record4 (coordinate-system transforms).** Bullet scans
  render fine in the raw sensor frame.

---

## References

- [ISO 5436-2](https://www.iso.org/standard/54622.html) — the standard.
- [OpenFMC](https://www.openfmc.org/) — open spec and example files.
- [NIST RM 8240](https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=922019) —
  reference bullet measurements in `.x3p`.
- [`x3ptools`](https://heike.github.io/x3ptools/) — R implementation that
  informed much of the parser.
