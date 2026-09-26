# probes

One probe per item, run against the shipped packages and against upstream with
nothing else changed. The before/after numbers in the top-level README are these
scripts' output.

| file | item |
|---|---|
| `01-nested-reconciliation.mjs` | `1b7d0f2` — `await loader.update()` resolves before nested entries reconcile |
| `02-dropped-failure.mjs` | `2ceea23` (#109) — a dropped `Fiber.update()` failure becomes an unhandled rejection |
| `03-waterfall-twice.mjs` | `5b195b3` (#44) — a listener reaching `next()` twice runs the chain again |
| `04-interval-waiters.mjs` | `cb77029` (#53) — concurrent `interval().next()` waiters never settle |
| `05-06-hooks-and-buffer.mjs` | `1c1a10e` (#51) and `fd96b0a` (#36) |
| `mockloader.mjs` / `mockloader-shim.mjs` | `MockLoader` for `01` and `04`, ported to each side's package names |

## Running them

Two module trees:

```
/tmp/probe/          node_modules → the DSH install's node_modules   (@deepseek-ai/*)
/tmp/probe-fix/      node_modules/cordis → cordis/packages/core      (cordis, @cordisjs/*)
```

Set up the DSH side:

```bash
D=/path/to/dsh
mkdir -p /tmp/probe && ln -sfn "$D/node_modules" /tmp/probe/node_modules
printf '{"name":"probe","type":"module","private":true}\n' > /tmp/probe/package.json
```

Set up the upstream side (after `yarn install` and `yarn yakumo esbuild` in a
cordis checkout):

```bash
C=~/src/cordis
mkdir -p /tmp/probe-fix/node_modules/@cordisjs
ln -sfn "$C/packages/core"   /tmp/probe-fix/node_modules/cordis
ln -sfn "$C/packages/loader" /tmp/probe-fix/node_modules/@cordisjs/plugin-loader
ln -sfn "$C/packages/group"  /tmp/probe-fix/node_modules/@cordisjs/plugin-group
ln -sfn "$C/packages/timer"  /tmp/probe-fix/node_modules/@cordisjs/plugin-timer
ln -sfn "$C/node_modules/cosmokit" /tmp/probe-fix/node_modules/cosmokit
printf '{"name":"probe-fix","type":"module","private":true}\n' > /tmp/probe-fix/package.json
```

A linked package resolves its own dependencies from its real path, so the packages
that live outside `node_modules` need their own shim:

```bash
mkdir -p "$C/packages/timer/node_modules"
ln -sfn "$C/packages/core" "$C/packages/timer/node_modules/cordis"
ln -sfn "$C/node_modules/cosmokit" "$C/packages/timer/node_modules/cosmokit"
```

**The probes must run from inside those directories.** A bare specifier resolves
relative to the importing file, not the working directory, so running one from here
fails with `ERR_MODULE_NOT_FOUND`.

These files are written for the DSH side. To run one against upstream, substitute
the package names first:

```bash
for f in 0*.mjs; do
  sed -e 's|@deepseek-ai/cordis-plugin-loader|@cordisjs/plugin-loader|g' \
      -e 's|@deepseek-ai/cordis-plugin-group|@cordisjs/plugin-group|g' \
      -e 's|@deepseek-ai/cordis-plugin-timer|@cordisjs/plugin-timer|g' \
      -e "s|'@deepseek-ai/cordis'|'cordis'|g" "$f" > "/tmp/probe-fix/$f"
  cp "$f" /tmp/probe/
done
```

Then:

```bash
(cd /tmp/probe     && node 02-dropped-failure.mjs)
(cd /tmp/probe-fix && node 02-dropped-failure.mjs)
```

`01` and `04` also need the matching mock loader in the same directory —
`mockloader.mjs` for the DSH side, `mockloader-shim.mjs` for upstream. The other
three are self-contained.
