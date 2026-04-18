// End-to-end parse using the real parser from lib/x3p.ts via tsx.
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

globalThis.DOMParser = new JSDOM().window.DOMParser;

// Minimal File polyfill for Node
class NodeFile {
  constructor(buf, name) {
    this._buf = buf;
    this.name = name;
  }
  async arrayBuffer() {
    return this._buf.buffer.slice(
      this._buf.byteOffset,
      this._buf.byteOffset + this._buf.byteLength,
    );
  }
}
globalThis.File = NodeFile;

const { parseX3p } = await import("../lib/x3p.ts");

const path = process.argv[2];
const buf = readFileSync(path);
const file = new NodeFile(new Uint8Array(buf), path.split("/").pop());
const scan = await parseX3p(file);

console.log(`Parsed: ${scan.name}`);
console.log(`Size: ${scan.meta.sizeX} × ${scan.meta.sizeY}`);
console.log(`Physical: ${(scan.widthMeters * 1000).toFixed(3)} × ${(scan.heightMeters * 1000).toFixed(3)} mm`);
console.log(`Z: [${(scan.zMin * 1e6).toFixed(2)}, ${(scan.zMax * 1e6).toFixed(2)}] µm`);
console.log(`Mean Z: ${(scan.zMean * 1e6).toFixed(3)} µm`);
console.log(`Valid: ${scan.validCount} / ${scan.z.length}`);
console.log(`Instrument: ${scan.meta.instrument ?? "(none)"}`);
console.log("OK");
