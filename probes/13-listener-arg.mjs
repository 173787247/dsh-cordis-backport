/**
 * #233: `internal/listener` receives the EventOptions object, but `Events`
 * declares it as `boolean`.
 */
import { Context } from '@deepseek-ai/cordis'

const ctx = new Context()
const seen = []
ctx.on('internal/listener', (...args) => {
  const arg = args[args.length - 1]
  seen.push({ name: args[0], type: typeof arg, value: JSON.stringify(arg) })
})
ctx.on('foo', () => {})
ctx.on('bar', () => {}, { prepend: true })
for (const item of seen) {
  console.log(`  name=${item.name} typeof=${item.type} arg=${item.value}`)
}
const ok = seen.length >= 2 && seen.every((item) => item.type === 'object')
console.log(`  ${ok ? '✓ 运行时是 EventOptions 对象' : '★ 运行时参数不是对象'}`)
