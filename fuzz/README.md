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
| `06-stale-state-after-update.mjs` | one `update()` then a dependency withdrawal | the cached `state` field against `_getState()` |
| `07-callable-service-shadow.mjs` | a callable service reached through `[Service.extend]()` | upstream's own #37 test, ported — fixed by the shadow port |
| `12-throwing-teardown-observer.mjs` | a listener on `internal/plugin` that throws during teardown | peers must still run and the disposal must complete — **upstream PR #177** |
| `10-unloading-registration-harm.mjs` | a listener registered during unload, then events emitted after the fiber is `PENDING` | the registration must not survive — the harm case for #176 |
| `09-unloading-effect-registration.mjs` | an effect registered from inside a disposer, during unload | the registration must be refused — **upstream PR #176**, the one item here that runs the other way |
| `08-defsite-service-injection.mjs` | `ctx.foo.bar` where the accessing service injects only `foo` | upstream's `4cfd19a` test — fixed by the same port |

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

## 06: cached state goes stale after an update — root cause found

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

**Root cause.** `registry.plugin()` hands callers a wrapper:

```ts
const fiber = new Fiber(...)
const wrapped = Object.create(fiber) as Fiber & PromiseLike<Fiber>
```

The real fiber is the wrapper's *prototype*. `update()` and `restart()` then did
`this.assertActive()`, `this._config = config`, `this.config = config`,
`this._error = undefined`, and every `this.state = ...` underneath them — all
through the wrapper, which creates **own** copies of those fields and shadows the
real fiber's. `reflect.notify()` iterates `runtime.fibers`, which holds the real
fiber, so afterwards the two copies diverge. `Object.getOwnPropertyNames` tells
the whole story:

```
DSH, after update()     [then, _config, config, _error, inertia, state, store]
upstream, after update() [then]
```

Upstream fixed exactly this in
[`752dbee`](https://github.com/cordiverse/cordis/commit/752dbee) (#40, *keep
wrapped fiber state canonical*) by dereferencing at the top of both methods:

```ts
const fiber = this.ctx.fiber
fiber.assertActive()
```

and its tests assert the wrapper stays clean — `Object.hasOwn(fiber, 'state')`
must be `false`. The fix is in
[`../backport/cordis-4.0.4.patch`](../backport/cordis-4.0.4.patch); with it
applied the wrapper keeps only `[then]` and both copies agree.

Worth noting how this was missed the first time: an earlier pass had classified
`752dbee` as *present, different shape*, because every identifier it touches
exists in the vendored line. It changes the **receiver** of an assignment, and no
name-based check can see that. Fuzzing found what the diff could not.

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
