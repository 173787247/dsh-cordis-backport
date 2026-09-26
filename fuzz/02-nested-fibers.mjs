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

const NAMES = ['a', 'b']
const problems = [], seen = new Set()
const report = (seed, step, msg) => {
  const key = msg.replace(/\d+/g, 'N').slice(0, 90)
  if (seen.has(key)) return
  seen.add(key); problems.push(`seed ${seed} step ${step}: ${msg}`)
}

for (let seed = 1; seed <= 250; seed++) {
  const r = rng(seed)
  const root = new Context(); root.logger.error = () => {}
  const unhandled = []
  const onU = (e) => unhandled.push(e?.message ?? String(e))
  process.on('unhandledRejection', onU)

  const provided = new Map(), allFibers = [], stats = new Map(), disposals = []
  const pick = (arr) => arr[Math.floor(r() * arr.length)]

  const track = (f, st) => { allFibers.push(f); stats.set(f, st); return f }

  const mkFiber = (parent, depth) => {
    const inject = NAMES.filter(() => r() < 0.6)
    const st = { injects: inject, outstanding: 0, children: 0, calls: 0, disposed: false }
    const f = parent.inject(inject, async (ctx) => {
      st.calls++
      st.outstanding++
      ctx.effect(() => () => { st.outstanding-- }, 'own')
      // 嵌套注册子 fiber
      if (depth < 2) {
        const n = Math.floor(r() * 3)
        for (let i = 0; i < n; i++) { st.children++; mkFiber(ctx, depth + 1) }
      }
      return () => {}
    })
    return track(f, st)
  }

  const opProvide = () => {
    const n = pick(NAMES)
    if (provided.has(n)) { provided.get(n)(); provided.delete(n) }
    else provided.set(n, root.provide(n, Math.floor(r() * 100)))
  }

  const live = () => allFibers.filter(f => f.uid !== null && f.uid !== 0)
  const opFiber = () => mkFiber(root, 0)
  const opDispose = () => { const l = live(); if (l.length) disposals.push(pick(l).dispose()) }
  const opUpdate = () => { const l = live(); if (l.length) pick(l).update({ v: Math.floor(r() * 3) }) }

  const ops = [opProvide, opProvide, opFiber, opFiber, opDispose, opUpdate]
  for (let step = 0; step < 25; step++) {
    try { pick(ops)() } catch (e) { report(seed, step, `操作抛错 ${e.message.slice(0,60)}`) }
    for (let i = 0; i < 300; i++) {
      await sleep(0)
      if (disposals.length) { await Promise.allSettled(disposals.splice(0)); continue }
      let busy = false
      for (const f of allFibers) if (f.inertia) { busy = true; await f.inertia.catch(() => {}) }
      if (!busy) break
    }
    if (unhandled.length) { report(seed, step, `unhandledRejection: ${unhandled[0]}`); unhandled.length = 0 }

    for (const f of allFibers) {
      const st = stats.get(f)
      if (f.state === LOADING || f.state === UNLOADING)
        report(seed, step, `静默后仍在 ${S[f.state]}`)
      if (f.uid === null && f.state !== DISPOSED)
        report(seed, step, `uid 已清空但 state=${S[f.state]}`)
      if (st.outstanding < 0) report(seed, step, 'outstanding 为负')
      if (f.state === DISPOSED && st.outstanding !== 0)
        report(seed, step, `已 DISPOSED 但仍有 ${st.outstanding} 个未释放 effect`)
      // ctx.get 一致性：有提供者时，ACTIVE 的 injector 应能取到
      if (f.state === ACTIVE) {
        for (const n of st.injects) {
          if (!provided.has(n)) report(seed, step, `ACTIVE 但 ${n} 无提供者`)
        }
      }
    }
  }
  process.off('unhandledRejection', onU)
  if (problems.length > 10) break
}

if (problems.length) {
  console.log(`★ ${problems.length} 类问题:`)
  problems.slice(0, 10).forEach(p => console.log('   ' + p.slice(0, 175)))
} else {
  console.log('  ✓ 250 种子 × 25 步（含两层嵌套 fiber）：全部不变量成立')
}
