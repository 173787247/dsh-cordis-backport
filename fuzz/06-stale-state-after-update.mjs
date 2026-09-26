import { Context } from '@deepseek-ai/cordis'
/**
 * A fiber's cached `state` goes stale after a config update, and a later
 * dependency withdrawal stops being visible through `fiber.state`.
 *
 * Run against both lines to see it: this file targets the vendored
 * `@deepseek-ai/cordis`. Swap the import to `'cordis'` for upstream.
 *
 *   DSH 4.0.4:
 *     建 fiber 后     state=ACTIVE  _getState=ACTIVE   epoch=:0             一致
 *     update 后       state=ACTIVE  _getState=ACTIVE   epoch=:0             一致
 *     撤销 b 后       state=ACTIVE  _getState=PENDING  epoch=__INACTIVE__   ★ 不一致
 *
 *   upstream rc.10:
 *     撤销 b 后       state=PENDING _getState=PENDING  epoch=__INACTIVE__   ✓
 *
 * The epoch moves and the derived state follows it; only the cached field
 * lags. Nothing writes to `state` during the withdrawal at all, so
 * `_updateState()` is never reached on that path.
 *
 * Who reads the cached field, and why a stale ACTIVE matters:
 *   cordis/src/reflect.ts:294        `if (this.ctx.fiber.state === FiberState.ACTIVE)`
 *                                    — a fiber that believes it is active may keep
 *                                      providing a service it no longer owns
 *   cordis-plugin-loader/.../entry.ts:145
 *                                    gates the volatile-only config fast path on it
 *
 * The trigger is the `update()`. Drop it and both lines agree. Removing any
 * other single step does not stop it reproducing, which is why it is not
 * obvious from reading the update path.
 */
const sleep = (ms = 0) => new Promise(r => setTimeout(r, ms))
const S = ['PENDING', 'LOADING', 'ACTIVE', 'FAILED', 'DISPOSED', 'UNLOADING']

const root = new Context()
root.logger.error = () => {}
const db = root.provide('b', 1)                       // ① provide b
const fiber = root.inject(['b'], async () => {        // ② a fiber injecting it
  await sleep(1)
  return () => {}
})
await sleep(10)

const snap = (label) => {
  const cached = fiber.state
  const derived = fiber._getState()
  console.log(
    `  ${label.padEnd(20)} state=${S[cached].padEnd(8)} _getState=${S[derived].padEnd(8)}` +
    ` epoch=${String(fiber._runner.epoch).padEnd(14)} ${cached === derived ? '一致 ✓' : '★ 不一致'}`,
  )
  return cached === derived
}

snap('建 fiber 后')
fiber.update({ v: 1 })                                // ③ config update
await sleep(20)
snap('update 后')
db()                                                  // ④ withdraw b
await sleep(25)
const ok = snap('撤销 b 后')

console.log()
console.log(ok ? '  ✓ cached state agrees with the derived state' : '  ★ cached state is stale')
process.exit(ok ? 0 : 1)
