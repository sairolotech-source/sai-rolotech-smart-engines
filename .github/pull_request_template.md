# Engineering Validation & Merge Governance Template

## Policy
No merge to protected branches (`main`, `release/*`, `production`) unless all gates pass, required evidence is attached, and required sign-offs are approved.

## Enforcement Gates

### Gate 1 — Engineering Logic Gate
- Criteria: Core engineering logic is present, reachable, and validated for normal and edge cases.
- On fail: **Engineering Logic Gate fail -> Do not merge**.
- Evidence checklist:
  - [ ] Logic path implementation links attached
  - [ ] Reachability validated (manual + automated)
  - [ ] Edge-case validation attached

### Gate 2 — Validation & Test Gate
- Criteria:
  - Mandatory tests pass
  - Required CI jobs are green
  - No blocking regression remains
- On fail: **Validation & Test Gate fail -> Do not merge**.
- Evidence checklist:
  - [ ] Unit/integration/e2e status attached
  - [ ] CI pipeline URL attached
  - [ ] Regression triage complete

### Gate 3 — Production Safety Gate
- Criteria:
  - Production safety controls are active
  - Hard-block conditions are enforced
  - Unsafe release/export paths are disabled
  - Scoped profile/machine restrictions are active where required
- On fail: **Production Safety Gate fail -> Do not merge**.
- Evidence checklist:
  - [ ] Safety controls validated in runtime
  - [ ] Hard-block validations validated
  - [ ] Unsafe export/release path tests attached

## Baseline Status (separate from pass/fail)
- Baseline recorded: Yes / No
- Delta from baseline reviewed: Yes / No
- Risk level: Low / Medium / High

## Hard Production Block
Production release is blocked when any critical gate is failed, bypassed, or marked partial.

## Evidence (required)
- Test report(s): `<path or URL>`
- Calibration report(s): `<path or URL>`
- Runtime logs / screenshots: `<path or URL>`
- Reviewer notes: `<path or URL>`
- Compatibility matrix / acceptance artifact: `<path or URL>`

## Sign-off (required)
- Engineering: Name / Approved or Rejected / Date
- QA: Name / Approved or Rejected / Date
- Ops: Name / Approved or Rejected / Date

## Merge Decision
- Merge allowed: Yes / No
- Approved release label:
- Final reason:

## Usage Notes
- Any gate status of **Fail**, **Partial**, or **Bypassed** must force `Merge allowed: No`.
- Missing evidence must be treated as gate not passed.
- For protected branches, all three sign-offs are mandatory.
- Keep this document with the PR evidence bundle for auditability.
