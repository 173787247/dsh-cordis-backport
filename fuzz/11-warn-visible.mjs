/**
 * `ctx.logger.warn()` must reach an exporter at the default configuration.
 *
 *   as shipped   default level, exporter receives   [info]
 *   fixed        default level, exporter receives   [info, warn]
 *
 * `LoggerLevel` listed INFO and WARN the wrong way round, and the exporter's
 * default threshold *is* `LoggerLevel.INFO` — so a `warn` carried level 2
 * against a threshold of 1 and was dropped before any exporter saw it. Nothing
 * thrown, nothing logged about it.
 */
import { Context } from '@deepseek-ai/cordis'
const root = new Context(); root.logger.error = () => {}
const seen = []
root.logger.exporter({ colors: 0, export: (m) => seen.push(m) })
root.logger.info('I'); root.logger.warn('W'); root.logger.error('E')
await new Promise(r => setTimeout(r, 5))
const types = seen.map(m => m.type)
console.log(`  默认级别下到达导出器的消息: [${types.join(', ')}]`)
console.log(`  ${types.includes('warn') ? '✓ warn 可见' : '★ warn 被静默丢弃 —— 只有 ' + types.join('/') + ' 能输出'}`)
