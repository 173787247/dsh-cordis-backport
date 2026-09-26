import { Context } from '@deepseek-ai/cordis'
import Timer from '@deepseek-ai/cordis-plugin-timer'
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const root = new Context()
await root.plugin(Timer)
const it = root.interval(40)

// 一次 tick 之前，先排两个等待者
const p1 = it.next().then(() => 'A')
const p2 = it.next().then(() => 'B')

const res = await Promise.race([
  Promise.all([p1, p2]).then(() => '两个都完成'),
  sleep(600).then(() => '超时'),
])
console.log('  并发 next() x2 →', res)

// 再排三个
const ps = [it.next(), it.next(), it.next()].map((p, i) => p.then(() => '#' + i))
const res3 = await Promise.race([
  Promise.all(ps).then(() => '三个都完成'),
  sleep(600).then(() => '超时'),
])
console.log('  并发 next() x3 →', res3)
console.log('  ' + (res === '超时' || res3 === '超时' ? '★ 有等待者永远挂起' : '✓ 全部按序结算'))
