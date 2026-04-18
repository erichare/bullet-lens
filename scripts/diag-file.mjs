import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { unzipSync, strFromU8 } from "fflate";

const path = process.argv[2];
if (!path) {
  console.error("usage: node diag-file.mjs <path-to-x3p>");
  process.exit(1);
}
globalThis.DOMParser = new JSDOM().window.DOMParser;

const buf = readFileSync(path);
console.log(`File: ${path}`);
console.log(`Size: ${buf.length} bytes`);

let zip;
try {
  zip = unzipSync(new Uint8Array(buf));
} catch (e) {
  console.error("unzip failed:", e.message);
  process.exit(1);
}

console.log(`\nZip entries:`);
for (const [name, data] of Object.entries(zip)) {
  console.log(`  ${name}  (${data.length} bytes)`);
}

let xml = null;
let bin = null;
let binName = null;
for (const [name, data] of Object.entries(zip)) {
  const lname = name.toLowerCase();
  if (lname.endsWith("main.xml")) xml = strFromU8(data);
  else if (lname.endsWith(".bin")) {
    bin = data;
    binName = name;
  }
}

console.log(`\nmain.xml found: ${!!xml}`);
console.log(`.bin found: ${!!bin} (${binName ?? "none"})`);

if (!xml) {
  console.error("No main.xml — can't proceed");
  process.exit(1);
}

console.log(`\n--- first 800 chars of XML ---`);
console.log(xml.slice(0, 800));
console.log(`--- last 300 chars ---`);
console.log(xml.slice(-300));

function stripNsPrefixes(s) {
  return s
    .replace(/<(\/?)[A-Za-z_][\w.-]*:([A-Za-z_])/g, "<$1$2")
    .replace(/xmlns:[A-Za-z_][\w.-]*="[^"]*"/g, "");
}

let doc = new DOMParser().parseFromString(xml, "application/xml");
let perr = doc.querySelector("parsererror");
if (perr) {
  console.log("\nInitial parse failed, retrying with namespace strip...");
  doc = new DOMParser().parseFromString(stripNsPrefixes(xml), "application/xml");
  perr = doc.querySelector("parsererror");
}
if (perr) {
  console.error("\nXML PARSE ERROR:");
  console.error(perr.textContent);
  process.exit(1);
}

function first(sel) {
  return doc.querySelector(sel)?.textContent?.trim();
}
function firstNS(tag) {
  // Try both querySelector and getElementsByTagNameNS / getElementsByTagName
  const els = doc.getElementsByTagName(tag);
  return els.length ? els[0].textContent?.trim() : null;
}

console.log(`\nquerySelector("MatrixDimension SizeX") = ${first("MatrixDimension SizeX")}`);
console.log(`querySelector("MatrixDimension SizeY") = ${first("MatrixDimension SizeY")}`);
console.log(`getElementsByTagName("SizeX") = ${firstNS("SizeX")}`);
console.log(`getElementsByTagName("SizeY") = ${firstNS("SizeY")}`);

console.log(`\nCX Increment: qs=${first("Axes > CX > Increment")}  byTag=${firstNS("Increment")}`);
console.log(`CZ DataType: qs=${first("Axes > CZ > DataType")}`);

const root = doc.documentElement;
console.log(`\nRoot element: <${root.tagName}>  namespaceURI=${root.namespaceURI ?? "(none)"}`);
console.log(`children:`, Array.from(root.children).map(c => c.tagName).join(", "));
