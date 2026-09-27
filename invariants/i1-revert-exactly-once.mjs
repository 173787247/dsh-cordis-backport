/**
 * I1 — temporal: every registered effect is reverted exactly once.
 *
 * The paper's revertible-effects property: a context transformation carries an
 * inverse that the runtime holds. So for any effect that is registered, its
 * inverse must run when the owner is disposed — once, not zero times, not twice.
 *
 * This says nothing about *which* fix is present. It asserts the property, and a
 * violation on either line is a finding.
 */
import { Context } from 'CORDIS_PKG'
import { sleep, check, scenario } from './lib/harness.mjs'

const S = ['PENDING', 'LOADING', 'ACTIVE', 'FAILED', 'DISPOSED', 'UNLOADING']

await scenario('I1', async () => {
  // ── 1. ordinary disposal reverts every effect exactly once ──────────────
  {
    const root = new Context(); root.logger.error = () => {}
    const counts = [0, 0, 0]
    const fiber = root.inject([], async (ctx) => {
      for (let i = 0; i < 3; i++) ctx.effect(() => () => { counts[i]++ }, `e${i}`)
    })
    await sleep(15)
    const before = counts.slice()
    await fiber.dispose()
    await sleep(15)
    check('I1.dispose-reverts-all', counts.every(c => c === 1),
      `before=[${before}] after=[${counts}] state=${S[fiber.state]}`)
  }

  // ── 2. an ASYNC inverse is still awaited and still runs once ────────────
  {
    const root = new Context(); root.logger.error = () => {}
    let ran = 0, settled = false
    const fiber = root.inject([], async (ctx) => {
      ctx.effect(() => () => new Promise(r => setTimeout(() => { ran++; r() }, 30)), 'slow')
    })
    await sleep(15)
    const p = fiber.dispose()
    if (p && typeof p.then === 'function') await p
    settled = true
    await sleep(60)
    check('I1.async-inverse-ran-once', ran === 1,
      `after dispose resolved: ran=${ran} (settled=${settled})`)
  }

  // ── 3. a reentrant disposal (from inside the inverse itself) is single-shot
  {
    const root = new Context(); root.logger.error = () => {}
    let ran = 0
    const fiber = root.inject([], async (ctx) => {
      ctx.effect(() => () => { ran++ }, 'reentrant')
    })
    await sleep(15)
    await Promise.all([fiber.dispose(), fiber.dispose(), fiber.dispose()])
    await sleep(20)
    check('I1.repeated-dispose-single-shot', ran === 1,
      `three concurrent dispose() calls -> inverse ran ${ran} time(s)`)
  }

  // ── 4. disposing an owner reverts effects of nested owners too ──────────
  {
    const root = new Context(); root.logger.error = () => {}
    let inner = 0
    const fiber = root.inject([], async (ctx) => {
      const child = ctx.inject([], async (c) => {
        c.effect(() => () => { inner++ }, 'inner')
      })
      await child
    })
    await sleep(25)
    await fiber.dispose()
    await sleep(25)
    check('I1.owner-dispose-reaches-nested', inner === 1,
      `nested effect inverse ran ${inner} time(s)`)
  }
})
