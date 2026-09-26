# Proposed additions to `vendor/README.md` → "Local modifications"

The vendored set is pinned to upstream `56b3d4f` (2026-07-15) with 22 logged local
modifications. Between that pin and `upstream/main` there are 30 commits, 17 of
them `fix`; these are the twelve of those seventeen that the local log does not
already cover.

Written in the log's own format — `N. **file**: what changed. why. Covered by
what.` — so they can be pasted in. Numbering continues from the existing 22.

Each entry names the upstream commit it corresponds to, so the entry can be
retired when the vendored set is next synced past it. That is the convention
entry 7 already uses (*"Retire this entry when the enrichment is upstreamed to
the fork."*).

---

23. **`cordis/src/fiber.ts` unhandled update failures**: `update()` dropped the task returned by the `internal/update` waterfall instead of returning it, and did not mark it handled. A caller that ignored the result turned a plugin failure during a config update into an `unhandledRejection`, which terminates the process by default; a caller that awaited it received `undefined` and had no way to observe the failure. Returns the task and attaches a no-op `catch`, so a dropped result cannot escape while `await update()` still observes it. Corresponds to `2ceea23` (#109). Covered by `probes/02-dropped-failure.mjs`.

24. **`cordis-plugin-loader/src/config/{entry,group,isolate}.ts` awaited nested reconciliation**: `_patchContext` was not async and awaited neither the `loader/patch-context` waterfall nor the `fiber.update()` it triggered, so `await loader.update()` resolved before the nested entries it created had reconciled — anything that awaited a config change and then used the entries it declared was racing. `Group`'s `internal/update` listener also returned `undefined` rather than the `update()` promise; because the waterfall propagates a listener's return value outward, that missing implicit return is what actually broke the await chain, and changing `entry.ts` alone does not fix it. Corresponds to `1b7d0f2`. Covered by `probes/01-nested-reconciliation.mjs`.

25. **`cordis/src/events.ts` waterfall continuation guard**: a listener that reached `next()` twice ran the rest of the chain a second time instead of failing, so a listener reaching `next()` on two paths doubled whatever the downstream chain did. Throws `next() called multiple times` on the second call, with the guard scoped per level rather than per listener. Corresponds to `5b195b3` (#44). Covered by `probes/03-waterfall-twice.mjs`.

26. **`cordis-plugin-timer/src/index.ts` concurrent interval reads**: the async iterator held a single `nextTask` slot, so a second `next()` before a tick overwrote the first and left its promise permanently unsettled — two `for await` loops over one `ctx.interval()` stalled one of them forever. Holds an array and settles every waiter in order. Corresponds to `cb77029` (#53). Covered by `probes/04-interval-waiters.mjs`.

27. **`cordis/src/events.ts` prototype-named events**: the hook table was initialised with `{}`, so a lookup for an event named after an `Object.prototype` member found the inherited function instead of `undefined`, and `ctx.on('toString', …)` threw `hooks[method] is not a function`. Initialises with `Object.create(null)`. Corresponds to `1c1a10e` (#51). Covered by `probes/05-06-hooks-and-buffer.mjs`.

28. **`cordis/src/logger.ts` bounded buffer**: the exporter truncated by assigning `self.buffer = self.buffer.slice(-size)`, which replaces the array object — so any holder of `ctx.logger.buffer` kept the old one and grew without bound. Truncates in place. Corresponds to `fd96b0a` (#36). Covered by `probes/05-06-hooks-and-buffer.mjs`.

29. **`cordis/src/fiber.ts` failed fibers must not re-enter the lifecycle**: `_setEpoch` lacked the `if (this._error) return` guard, so a dependency withdrawal and re-provide re-ran the `apply` of a plugin that had already thrown, while its state stayed `FAILED`. Anything the plugin did before throwing accumulated across attempts that could never succeed. Corresponds to `10194de` (#98). Covered by `probes/06-failed-fiber-reentry.mjs`.

30. **`cordis/src/fiber.ts` wrapped-fiber state**: `update()` and `restart()` assigned lifecycle fields through `this`. `registry.plugin()` hands callers an `Object.create(fiber)` wrapper, so a call reached through it wrote a second copy of `_config`, `config`, `_error`, `inertia`, `state` and `store` onto the wrapper, shadowing the real fiber's — while `reflect.notify()` iterates `runtime.fibers`, which holds the real fiber. The two then diverged, and the wrapper kept reporting `ACTIVE` after the fiber had unloaded. Dereferences to `this.ctx.fiber` at the top of both methods, which is what upstream's fix does. Different route from local modification 20, which addresses the same defect at the loader's `Entry`; the two are complementary rather than alternatives. Corresponds to `752dbee` (#40). Covered by `fuzz/06-stale-state-after-update.mjs`.

31. **`cordis/src/logger.ts` log level ordering**: `LoggerLevel` listed `INFO = 1, WARN = 2`, inverting severity. The exporter's default threshold *is* `LoggerLevel.INFO`, so at the default configuration `warn` carried level 2 against a threshold of 1 and was dropped before any exporter saw it — `ctx.logger.warn(...)` produced no output anywhere, with nothing thrown and nothing logged about it. Swapped to `WARN = 1, INFO = 2`. Must also be applied to the built `lib/index.js`: a `const enum` is inlined, so the ordering appears there as the literal arguments to `_method()` and as the `?? 1` default in the export filter. Corresponds to `eb5604d` (#32). Covered by `fuzz/11-warn-visible.mjs`.

32. **`cordis/src/context.ts` and `cordis-plugin-loader/src/config/entry.ts` optional property widening**: `baseUrl?: string` and `_initTask?: Promise<void>` are not widened to `| undefined`, so a consumer compiling with `exactOptionalPropertyTypes` cannot assign `undefined` to either — `ctx.baseUrl = undefined` is `error TS2412`. The matching `lib/types/context.d.ts` needs the same change, since the declarations ship built. Type-only; no runtime behaviour. Corresponds to `988df36` (#68).

33. **`cordis/src/utils.ts` and `cordis/src/reflect.ts` shadow resolution**: `createShadow` used `Reflect.getOwnPropertyDescriptor` where a class service's member lives on the prototype, so the lookup missed and the shadow was dropped; it also did not resolve a shadowed value to its def site. The `get` trap then ran consumers against the use site rather than the def site, and `reflect`'s inject check tested `ctx.fiber.runtime` rather than the def site's. Together these let a service reach a service it never declared, and stopped one that had declared it from reaching it through a nested context. Ports upstream's rework of that block. Corresponds to `be7d36e` (#37) and `4cfd19a`. Covered by `fuzz/07-callable-service-shadow.mjs` and `fuzz/08-defsite-service-injection.mjs`; validated against upstream's own core suite, where it takes 10 failures to 5 with none newly failing.

34. **`cordis/src/fiber.ts` effect registration during unload**: `_unload()` clears `_disposables` and drains that snapshot, so an effect registered from inside one of those disposers landed after the clear and was not disposed by the unload that should have owned it. A fiber that had already returned to `PENDING` still had a subscription registered during its own teardown, and that subscription still fired — `root.emit('ping')` was captured three times by the unloaded fiber's listener. Rejects registration while the owner is `UNLOADING`, reusing `CordisError.Code.INACTIVE_EFFECT`; `PENDING` and `LOADING` stay legal, because an `internal/plugin` observer registers effects there and the activation that follows drains them. Sent upstream as [#176](https://github.com/cordiverse/cordis/pull/176). Covered by `fuzz/09-unloading-effect-registration.mjs` and `fuzz/10-unloading-registration-harm.mjs`.

35. **`cordis/src/fiber.ts` teardown notification containment**: the disposal path calls `this.context.emit('internal/plugin', this)`, a bare listener loop. A teardown observer that throws therefore starves every observer after it *and* aborts the rest of the disposer — runtime bookkeeping, `_setEpoch(INACTIVE)`, and the unload never run, so the fiber is left reporting `ACTIVE` with every effect it owned still registered while `dispose()` rejects. Replaces that one call with a dispatch that runs each observer in its own `try` and logs failures. The creation-side emit at the top of the constructor keeps its current behaviour deliberately: it sits inside a `try` that disposes the fiber when publication fails, which is a considered response rather than something to swallow. Sent upstream as [#177](https://github.com/cordiverse/cordis/pull/177). Covered by `fuzz/12-throwing-teardown-observer.mjs`.

36. **`cordis/src/fiber.ts` publication ordering**: the constructor emitted `internal/plugin` before assigning `this.dispose`, so an observer received a fiber whose `dispose` was `undefined` — the only handle it has, since the constructor had not returned. `_checkImpl` and `_refresh` then ran after the notification and activated the fiber regardless, so one an observer wanted gone at publication stayed `ACTIVE` with its plugin applied. Assigns the disposer first, publishes second inside a `try` that disposes on a synchronous failure, and resolves config and dependencies third behind a `uid !== null && parent.fiber.state !== FiberState.UNLOADING` guard so a reentrant disposal is not dragged back into activation. Config resolution also has to move after the notification, because an observer may add to `fiber.inject`. Sent upstream as [#178](https://github.com/cordiverse/cordis/pull/178). Covered by `fuzz/13-publication-disposer-order.mjs`.

---

## Applying

`../backport/` holds the same twelve as three patch files — `cordis-4.0.4.patch`
(25 hunks), `cordis-plugin-loader-1.0.5.patch` (15), `cordis-plugin-timer-1.1.6.patch`
(5) — each touching `src/*.ts` **and** the built `lib/index.js`, because `exports`
resolves to the bundle and changing `src` alone does not change what runs. All
three apply cleanly to untouched 4.0.4 sources.

Entries 23–34 were reduced from live probes rather than written from the upstream
diffs, so each names the probe that reproduces it. Two of them (31, 33) also need
a change in a file the log does not otherwise track — the built `lib` for an
inlined `const enum`, and the shipped `lib/types` for a declaration — which is
why those entries say so explicitly.
