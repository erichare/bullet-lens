# Architecture

Bullet Lens is a **pure client-side** Next.js 16 App Router app. No backend,
no API routes, no persisted state — every byte of a dropped `.x3p` stays in
the browser's memory for the lifetime of the tab.

This document describes how the pieces fit together so a new contributor can
make informed changes to the pipeline, the viewers, or the store.

---

## High-level data flow

```
  [user drops .x3p]
         |
         v
  DropZone (components/drop-zone.tsx)
         |   File[] → parseX3p(file)
         v
  lib/x3p.ts
    ├── unzipSync (fflate)                 → Record<name, Uint8Array>
    ├── parseMetadataXml (DOMParser)       → X3pMetadata
    └── decodeBinaryZ / decodeTextZ        → Float32Array (meters)
         |
         v
  X3pScan  — { name, meta, z, widthMeters, heightMeters, zMin/Max/Mean, validCount }
         |
         v
  lib/store.ts  (zustand)   — scans[], activeIndex, view mode, settings
         |
         +---> Single-land view  → buildLandGeometry()
         +---> Bullet view       → buildStitchedLandGeometry() × N
         +---> Compare (split)   → 2× buildLandGeometry()
         +---> Compare (merged)  → 2× buildLandGeometry() + flip + x-slide
         +---> Crosscut plot     → extractCrosscut() → optional flattenSignature()
```

Every arrow is a pure function except the DropZone (side-effectful) and the
Zustand store (holds state).

---

## Module responsibilities

### `lib/x3p.ts`

The only I/O-adjacent module. Exposes:

- `parseX3p(file: File): Promise<X3pScan>` — the one-shot parser.
- `decimate(scan, maxPoints?)` — returns a downsampled regular grid
  `{ nx, ny, z, strideX, strideY }` to keep mesh sizes GPU-friendly
  (default cap: 400 000 cells).

Key design choices:

- **Tolerant XML parsing.** `.x3p` is ISO 5436-2 XML packaged in a ZIP, but
  real-world writers (e.g. Sensofar) emit files with undeclared namespace
  prefixes (`<p:ISO5436_2>`). `stripNamespacePrefixes()` rewrites tag names on
  reparse so these files load without user action.
- **Multiple data encodings.** The Z matrix can be in a sibling `.bin` (typed
  little-endian `D`/`F`/`I`/`L`), in a separate `data.xml` `<DataList>`, or
  embedded directly in `main.xml`. All three paths fall back to a Float32 grid
  with `NaN` for invalid cells.
- **Single-pass statistics.** `zMin`, `zMax`, `zMean`, and `validCount` are
  computed once during parsing so viewers never re-scan the buffer.
- **Units are meters everywhere.** Consumers display µm/mm via
  [`formatMicrons`](../lib/utils.ts).

See [`X3P_FORMAT.md`](./X3P_FORMAT.md) for the file-format deep dive.

### `lib/geometry.ts`

Pure functions that turn an `X3pScan` into a `THREE.BufferGeometry`:

- **`buildLandGeometry(scan, colormap, zExag, maxPoints?, sharedMaxPhys?)`** —
  flat planar mesh in the XY plane with Z = height. Z is centered around the
  scan's median so the mesh sits at the origin; vertex colors sample the
  colormap over the Z range. Triangles touching a NaN cell are skipped, so
  masked regions create real holes rather than spike artifacts.
  `sharedMaxPhys` lets multiple scans render at a common physical scale —
  used by the merged compare view so the two lands line up at true size.

- **`buildStitchedLandGeometry(scan, opts)`** — cylindrical section for the
  bullet view. The scan's X axis wraps around the barrel (angular position);
  Y runs vertically; Z displaces the surface **radially**.

  The core trick: we split Z into **baseline + detail**.
  `detrendBaseline()` computes the per-column Y-mean, fills NaNs by linear
  interpolation, and applies a 4%-wide moving average. The baseline is
  rendered at a fixed amplitude (5% of `baseRadius`) so the physical
  curvature of the bullet is preserved no matter what Z-exaggeration the
  user picks; only the detail (striae) is multiplied by `zExaggeration` and
  colored. This is why the bullet looks round at 5× but the striae are
  still clearly readable.

- **`extractCrosscut(scan, yFrac)`** — one row of the Z matrix at a given
  fractional Y, with X positions in meters. Used by the crosscut plot and,
  indirectly, by click handling in the 3D viewers.

### `lib/flatten.ts`

Least-squares polynomial detrend for a 1D crosscut:

1. Trim `trimFrac` (default 10%) from each side — the groove-impression
   region typically has a strong slope that isn't striae.
2. Fit an order-`degree` polynomial (default quadratic) to the remaining
   finite samples using normal equations + Gaussian elimination with partial
   pivoting.
3. Subtract the fit; return the residual.

Works in normalized X coordinates so the matrix conditioning is independent
of the scan's physical units.

### `lib/colormap.ts`

Compact 10-stop RGB tables for Viridis, Plasma, Magma, Cividis (default),
Turbo, and Bone. `sampleColor(name, t)` linearly interpolates between stops
for a value `t ∈ [0,1]`. Stops are small enough that the whole module is
under 100 lines — if you need higher fidelity for a future export feature,
swap in `d3-scale-chromatic` or a precomputed LUT texture.

### `lib/store.ts`

Single zustand store — `useApp`. Holds:

- `scans: X3pScan[]` and `activeIndex`.
- View mode (`land` | `bullet` | `compare`) and compare layout
  (`split` | `merged`) + flips, B-slide offset, indices.
- Rendering settings: `colormap`, `zExagLand`, `zExagBullet`,
  `showWireframe`, `landCoverage` (bullet view angular span).
- Interaction state: `crosscutY`, `highlightX`, `flatten`, `viewPreset` +
  `viewResetTick`.
- UI state: `error`, `loading`.

Actions (`addScans`, `setMode`, `setColormap`, …) are the only way to
mutate state. All defaults are co-located with the state definition at the
top of the file.

### `lib/utils.ts`

Tiny helpers: `cn()` for Tailwind class merging, `formatMicrons()` /
`formatCount()` for display.

---

## View components

| Component | Responsibility |
| --- | --- |
| `app-shell.tsx` | Top bar, mode switcher, compare controls, layout of viewers + crosscut plots, error toast. |
| `drop-zone.tsx` | File picker + drag-and-drop; calls `parseX3p`; writes to the store. |
| `land-viewer.tsx` | Canvas for single-land view. Builds `buildLandGeometry`; renders mesh + Y crosscut bar + X highlight. |
| `bullet-viewer.tsx` | Canvas for stitched bullet; computes angular layout from `landCoverage`; renders cylinder + N `StitchedLand`s. |
| `merged-compare-viewer.tsx` | Canvas for merged compare; stacked A/B panels with independent flips and B-slide, shared crosscut + highlight. |
| `crosscut-plot.tsx` | 2D canvas line plot with colormap-shaded line, optional flatten, X highlight. |
| `metadata-panel.tsx` | Right-hand drawer with scan metadata, colormap picker, sliders, wireframe toggle. |
| `learn-panel.tsx` | Educational overlay explaining lands, striae, and the x3p format. |
| `scale-overlay.tsx` | Physical scale bar (µm / mm) on the active viewer. |
| `view-presets.tsx` | Camera preset toolbar (perspective / top / front / side / bottom) and the `CameraController` hook that drives `@react-three/fiber` transitions. |
| `welcome-intro.tsx` | First-load hero card shown before any scans are loaded. |
| `tooltip.tsx` | Tiny tooltip primitive. |

All 3D components are loaded via `next/dynamic` with `ssr: false` — Three.js
wants a real WebGL context and crashes during Next's static generation
otherwise.

---

## Performance notes

- **Decimation.** `decimate()` caps mesh cells at 400 000 by picking the
  smallest integer stride that fits. Typical Hamby lands (~1200 × 180) render
  at full resolution; high-resolution confocal scans (3000 × 500+) get
  sampled down transparently.
- **Geometry is `useMemo`'d** on `(scan, colormap, zExaggeration, …)`. Each
  geometry disposes in its cleanup effect to release GPU memory when props
  change.
- **`dpr={[1, 2]}`** caps device-pixel-ratio at 2 so retina displays don't
  render 4× the pixels.
- **Indexed meshes use `Uint16BufferAttribute` when possible** and fall back
  to `Uint32` when triangle count ≥ 65 536.

---

## Testing

Vitest runs unit tests in a `jsdom` environment under `tests/`. A synthetic
`.x3p` fixture is generated at test-setup time by
[`tests/fixtures/build-x3p.ts`](../tests/fixtures/build-x3p.ts) — a small
Float32 grid plus a valid `main.xml` zipped with `fflate`. This keeps the
repo binary-free while still exercising the real parser end-to-end.

E2E tests with WebGL are **not** included. Playwright's headless Chromium
can render R3F but reliable screenshot/interaction tests require a GPU
runner; we explicitly opted out of this for now. Manual QA via
`npm run dev` is the current answer for the 3D viewers.

---

## Non-goals

- **No server / no uploads.** If you're tempted to add a backend, reconsider —
  the "paste into browser" ergonomics are a core feature.
- **No persistent storage.** The store is intentionally in-memory. A future
  `localStorage` hydration pass would be fine but should stay opt-in.
- **No heavy analysis.** Cross-scan comparison statistics, CMC scoring,
  registration — those live in the R package `bulletAnalyzrResearch`. This
  viewer is a visualization layer.
