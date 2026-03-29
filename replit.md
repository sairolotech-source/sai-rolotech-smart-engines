# SAI Rolotech Smart Engines — Professional Roll Forming & CNC Engineering Suite

## Overview

SAI Rolotech Smart Engines is a pnpm workspace monorepo project developing an advanced roll forming machine roll design tool. It provides engineers with capabilities for roll forming machine design, CNC G-code generation, and engineering calculations. The project aims to deliver a high-quality, stable, and accurate engineering suite with a premium user experience, incorporating advanced AI features and robust offline functionality for the roll forming and CNC engineering domain.

**Key Capabilities:**
- Power pattern generation with springback compensation.
- CNC G-code output for lathe operations.
- Digital twin visualization and 3D strip forming simulation.
- AI-based defect diagnosis, design analysis, and material/tool recommendations.
- Comprehensive suite of engineering analysis tools (springback, strip width, roll gap, cost estimation).
- Full 3D solid modeling and 2D drafting capabilities.
- Offline-first architecture with hardware acceleration and extensive offline knowledge bases.
- Machine-verified CNC patterns.

## User Preferences

- **Communication:** Always communicate in Hindi/Urdu. English technical terms are acceptable, but explanations must be in Hindi/Urdu. Be direct, avoid lengthy introductions, and be honest about problems.
- **Workflow & Quality:**
    - Test code changes thoroughly, especially API tests, before declaring completion.
    - Fully fix bugs upon discovery; do not leave them incomplete.
    - Update `replit.md` after every significant task to ensure memory persistence.
    - Prioritize stability: new features should not break existing functionality.
    - Always check interface fields by reading the file; do not assume their structure.
    - Strive for 98% quality on all tasks; below this, a task is considered incomplete.
    - Provide concrete proof (e.g., HTTP 200, output screenshots) for task completion.
    - Address one task at a time and verify it before moving to the next.
    - If a solution fails twice, be prepared to rewrite it from scratch.
    - Start new sessions by stating "RSB1164" to activate all rules.
    - Be direct when pointing out errors; accept feedback immediately.
    - Be honest about self-assessment and quality scores.
- **Interaction Style:**
    - For ambiguous tasks, ask clarifying questions before proceeding.
    - Prefer specific instructions over vague requests.
    - Provide concise answers to simple questions (3-5 lines).
    - For technical tasks, provide steps and proof.
    - For any file edit, ensure the file is read first using `read()` tool.
    - When changing a file, check for dependent files, function signature changes, and build errors.
    - Apply the minimum change principle: only modify necessary lines.
    - Understand errors 100% before attempting a fix.
    - Run tools in parallel if they are not dependent.
- **Working Preferences:**
    - Do not assume file contents without reading them.
    - Do not declare completion without actual API or browser tests.
    - Do not break existing functionality while fixing another.
    - Do not rewrite entire files for minor fixes.
    - Do not attempt fixes without understanding the error.
    - Do not start a session without checking the production server.
    - Do not give long responses when short ones are appropriate.
    - Do not run tools serially if they can run in parallel.
    - Do not start ambiguous tasks without clarification.
    - Do not forget to update `replit.md` after major tasks.
    - Do not make changes to files related to Dev bypass or Dev-only test harnesses.

## System Architecture

The project is structured as a pnpm workspace monorepo with `api-server`, `design-tool`, and `desktop` applications, and shared `lib` packages. It features a robust Python FastAPI server for engineering computations.

**UI/UX Decisions:**
- **Design System:** Premium desktop UI with a deep midnight navy background, electric amber/orange accents, cyan highlights, glassmorphism panels, and subtle depth.
- **Navigation:** Sidebar-first with an expanding tool panel; a slim top bar for branding and controls.
- **Typography:** Inter font with a refined hierarchy.
- **Interactivity:** Micro-animations and amber glow shadows on primary buttons.
- **Responsiveness:** Laptop-optimized with a responsive ribbon for smaller screens.
- **Enhancements:** Figma-quality dashboards, shimmer loading, toast notifications, keyboard shortcut overlay, smooth transitions, polished error boundaries, contextual empty states.
- **Theming:** Supports Dark/Light theme toggling.
- **User Roles:** Implements a user role system (`admin`, `engineer`, `viewer`) with action-based access control.

**Technical Implementations & Feature Specifications:**
- **DXF/DWG Profile Upload:** Imports profiles with AutoCAD dimension extraction, reference point detection, and spline interpolation.
- **Power Pattern:** Station-by-station bend progression with springback compensation, K-factor lookup, and iterative solvers.
- **Roll Tooling:** K-factor + neutral axis calculations, per-roll specifications, roll gap calculator, and cantilever beam deflection.
- **SolidCAM Tool Database:** ISO 1832 insert code parser with cutting data and SVG insert preview, managed via Admin Control System.
- **3D Visualization:** Uses Three.js/React Three Fiber for 3D strip forming visualization with stress/strain approximation and animated mesh.
- **Hardware Acceleration:** Leverages Web Workers for heavy calculations.
- **CNC G-Code:** Generates lathe G-code with adaptive chord tolerance, G71/G70 cycles, feed rate ramping, and multi-controller post-processors, including a Pro CNC Lathe Simulator. Includes advanced 5-axis CAM modules.
- **Digital Twin:** Machine side-view SVG with animated strip flow, rolls, and station detail.
- **Smart Defect Diagnosis:** Identifies 12 defect types with station-specific numeric corrections.
- **AI Integration:** GPT-4o-mini powered AI for design analysis, G-code optimization, power pattern advising, material/tool recommendations, and a Master Designer Chatbot, using live project data context.
- **Offline AI & Resilience:** Extensive offline knowledge base (TF-IDF engine) and an offline-first architecture with caching and an offline queue.
- **Auto Backup System:** Auto-saves project state to localStorage every 5 minutes with smart change detection.
- **Validation Pipeline:** 5-layer validation (Geometry, Flower Pattern, Roll Tooling, G-Code, AI Review) with strict gates.
- **BOM Generator:** Generates comprehensive Bill of Materials.
- **3D Solid Modeling:** Parametric solid modeling kernel with Boolean CSG operations and STL/STEP export.
- **2D Drafting Tools:** AutoCAD-level manual drawing environment with hatching, editing commands, and print/plot layout.
- **Line → Sheet Converter:** AutoCAD-style canvas tool to calculate flat blank width, weight, and area.
- **Specialized Engineering Engines:** Includes Thickness Range, Geometry Recognition, Pass Angle, Engineering Formula Calculator, Design Rule, Defect Prediction, and Machine Fitment engines.
- **AI Ultra Validation System:** Injects comprehensive rule sets into AI system prompts to enforce engineering standards and safety.
- **Production Build Serving:** API Server serves gzipped production-built frontend with immutable cache headers.
- **Critical Chunk Splitting:** Lazy loading of large dependencies to reduce initial bundle size.
- **Staged Loading Architecture:** Multi-stage deferred loading prevents crashes/hangs on weaker devices by progressively loading components and heavy stores on demand.
- **SW Recovery System:** A recovery page at `/` clears stale Service Workers and CacheStorage before redirecting to the app, with a self-destructing `sw.js` to ensure clean updates.
- **Python FastAPI Server:** Runs at `artifacts/python-api/` with a modular architecture of 17 distinct engineering engines, providing endpoints for auto/manual mode calculations, DXF upload, semi-auto confirmation, PDF export, and debugging. Features an Accuracy Control System for confidence scoring and automated review mode determination (Auto, Semi Auto, Manual Review).
- **Phase 3 Simulation Upgrades (RollFormingSimulator.tsx + stationLogicEngine.ts):** (1) Animation speed control — slow/normal/fast (400ms–1600ms). (2) Workflow Chain panel (toggle) — 6-step "Input Profile → Developed Strip → Flower → Station Geometry → Roll Contour → Roll Drawing" live chain with active step highlighted. (3) Station Logic Explanation Box — auto-generates "Purpose / Forming / Next station / Technical note / Risk / What-if-removed" for every pass. (4) Manufacturability Warnings panel — checks gap too tight/loose, excessive angle increment, large depth ratio, high strain, thin wall, angle reversal, narrow face. (5) Contact-point red dots on flower diagram — detects bend vertices algorithmically. (6) Bend completion annotation on flower SVG — "X% formed · Y° remaining". (7) Basic/Engineering/Manufacturing drawing modes in RollDrawingPanel with mode info banners and mode-specific detail panels (Basic: 8-field summary; Manufacturing: tolerances, part number, material spec, machining note). (8) Contact-point highlights in CrossSectionView — red dots at upper/lower roll contact points + neutral zone shading. (9) **Standard color scheme enforced**: strip=gold, upper roll=blue (#3b82f6), lower roll=green (#22c55e), current stage=stage_color (orange for progressive), final profile=red dashed (#ef4444), centerline=grey dashed. (10) **Flower dimension overlay** — active station shows θ angle + width delta (mm), faded stations show "S1/S2..." labels. (11) **Smart Design Assistant** panel — recommends station count, OD, bore, face width, gap; shows bend distribution bar; risky stations list; calibration pass check. (12) **One-click Full Production Set** button (amber gradient, prominent) — "📦 Download Full Production Set — All N Stations (SVG+DXF+PDF+Manifest)" replaces the plain ZIP row.
- **Phase 2 Roll Drawing Export Engine (`artifacts/design-tool/src/lib/rollDrawingExport.ts`):** Production-grade modular export architecture. Provides: `DrawingModel` normalized data layer, `validateDrawingModel()` pre-export gate, `renderDrawingToSVG()` (A3 3-view engineering drawing), `renderDrawingToDXF()` (R12 ASCII, 6 layers: OUTLINE/ROLL_PROFILE/STRIP/CENTERLINE/ANNOTATION/CONSTRUCTION), `printSinglePDF()`, `printAllStationsPDF()` (multi-page A3), `buildZipPackage()` (structured folders: svg/ dxf/ manifest/ readme/), `buildExportManifest()` (JSON traceability), `buildExportSummaryTxt()` (human-readable), `generateFileName()` (deterministic naming: `srt-roll-tooling-{profile}-station-{N}-{rev}.{ext}`). **Manufacturing Release Mode**: 4 states (Draft → Internal Review → Shop Drawing → Manufacturing Release) with Checked By / Approved By fields; manufacturing release blocked without both fields. Thin-wall warning if wall < 15mm. Springback shown in all exported drawings and SVGs.
- **Phase 4 P2 Session-2 Upgrades (v2.4.0):** (1) **Persistent Audit Log Backend** — `POST /api/audit-log` (write) + `GET /api/audit-log` (read) + `DELETE /api/audit-log` (admin-clear); file-based JSON storage at `artifacts/api-server/data/audit-log.json`; max 2000 entries with rotation; `useAuditLog()` hook upgraded with fire-and-forget backend sync, backend/local sync indicator (`Cloud`/`WifiOff`), synced status per entry, backend history merged on mount; `backendOk` state propagated to `AuditLogPanel`. (2) **RBAC Backend Middleware** — `artifacts/api-server/src/middleware/rbac.ts` — 5-role offline token registry (`admin-srtool-1164`/`designer-srtool-1164`/`checker-srtool-1164`/`approver-srtool-1164`/`viewer-srtool-1164` + backward compat tokens), `injectRbacUser` middleware (reads Bearer token + `X-User-Role` header), `requireRole()` / `requirePermission()` middleware factories, `ROLE_PERMISSIONS` map for canEdit/canExport/canCheck/canApprove/canSupersede/canAdmin/canViewAudit; `/api/rbac/info` (role capabilities + token list) + `/api/rbac/me` (current user) + `/api/rbac/verify` (token check) endpoints. (3) **Roll Interference Visual Indicator** — `InterferenceWarningPanel.tsx` — reads `roll_interference_engine` pipeline response; shows station-level clash badges, severity colors (red=blocking/orange=warning), recommended engineering fixes (OD clash / bore interference / strip width), expandable per-issue view, No-Interference green badge; wired from `pipelineResult.roll_interference_engine` via `PythonDashboard.tsx → RollDrawingPanel.tsx`; shown only when interference data present. (4) **ISO 7200 Title Block + Customer/Job fields** — `DrawingModel` extended with `companyName`, `customerName`, `jobNo`, `projectName`, `partNo`, `sheetNo`, `totalSheets`, `drawingScale`; `buildDrawingModel()` upgraded with ISO 7200 drawing number generator format `SRT-{custCode}-{jobCode}-{profileTag}-ST{nn}-{rev}`; SVG title block fully redesigned — company header strip ("SAI ROLOTECH PVT. LTD.") + ISO 7200/AS 1100.301 stamps + 8-row grid with Customer/Job+Project/Material+Stage/Rev+Date/Checked/Approved/Scale+Sheet; PDF/manifest export table updated with Customer/Job/Project/Sheet fields; 3 input fields (Customer / Job No. / Project) added to RollDrawingPanel with live drawing number preview; DXF export draws number auto-generated from ISO format.
- **Phase 4 P2 Upgrades (v2.4.0):** (1) **RBAC + Manufacturing Approval Workflow** (`artifacts/design-tool/src/lib/roleSystem.ts`) — 5 roles (Admin/Designer/Checker/Approver/Viewer), 5 states (Draft/Under Review/Checked/Approved for Manufacturing/Superseded), transition rules, release gate validator (blocks release if revision=R0, OD/bore/face width/keyway missing, checkedBy/approvedBy missing), approval history with timestamp+actor+note, localStorage persistence; `RoleGatePanel.tsx` integrated into RollDrawingPanel — state syncs to legacy `ReleaseState`. (2) **Deformation Predictor Engine** (`artifacts/python-api/app/engines/deformation_predictor_engine.py`) — 5 functions: `predict_bow_camber()` [Formula+Rule+Estimate], `predict_edge_wave_risk()` [Formula+Rule], `predict_wrinkling_risk()` [Rule+Table], `calculate_station_aggressiveness()` [Formula+Rule], `generate_deformation_prediction_report()` — full pass-by-pass predictions; new API endpoint `POST /api/deformation-predict`; `DeformationPredictorPanel.tsx` with Overview/Heatmap/Actions tabs integrated into RollFormingSimulator. (3) **DXF R2000 Modernization** — upgraded from AC1006→AC1015 (R2000), added LTYPE table with CONTINUOUS/CENTER/DASHED linetypes, $DWGCODEPAGE/$LUNITS/$MEASUREMENT/$AUNITS header vars, POLYLINE+VERTEX+SEQEND → LWPOLYLINE (modern compact form). (4) **Benchmark Validation Dashboard** (`BenchmarkValidationPanel.tsx`) — runs all 5 profiles through both Risk + Deformation APIs simultaneously, shows score/level/worst-mode/calibration/confidence/API-time per profile. (5) **Export Regression Test Suite** (`test_export_regression.py`) — DXF structural validator, all 5 benchmarks through risk+deformation engines; 97/97 total tests pass (54 original + 24 deformation + 19 export regression).
- **Phase 4 Quality Upgrades (v2.4.0):** (1) **Engineering Risk Engine** (`artifacts/python-api/app/engines/engineering_risk_engine.py`) — 7 risk functions: `calculate_bend_severity_index()` [Formula+Rule], `check_edge_buckling_risk()` [Rule], `check_twist_risk()` [Rule], `estimate_calibration_need()` [Table+Rule], `calculate_deformation_confidence()` [Estimate], `check_over_compression()` [Rule], `generate_engineering_risk_report()` — full sequence analysis. All values labeled with method ([Formula]/[Rule]/[Estimate]/[Table]). NOT FEA. (2) **API Endpoint** `POST /api/engineering-risk` — full risk report from pass sequence. (3) **Python Test Suite** (`artifacts/python-api/tests/`) — 54 tests across 3 test files: `test_engineering_risk_engine.py`, `test_simulation_engine.py`, `test_springback_engine.py`; `conftest.py` with 5 benchmark profiles (170×50×3 MS, 100×40×1.2 GI, 250×75×2 SS, 60×25×0.8 CR, stress case). All 54 tests pass. (4) **EngineeringRiskPanel** (`artifacts/design-tool/src/components/python-dashboard/EngineeringRiskPanel.tsx`) — per-station severity bars, twist risk, calibration urgency, confidence score, recommendations — integrated into RollFormingSimulator. (5) **HelpTooltip** (`artifacts/design-tool/src/components/ui/HelpTooltip.tsx`) — inline "?" help with title, body, method badge ([Formula]/[Rule]/[Estimate]/[Table]), range, example. (6) **AuditLog** (`artifacts/design-tool/src/components/ui/AuditLog.tsx`) — `useAuditLog()` hook + `AuditLogPanel` component; logs all export actions (SVG/DXF/PDF/ZIP) with timestamp, filename, station — integrated into RollDrawingPanel. (7) **Calculation Source Labels** in stationLogicEngine.ts — `sources[]` array on StationExplanation with [Formula], [Rule], [Estimate], [Table] labels per value.

- **Production Readiness Layer (v2.2.23) — 97% Audit Features:**
  - **AGENTS.md** — Repo-root Codex discipline file: truthfulness rules, null-safety contracts, export gate rules, springback rules, material-aware warning criteria, operator action suggestion logic, 8 audit buckets, station readiness matrix, tech-stack rules.
  - **Export Preflight Modal** (`ExportPreflightModal.tsx`) — 5-count summary dashboard (Total/Complete/Incomplete/No Profile/Blocked), per-station expandable rows with 6 root-cause checks (Roll Profile / Geometry Synthesis / Bend Extraction / Flower Pass Data / Calibration Data / G-Code Output), BLOCKER/WARNING banners, Regenerate Incomplete + Export Package actions; wired into CompletePackagePanel Export tab.
  - **Regenerate Incomplete Stations** — `handleRegenerateIncomplete` in LeftPanel.tsx (uses `validateStationProfiles`) and standalone in RollToolingView.tsx (uses `apiGenerateRollTooling` directly); "⟳ Regenerate N Incomplete" button shown only when incomplete stations exist.
  - **Collision/Interference Overlay** (`InterferenceWarningPanel` in DigitalTwinView.tsx) — 3 severity levels (CLASH ≤0mm, CRITICAL <thickness×5%, TIGHT <thickness×50%); per-station gap badges; hides when no issues.
  - **PassAngleMiniChart with Overbend Mode** (in RollToolingView.tsx) — material springback badge (+X%), toggle between "Target angle" and "Overbend (×factor)" views, per-bend overbend table (B1: X° → Y°), color-coded bars; `springbackFactor` and `materialType` passed from store through `StationRollPair`.
  - **GcodeSafetyChecker** (`GcodeSafetyChecker.tsx`) — score/100, Critical/Warning/Info per-issue, file drag-drop, fix suggestions; backend `/api/gcode-safety-check` route.
  - **Operator Next Step Panel** (in LeftPanel.tsx) — live 4-step pipeline progress indicator (Profile → Flower → Tooling → G-Code); shows current incomplete step with exact action label; amber progress pills per step; green "Package Ready" state when all complete; watches `stations`, `rollTooling`, `gcodeOutputs` from store.

## External Dependencies

- **Authentication:** Offline Token Auth
- **Database:** PostgreSQL (via Drizzle ORM)
- **3D Graphics:** Three.js, React Three Fiber (`@react-three/fiber`, `@react-three/drei`)
- **UI Framework/State Management:** React, Zustand
- **API Framework:** Express 5, FastAPI
- **Package Management:** pnpm
- **Build Tools:** Vite, esbuild
- **TypeScript Tools:** Zod, Drizzle Kit, Orval
- **PDF Generation:** jspdf, ReportLab (Python)
- **Mapping:** Konva
- **G-Code Parsing/Generation:** Custom `dxf-parser`, `jszip`, `jose`
- **AI APIs:** Replit AI Integration (GPT-4o-mini), Gemini Flash, Claude Haiku, OpenRouter Llama, SambaNova Llama, Kimi Moonshot, NVIDIA Llama 3.1, GPT-5 Mini
- **Cloud Services:** Google Drive API
- **Desktop Application Framework:** Electron