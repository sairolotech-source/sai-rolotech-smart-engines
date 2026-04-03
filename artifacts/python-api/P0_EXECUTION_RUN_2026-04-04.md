# P0 Execution Run - 2026-04-04

**Mode:** Strict no-fake execution  
**Base plan:** `COPRA_EXECUTION_PLAN_2026-04-04.md`  
**Overall verdict:** **PARTIALLY FIXED** (code fixes done, runtime proof blocked by missing local runtimes)

---

## Task 1 - Flower -> Roll derivation

### Root cause
- Roll contour pipeline could silently fall back to heuristic scheduling even when flower pass-plan data existed but was unusable.
- This weakens traceability from flower planning to contour generation.

### Files changed
- `artifacts/python-api/app/engines/roll_contour_engine.py`

### Functions changed
- `generate_roll_contour(...)`

### Before vs after
- Before:
  - If extracted angles were empty, engine immediately used heuristic schedule.
- After:
  - If `flower_result.pass_plan` exists but angle extraction fails, engine now returns explicit `fail` and refuses heuristic fallback.
  - Heuristic schedule is used only when pass-plan is absent (`profile_heuristic_no_pass_plan`).

### Proof markers in code
- `roll_contour_engine.py` lines around `1324`, `1343`.

---

## Task 2 - CAD export pipeline (contour-only, no fake STEP roll fallback)

### Root cause
- STEP generation could fall back to legacy hollow-cylinder placeholders when contour/CadQuery path failed.
- Export pipeline could include non-contour station data fallback paths that risked generic outputs.

### Files changed
- `artifacts/python-api/app/engines/cad_export_engine.py`

### Functions changed
- `_contour_span_x_mm(...)` (new helper)
- `_build_export_rolls(...)`
- `generate_step_files(...)`
- `generate_cad_export(...)`

### Before vs after
- Before:
  - STEP rolls used contour path when available, else legacy cylinder fallback.
  - Station fallback logic could add non-contour entries.
- After:
  - Legacy placeholder roll STEP fallback disabled.
  - Missing contour STEP now reported as warning/error, not replaced by fake cylinder.
  - Station coverage and contour presence are validated; missing stations now raise explicit errors.
  - Capability flags now expose contour-only STEP mode truth.

### Proof markers in code
- `cad_export_engine.py` lines around `149`, `241`, `765`, `864`, `979`, `980`.

---

## Task 3 - Roll dimensioning derivation improvements

### Root cause
- Fixed-style width/OD/spacer heuristics were still present in dimensioning utilities.

### Files changed
- `artifacts/python-api/app/engines/roll_design_calc_engine.py`
- `artifacts/python-api/app/engines/roll_dimension_engine.py`

### Functions changed
- `estimate_spacer_logic(...)` in `roll_design_calc_engine.py`
- `generate_roll_dimensions(...)` in `roll_dimension_engine.py`

### Before vs after
- Before:
  - Working face and spacer recommendations used simple additive heuristics.
  - Roll dimension engine relied on width-based fixed rule progression.
- After:
  - Spacer/face recommendations are derived from section envelope, thickness, bend count, shaft, and section type.
  - Roll dimension engine derives OD/face from envelope + contour depth proxy + shaft packaging constraints.
  - Added explicit `dimension_source: geometry_constraint_derived`.

### Proof markers in code
- `roll_design_calc_engine.py` lines around `73`, `269`, `309`, `311`.
- `roll_dimension_engine.py` lines around `33`, `58`, `59`, `86`.

---

## Task 4 - Station completeness (no silent partial coverage)

### Root cause
- Export paths needed explicit coverage checks so missing stations are surfaced as blockers instead of silent partials.

### Files changed
- `artifacts/python-api/app/engines/cad_export_engine.py`

### Functions changed
- `generate_cad_export(...)`

### Before vs after
- Before:
  - Missing station coverage might not be explicitly surfaced as export blocker.
- After:
  - `expected_station_set` vs `exported_station_set` check added.
  - Missing stations now produce explicit errors in result payload.

### Proof markers in code
- `cad_export_engine.py` lines around `862`, `864`, `975`.

---

## Task 5 - Simulation route truth + runtime gating

### Root cause
- `/api/simulate` could proceed without strict fail propagation from upstream engines and did not explicitly label precheck-vs-FEA verification ceiling.

### Files changed
- `artifacts/python-api/app/api/routes.py`

### Functions changed
- `_run_core_engines(...)`
- `simulate_roll_forming(...)` route handler

### Before vs after
- Before:
  - Core route path had weaker fail propagation in some downstream steps.
  - `/simulate` did not include explicit verification ceiling for full FEA claims.
- After:
  - Added fail propagation for core stages including roll contour and CAM prep.
  - `/simulate` blocks when no forming passes exist.
  - Response now explicitly labels precheck runtime mode and keeps full-FEA claim as not verified unless `/api/fea/run` solver artifacts exist.

### Proof markers in code
- `routes.py` lines around `129`, `149`, `160`, `1148`, `1253`, `1257`, `1259`.

---

## Commands run (runtime execution attempts)

```powershell
python --version
pnpm --version
node --version
where.exe python
where.exe node
where.exe git
git status --short
```

### Result summary
- `python`: Windows Store alias only; interpreter unavailable.
- `pnpm`: not found.
- `node`: not found.
- `git`: not found.

---

## Runtime proof status

- Runtime execution proof for modified code paths: **NOT VERIFIED in this shell session**.
- Reason: local execution toolchain missing (`python`, `node`, `pnpm`, `git` unavailable).

---

## Final verdict

- **FIXED IN CODE:** yes, for all 5 P0 target areas.
- **RUNTIME VERIFIED:** no (environment blocked).
- **Overall status:** **PARTIALLY FIXED**.

