# Master Control Dashboard (Daily Use)

Project: SAI ROLOTECH ENGINE  
Global rule: No proof = no progress

## Phase Tracking Table

```text
PHASE STATUS BOARD

PHASE 1: GEOMETRY / ROLL DESIGN
Status: [NOT STARTED / IN PROGRESS / PARTIAL / VERIFIED]
Proof: [YES / NO]
Deviation Report: [YES / NO]

PHASE 2: SIMULATION ENGINE
Status: [NOT STARTED / IN PROGRESS / PARTIAL / VERIFIED]
Physics-based output: [YES / NO]
Graphs generated: [YES / NO]

PHASE 3: CAD EXPORT
DXF: [VERIFIED / NOT VERIFIED]
STEP: [VERIFIED / NOT VERIFIED]
DWG: [SUPPORTED / UNSUPPORTED / NOT VERIFIED]

PHASE 4: FULL WORKFLOW
UI working: [YES / NO]
API working: [YES / NO]
Crash-free: [YES / NO]

PHASE 5: VALIDATION
Test coverage: [LOW / MEDIUM / HIGH]
Real comparison done: [YES / NO]
Score honesty: [VALID / FAKE]
```

## Scoring System (Strict)

```text
FINAL SCORE MODEL

1. IMPLEMENTED (code exists) -> 20%
2. RUNNING (no crash) -> 20%
3. VERIFIED (proof + output) -> 30%
4. ENGINEERING ACCURACY -> 20%
5. PRODUCTION READINESS -> 10%

TOTAL = 100

IMPORTANT:
- If VERIFIED missing -> max score = 50
- If runtime missing -> max score = 40
- If fake claim -> score reset to 0
```

## Daily Command Template

```text
You are working under strict audit.

Today's Phase: [PHASE X]

Current Status:
[Paste tracking board]

Your Task:
[Define specific task]

Rules:
- No claim without proof
- No partial answers
- No fake completion

You must return:
- root cause
- files changed
- commands run
- runtime output
- screenshots/artifacts
- final verdict: VERIFIED / PARTIAL / FAILED
```

## Verification Checklist

```text
CHECK BEFORE ACCEPTING:

1. Did we get real output?
2. Do we have screenshot/file proof?
3. Was code actually run, not only written?
4. Are logs clean?
5. Is result reproducible?

If any answer is NO -> REJECT
```

## Red Flags (Immediate Reject)

```text
- "should work"
- "likely fixed"
- "implemented"
- "seems correct"
- "logic updated"

Without proof = FAKE
```

## Final Target (COPRA+ Proof Standard)

- Roll design geometry must match expected contour with numeric tolerance proof.
- Simulation must be physics-based and output real strain/stress/springback data.
- DWG must be truly supported with artifact proof, or explicitly disabled/unsupported.
- Full workflow must run end-to-end without route/API breaks.
- Outputs must be engineering-valid with repeatable evidence.

## 7-Day Strategy

- Day 1-2: Phase 1 (Geometry fix)
- Day 3-4: Phase 2 (Simulation real)
- Day 5: Phase 3 (Export truth)
- Day 6: Phase 4 (Full flow)
- Day 7: Phase 5 (Validation + scoring)

## Core Principle

Software is accepted when it is proven, not when it is claimed.
