import { Context } from '@deepseek-ai/cordis'
const root = new Context()
root.logger.error = () => {}

let downstream = 0
// 与上游 #44 的测试同构：监听器调了两次 next()
root.on('test/wf', (next) => { next(); return next() })
root.on('test/wf', (next) => { downstream++; return next() })

let err = null
try {
  const r = root.waterfall('test/wf', () => { downstream++; return 'done' })
  console.log('  返回:', JSON.stringify(r))
} catch (e) { err = e.message }

console.log('  下游执行次数:', downstream)
console.log('  抛错:', err ?? '无')
console.log('  ' + (err ? '✓ 拒绝了重复 next()' : '★ 静默跑了两次 —— 该守卫缺失'))
