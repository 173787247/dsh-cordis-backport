# The shipped line moved to 4.0.5 — one of the four is in, one got worse

**Status: confirmed by probe.** `probes/08-group-reconcile-entries.mjs`, run against
the packages a current DSH install ships.

## What moved

The audit in this repository compares the vendored line at **`cordis@4.0.4` /
`cordis-plugin-loader@1.0.5`** against upstream `56b3d4f`. The install inspected here
ships **`cordis@4.0.5` / `cordis-plugin-loader@1.0.6`**, so two of the rows need
re-reading.

### #175–#178 (the four disposal-order PRs): now present

`cordis@4.0.5`'s build contains the whole shape this repository's own log described:
`emitPluginDisposed(context, fiber)` with per-observer containment, and a constructor
that assigns `this.dispose = parent.fiber.effect(...)` **before** emitting
`internal/plugin`, wrapping the emit in `try { … } catch { dispose() ; throw }` and
guarding the dependency pass with `if (this.uid !== null && parent.fiber.state !== …)`.

That is consistent with what `my-prs-vs-dsh.md` already says — these four came out of
this line's log, not the other way round — and it means the shipped line no longer
needs them.

### #167 (remove then create when reconciling a group): still present, and worse

`cordis-plugin-loader@1.0.6` still reconciles without ordering the removal against the
creation. On upstream that leaves a stale plugin running (`["foo","baz"]` instead of
`["baz"]`). On the shipped line the same scenario ends with **no plugin running at
all**:

```
initial   active = ["foo","baz"] | entries = ["1:foo","2:bar","g1","g2"]
round 1   active = ["foo"]       | entries = ["2:foo","3:foo","g1","g2"]
final     active = []            | entries = ["g1","g2"]      ← every child entry gone
expected  active = ["baz"]
```

A config that asks for two `baz` entries ends up with none, and the tree no longer
holds them either. The failure is silent: nothing throws, the group entries stay.

### #165 (persist entry config only after a committed update): still present

`cordis-plugin-loader@1.0.6` uses the pre-`internal/commit` event shape — the update
listener is registered with `prepend: true` and assigns `entry.options.config` and
writes the tree **before** calling `next()`, which is exactly the code #165 objects to.
Being prepended, a downstream listener cannot veto it in time:

```
initial   entry config = {"a":1}
veto      vetoed
after     entry config = {"a":3}      ← the vetoed value is already persisted
```

Probe: [`probes/09-persist-order.mjs`](../probes/09-persist-order.mjs).

## What this means for the patches in `backport/`

`cordis-plugin-loader-1.0.5.patch` named its version in the filename and was cut against
1.0.5. Against 1.0.6 two of its hunks fail on context drift (the vendored `_init()` renamed
`exports` to `moduleNamespace`), so it was **re-cut as
`cordis-plugin-loader-1.0.6.patch`** — the two hunks re-expressed by hand, the rest applying
unchanged.

Verified by running `probes/08` and `probes/09` against a copy of the patched 1.0.6 package:
the group reconcile ends with `["baz"]`, and a vetoed update leaves the entry at its old
value. Both defects the patch addresses are gone.

The other two patches are no longer needed, and that was checked item by item rather
than by the patch tool alone:

| item | probe / check | on the shipped line |
|---|---|---|
| `eb5604d` logger level | `fuzz/11-warn-visible` | `[info, warn]` reaches the exporter |
| `be7d36e` + `4cfd19a` shadows | `fuzz/07`, `fuzz/08` | both correct |
| `988df36` types | `baseUrl?: string \| undefined` in `src/context.ts` | widened |
| `10194de` FAILED re-entry | `probes/06-failed-fiber-reentry` | not re-entered |
| `752dbee` wrapper fields | `probes/10-plugin-wrapper-fields` | wrapper and fiber agree |
| `2ceea23` update task | `probes/02-dropped-failure` | rejects to an awaiter, nothing leaks |
| `5b195b3` next twice | `probes/03-waterfall-twice` | rejected |
| `1c1a10e`, `fd96b0a` | `probes/05-06-hooks-and-buffer` | both correct |
| `cb77029` timer waiters | `probes/04-interval-waiters` | all settle |

One item is **not** on this line: the loader's `_initTask?: Promise<void>` is still not
widened to `| undefined`. That is part of the loader patch, which the re-cut 1.0.6 version
does apply.
