# `watch()` holds a callback once per path — not a defect

**Status: negative result.** Recorded so nobody "fixes" this into reference
counting without deciding the semantics first.

```ts
const callbacks = this.watchers.get(filename)   // Set<WatchCallback>
callbacks.add(callback)
return () => { callbacks.delete(callback); if (!callbacks.size) this.watchers.delete(filename) }
```

`hrm.watch(file, cb)` twice, then release either registration:

```
registered twice   -> callbacks for that path = 1
release one        -> callbacks for that path = 0, the path leaves this.watchers
release both       -> unchanged
change the file    -> the callback is not called
```

This looks surprising only if one assumes the API counts registrations. It does
not: the docstring says *"every callback registered for a path runs on each
change"*, the store is a `Set` of callbacks, and the same function registered
twice is one callback — which then runs once per change, as promised. Releasing
either registration releases that one callback.

So: not a defect, and no test was added (a test pinning it would only restate the
`Set`). Two different callbacks on the same path stay independent — that is the
"registrations are not exclusive" half of the docstring, and the existing suite
covers it.

The one thing worth saying out loud: if the intent were ever "N registrations of
the same function run N times", the `Set` would have to become a counted map, and
that is a behaviour change, not a bug fix.
