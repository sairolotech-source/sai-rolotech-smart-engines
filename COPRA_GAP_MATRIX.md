# COPRA vs Sai Rolotech — Detailed 10-Source Gap Matrix (Initial)

**Version:** v2  
**Status:** Internal planning artifact  
**Purpose:** Convert the current COPRA benchmark audit into an execution-ready engineering roadmap.  
**Scope note:** This is an evidence-based planning matrix, not a customer-facing parity claim. Update it after every major feature merge, regression pass, and acceptance review.

## Matrix columns
- **COPRA module / baseline**
- **Sai Rolotech current proven status**
- **Missing capability / proof gap**
- **Codex fix priority**
- **Audit bucket mapping**
- **Acceptance condition**
- **Evidence link / artifact**

## Priority legend
- **P0 (Immediate):** Required for release credibility or competitive baseline
- **P1 (High):** Strong parity improvement
- **P2 (Medium):** Workflow acceleration / maturity
- **P3 (Later):** Optimization / ecosystem expansion

## 10-source gap matrix

| # | COPRA module baseline | Sai Rolotech current proven status | Missing features / proof gaps | Codex fix priority | Audit bucket(s) | Acceptance condition | Evidence link / artifact |
|---|---|---|---|---|---|---|---|
| 1 | **RF Sections core** (open + closed profile workflows) | Commercial profile matrix + machine-aware compatibility proven | Need deeper section-edit workflow parity and profile-parameter completeness across all families | **P1** | 1, 2 | Supported profile families can be edited, revalidated, and exported with no static/manual truth leak | `<path or URL>` |
| 2 | **Parametric spreadsheet-driven updates** | Runtime engine supports machine-aware evaluation | No proven bi-directional spreadsheet/parametric synchronization | **P1** | 1, 2 | Geometry/parameters update downstream flower/tooling/simulation state automatically and reproducibly | `<path or URL>` |
| 3 | **Strip width + springback methods** | Springback-aware direction exists | Need standardized strip-width method options and traceable springback strategy in UI/exports | **P0** | 2, 6 | User can select/see strip-width method and springback method; outputs are visible in report/export | `<path or URL>` |
| 4 | **Punch-hole / perforation editing support** | No proven punch-hole workflow evidence | Missing authoring, validation, and downstream manufacturing checks | **P1** | 1, 7 | Punch/perforation input affects design/export/validation consistently | `<path or URL>` |
| 5 | **Flower design depth** (2D/3D switching, auto updates, forming curves, down-hill logic) | Flower/progression directionally present | Need forming curves, down-hill optimization, and 3D wire-level parity | **P0** | 3 | Benchmark profiles produce 2D/3D flower, forming curves, and down-hill outputs with regression coverage | `<path or URL>` |
| 6 | **SmartRolls-class auto roll design** | Tooling IDs + compatibility + rejection engine proven | Missing near-automatic roll drafting/finalization loop, cloning strategies, and visual final roll workflow | **P0** | 4 | Auto-draft -> review -> finalize workflow exists with auditable constraints and generated roll outputs | `<path or URL>` |
| 7 | **Axis configurator + relocation + roll weight workflow** | Machine-specific process context exists | Missing axis configurator parity, relocation support, and roll weight lifecycle outputs | **P1** | 4, 5 | User can change axis/machine context and regenerate valid tooling/weight outputs | `<path or URL>` |
| 8 | **DTM pre-optimization** (deformation, defect prevention, elongation/diameter awareness) | Precheck direction and constraints are strong | Missing explicit deformation metrics, roll-diameter elongation model, and defect pre-optimization outputs | **P0** | 6, 7 | Pre-optimization panel shows deformation/elongation/risk metrics on benchmark jobs | `<path or URL>` |
| 9 | **Full nonlinear FEA simulation chain** | No solver-backed full FEA parity evidence | Missing elastoplastic solver workflow, FE auto-prep, friction/shaft-deflection models, power/speed estimation | **P0** | 6, 7 | Advanced solver tier produces traceable simulation outputs on representative profiles | `<path or URL>` |
| 10 | **Tube / shaped tube / cage forming + lifecycle tooling database** | Some tube/box support present; machine store exists | Missing tube strategy automation, shaped-tube compression distribution, cage-forming workflow, enterprise reuse/lifecycle DB | **P1** | 4, 5 | Tube/shaped-tube/cage benchmark cases run with traceable tooling lifecycle and reuse workflow | `<path or URL>` |

## Recommended implementation sequence

### P0-A — Smart roll automation MVP
**Goal:** Auto-draft + finalize loop + auditable constraints  
**Buckets:** 4, 7  
**Done when:** Roll drafting, constraint checks, visual review, and finalized outputs all exist with regression tests.

### P0-B — Flower technology depth
**Goal:** Forming curves, down-hill logic, 3D wire model pipeline  
**Bucket:** 3  
**Done when:** Benchmark profiles generate traceable flower artifacts beyond simple staged angle progression.

### P0-C — DTM-like deformation outputs
**Goal:** Deformation, elongation, diameter-aware defect pre-optimization  
**Buckets:** 6, 7  
**Done when:** Precheck panel/report exposes these metrics with tested benchmark outputs.

### P0-D — Simulation split architecture
**Goal:** Separate `Engineering Checks` from `Advanced Solver`  
**Buckets:** 6, 7  
**Done when:** Claims are clearly scoped and solver-backed outputs are separated from heuristic checks.

### P1 — Tube / shaped tube / cage forming + tooling lifecycle
**Goal:** Extend beyond sections into tube strategies and enterprise tooling workflows  
**Buckets:** 4, 5  
**Done when:** Supported tube/shaped-tube/cage cases run with reusable tooling records and lifecycle traceability.

## Customer-safe positioning statement (current)

> Our software is engineering-validated for supported commercial profiles and machine-aware compatibility, but it has not yet reached full COPRA parity in automatic roll design, advanced flower technology depth, and full FEA-backed simulation.

## Remaining risks
- This matrix is planning-ready, not feature-proof by itself.
- Benchmark interpretation relies on public COPRA/DATAM positioning and should be refreshed before external commercial claims.
- Simulation claims remain high-risk until solver-backed outputs are validated on representative profiles and station counts.

## Update rule
Update this document whenever any of the following changes:
- machine-aware compatibility logic
- Top-50 or benchmark profile matrix
- flower engine depth
- roll design automation
- simulation architecture
- tube/cage/lifecycle tooling workflows
