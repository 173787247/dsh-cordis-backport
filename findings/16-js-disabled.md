# `disabled: !!js` — the expression is never evaluated

**Status: confirmed and fixed — upstream PR [#179](https://github.com/cordiverse/cordis/pull/179).**

## The defect

Upstream's `include` defines the `!!js` YAML tag generically:

```ts
const JsExpr = new yaml.Type('tag:yaml.org,2002:js', {
  kind: 'scalar',
  construct: (data) => ({ __jsExpr: data }),
  predicate: isJsExpr,
})
```

so `disabled: !!js <expr>` parses into `{ __jsExpr: '<expr>' }`. The loader then reads it
as a plain value:

```ts
get disabled() {
  ...
  do {
    if (entry.options.disabled) return true      // Boolean({...}) is always true
    ...
```

`isJsExpr` is used in `interpolate` (for `config`) and as the YAML predicate — it never
reaches this path.

## Measured

```
upstream    disabled = { __jsExpr: 'false' }  ->  entry.disabled = true   apply ran 0 times
            disabled = { __jsExpr: 'true'  }  ->  entry.disabled = true   apply ran 0 times

as shipped  disabled = { __jsExpr: 'false' }  ->  entry.disabled = false  apply ran 1 time
            disabled = { __jsExpr: 'true'  }  ->  entry.disabled = true   apply ran 0 times
```

An entry carrying a `!!js` expression in `disabled` is disabled **whatever the expression
says**. The YAML is valid, the config loads, the entry never runs, and nothing is logged.

Probe: `fuzz/14-js-expression-disabled.mjs`.

## Where it comes from

Documented in the vendored line as local modification 18, *"Entry `disabled` interpolation
… a `disabled: !!js` expression evaluates against the loader context at every mount
decision; the raw node stays in the options, so write-back keeps the `!!js` form."*
Third item from that log to turn out to be an upstream defect rather than a local
preference, after #176 and #177.

## The fix

Ported from that line:

```ts
private _disabledOf(options: EntryOptions): boolean {
  return isJsExpr(options.disabled)
    ? Boolean(this.evaluate(options.disabled.__jsExpr))
    : Boolean(options.disabled)
}
```

plus `isJsExpr` added to the `./utils.ts` import in
`packages/loader/src/config/entry.ts`. The raw node stays in the options, so
write-back keeps the `!!js` form rather than replacing it with the evaluated
boolean.

```
before   { __jsExpr: 'false' } -> disabled = true    applied 0 times
after    { __jsExpr: 'false' } -> disabled = false   applied 1 time
         { __jsExpr: 'true'  } -> disabled = true    applied 0 times
```

Full suite 249 passing. The new test in `packages/loader/tests/index.spec.ts`
fails on `main` with `expected true to equal false`, and the other eight tests in
the file pass in both runs.

## How long this took, and why

The fix was drafted early and sat unverified for a while because the build
environment appeared to have broken on its own: `yakumo esbuild` reported
`command "esbuild" not found`, and `yakumo --help` listed only `help`.

It had not broken on its own. **`yakumo` mounts `yakumo.yml` through this very
loader**, so a loader bundle left in a broken state — `src` reverted with
`git checkout`, but `lib/index.js` being an untracked build artifact, still
carrying the half-applied edit — took the build tool down with it. The `initial`
fallback in yakumo's bootstrap is `[{ name: 'yakumo' }]`, which is exactly the
"only `help` is available" symptom.

Two lessons, both already learned elsewhere in this repository and both
re-learned here:

- reverting `src` is not reverting the build; check what actually runs
- a tool that stops working at the same moment as the code under test is a
  suspect, not a coincidence
