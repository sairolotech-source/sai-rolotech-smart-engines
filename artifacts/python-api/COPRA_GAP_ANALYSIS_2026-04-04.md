# COPRA vs Sai Rolotech - Code-Evidence Gap Analysis

**Date:** 2026-04-04  
**Mode:** Strict no-fake audit (source inspection only)  
**Runtime status for this report:** **NOT VERIFIED** in this shell session (no executable Python runtime available)

---

## 1) Scope and guardrails

This report compares the current repository capabilities against the COPRA feature baseline shared by the team.

What this report **does**:
- Uses current code paths and API routes as evidence.
- Marks each module as `Implemented in Code`, `Partial`, or `Not Verified`.
- Separates architecture readiness from runtime proof.

What this report **does not** do:
- Does not claim production parity with COPRA.
- Does not claim 99% accuracy.
- Does not claim solver-verified FEA outputs were produced in this session.

---

## 2) Module-by-module gap matrix

| COPRA-class capability | Current repo evidence | Current status | Gap to close |
|---|---|---|---|
| End-to-end workflow (profile -> flower -> tooling -> simulation -> exports) | Core chain assembled in `app/api/routes.py` via `_run_core_pipeline` and downstream engines (`advanced_flower`, `roll_contour`, `cam_prep`, `cad_export`) | **Partial** | Runtime proof package still needed for full chain on representative profiles |
| Parametric flower system with station updates | `advanced_flower_engine.py` builds `pass_plan` with per-bend progression + 3D centerline (`build_pass_plan`, `compute_3d_flower_centerline`); `roll_contour_engine.py` now consumes flower pass plan (`_extract_flower_angle_schedule`) | **Implemented in Code** | Need runtime traces showing pass-plan edits propagate through CAD/export outputs |
| Smart contour-driven roll tooling (not placeholder cylinders) | `roll_contour_engine.py` emits top/bottom contours per station; `cad_export_engine.py` merges contour payload via `_build_export_rolls` and overlays contours in DXF | **Implemented in Code** | STEP path still has fallback to legacy cylinder mode when CadQuery unavailable |
| Full roll dimensioning + assembly output | `roll_design_calc_engine.py` OD derives from geometry + station/shaft context; `cam_prep_engine.py` derives station dimensions from contours; `cad_export_engine.py` outputs roll/shaft/assembly DXF | **Partial** | Need validation against known tooling references and measured deviations |
| Real FEA simulation (nonlinear elastoplastic, solver-backed) | `engines/fea/*` pipeline exists (`run_fea_pipeline`) with deck generation, solver adapter, result import; explicit `EXTERNAL_SOLVER_REQUIRED` path when solver missing | **Partial** | Solver runtime proof required (`ccx`/`abaqus`) with real solved passes and imported results |
| Machine and production planning (line setup, process docs) | `machine_layout_engine.py`, `process_card_engine.py`, `bom_engine.py`, related API endpoints in `routes.py` | **Implemented in Code** | Needs integrated runtime package proof (BOM + process card + machine constraints from same run) |
| Material and tooling databases + persistence | `utils/material_database.py`, `utils/tooling_library.py`, `utils/project_persistence.py`, and project/tooling endpoints in `routes.py` | **Implemented in Code** | Centralized enterprise DB / lifecycle analytics still limited (file-based project persistence) |
| Quality control scanning / metrology feedback loop | No scanner/measurement ingestion route found in `app/api/routes.py`; only risk/consistency heuristics and notes | **Gap (Not Implemented)** | Add scan ingestion + deviation comparison engine + tolerance signoff workflow |
| Advanced extras (punch-hole editor, laminate/coating simulation, deep CAD integrations) | SolidWorks/SolidCAM handoff appears in export metadata; no robust punch/coating simulation path found in backend engines/routes | **Gap (Partial at best)** | Implement dedicated punch/perforation/coating modules with downstream tooling/simulation effects |

---

## 3) Evidence anchors (source locations)

- Core API orchestration and engine inventory:
  - `artifacts/python-api/app/api/routes.py` (imports and `_run_core_pipeline`; health lists 30 engines)
- Flower engine and pass plan:
  - `artifacts/python-api/app/engines/advanced_flower_engine.py`
- Flower -> contour connection:
  - `artifacts/python-api/app/engines/roll_contour_engine.py` (`_extract_flower_angle_schedule`, `angle_schedule_source`, `flower_pass_plan_used`)
- Contour-driven CAD export + DWG truth gate:
  - `artifacts/python-api/app/engines/cad_export_engine.py` (`_build_export_rolls`, contour overlays, STEP mode counts, `dwg_export_supported: False`)
- Derived OD and station dimensions:
  - `artifacts/python-api/app/engines/roll_design_calc_engine.py`
  - `artifacts/python-api/app/engines/cam_prep_engine.py`
- FEA architecture and solver-required behavior:
  - `artifacts/python-api/app/engines/fea/fea_pipeline.py`
  - `artifacts/python-api/app/engines/fea/fea_routes.py`
- Material/tooling/persistence:
  - `artifacts/python-api/app/utils/material_database.py`
  - `artifacts/python-api/app/utils/tooling_library.py`
  - `artifacts/python-api/app/utils/project_persistence.py`
- OSS CAD stack status endpoint:
  - `artifacts/python-api/app/engines/oss_cad_stack_engine.py`
  - `artifacts/python-api/app/api/routes.py` (`/api/cad-stack/status`, `/api/cad-stack/architecture`)

---

## 4) Honest current verdict

- **Engineering direction:** strong and improving.
- **COPRA-equivalent claim:** **NOT VERIFIED**.
- **Most critical open proof gaps:** solver-backed FEA runtime evidence, metrology/scan-based deviation loop, and production-grade contour validation against benchmark references.

---

## 5) Priority execution roadmap (next)

### P0 (immediate)
1. Run runtime proof for Phase 1B contour-driven pipeline (flower -> contour -> CAD artifacts).
2. Execute solver-backed FEA run via `/api/fea/run` with stored outputs and parser import.
3. Build station-wise deviation report (target vs generated contours) for at least 5 hard profiles.

### P1 (high)
1. Add quality/metrology ingestion API (profile scan + roll scan + deviation scoring).
2. Promote contour-based STEP generation to default (remove legacy cylinder fallback from main path where possible).
3. Add explicit unsupported markers for punch/coating workflows until implemented.

### P2 (medium)
1. Upgrade persistence from file-only workflows to stronger indexed data layer for lifecycle analytics.
2. Expand CAD stack usage proof (CadQuery/OCP/PyVista/trimesh) with runtime module availability matrix.

---

## 6) Acceptance gates for future claims

Use this gate for every COPRA-class claim:

- If only code exists -> `PARTIAL`.
- If runtime not proven with artifacts -> `NOT VERIFIED`.
- If solver path not executed but called "FEA done" -> `FAILED`.
- If DWG claimed without true writer/backend + file proof -> `FAILED`.

