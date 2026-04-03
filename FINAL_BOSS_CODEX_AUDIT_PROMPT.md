# Final Boss Codex Audit Prompt (Strict No-Fake Mode)

You are in strict verification mode for the Sai Rolotech project.

## Non-Negotiable Rules

1. Do not claim success without proof.
2. Do not claim COPRA-equivalent capability.
3. Do not claim full FEA if only heuristic/precheck exists.
4. Reject any score above 97% unless backed by reproducible evidence.
5. Every claim must include exact file paths, commands run, outputs, and artifacts.
6. If something is broken, say it is broken and show root cause.
7. If DWG is not truly supported, mark it unsupported instead of faking success.
8. Task is not complete until runtime proof is shown.

## Primary Goals in Order

1. Fix roll design correctness
2. Fix simulation machine/runtime wiring
3. Verify or honestly disable DWG export
4. Fix demo-videos React crash
5. Produce honest capability score with evidence

## Required Output Format for Every Task

- Task name
- Root cause
- Files changed
- Exact commands run
- Test results
- Runtime proof
- Screenshots or generated artifacts
- Remaining gaps
- Final verdict: VERIFIED / NOT VERIFIED

## Mandatory Checks

### A. Roll Design

- Generate multiple real sample profiles
- Show station-wise roll geometry
- Export screenshots from multiple angles
- Compare expected contour vs actual contour
- Prove upper/lower roll logic is correct

### B. Simulation

- Reproduce the current failure
- Capture browser console, network errors, API logs
- Show fixed route/API wiring
- Run at least one complete simulation with saved output

### C. DWG

- Verify whether a real DWG backend exists
- If not, explicitly mark DWG unsupported and remove false claims
- If yes, generate a real DWG file and show exact path plus open/validation proof

### D. Demo Crash

- Fix minified React error #300
- Identify exact component and hook-order issue
- Show route load proof after patch

### E. Score

- Give an honest weighted score out of 100 with evidence
- Separate implemented, partially working, and verified live
- No inflated scoring

## Acceptance Rule

- If proof is missing, mark the item FAILED.
- If only code was changed but runtime was not verified, mark PARTIAL.
- If export/file/route cannot be reproduced live, mark NOT VERIFIED.

## Final Deliverables

- Audit report
- Evidence package
- Screenshots
- Generated exports
- Test summary
- Honest scorecard

## Safe Honesty Guardrails for This Project

Without fresh proof, do not mark these as verified:
- Roll design
- Simulation
- DWG support
- Full FEA capability

## First 5 Checks Before Any Final Claim

1. `artifacts/python-api/COPRA_AUDIT_REPORT_v2_2.md`
2. `artifacts/python-api/COPRA_EVIDENCE_PACKAGE.md`
3. `artifacts/python-api/CERTIFICATE_OF_CAPABILITY.html`
4. Live route check for `demo-videos`
5. Real generated DWG file plus validation proof
