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
