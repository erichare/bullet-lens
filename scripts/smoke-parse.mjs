// Node.js smoke test for the x3p parser against a user-supplied file.
// Usage: node scripts/smoke-parse.mjs path/to/scan.x3p
//
// Uses jsdom to provide DOMParser in a Node environment. For a fully
// automated regression suite see `npm test`.

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { JSDOM } from "jsdom";
import { unzipSync, strFromU8 } from "fflate";

globalThis.DOMParser = new JSDOM().window.DOMParser;

const demoPath = process.argv[2];
if (!demoPath) {
  console.error("usage: node scripts/smoke-parse.mjs <path-to-x3p>");
  process.exit(1);
}

const buf = readFileSync(demoPath);
console.log(`Read ${buf.length} bytes from ${basename(demoPath)}`);

const zip = unzipSync(new Uint8Array(buf));
console.log("Zip entries:", Object.keys(zip));

let xml = null;
let bin = null;
for (const [name, data] of Object.entries(zip)) {
  if (name.toLowerCase().endsWith("main.xml")) xml = strFromU8(data);
  else if (name.toLowerCase().endsWith(".bin")) bin = data;
}
if (!xml) {
  console.error("no main.xml found");
  process.exit(1);
}

const doc = new DOMParser().parseFromString(xml, "application/xml");
const dim = doc.querySelector("MatrixDimension");
const sx = Number(dim.querySelector("SizeX")?.textContent);
const sy = Number(dim.querySelector("SizeY")?.textContent);
const cx = Number(doc.querySelector("Axes > CX > Increment")?.textContent);
const cy = Number(doc.querySelector("Axes > CY > Increment")?.textContent);
const cz = doc.querySelector("Axes > CZ > DataType")?.textContent?.trim() ?? "D";

console.log(
  `Matrix: ${sx} × ${sy}; dx = ${(cx * 1e6).toFixed(3)} µm; dy = ${(cy * 1e6).toFixed(3)} µm; dtype=${cz}`,
);
console.log(
  `Physical extent: ${((sx - 1) * cx * 1000).toFixed(3)} mm × ${((sy - 1) * cy * 1000).toFixed(3)} mm`,
);

if (!bin) {
  console.error("no .bin payload found");
  process.exit(1);
}

console.log(`Binary size: ${bin.length} bytes (expected: ${sx * sy * (cz === "D" ? 8 : cz === "F" ? 4 : 2)})`);

const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
let zMin = Infinity;
let zMax = -Infinity;
let valid = 0;
let sum = 0;
for (let i = 0; i < sx * sy; i++) {
  const v = cz === "D" ? dv.getFloat64(i * 8, true) : dv.getFloat32(i * 4, true);
  if (Number.isFinite(v)) {
    if (v < zMin) zMin = v;
    if (v > zMax) zMax = v;
    sum += v;
    valid++;
  }
}
console.log(
  `Z: min=${(zMin * 1e6).toFixed(3)} µm, max=${(zMax * 1e6).toFixed(3)} µm, mean=${((sum / valid) * 1e6).toFixed(3)} µm, valid=${valid}/${sx * sy}`,
);

console.log("Parser smoke test: OK");
