# verify

**English** | [中文](README.zh.md)

Checks on the part of this codebase that has **no upstream counterpart**: the
`volatile` config machinery, which DeepSeek Harness adds on top of cordis.

Upstream has none of it — not the `volatile` schema support, not
`cosmokit/src/volatile.ts`, not `cordis-plugin-loader/src/config/diff.ts`. So
unlike everything in [`../backport`](../backport), none of it has been read by
anyone outside the team that wrote it.

## What is checked

`equalExceptVolatile(previous, next, schema)` decides whether a config change
touches anything but volatile fields. The loader reads `true` as *"no remount
needed"*, so **a false `true` silently swallows a real config change**. That is
the property worth testing, and it is what `diff-fuzz.mjs` hammers.

| | result |
|---|---|
| 5000 seeded random config pairs — safety, reflexivity, symmetry | all hold |
| defaults, arrays, unknown keys, nesting (targeted) | all correct |
| a non-nullish `Config` without `~standard` | throws — see below |

## The one defect, and why it does not bite

`isSchemastery` guards `schema` but not what it reaches through:

```ts
function isSchemastery(schema: Plugin.Runtime['Config']): schema is Schema {
  return schema?.['~standard'].vendor === 'schemastery'
}
```

A non-nullish `Config` with no `~standard` gives `undefined.vendor`. But it is
**not reachable**, and the reason is worth writing down because it is a
coincidence rather than a design:

- `equalExceptVolatile` is called under `this.fiber.state === FiberState.ACTIVE`
  (short-circuit `&&` in `Entry.update`).
- A plugin whose `Config` lacks `~standard` never reaches `ACTIVE`:
  `resolveConfig` in `cordis/src/fiber.ts` is missing **the same** guard —

  ```ts
  if (!runtime.Config) return config
  const result = runtime.Config['~standard'].validate(config)
  ```

  so such a plugin fails while loading, before this function is ever reached.

**Two missing guards mask each other.** Fix either one alone and the other becomes
live. That is the reason this is written up rather than patched: a fix has to
address both, and it is a small robustness question, not a defect anyone is
hitting.

## One behaviour recorded rather than asserted

`??` treats `null` and `undefined` alike, so an absent object falls through to the
schema default but `null` also does, while `{}` does not:

```
{}    vs absent (default present)  → false
null  vs absent (default present)  → true
```

Nothing in the tree relies on this today. Whether a plugin should be able to use
`null` to mean "explicitly empty" is a design question, so it is printed, not
asserted.

## Running

`diff.ts` lives inside `node_modules`, and Node refuses type stripping there, so
the source has to be copied out first and given a module tree of its own:

```bash
D=/path/to/dsh/node_modules
mkdir -p /tmp/dsh-src/node_modules/@deepseek-ai
cd /tmp/dsh-src
cp -r "$D/@deepseek-ai/cordis-plugin-loader/src" ./loader-src
printf '{"name":"dsh-src","type":"module","private":true}\n' > package.json
for p in cordis cosmokit schemastery; do
  ln -sfn "$D/@deepseek-ai/$p" "node_modules/@deepseek-ai/$p"
done
```

Then, from `/tmp/dsh-src`:

```bash
node /path/to/verify/diff-fuzz.mjs     # DSH_DIFF=./loader-src/config/diff.ts by default
node /path/to/verify/diff-edge.mjs
```

`DSH_DIFF` overrides the module path, and `CASES` the iteration count.

## Also checked, same machinery

`fiber.update()` keeps its promise-handling defect in the same shape as upstream
`2ceea23` (#109) — see [`../README.md`](../README.md). Both `resolveConfig` and
`isSchemastery` are the same class of omission as upstream's open
[#141](https://github.com/cordiverse/cordis/pull/141) (*guard resolveConfig
against Config without Standard Schema V1*, tracked as upstream issue #102), which
is still unmerged there. Upstream's `resolveConfig` does throw on such a Config —
reproduced while checking this — and this line happens to avoid it by resolving
config after the state check rather than before.
