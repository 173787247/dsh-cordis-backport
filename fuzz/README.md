# fuzz

Invariant fuzzing for the cordis **core** — the fiber state machine, its effect
accounting, service provision and disposal cascades.

This is deliberately not a diff against anything. [`../backport`](../backport)
answers "what has this line not taken from upstream"; this answers "does the core
actually hold its own invariants", which no amount of reading the two side by side
will tell you. It is how [#175](https://github.com/cordiverse/cordis/pull/175) was
found.

## The fuzzers

| file | drives | invariants |
|---|---|---|
| `01-lifecycle.mjs` | provide/withdraw services, create/dispose/update fibers | state settles after quiescence, `ACTIVE` ⟺ deps satisfied, effect accounting never goes negative, a `DISPOSED` fiber owns nothing |
| `02-nested-fibers.mjs` | the above, with fibers registering fibers two levels deep | parent disposal cascades, no orphaned effects |
| `03-multi-provider.mjs` | several fibers providing the same service, disposed in random order | `ctx.get()` is defined ⟺ a provider is alive, never returns a dead provider's value |
| `04-concurrent-ops.mjs` | **four operations issued back to back with no settle in between** | all of the above, under overlapping transitions |

All seeded (`mulberry32`) and deterministic — a failure names a replayable seed.
All default to upstream; see *Running against another line* below.

## Results

Run against `cordiverse/cordis` at `upstream/main` **with #175 applied**:

```
01-lifecycle        ✓ 400 seeds × 35 steps
02-nested-fibers    ✓ 250 seeds × 25 steps
03-multi-provider   ✓ 300 seeds × 25 steps
04-concurrent-ops   ✓ 400 seeds × 20 rounds × 4 concurrent ops
```

On `upstream/main` **without** #175, `01-lifecycle` fails on the first seed with
`uid cleared but state=PENDING` — the invariant #175 fixes. That is the fuzzers'
own validation: they catch a known bug and do not fire otherwise.

## The checks that turned out to be wrong

Worth recording, because both mistakes were mine and both looked like findings at
first:

**`disposals > calls`.** A plugin callback registering N effects produces N
disposers for one invocation, so disposers naturally outnumber callbacks. The
invariant was nonsense.

**`outstanding` incremented beside `ctx.effect()`, not inside it.** A callback
still running when its fiber is disposed reaches `ctx.effect()` and gets
`cannot create effect on inactive context`. The counter had already been bumped,
so the effect was counted but never registered — a permanent phantom, reported as
a leak. Moving the increment into the effect body fixed it: the body only runs
when registration succeeds.

Both are the same lesson as `../README.md`'s: an assertion firing is not a bug,
and the reachability argument has to come before the report.

## 06: cached state goes stale after an update — confirmed, root cause not

`06-stale-state-after-update.mjs` is not a fuzzer; it is the reduction of one.

A fiber's cached `state` field can disagree with the epoch after a config
update, and a later dependency withdrawal then never reaches it:

```
DSH 4.0.4       撤销 b 后   state=ACTIVE   _getState=PENDING   epoch=__INACTIVE__   ★
upstream rc.10  撤销 b 后   state=PENDING  _getState=PENDING   epoch=__INACTIVE__   ✓
```

Ten lines, deterministic, and it needs the `update()` — drop that one call and
the two lines agree. The epoch moves and the derived state follows it; only the
cached field lags, and nothing writes to `state` at all on the withdrawal path,
so `_updateState()` is never reached there.

That the cached field is the one read in the places that matter is why this is
worth writing down even unfinished:

- `cordis/src/reflect.ts:294` — `if (this.ctx.fiber.state === FiberState.ACTIVE)`
- `cordis-plugin-loader/src/config/entry.ts:145` — gates the volatile-only fast path

A fiber that believes it is active after being unloaded may keep providing a
service it no longer owns.

**What is not done: the root cause.** I reduced it to the `update()` but did not
find the assignment that skips `_updateState()`. Ruled out along the way: the
`if (this.inertia) return` early exit in `_setEpoch` (inertia is `undefined` by
then), and `_reload()`'s catch (which would have set `_error`, and `_getState()`
reports `PENDING`, not `FAILED`). The epoch is `INACTIVE` and the field is
`ACTIVE`, so something set the epoch on a path that does not refresh the field.

Until that is pinned down this is a symptom report, not a patch.

## An open discrepancy, not a finding

Run against the vendored `@deepseek-ai/cordis@4.0.4` line, `01`, `02` and `04`
report violations that `03` does not — for instance
`uid cleared but state=PENDING`, the shape #175 fixes, which that line
**does** handle.

I could not reduce any of them. Minimal cases built from the same ingredients —
disposing a `PENDING` fiber, disposing during the loading window, repeated
load/unload cycles with a traced `internal/status` history — all show that line
behaving correctly, and its transition history is exactly what it should be:

```
PENDING→LOADING → ACTIVE → UNLOADING → PENDING → UNLOADING(uid=null) → DISPOSED
```

So these are listed as **unresolved**, not as bugs. Either the fuzzers are
exercising something the minimal cases do not reach, or they are misreading that
line's API somewhere (its anonymous fibers carry `uid = 0` where upstream uses
`null`, which is the kind of difference that quietly changes an invariant). Until
one of those is decided, nothing here should be read as a claim about the vendored
line.

## Running against another line

The fuzzers import from `'cordis'`. To point them at the vendored line:

```bash
sed "s|from 'cordis'|from '@deepseek-ai/cordis'|" 01-lifecycle.mjs > /tmp/probe/01.mjs
```

and run it from a directory whose `node_modules` resolves `@deepseek-ai/*`, as
described in [`../probes/README.md`](../probes/README.md). The upstream side needs
`packages/core` built (`corepack yarn yakumo esbuild core`).
