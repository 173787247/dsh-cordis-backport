/**
 * I2 — temporal: an effect cannot escape its owner's release boundary.
 *
 * The companion to I1. Registering an effect is itself a context
 * transformation, so it too must be revertible by the owner. If an effect can be
 * registered after the owner's release has begun — or from inside a listener
 * that runs during release — and that effect is not drained by the same release,
 * then the owner no longer holds the inverse and the property is broken.
 */
import { Context } from 'CORDIS_PKG'
import { sleep, check, scenario } from './lib/harness.mjs'

const S = ['PENDING', 'LOADING', 'ACTIVE', 'FAILED', 'DISPOSED', 'UNLOADING']

await scenario('I2', async () => {
  // ── 1. registering from a teardown observer must not outlive the owner ──
  {
    const root = new Context(); root.logger.error = () => {}
    let escaped = 0
    const fiber = root.inject([], async (ctx) => {
      ctx.effect(() => () => {
        // a teardown observer that registers a NEW effect on the same context
        try { ctx.effect(() => () => { escaped++ }, 'late') } catch { /* refused is fine */ }
      }, 'outer')
    })
    await sleep(15)
    await fiber.dispose()
    await sleep(40)
    check('I2.late-registration-drained', escaped <= 1,
      `effect registered during teardown has run ${escaped} time(s); state=${S[fiber.state]}`)
  }

  // ── 2. an effect registered on a PENDING owner is released with it ──────
  //
  // The owner's own body cannot register it — the body never runs, because the
  // declaration is unsatisfied. So the effect has to arrive from outside, which
  // is precisely what a listener on `internal/plugin` does: it observes every
  // fiber at publication, including one that will never activate.
  {
    const root = new Context(); root.logger.error = () => {}
    let ran = 0
    const seen = new Set()
    root.on('internal/plugin', (fiber) => {
      if (fiber.uid === null || seen.has(fiber)) return
      seen.add(fiber)
      try { fiber.ctx.effect(() => () => { ran++ }, 'from-observer') } catch {}
    })
    const fiber = root.inject(['neverProvided'], async () => {})
    await sleep(15)
    const stateBefore = S[fiber.state]
    const registered = seen.size > 0
    await fiber.dispose()
    await sleep(30)
    check('I2.pending-owner-drains', ran === 1,
      `owner ${stateBefore} (effect registered by observer: ${registered}), dispose -> inverse ran ${ran}, now ${S[fiber.state]}`)
  }

  // ── 3. a failing setup must still revert whatever it registered first ───
  {
    const root = new Context(); root.logger.error = () => {}
    let rolledBack = 0
    const fiber = root.inject([], async (ctx) => {
      try {
        ctx.effect(() => {
          ctx.effect(() => () => { rolledBack++ }, 'collected-before-throw')
          throw new Error('setup fails after collecting')
        }, 'failing-setup')
      } catch { /* the throw is expected */ }
    })
    await sleep(20)
    const afterSetup = rolledBack
    await fiber.dispose()
    await sleep(25)
    check('I2.failed-setup-rolls-back', rolledBack === 1,
      `inverse ran ${afterSetup} time(s) at setup failure, ${rolledBack} after dispose`)
  }
})
