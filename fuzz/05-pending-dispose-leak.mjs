import { Context } from 'cordis'
const sleep = (ms = 0) => new Promise(r => setTimeout(r, ms))
const S = ['PENDING','LOADING','ACTIVE','FAILED','DISPOSED','UNLOADING']

// 模拟 loader 的 Entry：在 internal/plugin 里给新 fiber 的 ctx 注册 effect
async function scenario(Context) {
  const root = new Context()
  root.logger.error = () => {}
  let disposed = 0
  const seen = []

  root.on('internal/plugin', (fiber) => {
    if (!fiber.uid || fiber.uid === 0) return
    seen.push(fiber.uid)
    // 挂在 fiber 自己的 ctx 上——这正是 Entry 的做法
    fiber.ctx.effect(() => {
      return () => { disposed++ }
    }, 'observer-effect')
  })

  const f = root.inject(['missing'], async () => () => {})   // 停在 PENDING
  await sleep(5)

  const before = { state: f.state, uid: f.uid, disposed }
  await f.dispose()
  await sleep(10)

  return {
    observerSaw: seen.length,
    stateBefore: S[before.state], stateAfter: S[f.state],
    uidAfter: f.uid,
    effectDisposed: disposed,
    stateOk: f.state === 4,
    effectOk: disposed > 0,
  }
}

const r = await scenario(Context)
console.log(`  internal/plugin 观察到 ${r.observerSaw} 个 fiber`)
console.log(`  dispose 前 state=${r.stateBefore}`)
console.log(`  dispose 后 state=${r.stateAfter}  uid=${r.uidAfter}`)
console.log(`  观察者注册的 effect 被释放次数: ${r.effectDisposed}`)
console.log(`  ——`)
console.log(`  ${r.stateOk ? '✓' : '★'} 状态落成 DISPOSED     ${r.stateOk ? '' : '（实际 ' + r.stateAfter + '）'}`)
console.log(`  ${r.effectOk ? '✓' : '★'} 观察者的 effect 被释放  ${r.effectOk ? '' : '（★ 泄漏：注册了却从不释放）'}`)
