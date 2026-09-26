# backport

**English** | [中文](README.zh.md)

Eight upstream fixes the vendored cordis line has not taken, as patches against
`@deepseek-ai/*@4.0.4` / `1.0.5` / `1.1.6`.

| patch | package | hunks |
|---|---|---|
| `cordis-4.0.4.patch` | `@deepseek-ai/cordis@4.0.4` | 12 |
| `cordis-plugin-loader-1.0.5.patch` | `@deepseek-ai/cordis-plugin-loader@1.0.5` | 13 |
| `cordis-plugin-timer-1.1.6.patch` | `@deepseek-ai/cordis-plugin-timer@1.1.6` | 5 |

Each patch touches `src/*.ts` **and** `lib/index.js`. The `exports` map resolves to
the bundle, so changing `src` alone does not change what runs. The `src` half is what
would be committed; the `lib` half is what made the patch verifiable without a
rebuild. `lib` is esbuild output, unminified — readable and hand-editable.

## Contents

| upstream | file | before → after |
|---|---|---|
| `10194de` (#98) | `cordis/src/fiber.ts` | a `FAILED` fiber re-entered its lifecycle on a dependency refresh, so a plugin whose `apply` throws had it called again on every withdraw/re-provide — side effects before the throw accumulate while the state stays `FAILED` |
| `752dbee` (#40) | `cordis/src/fiber.ts` | `plugin()` returns an `Object.create(fiber)` wrapper; assigning lifecycle fields through `this` put a **second copy on the wrapper**, shadowing the real fiber's — a later dependency withdrawal then updates only one of them → wrapper keeps reading `ACTIVE` after the fiber unloaded |
| `2ceea23` (#109) | `cordis/src/fiber.ts` | `update()` returned `undefined`; dropped, it produced `unhandledRejection: 'boom'` → returns the task, rejects to an awaiter, nothing leaks |
| `1b7d0f2` | `cordis-plugin-loader/src/config/{entry,group,isolate}.ts` | a new child entry had no fiber when `await loader.update()` resolved → reconciled by then |
| `5b195b3` (#44) | `cordis/src/events.ts` | downstream ran 3 times silently → runs 2 and throws `next() called multiple times` |
| `cb77029` (#53) | `cordis-plugin-timer/src/index.ts` | 2 and 3 concurrent waiters both timed out → all settle in order |
| `1c1a10e` (#51) | `cordis/src/events.ts` | `ctx.on('toString', …)` threw `hooks[method] is not a function` → registers |
| `fd96b0a` (#36) | `cordis/src/logger.ts` | a held `ctx.logger.buffer` grew 2 → 3 → more → stays at 2 |

Every row is one probe before and one probe after; the probes are in [`../probes`](../probes).

## The hunk that does not look like a fix

`1b7d0f2` includes this, which reads like a formatting change:

```diff
-    ctx.on('internal/update', (config) => {
-      this.update(config)
-    })
+    ctx.on('internal/update', config => this.update(config))
```

It is not. The first returns `undefined`; the second implicitly returns the promise,
and the waterfall propagates a listener's return value out to `Fiber.update`'s
caller. **That is where the await chain breaks.**

With only `entry.ts` and `isolate.ts` changed the probe still failed. It passed once
this went in. Worth knowing for anyone cherry-picking across these two lines.

### A correction to the earlier audit

`752dbee` (#40) was first classified in this repository as *"present, different
shape"*. **That was wrong**, and the mistake is worth spelling out because of how
it was made.

The audit checked for the presence of identifiers — `applyTraceable`, `noShadow`,
`createShadow` — and found them, so the commit was marked as implemented
differently. What `752dbee` actually changes is the *receiver* of an assignment:
`this.assertActive()` becomes `const fiber = this.ctx.fiber; fiber.assertActive()`.
No new identifier appears anywhere, so a name-based check cannot see it.

It was found later by fuzzing, not by reading: a fiber's cached `state` went stale
after a config update, and the reduction ended at `Object.hasOwn(wrapper, 'state')`
— the exact condition that commit's own test asserts on:

```ts
expect(Object.hasOwn(fiber, 'state')).to.equal(false)
expect(Object.hasOwn(fiber, 'inertia')).to.equal(false)
```

The lesson generalises: for a codebase with a wrapper/prototype indirection,
"does this identifier exist" says nothing about whether a fix is present.

## Confirmed, but not in this patch set

`be7d36e` (#37, *apply shadows to callable services*) — **the upstream test for it
fails here**, ported verbatim to
[`../fuzz/07-callable-service-shadow.mjs`](../fuzz/07-callable-service-shadow.mjs):

```
as shipped   Error: cannot get property "dependency" without inject
upstream     both calls return a Dependency instance
```

A callable service reached through `[Service.extend]()` loses its shadow, so the
extension cannot see the dependency its own `inject` declares.

It is not patched because it is not a backport. The visible cause is one line —
`createShadow` calls `Reflect.getOwnPropertyDescriptor` where upstream calls
`getPropertyDescriptor`, and a class service's member lives on the prototype, so
the lookup misses and the shadow is dropped. **Changing that alone does not fix
it.** The whole `get` trap in `createTraceable` is an earlier shape here; upstream
reworked it in the same commit. That is a refactor of the shadow machinery, and
half of it is worse than none — I reverted my attempt rather than ship an
unverified half.

## Applying

```bash
cd <path to the install>/node_modules/@deepseek-ai

for f in cordis-4.0.4 cordis-plugin-loader-1.0.5 cordis-plugin-timer-1.1.6; do
  git apply --check /path/to/$f.patch && git apply /path/to/$f.patch
done
```

All three were verified to apply cleanly to **untouched 4.0.4 sources**, and the
result is byte-identical to the workspace the before/after numbers came from.

## Scope

- These target **4.0.4 sources only**. A DSH update will need them realigned.
- **No** `8abd903` (#35, caller tracking). `symbols.caller` does not exist here at
  all, so it is a feature rather than a repair.
- **No** `c594d1a` (#121) or `c2835d8` (#123). The include here **deliberately**
  vetoes the fiber restart and persists the config itself — there is a comment
  explaining why. Whether to follow upstream is a product decision.
