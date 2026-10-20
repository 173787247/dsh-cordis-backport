# A fired timer already frees its slot — the suite just does not say so

**Status: not a defect, and not fixed.** Recorded under the same rule as
`21-`/`22-`: only behaviour that is wrong gets a change.

`timeout()` registers through `ctx.effect`, and the disposer is what removes the
effect from the owning fiber's list:

```ts
// callback form
const dispose = this.ctx.effect(() => {
  const timer = setTimeout(() => { dispose(); callback() }, delay)
  return () => clearTimeout(timer)
})
// promise form
return promise.finally(dispose)
```

Both forms do release the slot today. What is missing is a test that says so:
removing either release leaves the whole suite green, and a long-lived fiber then
keeps one entry per scheduled timer — fifty fired timeouts, fifty entries. That is
a regression surface, not a present bug, so nothing was filed against upstream.

Two tests were written and thrown away: fake timers, schedule a batch, advance past
the deadline, assert `_disposables.length === 0`. They fail under both mutations
(`expected 50 to equal +0`, `expected 10 to equal +0`) and pass on the real code —
which is exactly the shape that proves a gap rather than a defect. Kept out of the
repository because a test that only restates correct behaviour is not a change
anyone asked for.
