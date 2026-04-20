# Bullet Lens

Modern, interactive 3D viewer for forensic bullet topography scans stored in the
ISO 5436-2 `.x3p` format. Drop one or more scans into your browser and inspect
the land surface in three dimensions, extract live crosscut signatures,
stitch multiple lands into a virtual bullet, and compare lands side-by-side or
merged.

Everything runs **entirely in the browser** — no server, no uploads, no
account. Drop-in `.x3p` → interactive 3D in one step.

---

## Features

- **Drag-and-drop** `.x3p` files — parsing (ZIP → XML → binary matrix) runs
  client-side via `fflate` and `DOMParser`.
- **Single-land view** — 3D surface with orbit/zoom/pan, configurable
  Z-exaggeration, wireframe toggle, and a clickable crosshair.
- **Bullet view** — stitch ≥ 2 lands around a virtual barrel, preserving the
  bullet's physical curvature while letting you amplify the striae
  independently.
- **Compare view** — two lands side-by-side (split) or stacked along a seam
  (merged), with independent flip controls, a horizontal B-slide to dial in
  striae alignment, and dual crosscut plots.
- **Crosscut plot** — live 1D signature extraction at any Y position, with
  optional detrending (quadratic fit, trimmed endpoints) to isolate striae.
- **Colormaps** — Viridis, Plasma, Magma, **Cividis (default)**, Turbo, Bone.
- **Scale overlay** — real-world micron/mm measurements on the active scan.
- **Learn panel** — built-in glossary and educational overlays explaining
  lands, striations, and the x3p format.

## Stack

- [Next.js 16](https://nextjs.org/) (App Router) + React 19
- [`@react-three/fiber`](https://r3f.docs.pmnd.rs/) + Three.js for WebGL 3D
- [Tailwind CSS 4](https://tailwindcss.com/) for styling
- [`fflate`](https://github.com/101arrowz/fflate) for client-side ZIP decoding
- [`zustand`](https://github.com/pmndrs/zustand) for state
- [Vitest](https://vitest.dev/) + [`jsdom`](https://github.com/jsdom/jsdom)
  for unit tests

## Requirements

- Node.js **20.11+** (see [`.nvmrc`](.nvmrc))
- A browser with WebGL 2 and `DOMParser` — recent Chrome/Firefox/Safari/Edge.

## Dev

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Build

```bash
npm run build
npm run start
```

## Quality gates

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint . (flat config)
npm test            # vitest (headless, jsdom)
npm run test:watch  # vitest --watch
```

CI runs typecheck → lint → test → build on every push and PR; see
[`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Deploying

The app is a pure static/SSR Next.js app with no backend, env vars, or secrets.
Deploy to [Vercel](https://vercel.com/) with zero config:

```bash
npx vercel            # preview
npx vercel --prod     # production
```

Any Next.js-compatible host works.

## Notes

- Large x3p matrices (> 400k cells) are decimated before upload to the GPU —
  see [`decimate`](lib/x3p.ts) and [Architecture](docs/ARCHITECTURE.md).
- Invalid / NaN cells are dropped from the triangulation, so the mesh
  faithfully reflects any masked regions in the scan.
- Z is visually exaggerated; a real land is only a few microns tall over
  millimeters of width.
- In the **bullet view**, the physical curvature is held to a fixed amplitude
  and only the high-frequency detail (striae) is amplified by Z-exaggeration.
  This keeps the barrel looking round even at 5×+ exaggeration.

## Project layout

```
app/               Next.js App Router entry (layout, page, global CSS, icon)
components/        React components (viewers, panels, controls)
lib/               Pure TS: x3p parsing, geometry, colormap, store, flatten
scripts/           Node diagnostics (parse probes, never run in browser)
docs/              Architecture + x3p format notes
tests/             Vitest unit tests + synthetic fixture generator
.github/workflows/ CI
```

More detail in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and
[`docs/X3P_FORMAT.md`](docs/X3P_FORMAT.md).

## Demo data

The welcome screen has a **Try a matching pair (demo)** button that pulls all
12 lands from the NIST [Ballistics Toolmarks Research Database][nbtrd] (Hamby
252 study — Barrel 1, Bullets 1 & 2, 6 lands each) and drops into the merged
compare view with a best-guess A/B pair pre-selected. Once loaded, use the
`A`/`B` chips next to each scan in the right-hand panel to swap either slot
and hunt for the actual match. The measurement IDs come from the
[CSAFE-ISU/`nbtrd`][nbtrd-pkg] R package. Because NBTRD doesn't send CORS
headers, the app fetches them through the `/api/demo/[id]` route (a thin,
allowlisted server-side proxy) rather than hitting NIST from the browser.

Alternatively, drop your own `.x3p` files. The Hamby reference set
([Hamby et al., AFTE 2009](https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=905097))
is a common source, and the companion R package
[`bulletAnalyzrResearch`](https://github.com/heike/bulletAnalyzrResearch) ships
canonical demo files under
`inst/extdata/demo/hamby_set_44_final/barrel_1/bullet_1/land1.x3p`. Drop any of
those into the app to try.

[nbtrd]: https://tsapps.nist.gov/NRBTD/Studies/Search
[nbtrd-pkg]: https://github.com/CSAFE-ISU/nbtrd

## Contributing

Bug reports and PRs welcome — please read
[`CONTRIBUTING.md`](CONTRIBUTING.md) first.

## License

MIT — see [`LICENSE`](LICENSE).
