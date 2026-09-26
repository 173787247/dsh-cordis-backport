# dsh-cordis-backport

**English** | [中文](README.zh.md)

An audit of the cordis line vendored into DeepSeek Harness, and backports for the
upstream fixes it has not taken.

**Background and discussion:** https://github.com/deepseek-ai/deepseek-harness/discussions/7922

## What this is

DeepSeek Harness ships `@deepseek-ai/cordis@4.0.4` and its plugins rather than the
published `cordis` package. That line is not a renamed snapshot of
`cordis@4.0.0-rc.10` — it is a separate track with its own `config/diff.ts`, its own
`volatile` concept, and its own handling of `!!js` in `disabled`. Both tracks make
their own trade-offs.

What follows from that is the thing this repository is about: **upstream has fixed
bugs that the vendored line still has**, in code DSH runs every day.

## The nine, each reproduced

Every row was confirmed with one probe run against the shipped packages and against
upstream `cordis@4.0.0-rc.10`, with nothing else changed. Probes are in [`probes/`](probes).

| upstream | where | before → after |
|---|---|---|
| [`988df36`](https://github.com/cordiverse/cordis/commit/988df36) (#68) | `cordis/src/context.ts` | optional properties left un-widened, so `exactOptionalPropertyTypes` consumers cannot assign `undefined` — type-level only, no runtime change |
| [`10194de`](https://github.com/cordiverse/cordis/commit/10194de) (#98) | `cordis/src/fiber.ts` | a `FAILED` fiber re-entered its lifecycle on a dependency refresh, re-running a plugin that had already thrown |
| [`752dbee`](https://github.com/cordiverse/cordis/commit/752dbee) (#40) | `cordis/src/fiber.ts` | `plugin()` returns an `Object.create(fiber)` wrapper; writing lifecycle fields through `this` shadowed the real fiber's, so after a config update the wrapper and the fiber disagreed — the wrapper kept reporting `ACTIVE` after unload |
| [`2ceea23`](https://github.com/cordiverse/cordis/commit/2ceea23) (#109) | `cordis/src/fiber.ts` | `Fiber.update()` returned `undefined`; a dropped call produced `unhandledRejection: 'boom'` → returns the task, rejects to an awaiter, nothing leaks |
| [`1b7d0f2`](https://github.com/cordiverse/cordis/commit/1b7d0f2) | `loader/src/config/{entry,group,isolate}.ts` | a new child entry had no fiber when `await loader.update()` resolved → reconciled by then |
| [`5b195b3`](https://github.com/cordiverse/cordis/commit/5b195b3) (#44) | `cordis/src/events.ts` | a listener reaching `next()` twice ran the chain again silently → throws `next() called multiple times` |
| [`cb77029`](https://github.com/cordiverse/cordis/commit/cb77029) (#53) | `timer/src/index.ts` | 2 and 3 concurrent `next()` waiters both timed out → all settle in order |
| [`1c1a10e`](https://github.com/cordiverse/cordis/commit/1c1a10e) (#51) | `cordis/src/events.ts` | `ctx.on('toString', …)` threw `hooks[method] is not a function` → registers |
| [`fd96b0a`](https://github.com/cordiverse/cordis/commit/fd96b0a) (#36) | `cordis/src/logger.ts` | a held `ctx.logger.buffer` grew past its bound instead of staying put → stays bounded |

## The upstream pull requests

Eleven are open against `cordiverse/cordis`. They apply cleanly in any order — no
two touch the same lines — and together they run green:

```
upstream/main       25 files   248 tests
all eleven stacked  34 files   264 tests   all passing
```

The stacked diff is on the fork as `all-prs-stacked`, as a convenience for
reviewing them as a batch rather than as a dependency between them. The
no-conflict claim was checked by cherry-picking all eleven, commit by commit, onto
a clean `upstream/main`.

## Where the gaps actually are

The nine items above all come from a **narrow window — August and September
2026**. That is worth stating explicitly, because the obvious reading of a
vendored line sitting at `4.0.4` against an upstream `4.0.0-rc.10` is that it has
drifted far behind. It has not.

Scanning every upstream `fix` commit before July 2026 — 78 of them — and checking
each against the vendored line, the historical fixes are essentially all present:

| upstream | verdict |
|---|---|
| `fa817a6` (#20, `null instanceof Service` crash) | present — `if (!instance) return false` |
| `566aee7` (#22, `DisposableList` reading `this.sn` late) | present — `const sn = ++this.sn` |
| `2e4cc04` (#24, optional inject reading unknown services) | present |
| `938513b` (do not emit unhandled rejections) | present — the `while (this.inertia)` loop and its comment |
| `dd8bf6e` (logger respects def-site names) | present — `this.ctx[symbols.shadow] ?? this.ctx` |
| `bd6e229` (timer `iterator.throw()` result) | present — the `done.kind` shape |
| `592b4f3`, `9797afb` (loader `internal/plugin` case analysis) | present, and numbered per a **later** upstream state |
| `e20aef4` (include resolves `baseUrl`) | present |

Not applicable rather than missing: the `hmr` package (not shipped), and the
`scope.ts` / `entry.ts`-era commits whose files were renamed before this line
existed.

So the line is actively maintained and the cherry-picking is thorough. What it
has not taken is the most recent work — which is also the work least likely to
have been reviewed yet, since upstream's merge cadence runs in multi-week bursts
and the newest commits are the ones still open as pull requests.

That is the useful conclusion for anyone re-running this later: **start from the
last few weeks of upstream history, not from the beginning.**

## Verification of code upstream does not have

[`verify/`](verify) covers the one part of this tree with no upstream counterpart:
the `volatile` config machinery (`cosmokit/src/volatile.ts`, the schemastery
support, `loader/src/config/diff.ts`). Upstream has none of it, so unlike the
backports above, none of it has been read by anyone outside the team that wrote it.

Short version: `equalExceptVolatile` — the function that decides whether a config
change needs a remount — holds up under 5000 seeded config pairs plus targeted
edge cases. One missing guard turns up; it is argued unreachable in
[`verify/README.md`](verify/README.md), and the argument matters more than the
defect, because **two missing guards mask each other** and fixing either alone
makes the other live.

## Fuzzing the core

[`fuzz/`](fuzz) drives the fiber state machine with seeded random lifecycles and
checks invariants that should hold regardless: state settles after quiescence,
effects are accounted for exactly, `ctx.get()` never returns a dead provider's
value, disposal cascades through nested fibers. Four fuzzers, the last issuing
operations concurrently with no settle in between.

This is how [#175](https://github.com/cordiverse/cordis/pull/175) was found — a
fiber disposed before activation keeps its disposables forever, which no amount of
reading two versions side by side would have shown. It also caught the two bugs in
my own invariants, which [`fuzz/README.md`](fuzz/README.md) records.

## Backports

[`backport/`](backport) holds three patches — `cordis@4.0.4`,
`cordis-plugin-loader@1.0.5`, `cordis-plugin-timer@1.1.6` — covering all six.
They apply cleanly to untouched 4.0.4 sources and were verified the same way the
audit was: probe before, probe after.

Note that each patch touches `src/*.ts` **and** `lib/index.js`. `exports` resolves
to the bundle, so changing `src` alone does not change what runs; shipping both
halves means the patch can be verified without a rebuild.

## Two things worth knowing before cherry-picking

**The innocent-looking hunks are the load-bearing ones.** In `1b7d0f2`, this reads
like formatting:

```diff
-    ctx.on('internal/update', (config) => {
-      this.update(config)
-    })
+    ctx.on('internal/update', config => this.update(config))
```

It is not. The first returns `undefined`; the second implicitly returns the promise,
and the waterfall propagates a listener's return value out to `Fiber.update`'s
caller. That is where the await chain actually breaks. With only `entry.ts` and
`isolate.ts` changed the probe still failed; it passed once this went in.

**"Added lines not found here" does not mean "fix missing".** Both tracks have been
refactored. A line-matching pass over the upstream log flagged twelve commits as
absent; checking them one at a time, several were the same feature written
differently (`be7d36e` #37). **One of those calls was wrong:** `752dbee` (#40) was
marked present because the identifiers it touches all exist here, but what it
changes is the *receiver* of an assignment — `this.assertActive()` becomes
`const fiber = this.ctx.fiber; fiber.assertActive()` — so nothing name-based can
see it. It was found by fuzzing instead, and it is the seventh item above. The
correction is written up in [`backport/README.md`](backport/README.md).

The audit window is fully adjudicated: all sixteen upstream `fix` commits between
2026-08-01 and the head of `upstream/main` carry a verdict — nine backported, two
confirmed and deliberately unpatched (the shadow gap above), two deliberate
divergences, one a feature, one not applicable (the `hmr` package is not shipped
here), one already present.

Not included, deliberately:

- `8abd903` (#35, caller tracking) — `symbols.caller` does not exist here at all, so
  this is a feature rather than a repair.
- `c594d1a` (#121) and `c2835d8` (#123) — the include here **deliberately** vetoes the
  fiber restart and persists the config itself, with a comment explaining why.
  Following upstream there is a product decision, not a backport.

## Running the probes

The probes need two module trees: one resolving `@deepseek-ai/*` (the shipped
packages) and one resolving `cordis` / `@cordisjs/*` (upstream). See
[`probes/README.md`](probes/README.md) for the layout and the one-line module-name
substitution that lets a single probe run against either side.
