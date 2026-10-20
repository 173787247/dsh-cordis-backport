# The per-entry isolate marker survives mutation — no test could tell

**Status: negative result.** Four mutations applied to
`packages/loader/src/config/isolate.ts` on upstream `main` (`df4431e`), each run
against the repository's own suite (`yakumo vitest`, 33 files / 371 tests).

| mutation | verdict |
|---|---|
| `Realm.access()` stops memoising the realm key | killed — `isolate-provide.spec.ts` |
| `access(key, false)` also writes the key into the realm store | **survived** |
| the `delim:${name}` symbol stops being memoised | killed — `isolate-provide.spec.ts` |
| `entry.ctx[delim] = Symbol(`${name}#${entry.id}`)` becomes one shared value for every entry | **survived** |

The last one is the interesting one. That marker is what `loader/patch-context`
compares against the implementing fiber's own marker
(`if (entry.ctx[delim] !== fiber.ctx[delim]) break`) to decide whether the impl
belongs to **this** entry, and step 5 only transfers the impl when
`flag1 === flag2`. Making every entry share a marker should therefore let one
entry adopt a sibling's provision.

Three behavioural tests were written to show that, and none distinguishes the
mutation from the real code:

1. two entries, each `isolate: { svc: true }`, one of them moving to a global
   realm — the moving entry's own impl is local, so both markers agree in the
   real code too;
2. the same, with `svc` provided by a sibling entry sharing a global realm — the
   sibling's impl never appears in the moving entry's `reflect.store`, so the
   diff is empty and the loop never runs;
3. an entry that only references the shared realm and then leaves it.

So either the marker is load-bearing only in a composition nobody reaches, or the
transfer/notify path it guards is unreachable through the public surface. That is
worth knowing before anyone "simplifies" it — but it is not a defect anyone can
demonstrate today, and no test was added: a test that passes on both the real
code and the mutation proves nothing.

## The second survivor is dead code, not a gap

`Realm.access(key, create = false)` has two branches: `create` memoises a symbol
into the realm store, and the default returns a transient one. The loader's wrapper
(`access(entry, name, create = false)`) is called exactly **once**, at
`patch-context` step 1, and always with `create = true`:

```ts
newMap[name] = access(entry, name, true)
```

So the `create = false` branch — and the wrapper's `else realm = realms[label]`
branch that goes with it — cannot be reached from the loader at all. The mutation
that made it write into the store changed nothing because nothing calls it. This is
worth knowing for a different reason than the marker: the two `access` overloads
suggest a read-only probe that the loader never performs, so a future caller would
be the first to exercise that branch.
