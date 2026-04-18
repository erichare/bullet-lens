# Contributing to Bullet Lens

Thanks for your interest! Bullet Lens is a small, focused app and we'd love
to keep it that way. Here's what you need to know to contribute effectively.

## Quick setup

```bash
git clone https://github.com/<you>/bullet-lens.git
cd bullet-lens
nvm use           # uses .nvmrc
npm install
npm run dev       # http://localhost:3000
```

Drop any `.x3p` file into the app to verify it loads.

## Development loop

Before sending a PR, run all four gates locally — CI runs the exact same
commands:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

If you're iterating on tests, use `npm run test:watch` for fast feedback.
Lint auto-fixes are available via `npm run lint:fix`.

## Project conventions

- **Pure functions in `lib/`**, React in `components/`, routes in `app/`.
  Don't reach across: components should import from `lib`, never the other
  way around.
- **No backend.** Anything that needs a server goes somewhere else. Parsing,
  geometry, and state all run in the browser.
- **No `any`.** Use `unknown` for untrusted input and narrow it. If you find
  yourself reaching for `any`, the type signature of the function you're
  calling probably needs fixing first.
- **Meters everywhere.** The `lib/` layer speaks meters. Only display
  components (or `formatMicrons`) convert to µm / mm.
- **Immutability.** Zustand actions return new state; never mutate arrays or
  scan objects in place.
- **File size.** Components over ~400 lines are a code smell — extract.

## Testing

- Unit tests live in `tests/` and run under Vitest + jsdom.
- Pure functions in `lib/` should have tests. A synthetic `.x3p` generator
  lives at [`tests/fixtures/build-x3p.ts`](tests/fixtures/build-x3p.ts) —
  use it rather than committing binary fixtures.
- We **don't** have WebGL E2E tests. Manually verify rendering changes with
  `npm run dev` and state the testing you did in the PR description.

## What to work on

Good first PRs:

- Additional x3p writer quirks (more namespace oddities, alternative
  `Record3` spellings, etc.) — add a regression test in
  `tests/x3p.test.ts`.
- New colormaps — extend `lib/colormap.ts` and add a sampling test.
- UI polish in `components/` — drop screenshots/gifs in the PR.

Bigger ideas worth discussing in an issue first:

- Alternative parsers (streaming for very large x3p files).
- Cross-land analytics (registration, CMC scoring). These probably belong
  in the R package first.
- Persistent view presets or session restoration.

## Pull requests

- Small, focused PRs > giant ones.
- Subject line follows Conventional Commits: `feat: …`, `fix: …`,
  `docs: …`, `test: …`, `refactor: …`, `chore: …`.
- Include a **Test plan** section — what you ran and what you eyeballed.
- Link any related issue.

## Code of conduct

Be kind, assume good faith, keep discussion technical. We follow the
[Contributor Covenant](https://www.contributor-covenant.org/).

## License

By contributing you agree your work will be released under the project's
MIT license.
