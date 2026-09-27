# Invariants — properties from the paper, run against both lines

Every other directory here holds things found by reading code or by fuzzing a
suspicion. This one is different: it holds the **properties the framework claims
to have**, taken from the paper, and asks both lines whether they hold.

The paper is `cordiverse/paper` → [arXiv:2608.25512](https://arxiv.org/abs/2608.25512),
*A Programming Paradigm for Spatiotemporal Composability*. It defines two
orthogonal properties and builds the whole framework on them:

| Property | Paper's definition | Code mechanism |
|---|---|---|
| **revertible effects** (temporal) | every context transformation carries an inverse that the runtime holds | `ctx.effect()`, the `_disposables` list, owner tracking |
| **reactive coeffects** (spatial) | every context change is classified against a component's coeffect specification, driving its activation and deactivation | `inject`, the epoch machine, `reflect.notify` |

So this directory tests the **claim**, not the implementation. A scenario here
never asserts that a particular fix is present — it asserts that a property
holds, which makes the same file meaningful on both lines and makes a failure on
either one a finding.

## Why both lines

A property that holds everywhere is a property. A property that holds on one
line and not the other is a bug on the line that failed — and it is the only
signal a single-line test can produce. Every one of the four reverse-direction
findings in this repository (`#176`–`#179`) came from exactly that shape: one
line satisfied something the other did not.

## Running

```bash
node run.mjs              # every scenario
node run.mjs i2           # just i2-no-escape.mjs
```

The runner needs both environments checked out. It stages each scenario into
each one, substituting `CORDIS_PKG` for the specifier that line publishes cordis
under, then compares the invariant lines:

```
agree      both satisfied, or both violated — no divergence
DIVERGE    one satisfied it and the other did not   <- the finding
BOTH-FAIL  neither satisfied it — either a shared bug or a bad assertion
```

`BOTH-FAIL` is worth pausing on rather than assuming. In the first run of this
suite the three `BOTH-FAIL` results were **all wrong assertions**, not findings —
see below.

## Current state

```
15 agreed (0 violated on both), 1 divergent
```

The divergence is `I2.pending-owner-drains`:

```
dsh  PASS: owner PENDING, dispose -> inverse ran 1, now DISPOSED
up   FAIL: owner PENDING, dispose -> inverse ran 0, now PENDING
```

An effect registered on a fiber that never activates — by a listener on
`internal/plugin`, since the owner's own body never runs — is never reverted
upstream. **This is upstream PR [#175](https://github.com/cordiverse/cordis/pull/175)**,
rediscovered here by the property rather than by the fuzzer that first found it.
That is the point of the directory: the same defect reached from the definition
instead of from an example.

## What the first run taught, kept on purpose

The suite's first execution reported three violations. **All three were the
assertions being wrong**, and two of the three mistakes are easy to repeat, so
they are recorded in the scenario files themselves:

1. **`I2.pending-owner-drains`** asserted that a PENDING owner's effect is
   reverted — but registered that effect *in the owner's own body*, which never
   runs when the declaration is unsatisfied. Zero reverts was correct. The effect
   has to arrive from outside; that is what an `internal/plugin` listener does,
   and only then does the scenario mean anything.

2. **`I3`** claimed `inject` is a capability boundary, expecting a fiber not to
   reach an undeclared service. It is not. Cordis resolves services along the
   context prototype chain, so a fiber sees whatever its ancestors provide.
   The paper's coeffect property drives *activation*, not reachability — that
   belongs to `I4`. The scenario was rewritten to assert the boundary that does
   exist: the isolate realm.

3. **`I3`** used `null` for "never ran" and compared against `undefined`, so a
   correct run reported a violation.

The lesson is the same one this repository keeps relearning in other forms: a
failing test is a claim about the code *and* a claim about the test. Two of these
three were resolved by fixing the claim about the test, and it would have been
easy to file them as bugs instead.

## Files

| File | Property | What it asserts |
|---|---|---|
| `i1-revert-exactly-once.mjs` | temporal | every registered effect's inverse runs exactly once — on ordinary disposal, on async inverses, under repeated disposal, and down through nested owners |
| `i2-no-escape.mjs` | temporal | an effect cannot outlive its owner's release — teardown-time registration, PENDING owners, and failed setups |
| `i3-realm-boundary.mjs` | spatial | a service is visible exactly within its isolate realm; `inject` drives activation, not visibility |
| `i4-reclassification.mjs` | spatial | appearing, disappearing and competing providers each drive a fresh classification |

## Where this should go next

The four files cover the two properties at their simplest. The assertion surface
that is *not* yet covered is where the framework's own machinery makes the
property hard to see — the epoch cache, `reload` versus `unload`, the interaction
between a reload and a disposal already in flight, and nested fibers whose parents
move between states. Those are the places where a property holds in the simple
case and stops holding in the composed one, which is precisely where the four
reverse-direction findings came from.
