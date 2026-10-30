# PR verification, 2026-10-30

Every open cordis PR was checked in two directions:

1. **upstream** — its added test(s), copied onto a clean `upstream/main` checkout
   (`bb3bf8a`) and run with `./node_modules/.bin/vitest run <files>`; a real bug
   means the test fails there and passes on the PR branch.
2. **DSH line** — the probe in `probes/` run against the shipped
   `@deepseek-ai/cordis@4.0.5` / loader `1.0.6`.

| PR | upstream main | DSH 4.0.5 | classification |
|---|---|---|---|
| #165 persist order | 1 failed (`persist-order.spec.ts`) | ★ probe 17 | real bug on both lines; upstream fix needs rework after #134 moved commit |
| #167 group reconcile | **1 passed** (5/5 runs) | ★ probe 11 | **DSH-only reproduction**; upstream `internal/update` return fix (already on main) masks the race, so the upstream test does not fail without this change |
| #168 hmr double reload | 1 failed (`watch-claimed.spec.ts`) | N/A (hmr not vendored) | real upstream bug |
| #185 disposal order | 4 failed (`dispose.spec.ts`) | ✓ probes 16/16b/16c/16d | real upstream bugs; shipped line already has its own fixes, no backport needed |
| #232 prepend internal/update | 1 failed (`events.spec.ts`) | ★ probe 12 | real bug on both lines; backport `cordis-4.0.5.patch` |
| #233 listener arg type | type-level only | ✓ runtime argument is an object | declaration in `packages/core/src/events.ts` says `boolean`; runtime passes `EventOptions`. No runtime failure |
| #234 removed teardown | 2 failed (`teardown.spec.ts`) | ★ probe 14 (both scenarios) | real bug on both lines; backport `cordis-plugin-loader-1.0.6-teardown.patch` |
| #235 logger format | 1 failed (`logger.spec.ts`) | ★ probe 15b | real bug on both lines; backport `cordis-4.0.5.patch` |

## Notes

- `#167`: the upstream test passes on `main` because `Group` already returns the
  `update()` promise there (`ctx.on('internal/update', config => this.update(config))`);
  the shipped line lacks that hunk, which is why probe 11 still shows the stale
  plugin. Keep the DSH patch, but the upstream PR needs a test that fails without
  its change before it is worth merging.
- `#233` is a declaration bug, not a runtime one; there is no probe to run.
- `#185` confirms the opposite direction: four upstream defects that the shipped
  line already fixed on its own track.
