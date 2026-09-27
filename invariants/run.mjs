#!/usr/bin/env node
/**
 * The differential runner.
 *
 * Each scenario declares properties, not fixes, so the same file is meaningful
 * on both lines. The runner executes every scenario once per line and reports:
 *
 *   AGREE    both lines satisfied, or both violated, the same invariant
 *   DIVERGE  one line satisfied it and the other did not  <- the finding
 *
 * A divergence is not automatically a bug on the line that failed: it is a
 * question about which behaviour the property demands. But it is always the
 * place to look, and it is the only signal a single-line test cannot produce.
 *
 *   node run.mjs [scenario ...]
 */
import { spawn } from 'node:child_process'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

/** The two lines, and the bare specifier each publishes cordis under. */
const LINES = [
  { key: 'dsh', label: 'DeepSeek Harness line', root: '/tmp/probe-patched',
    spec: '@deepseek-ai/cordis', loader: '@deepseek-ai/cordis-plugin-loader' },
  { key: 'upstream', label: 'cordiverse/cordis', root: '/tmp/probe-fix',
    spec: 'cordis', loader: '@cordisjs/plugin-loader' },
]

function run(cmd, args, cwd) {
  return new Promise((done) => {
    const p = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = '', err = ''
    p.stdout.on('data', d => { out += d })
    p.stderr.on('data', d => { err += d })
    p.on('close', code => done({ code, out, err }))
  })
}

const parse = (out) => Object.fromEntries(
  out.split('\n')
    .filter(l => l.startsWith('INVARIANT '))
    .map((l) => {
      const [, id, verdict, ...rest] = l.split(' ')
      return [id, { ok: verdict === 'PASS', detail: rest.join(' ') }]
    }),
)

async function main() {
  const only = process.argv.slice(2)
  let files = (await import('node:fs')).readdirSync(HERE).filter(f => /^i\d+-.*\.mjs$/.test(f)).sort()
  if (only.length) files = files.filter(f => only.some(o => f.includes(o)))
  if (!files.length) { console.log('no scenarios matched'); process.exit(1) }

  const results = []
  for (const file of files) {
    const perLine = {}
    for (const line of LINES) {
      if (!existsSync(line.root)) {
        perLine[line.key] = { skipped: true, reason: `no environment at ${line.root}` }
        continue
      }
      // stage the scenario where the line's node_modules can resolve it
      const dir = join(line.root, '__invariants__')
      await mkdir(join(dir, 'lib'), { recursive: true })
      await cp(join(HERE, 'lib', 'harness.mjs'), join(dir, 'lib', 'harness.mjs'))
      const src = (await readFile(join(HERE, file), 'utf8'))
        .replaceAll('CORDIS_PKG', line.spec)
        .replaceAll('LOADER_PKG', line.loader)
      await writeFile(join(dir, file), src)
      // scenario-local helpers travel with the scenario
      if (existsSync(join(HERE, 'mockloader.mjs'))) {
        await cp(join(HERE, 'mockloader.mjs'), join(dir, 'mockloader.mjs'))
      }

      const { code, out, err } = await run('node', ['--no-warnings', file], dir)
      perLine[line.key] = { parsed: parse(out), code, tail: (err || out).trim().split('\n').pop() }
      await rm(dir, { recursive: true, force: true })
    }

    results.push({ file, perLine })
  }

  // ── report ────────────────────────────────────────────────────────────────
  let diverge = 0, violated = 0, agreed = 0
  for (const { file, perLine } of results) {
    console.log(`\n═══ ${file}`)
    const [a, b] = LINES.map(l => perLine[l.key])
    if (a?.skipped || b?.skipped) {
      console.log(`  SKIP  ${a?.reason || b?.reason}`)
      continue
    }
    const ids = [...new Set([...Object.keys(a.parsed || {}), ...Object.keys(b.parsed || {})])].sort()
    for (const id of ids) {
      const x = a.parsed?.[id], y = b.parsed?.[id]
      if (!x || !y) {
        console.log(`  ????  ${id}  missing on ${!x ? LINES[0].label : LINES[1].label}`)
        continue
      }
      if (x.ok === y.ok) {
        agreed++
        if (!x.ok) { violated++; console.log(`  BOTH-FAIL  ${id}\n        dsh: ${x.detail}\n        up : ${y.detail}`) }
        else console.log(`  agree      ${id}  ${x.detail}`)
      } else {
        diverge++
        console.log(`  DIVERGE    ${id}`)
        console.log(`        dsh ${x.ok ? 'PASS' : 'FAIL'}: ${x.detail}`)
        console.log(`        up  ${y.ok ? 'PASS' : 'FAIL'}: ${y.detail}`)
      }
    }
  }

  console.log(`\n──────── ${agreed} agreed (${violated} violated on both), ${diverge} divergent`)
  if (diverge) {
    console.log('A divergence means one line satisfies a property the other does not.')
    console.log('It is the only signal a single-line test cannot produce, and the place to look.')
  }
}

main()
