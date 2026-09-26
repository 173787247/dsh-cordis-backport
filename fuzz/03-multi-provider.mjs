import { Context } from 'cordis'
const sleep = (ms = 0) => new Promise(r => setTimeout(r, ms))
const S = ['PENDING','LOADING','ACTIVE','FAILED','DISPOSED','UNLOADING']
const LOADING=1, ACTIVE=2, DISPOSED=4, UNLOADING=5

function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

const problems = [], seen = new Set()
const report = (seed, step, msg) => {
  const key = msg.replace(/\d+/g, 'N').slice(0, 90)
  if (seen.has(key)) return
  seen.add(key); problems.push(`seed ${seed} step ${step}: ${msg}`)
}

for (let seed = 1; seed <= 300; seed++) {
  const r = rng(seed)
  const root = new Context(); root.logger.error = () => {}
  const unhandled = []
  const onU = (e) => unhandled.push(e?.message ?? String(e))
  process.on('unhandledRejection', onU)

  const providers = []        // { fiber, value, alive }
  const pick = (arr) => arr[Math.floor(r() * arr.length)]

  // 每个提供者是一个 fiber，在自己的回调里 provide('svc', 唯一值)
  const mkProvider = () => {
    const value = { id: Math.floor(r() * 1e6) }
    const rec = { value, fiber: null, alive: false }
    const f = root.inject([], async (ctx) => {
      ctx.provide('svc', value)
      rec.alive = true
      return () => { rec.alive = false }
    })
    rec.fiber = f
    providers.push(rec)
  }

  const ops = [mkProvider, mkProvider, mkProvider,
    () => { const l = providers.filter(p => p.fiber.uid !== null); if (l.length) pick(l).fiber.dispose() }]

  for (let step = 0; step < 25; step++) {
    try { pick(ops)() } catch (e) { report(seed, step, `操作抛错 ${e.message.slice(0,60)}`) }
    for (let i = 0; i < 300; i++) {
      await sleep(0)
      let busy = false
      for (const p of providers) if (p.fiber.inertia) { busy = true; await p.fiber.inertia.catch(() => {}) }
      if (!busy) break
    }
    if (unhandled.length) { report(seed, step, `unhandledRejection: ${unhandled[0]}`); unhandled.length = 0 }

    const aliveOnes = providers.filter(p => p.alive)
    const got = root.get('svc')

    // ① 有活着的提供者 ⟺ get 有值
    if (aliveOnes.length && got === undefined) {
      report(seed, step, `有 ${aliveOnes.length} 个活提供者但 get 返回 undefined`)
    }
    // ② 没有活提供者时 get 必须为空（泄漏检测）
    if (!aliveOnes.length && got !== undefined) {
      report(seed, step, `无活提供者但 get 仍返回 ${JSON.stringify(got)?.slice(0,40)}`)
    }
    // ③ 返回的必须是某个活提供者的值
    if (got !== undefined && !aliveOnes.some(p => p.value === got)) {
      report(seed, step, 'get 返回了一个已死提供者的值（陈旧引用）')
    }
    // ④ 不得停在转场态
    for (const p of providers) {
      if (p.fiber.state === LOADING || p.fiber.state === UNLOADING)
        report(seed, step, `提供者停在 ${S[p.fiber.state]}`)
      if (p.fiber.uid === null && p.fiber.state !== DISPOSED)
        report(seed, step, `uid 已清空但 state=${S[p.fiber.state]}`)
    }
  }
  process.off('unhandledRejection', onU)
  if (problems.length > 10) break
}

if (problems.length) {
  console.log(`★ ${problems.length} 类问题:`)
  problems.slice(0, 10).forEach(p => console.log('   ' + p.slice(0, 175)))
} else {
  console.log('  ✓ 300 种子 × 25 步（多提供者并发 provide/dispose）：4 条不变量全部成立')
}
