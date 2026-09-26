import { Context } from '@deepseek-ai/cordis'

// ── #36：外部持有 buffer 引用时，它还会不会保持有界 ──
{
  const ctx = new Context()
  ctx.logger.bufferSize = 2
  const held = ctx.logger.buffer            // 模拟外部（比如 UI 日志面板）拿到的引用
  for (let i = 0; i < 6; i++) ctx.logger.info('msg' + i)
  console.log('  #36 外部持有的引用长度:', held.length, '| ctx.logger.buffer 长度:', ctx.logger.buffer.length)
  console.log('      ' + (held.length <= 2 ? '✓ 有界（就地截断）' : `★ 无界增长（${held.length} 条，外部引用已失效）`))
}

// ── #51：用原型链上已有的名字注册事件 ──
{
  const ctx = new Context()
  ctx.logger.error = () => {}
  let result = '正常注册'
  try {
    ctx.on('toString', () => {})
  } catch (e) { result = '抛错: ' + e.message.slice(0, 50) }
  console.log('  #51 用 "toString" 注册事件:', result)
}
