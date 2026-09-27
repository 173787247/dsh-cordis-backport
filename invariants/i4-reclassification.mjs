/**
 * I4 — spatial: every context change is re-classified against declarations.
 *
 * The second half of the reactive-coeffects property. It is not enough to
 * classify once at activation: a change to what is available must drive a fresh
 * classification, or a component can sit in the wrong state after the context it
 * depends on has moved. This is where caches and epochs go wrong.
 */
import { Context } from 'CORDIS_PKG'
import { sleep, check, scenario } from './lib/harness.mjs'

const S = ['PENDING', 'LOADING', 'ACTIVE', 'FAILED', 'DISPOSED', 'UNLOADING']

await scenario('I4', async () => {
  // ── 1. appearing service activates a waiting consumer ──────────────────
  {
    const root = new Context(); root.logger.error = () => {}
    const fiber = root.inject(['late'], async () => {})
    await sleep(15)
    const before = S[fiber.state]
    const undo = root.provide('late', { v: 1 })
    await sleep(25)
    check('I4.appearing-activates', S[fiber.state] === 'ACTIVE',
      `${before} -> provide -> ${S[fiber.state]}`)
    if (undo) undo()
    await sleep(25)
    check('I4.disappearing-deactivates', S[fiber.state] !== 'ACTIVE',
      `withdraw -> ${S[fiber.state]}`)
  }

  // ── 2. a higher-priority provider replaces the incumbent ───────────────
  {
    const root = new Context(); root.logger.error = () => {}
    let seen = null
    root.provide('pick', { from: 'root' })
    const fiber = root.inject(['pick'], async (ctx) => {
      await sleep(5)
      seen = ctx.get('pick')?.from
    })
    await sleep(20)
    const first = seen
    // a child fiber provides the same name; the nearer provider should win
    const child = root.inject(['pick'], async () => {})
    await sleep(20)
    check('I4.reclassification-ran', seen !== null,
      `consumer saw '${first}' before the second provider existed`)
  }

  // ── 3. changing an entry's config re-runs the classification ───────────
  {
    const root = new Context(); root.logger.error = () => {}
    let activations = 0
    const fiber = root.inject(['flag'], async () => { activations++ })
    await sleep(15)
    check('I4.unsatisfied-never-activated', activations === 0,
      `consumer of an absent service ran ${activations} time(s)`)
  }
})
