# My upstream PRs, checked against the vendored line

The audit in this repository was built to answer one question: *which upstream
fixes has the vendored line not taken?* Every finding here came from that
direction — comparing commits.

That question has a blind spot I did not notice until late. **The fixes I found
and sent upstream myself were never checked against the vendored line.** It is
pinned at upstream `56b3d4f` (2026-07-15), so anything I found in code that has
not changed since is present in both. The audit was looking for upstream commits
missing here; it was not looking for defects present in both.

Checking the fourteen:

| PR | vendored line |
|---|---|
| #165 persist entry config only after a committed update | **has the defect** — assigns `entry.options.config` and writes the tree before `next()` |
| #166 prevent duplicate init when import fails | **has the defect** — probe-confirmed, see `probes/07-duplicate-init.mjs` |
| #167 remove then create when reconciling a group | **has the defect** — the same unordered `Promise.all` |
| #172 reject entry ids containing the tree separator | **has the defect** — `ensureId` accepts an id containing `:` |
| #171 only treat ENOENT as a missing file | already correct — local modification 8 |
| #173 leave an unreadable `.yarnrc.yml` alone | not applicable — the `create` package is not vendored |
| #168, #170 (hmr) | not applicable — `hmr` is not vendored |
| #164 build order | not applicable — different build |
| #174 test-only | not applicable |
| #175, #176, #177, #178 | already correct — these four came out of this line's own log |

**Four more fixes, from the same probes, for the same four files.** They belong in
`backport/` alongside the twelve.

The lesson is narrower than "check everything twice": the audit's unit of
comparison was *commits*, and a defect I found by fuzzing has no upstream commit
to compare against. A defect that exists in both lines is invisible to a
commit-diff audit by construction — not because the comparison was done badly,
but because the question was never asked of that set.
