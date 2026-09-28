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

/**
 * Record an observation this scenario cannot decide.
 *
 * Without this the only way to express "the run does not settle it" was to let
 * the check fail, which states a conclusion the scenario does not have. It also
 * counted toward "violated", so a scenario that was honest about its own limits
 * made the suite look worse than one that quietly omitted the case.
 *
 * I5.failed-update-restores-config is the instance that motivated this. It
 * observes that options.config keeps the new value after a rejecting update, on
 * both lines. But the claim it was written against describes the module-name
 * change path with a candidate fiber, and the vendored source has no dispose()
 * on that path. Deciding whether the property is unmet or the scenario simply
 * does not reach it needs the reload path read, not this scenario run again.
 * Its own header said so, above the code: "stated before the code so it cannot
 * be skimmed past". It worked -- but only because someone read the header. The
 * runner printed BOTH-FAIL, which reads as a shared defect, and the header is
 * the only thing that says otherwise.
 *
 * @param id      stable invariant id
 * @param reason  why this run cannot settle it — shown, not buried
 * @param detail  what was observed, in one line
 */
export function inconclusive(id, reason, detail) {
  results.push({ id, ok: null, reason: String(reason), detail: String(detail) })
}

/** Report, and exit non-zero only if an invariant was actually violated. */
export function report() {
  for (const r of results) {
    const state = r.ok === null ? 'INCONCLUSIVE' : r.ok ? 'PASS' : 'FAIL'
    console.log(`INVARIANT ${r.id} ${state} ${r.detail}`)
    if (r.ok === null) console.log(`  ?  ${r.reason}`)
  }
  const failed = results.filter(r => r.ok === false).length
  const open = results.filter(r => r.ok === null).length
  console.log(
    `SUMMARY ${results.length} checked, ${failed} violated` +
    (open ? `, ${open} inconclusive (not counted as violations)` : ''),
  )
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
