# Bullet Lens

Modern, interactive 3D viewer for forensic bullet topography scans stored in the
[ISO 5436-2](https://www.nmisa.org/iso5436-2/) `.x3p` format.

Built as a companion to **bulletAnalyzrResearch** — purely a browser-side
visualization tool, with no backend and no uploads.

## Stack

- **Next.js 16** + React 19 (App Router)
- **React Three Fiber** + Three.js for WebGL 3D
- **Tailwind CSS 4** for styling
- **fflate** for client-side ZIP decoding of x3p archives
- **zustand** for state

## Features

- Drag-and-drop `.x3p` files — parsing runs entirely in the browser
- **Single-land view** — 3D surface rendering with orbit / zoom
- **Bullet view** — drop multiple `.x3p` files to stitch them around a virtual barrel
- **Crosscut plot** — live 1D signature extraction at any Y position
- Colormaps (Viridis, Plasma, Magma, Cividis, Turbo, Bone), Z-exaggeration, wireframe
- Built-in glossary & educational overlays explaining lands, striations, and the x3p format
- Scale bar with real-world micron/mm measurements

## Dev

```bash
cd inst/webapp
npm install
npm run dev
# open http://localhost:3000
```

## Build

```bash
npm run build
npm run start
```

## Notes

- Large x3p matrices (&gt; 400k points) are decimated before upload to the GPU.
- Invalid / NaN cells are skipped from the triangulation, so the resulting mesh
  faithfully reflects any masked regions in the scan.
- Z-axis is visually exaggerated; a real land is only a few microns tall over
  millimeters of width.

## Demo data

A minimal demo file ships with the R package:

```
inst/extdata/demo/hamby_set_44_final/barrel_1/bullet_1/land1.x3p
```

Drop it into the app to try.
