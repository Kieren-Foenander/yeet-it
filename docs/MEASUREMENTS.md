# Bundle measurements

Initial browser payload = the JS and CSS referenced by `dist/index.html`, measured
with `pnpm build && node scripts/measure-bundle.ts [--url <live site>]`. Puzzle data
(`/api/puzzle/<date>`) is measured separately. Target: under 100 KB compressed.

## Milestone 1: playable Foldkit slice (2026-10-30)

Load today's puzzle from the Worker, type or tap letters, submit a shorter word,
remove unused letters, render the chain. No styling, persistence, or sharing yet.

| Build | Raw | gzip -9 | brotli q11 |
| --- | --- | --- | --- |
| Vite 8 default (Oxc minifier) | 308.4 KB | 100.4 KB | 88.1 KB |
| Terser, 3 compress passes | 306.3 KB | 99.4 KB | 86.5 KB |

Deployed to https://yeet-it.kfoenander98.workers.dev and downloaded raw:
**99.3 KB with `Accept-Encoding: gzip`, 101.0 KB with `br`** (Cloudflare's
on-the-fly brotli is a lower quality level than local q11). Today's puzzle payload
was 0.95 KB gzip / 0.99 KB br.

Composition from the source map: Foldkit runtime ≈145 KB raw (HTML builder
45 KB, plus hydration, DOM reflection, crash UI, and DevTools store modules the
runtime imports even for a client-only app), Effect ≈148 KB raw (effect core
28 KB, SchemaAST 25 KB, HashMap, PubSub, Schema, Duration, Channel, Queue …),
application code ≈7 KB raw.

Finding: the framework floor alone is about 97 KB gzip, so the 100 KB target
leaves only ~3 KB gzip for the application. Foldkit and Effect stay (the brief
forbids dropping them); further savings must come from keeping application code
and imports small.
