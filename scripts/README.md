# Scripts

Node.js diagnostics for poking at `.x3p` files from the command line. These
are **manual debugging aids**, not part of CI. For automated regression
coverage see `tests/` and `npm test`.

All scripts expect a file path as the first CLI argument. They use `jsdom`
to provide `DOMParser` in Node and must be run with the repo's installed
dependencies (run `npm install` first).

| Script | What it does |
| --- | --- |
| `smoke-parse.mjs` | Quick sanity: unzip, read metadata, decode `.bin`, print Z stats. |
| `diag-file.mjs` | Verbose: dump XML head/tail, tag selectors, namespace detection — for debugging parser failures on a new writer. |
| `full-parse-test.mjs` | Runs the real `lib/x3p.ts` parser (via `tsx`) end-to-end. |

Example:

```bash
node scripts/smoke-parse.mjs path/to/land1.x3p
node scripts/diag-file.mjs path/to/land1.x3p
npx tsx scripts/full-parse-test.mjs path/to/land1.x3p
```
