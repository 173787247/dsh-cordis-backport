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

## The twelve, each reproduced

Every row was confirmed with one probe run against the shipped packages and against
upstream `cordis@4.0.0-rc.10`, with nothing else changed. Probes are in [`probes/`](probes).

| upstream | where | before → after |
|---|---|---|
| [`eb5604d`](https://github.com/cordiverse/cordis/commit/eb5604d) (#32) | `cordis/src/logger.ts` | `INFO` and `WARN` were the wrong way round in `LoggerLevel`, and the exporter default threshold is that same `INFO` — so **`ctx.logger.warn()` was silently dropped** at the default level |
| [`be7d36e`](https://github.com/cordiverse/cordis/commit/be7d36e) (#37) + [`4cfd19a`](https://github.com/cordiverse/cordis/commit/4cfd19a) | `cordis/src/utils.ts`, `reflect.ts` | callable-service shadows were dropped and `ctx.foo.bar` was governed by the wrong context — a service could reach one it never declared, and one that had declared it could not reach it from a nested context |
| [`988df36`](https://github.com/cordiverse/cordis/commit/988df36) (#68) | `cordis/src/context.ts` | optional properties left un-widened, so `exactOptionalPropertyTypes` consumers cannot assign `undefined` — type-level only, no runtime change |
| [`10194de`](https://github.com/cordiverse/cordis/commit/10194de) (#98) | `cordis/src/fiber.ts` | a `FAILED` fiber re-entered its lifecycle on a dependency refresh, re-running a plugin that had already thrown |
| [`752dbee`](https://github.com/cordiverse/cordis/commit/752dbee) (#40) | `cordis/src/fiber.ts` | `plugin()` returns an `Object.create(fiber)` wrapper; writing lifecycle fields through `this` shadowed the real fiber's, so after a config update the wrapper and the fiber disagreed — the wrapper kept reporting `ACTIVE` after unload |
| [`2ceea23`](https://github.com/cordiverse/cordis/commit/2ceea23) (#109) | `cordis/src/fiber.ts` | `Fiber.update()` returned `undefined`; a dropped call produced `unhandledRejection: 'boom'` → returns the task, rejects to an awaiter, nothing leaks |
| [`1b7d0f2`](https://github.com/cordiverse/cordis/commit/1b7d0f2) | `loader/src/config/{entry,group,isolate}.ts` | a new child entry had no fiber when `await loader.update()` resolved → reconciled by then |
| [`5b195b3`](https://github.com/cordiverse/cordis/commit/5b195b3) (#44) | `cordis/src/events.ts` | a listener reaching `next()` twice ran the chain again silently → throws `next() called multiple times` |
| [`cb77029`](https://github.com/cordiverse/cordis/commit/cb77029) (#53) | `timer/src/index.ts` | 2 and 3 concurrent `next()` waiters both timed out → all settle in order |
| [`1c1a10e`](https://github.com/cordiverse/cordis/commit/1c1a10e) (#51) | `cordis/src/events.ts` | `ctx.on('toString', …)` threw `hooks[method] is not a function` → registers |
| [`fd96b0a`](https://github.com/cordiverse/cordis/commit/fd96b0a) (#36) | `cordis/src/logger.ts` | a held `ctx.logger.buffer` grew past its bound instead of staying put → stays bounded |

## Two companion studies

- [`dsh-vs-pi-verification.md`](dsh-vs-pi-verification.md) — a point-by-point
  check of an external comparison between DSH and Pi. Eight claims verified
  against this machine's installation, three corrected, five marked as not
  verifiable (everything about Pi itself, which is not present here). The
  substantive correction: `dsh-llm-pi-ai` is a **design-verification twin** of
  `dsh-llm-deepseek`, not the LLM foundation — DeepSeek's own models go through
  DSH's native adapter.
- [`improvement-opportunities.md`](improvement-opportunities.md) — six directions
  derived from this audit's actual results, ordered by value. The first is to
  turn the paper's two properties (revertible effects, reactive coeffects) into
  an invariant suite run against **both** lines, because every one of the sixteen
  findings landed on one of those two.

## How the project is organised

Cordis is not one repository. It is 26 under `cordiverse`, composed into a single
workspace through a gitignored `external/` directory, with a **bootstrapping
toolchain** — `yakumo` manages the workspace and is itself a cordis CLI plugin, so
cordis is built by something built on cordis.

DeepSeek Harness does not simply vendor that: it **forks seven of the nine
packages** plus the two foundation libraries, because `volatile` spans all of them
and upstream would never take a `cosmokit` change for it. Only `core` and `loader`
still follow `cordiverse/cordis`, and those two are where this repository's work
converged: **nine of the fifteen upstream pull requests** are in them
(`core` #175–#178, `loader` #165 #166 #167 #172 #179).

The other six are worth knowing about, because they are not equally useful here:

| PR | package | relevant to the vendored line? |
|---|---|---|
| #168, #170 | `hmr` | **no** — `hmr` is not vendored |
| #173 | `create` | **no** — `create` is not vendored |
| #164 | build script | **no** — different build |
| #171, #174 | `include` | partly — the line forks `include`, so upstream changes there do not flow in |

So the earlier framing ("nearly every fix lands in core and loader") was wrong in
both directions: it overstated the share, and it hid three pull requests that are
for packages this line does not ship at all.

Written up in [`architecture.md`](architecture.md).

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

## Areas checked with no divergence found

Recorded so a later pass does not re-spend the effort. Each was probed against
both lines and they behaved identically:

- **`ctx.isolate` realms** — cross-realm invisibility, and a withdrawal waking
  only the realm that provided it (`fuzz/15`)
- **`registry.delete()`** — returns with its fibers still `UNLOADING` and no
  handle to await, on both lines; delete-then-immediately-re-plugin reaches
  `DISPOSED` / `ACTIVE` correctly on both (`fuzz/16`)
- **`Service` base class** — `[Symbol.hasInstance]`, `[symbols.filter]`,
  `[symbols.extend]`, `[symbols.invoke]`; read line by line, nothing divergent
- **`RegistryService`** — `resolve`, `delete`, `_internal` lifetime
- **DSH local modifications 8, 11, 14, 19, 20, 21** — upstream already has each
- **`ctx.volatile`** — DSH-only machinery, and it passes a 5000-case fuzz
  (`verify/`)

## What the audit could not see

Every finding here came from comparing commits, and that has a blind spot: **the
defects I found myself were never checked against the vendored line.** It is
pinned at upstream `56b3d4f` (2026-07-15), so a defect in code unchanged since is
present in both — and a defect present in both is invisible to a commit-diff
audit by construction.

Checking my fourteen upstream PRs against it turned up four more:
`#165`, `#166`, `#167` and `#172` **all apply here too**. See
[`my-prs-vs-dsh.md`](my-prs-vs-dsh.md).

## One that runs the other way

Not every divergence here is a fix upstream has and this line lacks. The
vendored line's own local-modification log documents a lifecycle guard that
upstream did not have, and checking it found this:

```
as shipped   effect registered while the owner is UNLOADING   registers
             -> the effect outlives the teardown that should have owned it,
                and is only swept by the next unload, if there is one
with guard   throws CordisError('INACTIVE_EFFECT')
```

`_unload()` clears `_disposables` and drains it, so a registration made from
inside one of those disposers lands after the clear. Sent upstream as
[#176](https://github.com/cordiverse/cordis/pull/176); probe and regression test
in [`fuzz/09-unloading-effect-registration.mjs`](fuzz/09-unloading-effect-registration.mjs).

Worth keeping in mind for the rest of this work: the direction is not always
one-way. A pinned snapshot plus a documented modification log is a place where
the vendored side can be ahead.

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

The proper boundary is not a guessed date. DeepSeek Harness publishes its
vending manifest in
[`vendor/README.md`](https://github.com/deepseek-ai/deepseek-harness/blob/master/vendor/README.md),
which pins `cordis` to upstream `56b3d4f` (2026-07-15) and lists **23 local
modifications** layered on top. That is the real comparison: the pinned snapshot,
plus those modifications, against what upstream has since. From `56b3d4f` to
`upstream/main` there are 30 commits, 17 of them `fix` — and all seventeen now
carry a verdict. An earlier pass here used a self-chosen window instead; the
manifest is both narrower and correct, and it also explains why the historical
scan found so much already present: the local modifications are ports.

The window is fully adjudicated: all sixteen upstream `fix` commits between
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
