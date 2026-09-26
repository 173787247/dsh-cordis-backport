import { Context } from 'cordis'
const sleep = (ms = 0) => new Promise(r => setTimeout(r, ms))
const S = ['PENDING','LOADING','ACTIVE','FAILED','DISPOSED','UNLOADING']
const PENDING=0, LOADING=1, ACTIVE=2, DISPOSED=4, UNLOADING=5

function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

const NAMES = ['a', 'b', 'c']
const problems = [], seen = new Set()
const report = (seed, step, msg) => {
  const key = msg.replace(/\d+/g, 'N').slice(0, 90)
  if (seen.has(key)) return
  seen.add(key); problems.push(`seed ${seed} step ${step}: ${msg}`)
}

for (let seed = 1; seed <= 400; seed++) {
  const r = rng(seed)
  const root = new Context(); root.logger.error = () => {}
  const unhandled = []
  const onU = (e) => unhandled.push(e?.message ?? String(e))
  process.on('unhandledRejection', onU)

  const provided = new Map(), fibers = [], stats = new Map(), disposals = []
  const pick = (arr) => arr[Math.floor(r() * arr.length)]

  const opProvide = () => {
    const n = pick(NAMES)
    if (provided.has(n)) { provided.get(n)(); provided.delete(n) }
    else provided.set(n, root.provide(n, Math.floor(r() * 100)))
  }

  const opFiber = () => {
    const inject = NAMES.filter(() => r() < 0.5)
    if (!inject.length) inject.push(pick(NAMES))
    // outstanding：已注册未释放的 effect 数；order：本轮释放顺序
    const st = { calls: 0, outstanding: 0, injects: inject, pendingTags: [], releaseLog: [] }
    const f = root.inject(inject, async (ctx) => {
      st.calls++
      const cycle = st.calls
      const tags = []
      const k = 1 + Math.floor(r() * 3)
      for (let i = 0; i < k; i++) {
        const tag = `${cycle}#${i}`
        tags.push(tag)
        st.outstanding++
        ctx.effect(() => {
          return () => {
            st.outstanding--
            if (st.outstanding < 0) report(seed, -1, 'outstanding 变负 —— disposer 被多跑')
            st.releaseLog.push(tag)
          }
        }, tag)
      }
      st.pendingTags.push(tags)
      await sleep(Math.floor(r() * 2))
      return () => {}
    })
    fibers.push(f); stats.set(f, st)
  }

  const live = () => fibers.filter(f => f.uid !== null)
  const opDispose = () => { const l = live(); if (l.length) disposals.push(pick(l).dispose()) }
  const opUpdate = () => { const l = live(); if (l.length) pick(l).update({ v: Math.floor(r() * 5) }) }

  const ops = [opProvide, opProvide, opFiber, opFiber, opFiber, opDispose, opUpdate]
  for (let step = 0; step < 35; step++) {
    try { pick(ops)() } catch (e) { report(seed, step, `操作抛错 ${e.message.slice(0,60)}`) }
    for (let i = 0; i < 300; i++) {
      await sleep(0)
      if (disposals.length) { await Promise.allSettled(disposals.splice(0)); continue }
      let busy = false
      for (const f of fibers) if (f.inertia) { busy = true; await f.inertia.catch(() => {}) }
      if (!busy) break
    }
    if (unhandled.length) { report(seed, step, `unhandledRejection: ${unhandled[0]}`); unhandled.length = 0 }

    for (const f of fibers) {
      const st = stats.get(f)
      const satisfied = st.injects.every(n => provided.has(n))
      if (f.state === LOADING || f.state === UNLOADING)
        report(seed, step, `静默后仍在 ${S[f.state]} satisfied=${satisfied}`)
      if (f.state === ACTIVE && !satisfied) report(seed, step, 'ACTIVE 但依赖不满足')
      if (satisfied && f.uid !== null && f.state === PENDING) report(seed, step, '依赖满足却停在 PENDING')
      if (f.uid === null && f.state !== DISPOSED) report(seed, step, `uid 已清空但 state=${S[f.state]}`)
      if (f.state === ACTIVE && !f.store) report(seed, step, 'ACTIVE 但 store 为空')
      if (st.outstanding < 0) report(seed, step, 'outstanding 为负')
      // 已释放的 fiber 不该再有未释放的 effect
      if (f.state === DISPOSED && st.outstanding !== 0)
        report(seed, step, `已 DISPOSED 但仍有 ${st.outstanding} 个 effect 未释放`)
    }
  }
  process.off('unhandledRejection', onU)
  if (problems.length > 10) break
}

if (problems.length) {
  console.log(`★ ${problems.length} 类问题:`)
  problems.slice(0, 10).forEach(p => console.log('   ' + p.slice(0, 175)))
} else {
  console.log('  ✓ 400 种子 × 35 步：状态机 / effect 记账 / 事件 全部成立')
}
