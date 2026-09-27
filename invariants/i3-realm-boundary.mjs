/**
 * I3 — spatial: a service is visible exactly within the isolate realm it was
 * provided in.
 *
 * Written after two earlier versions of this file asserted the wrong property,
 * which is worth recording because both mistakes are easy to repeat:
 *
 *   1. It claimed `inject` is a capability boundary — that a fiber must not
 *      reach a service it did not declare. It must not be read that way: cordis
 *      resolves services along the context prototype chain, so a fiber sees
 *      whatever its ancestors provide. The paper's coeffect property drives
 *      *activation*, not reachability, and that is I4's job.
 *   2. The realm assertions used `null` as "never ran" and then compared against
 *      `undefined`, so a correct run reported a violation.
 *
 * What this file now asserts is the boundary that does exist.
 */
import { Context } from 'CORDIS_PKG'
import { sleep, check, scenario } from './lib/harness.mjs'

const S = ['PENDING', 'LOADING', 'ACTIVE', 'FAILED', 'DISPOSED', 'UNLOADING']
const NEVER = Symbol('never-ran')

await scenario('I3', async () => {
  // ── 1. two realms are genuinely distinct ───────────────────────────────
  {
    const root = new Context(); root.logger.error = () => {}
    const a = root.isolate('svc')
    const b = root.isolate('svc')
    const keyOf = (ctx) => ctx[Object.getOwnPropertySymbols(ctx).find(s => String(s).includes('isolate'))]
    check('I3.realms-are-distinct', keyOf(a) !== keyOf(b),
      `isolate key of A ${keyOf(a) === keyOf(b) ? 'equals' : 'differs from'} B`)
  }

  // ── 2. providing in one realm does not activate the other ──────────────
  {
    const root = new Context(); root.logger.error = () => {}
    const a = root.isolate('svc')
    const b = root.isolate('svc')
    let aRan = NEVER, bRan = NEVER
    const fa = a.inject(['svc'], async () => { aRan = 'ran' })
    const fb = b.inject(['svc'], async () => { bRan = 'ran' })
    await sleep(20)
    const beforeA = S[fa.state], beforeB = S[fb.state]
    const undo = a.provide('svc', { from: 'a' })
    await sleep(30)
    check('I3.provider-realm-activates', aRan === 'ran',
      `A: ${beforeA} -> ${S[fa.state]} (consumer ${aRan === 'ran' ? 'ran' : 'never ran'})`)
    check('I3.other-realm-blind', bRan === NEVER,
      `B: ${beforeB} -> ${S[fb.state]} (consumer ${bRan === NEVER ? 'never ran' : 'RAN'})`)
    if (undo) undo()
    await sleep(30)
    check('I3.withdrawal-is-local', S[fa.state] !== 'ACTIVE' && S[fb.state] !== 'ACTIVE',
      `after A withdrew -> A=${S[fa.state]} B=${S[fb.state]}`)
  }

  // ── 3. record that inject is NOT a capability boundary ────────────────
  {
    const root = new Context(); root.logger.error = () => {}
    root.provide('extra', {})
    let reached = NEVER
    const fiber = root.inject([], async (ctx) => { reached = ctx.get('extra') !== undefined })
    await sleep(20)
    check('I3.inject-drives-activation-not-visibility', reached === true && S[fiber.state] === 'ACTIVE',
      `declaration-free fiber activated and read an ancestor service: ${reached} (${S[fiber.state]})`)
  }
})
