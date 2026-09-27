#!/usr/bin/env node
/**
 * Reading progress over the DeepSeek Harness design notes.
 *
 *   node reading-status.mjs            summary by topic
 *   node reading-status.mjs next [n]   the next n pending docs, highest score first
 *   node reading-status.mjs done <name>   mark a doc read
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FILE = join(dirname(fileURLToPath(import.meta.url)), 'reading-progress.json')
const prog = JSON.parse(readFileSync(FILE, 'utf8'))
const [cmd = 'summary', arg] = process.argv.slice(2)

if (cmd === 'done') {
  if (!arg || !prog[arg]) { console.error(`no such doc: ${arg}`); process.exit(1) }
  prog[arg].status = 'done'
  writeFileSync(FILE, JSON.stringify(prog, null, 1) + '\n')
  console.log(`marked done: ${arg}`)
} else if (cmd === 'next') {
  const n = Number(arg ?? 5)
  const rows = Object.entries(prog).filter(([, v]) => v.status !== 'done')
    .sort((a, b) => (a[1].status === 'in-progress' ? -1 : 1) - (b[1].status === 'in-progress' ? -1 : 1)
      || b[1].score - a[1].score).slice(0, n)
  for (const [name, v] of rows) console.log(`  ${v.status === 'in-progress' ? '◐' : '○'} ${name}  [${v.topic}] score ${v.score}${v.note ? '  ' + v.note : ''}`)
} else {
  const by = {}
  for (const v of Object.values(prog)) {
    by[v.topic] ??= { done: 0, total: 0, ip: 0 }
    by[v.topic].total++
    if (v.status === 'done') by[v.topic].done++
    if (v.status === 'in-progress') by[v.topic].ip++
  }
  const done = Object.values(prog).filter(v => v.status === 'done').length
  for (const [t, c] of Object.entries(by).sort((a, b) => b[1].total - a[1].total)) {
    const bar = '█'.repeat(c.done) + '░'.repeat(c.total - c.done)
    console.log(`  ${t.padEnd(14)} ${bar} ${c.done}/${c.total}${c.ip ? `  (${c.ip} in progress)` : ''}`)
  }
  console.log(`\n  ${done}/${Object.keys(prog).length} read`)
}
