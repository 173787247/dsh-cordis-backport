/**
 * The invariant harness.
 *
 * Every scenario is a standalone module that imports from `CORDIS_PKG` — the
 * runner substitutes the real specifier per line before executing, because the
 * two lines publish the same package under different names.
 *
 * A scenario declares invariants and observes them. It never asserts a *fix* —
 * it asserts a *property*, so the same file is meaningful on both lines and a
 * failure on either one is a finding.
 */
export const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))

const results = []

/**
 * Record one observation.
 * @param id      stable invariant id, e.g. 'I1.exactly-once'
 * @param ok      whether the property held
 * @param detail  what was observed, in one line — printed either way
 */
export function check(id, ok, detail) {
  results.push({ id, ok: Boolean(ok), detail: String(detail) })
}

/** Report, and exit non-zero if any invariant was violated. */
export function report() {
  for (const r of results) {
    console.log(`INVARIANT ${r.id} ${r.ok ? 'PASS' : 'FAIL'} ${r.detail}`)
  }
  const failed = results.filter(r => !r.ok).length
  console.log(`SUMMARY ${results.length} checked, ${failed} violated`)
  if (failed) process.exitCode = 1
}

/**
 * Run a body with the invariant reporter attached, and surface a thrown error
 * as a scenario-level failure rather than an unhandled rejection — a scenario
 * that cannot run is itself a result worth seeing.
 */
export async function scenario(name, body) {
  try {
    await body()
  } catch (error) {
    check(`${name}.ran`, false, `threw: ${error && error.message}`)
  }
  report()
}
