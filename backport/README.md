# backport

**English** | [中文](README.zh.md)

Nine upstream fixes the vendored cordis line has not taken, as patches against
`@deepseek-ai/*@4.0.4` / `1.0.5` / `1.1.6`.

| patch | package | hunks |
|---|---|---|
| `cordis-4.0.4.patch` | `@deepseek-ai/cordis@4.0.4` | 14 |
| `cordis-plugin-loader-1.0.5.patch` | `@deepseek-ai/cordis-plugin-loader@1.0.5` | 15 |
| `cordis-plugin-timer-1.1.6.patch` | `@deepseek-ai/cordis-plugin-timer@1.1.6` | 5 |

Each patch touches `src/*.ts` **and** `lib/index.js`. The `exports` map resolves to
the bundle, so changing `src` alone does not change what runs. The `src` half is what
would be committed; the `lib` half is what made the patch verifiable without a
rebuild. `lib` is esbuild output, unminified — readable and hand-editable.

## Contents

| upstream | file | before → after |
|---|---|---|
| `988df36` (#68) | `cordis/src/context.ts`, `loader/src/config/entry.ts`, **and the shipped `.d.ts`** | `baseUrl?: string` and `_initTask?: Promise<void>` were not widened to `| undefined`, so a consumer compiling with `exactOptionalPropertyTypes` cannot assign `undefined` to them. This is the one item in the set that changes no runtime behaviour |
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

### The type-only one

`988df36` (#68) is worth a sentence because it is the only item here with no
runtime effect, and because it needed the `.d.ts` as well as `src`. A consumer
compiling against the shipped types:

```ts
import type { Context } from '@deepseek-ai/cordis'
export function clearBaseUrl(ctx: Context) { ctx.baseUrl = undefined }
```

```
as shipped, with exactOptionalPropertyTypes   error TS2412 (2 sites)
with `| undefined` added to that one line     compiles
```

Nothing else was changed in that comparison — the causality is the single
`| undefined`. The patch therefore touches `src/*.ts` and the matching
`lib/types/*.d.ts`, since the types ship built.

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

**Who it reaches.** `Service.extend` is a supported `protected` member of the
`Service` base class, identical in both lines, and its whole point is for a
subclass to expose it — upstream's own test does exactly that. Nothing inside
DeepSeek Harness calls it: the logger *is* a callable service
(`cordis/src/logger.ts` implements `[symbols.invoke]`) but it is reached through
`ctx.logger()`, not through `extend()`, and that path attributes to the right
fiber on both lines. So this is a plugin-author-facing break rather than
something live in the runtime — it fails for anyone who uses the callable
extension pattern, which is the pattern the commit was written to support.

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
