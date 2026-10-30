# Vendored anti-slop

Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), commit
`13909c9e07590f5a85d93c62712259fe14a883f7` (2026-10-13, "Merge pull request #45
from haydenbleasel/feat/group-singleline-bindings"). There is no official npm
package; the rules are vendored as recommended by the upstream README.

Copied from that commit with the bundled installer's asset layout:

- `skills/install-anti-slop/assets/anti-slop/**` → this directory. The assets were
  verified identical to upstream `src/` at that commit, minus upstream's RuleTester
  `*.test.ts` files (not copied).
- Root `LICENSE` (MIT, Copyright (c) 2026 Dillon Mulroy) → `LICENSE`.
- `vendor/eslint-stylistic/` keeps its own MIT `LICENSE` and `UPSTREAM.md`.

Entry points registered in `oxlint.config.ts`:

- `./tools/oxlint/anti-slop/index.ts` (`anti-slop`, every generic rule at `error`,
  plus the native companion `oxc/no-accumulating-spread`)
- `./tools/oxlint/anti-slop/effect/index.ts` (`anti-slop-effect`, every Effect
  rule at `error`; this project depends on `effect` directly)

Dependencies pinned exactly and together, per upstream guidance: `oxlint@1.90.0`
and `@oxlint/plugins@1.90.0`.

Local deviations: none. Update with the upstream `install-anti-slop` skill's update
procedure (three-way merge against the commit above) rather than replacing this
directory.
