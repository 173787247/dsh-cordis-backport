# `disabled: !!js` — the expression is never evaluated

**Status: confirmed. Fix drafted, NOT verified.**

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

## The draft

Ported from that line, branch `try/js-disabled` in the local checkout, uncommitted:

```ts
private _disabledOf(options: EntryOptions): boolean {
  return isJsExpr(options.disabled)
    ? Boolean(this.evaluate(options.disabled.__jsExpr))
    : Boolean(options.disabled)
}
```

plus `isJsExpr` added to the `./utils.ts` import in `packages/loader/src/config/entry.ts`.

**Not verified.** The `yakumo esbuild` command stopped resolving its own plugins partway
through this session — `yakumo --help` lists only `help` — so the loader bundle could not
be rebuilt and the probe still exercises the old build. Everything upstream that was
verified before that point stands; this one does not, and should not be sent until it does.
