# SAI Rolotech Smart Engines — Professional Roll Forming & CNC Engineering Suite

## ⚡ ACTIVATION CODE: RSB1164
Har session mein user yeh code likhta hai — sab rules activate ho jate hain.

## 🔑 CRITICAL SESSION MEMORY (March 23, 2026 — SAVE POINT)

### Communication Rules
- **ALWAYS Hindi/Urdu** — English technical terms OK but explanation Hindi mein
- User ka naam: SAI Rolotech owner/engineer
- Direct, honest, no flattery, concise answers

### GitHub Repository
- **Repo:** `https://github.com/sairolotech-source/sai-rolotech-smart-engines`
- **Branch:** `main`
- **Auto-Update:** Server har 5 min mein GitHub check karta hai → khud pull + pnpm install karega
- **Push API:** `POST /api/system/git-push` with `Bearer dev-sai-rolotech-2026`

### API Keys & Secrets
- `AI_INTEGRATIONS_GEMINI_API_KEY` — Replit Secrets mein hai (server-side only)
- **AI Provider:** Gemini 2.5 Flash via OpenAI-compatible endpoint (auto-fallback)
- **AI Routes Active:** `/api/ai/chat`, `/api/ai/chatbot/:id`, `/api/ai/analysis/*`, `/api/drawing-vision/*`
- **Offline tokens:** `dev-sai-rolotech-2026`, `offline-sai-rolotech-local`
- **Firebase Project ID:** `roll-forming-tooling-eng`

### Delta 2X CNC Real Tools (from actual SolidCAM TOOLKIT)
- T0208 VNMG 060108 R0.8 rough | T0404 groove | T0606 VNMG 160402 R0.2 finish
- T0808 heavy rough | T1010 detail R0.2 | Shank 25×25mm
- G96 S200/S225, F0.175/F0.08, G92 S500

### JSZip Available (used in RollToolingExportPanel, RollDataFileGenerator)

---

## 📋 FEATURES BUILT (All Working — March 23, 2026)

### Latest Session Features (March 23, 2026 — Session 2)
7. **📺 Demo Video Center** (`demo-videos` tab, Smart Tools section)
   - 13 animated feature walkthroughs with auto-play
   - Covers: Setup, DXF Import, Flower Pattern, Roll Tooling, G-Code, Machine Load, AutoCAD Drawing, Roll Data Files, BUDDY CRM, 3D Visualization, Analysis (9 tools), Safety Checks, 10-Layer Validation
   - Play/Pause, Next/Prev, sidebar navigation, progress bar
   - File: `artifacts/design-tool/src/components/cnc/DemoVideoCenter.tsx`

8. **🔐 Login Screen First** (Auth flow updated)
   - New users/devices: Landing Page → Login → Dashboard → Workspace
   - Returning users (same browser): Auto-login from saved session
   - Offline login via "Enter as Engineer" button
   - Files: `useAuthStore.ts` (initAuth changed), `App.tsx` (auto-login removed)

9. **🖥️ setup.bat Improved** (Windows Auto Setup)
   - Windows Defender auto-exclusion (Run as Admin)
   - Node.js/pnpm check, auto-install, file verification
   - Auto-start both servers + auto-open browser
   - One double-click = everything done

10. **📦 Root `dev` Script** (package.json)
    - `pnpm run dev` now works from root
    - Starts both api-server and design-tool

### Previous Session Features (SAVE POINT)
1. **🤖 BUDDY CRM** (`buddy-crm` tab, System section)
   - AI-powered CRM with 5 agents: BUDDY (coordinator), Lead Scout, WA Bot, Qualifier, Analytics
   - Lead management: Add/Edit/Delete, Status tracking (New→Contacted→Qualified→Demo→Quoted→Won→Lost)
   - AI Score (1-100) per lead, Source tracking, Product interest analytics
   - WhatsApp messaging via wa.me links (bina paid API ke!)
   - 4 message templates (First Contact, Follow Up, Quote Sent, Demo Invite)
   - BUDDY chat interface — ask questions, get CRM reports
   - localStorage persistence
   - File: `artifacts/design-tool/src/components/cnc/BuddyCRMDashboard.tsx`

2. **📄 Roll Data File Generator** (`roll-data-files` tab, Manufacturing section)
   - Per-station SVG files: UP roll / Strip profile / DOWN roll
   - Station list with preview, individual download, ZIP download (all stations)
   - CSV index file included in ZIP
   - Professional drawing with title block, dimensions, specs
   - File: `artifacts/design-tool/src/components/cnc/RollDataFileGenerator.tsx`

3. **⚙️ Machine Load Calculator** (`machine-load-calc` tab, Manufacturing section)
   - 5-section calculator: Forming Force → Motor HP → Gear Ratio → Bearing → Shaft Check
   - Standard motor sizes, standard gear ratios, SKF/FAG bearing catalog, L10 life calculation
   - File: `artifacts/design-tool/src/components/cnc/MachineLoadCalculator.tsx`

4. **📐 AutoCAD Engineering Drawing** (`autocad-engineering-drawing` tab, Design section)
   - Professional A3/A2/A4 sheet, auto-dimensions (linear/radius/angular)
   - Title block, center lines, DXF/PNG export, pan/zoom canvas
   - File: `artifacts/design-tool/src/components/cnc/AutoCADEngineeringDrawing.tsx`

5. **🌸 Flower Pattern Combined** (`flower-combined` tab + `flower` pipeline tab, Simulation section)
   - 3 modes: 2D only, 3D only, Side-by-side split
   - File: `artifacts/design-tool/src/components/cnc/FlowerPatternCombined.tsx`

6. **🔄 GitHub Auto-Update System** (`github-update` tab, System section)
   - Pull/Push/Auto-check system
   - **Server-side auto-update:** Har 5 min GitHub check → auto pull → pnpm install
   - Start/Stop/Force-check controls in UI
   - Live activity log
   - `startAutoUpdate()` called on server boot
   - API: `/api/system/auto-update/start`, `/stop`, `/check-now`, `/status`
   - File: `artifacts/api-server/src/routes/github-update.ts`
   - Frontend: `artifacts/design-tool/src/components/cnc/GitHubUpdatePanel.tsx`

### Previously Built Features (All Working)
- Accuracy Graph Calculator
- SolidCAM Tool Database with Admin Control
- NVIDIA GPU Override
- Windows Build (GitHub Actions)
- Electron Desktop App
- Line → Sheet Converter
- 20-Layer Testing Engine
- Validation Pipeline
- All FormAxis modules (14 specialized + 8 analysis)
- Pro CNC Lathe Simulator
- 5-Axis CAM
- Roll Design Suite (OD, Gap, Pass Compressor)
- Roll Knowledge Hub (Line Flow, Defects, 27 Rules)
- Drawing Vision (Gemini Pro)
- Safety Panel
- ERP Integration
- DXF CAD Viewer
- G-Code Simulator
- FEA Simulation
- Station Control (3-Mode)
- Auto Backup (5 min)
- And 50+ more tabs/features

---

## 🏗️ System Architecture

### Monorepo Structure (pnpm workspace)
```
artifacts/
  api-server/     — Express 5 API (port 8080)
  design-tool/    — React + Vite frontend (port 5000)
  desktop/        — Electron Windows app
  mockup-sandbox/ — Component preview (port 8081)
lib/              — Shared libraries
```

### Key Files
- `artifacts/design-tool/src/pages/Home.tsx` — Main app with all tabs
- `artifacts/design-tool/src/store/useCncStore.ts` — Zustand store + AppTab type
- `artifacts/api-server/src/routes/index.ts` — API router (all routes)
- `artifacts/api-server/src/middleware/auth.ts` — Auth middleware (offline tokens)
- `artifacts/api-server/src/routes/github-update.ts` — GitHub auto-update

### How to Add New Tab
1. Create component in `artifacts/design-tool/src/components/cnc/`
2. In `Home.tsx`: Add lazy import
3. In `useCncStore.ts`: Add to `AppTab` type
4. In `Home.tsx`: Add tab entry in correct section
5. In `Home.tsx`: Add category mapping
6. In `Home.tsx`: Add case in switch statement

### Workflows
- **"Start application"** — Main workflow (runs both api-server + design-tool)
- Secondary workflows (api-server alone, mockup-sandbox) — expected to fail alone

---

## Latest Changes (March 2026 Session)

- **"Replit" naam hata diya** — codebase mein sirf ek code comment tha, wo bhi remove kiya. App fully branded as "SAI Rolotech Engine"
- **Accuracy server error fix** — `useAccuracyScoring.ts` offline-first ho gaya: server unreachable ho to local browser computation se score calculate karta hai — koi error toast nahi aata
- **Server accuracy endpoints fixed** — `accuracy.ts` mein `/accuracy/design-score` aur `/accuracy/:taskType` dynamic routes add kiye gaye
- **Accuracy Graph Calculator** — naya tool `AccuracyGraphView.tsx`: SVG line chart, sub-score bar graph, grade history, CSV export, statistics (min/max/avg/trend), offline-first
- **SolidCAM / SolidWorks FEA / CNC Lathe Pro — har category mein** — Design, Analysis, FormAxis, Quality, Simulation categories mein ab yeh teeno tools directly accessible hain
- **NVIDIA GPU Override** — `gpu-tier.ts` mein manual override system (localStorage) + `HardwareMonitorPanel.tsx` mein full UI (36 GPU models, VRAM, Apply/Reset)

## Windows Build — GitHub Actions

**File:** `.github/workflows/build-windows.yml`

Windows `.exe` installer build karne ke liye GitHub Actions workflow set up hai. Steps:
1. Code GitHub par push karo (Replit Git tab se)
2. GitHub → Actions tab → Build automatically shuru hoti hai (15-20 min)
3. Artifacts section se `.exe` download karo
4. Ya tag `v2.2.0` create karo → GitHub Releases par proper download link milta hai

**Guide:** `GITHUB-BUILD-GUIDE.md` (Hindi mein step-by-step)

Electron desktop app code: `artifacts/desktop/` — API server + frontend dono bundle hain, internet nahi chahiye.

---

## Overview

SAI Rolotech Smart Engines is a pnpm workspace monorepo project developing a professional roll forming machine roll design tool. Its core purpose is to provide engineers with advanced capabilities for roll forming machine design, CNC G-code generation, and engineering calculations.

**Key Capabilities:**
- Power pattern generation with springback compensation.
- CNC G-code output for lathe operations (TurnAxis CAM-level).
- Digital twin visualization and 3D strip forming simulation.
- AI-based defect diagnosis, design analysis, and material/tool recommendations.
- Comprehensive suite of engineering analysis tools (springback, strip width, roll gap, cost estimation).
- Full 3D solid modeling and 2D drafting capabilities.
- Offline-first architecture with hardware acceleration and extensive offline knowledge bases.
- Machine-verified Delta 2X CNC patterns (from actual TAP files: G0→G53→G28 U0.→G28 W0.→M1→T0404()→G92 S500→G96 S200 M4).
- **SolidCAM Production TAP Files Reference (6 files, March 2026):** Real G-code from SolidCAM 2024 SP0.1 for Part5 roll forming roller profiles — D1/D5/D6/D8 variants with T02 (Profile VNMG) and T04 (Profile/Groove). Common pattern: G96 S200 M4 (rough CSS) → G96 S225 M4 (finish CSS), G92 S500 (max RPM), F0.102 (rough) / F0.051 (finish), G2/G3 arcs with R values (R34.5419, R5.5517, R4.7459, R0.8, R2.6273, R3.4849, R0.8003, R1.8, R10.8, R19.2, R58.1352), multi-pass step-down 0.75mm-1.5mm, ZX-ABS offset X=0.6 Z=0.2. Files: `D1_TR_contour.TAP` (324 lines), `D5_TR_contour1.TAP` (594 lines), `130_OD_D6_TOOL_NO_4_TR_contour.TAP` (498 lines), `D6_TR_contour1.TAP` (110 lines), `D8_TOOL_NO_2_TR_contour.TAP` (449 lines), `D8_TOOL_NO_4TR_contour.TAP` (215 lines). All stored in `attached_assets/`.

The project aims to deliver a high-quality, stable, and accurate engineering suite with a premium user experience, incorporating advanced AI features and robust offline functionality to serve the roll forming and CNC engineering domain.

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
    - For reports, use table format.
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

The project is structured as a pnpm workspace monorepo (`artifacts-monorepo`) containing `api-server`, `design-tool`, and `desktop` applications, alongside shared `lib` packages.

**UI/UX Decisions:**
- **Design System:** Premium desktop UI with a deep midnight navy background (`#05060f`), electric amber/orange accents (`#f59e0b`), and cyan highlights (`#06b6d4`). Utilizes glassmorphism panels, subtle borders, and depth shadows, defined via CSS custom properties and utility classes.
- **Navigation:** Sidebar-first architecture with a 52px slim left icon sidebar (`rt-icon-sidebar`) for categories, revealing a 160px tool panel. A 44px slim top bar (`rt-topbar`) displays logo, breadcrumbs, status, and user menu.
- **Typography:** Uses the Inter font with a refined hierarchy (800 for hero, 700 for section headings, 600 for labels, 10px uppercase tracking-widest for panel headers).
- **Interactivity:** Micro-animations (`hover:scale`, `hover:-translate-y-2px`, `transition-all duration-200`), amber glow shadows on primary buttons.
- **Responsiveness:** Laptop-optimized layout for 1280–1440px screens, responsive ribbon for smaller screens.
- **Enhancements:** Figma-quality dashboards, landing page (`/`) for unauthenticated users, shimmer loading, toast notifications, keyboard shortcut overlay, smooth transitions, polished error boundaries, contextual empty states.

**Technical Implementations & Feature Specifications:**
- **DXF/DWG Profile Upload:** Imports profiles with AutoCAD dimension extraction, reference point detection, ellipse support, adaptive spline interpolation, precision segment chaining, and profile analysis.
- **Power Pattern:** Station-by-station bend progression with springback compensation, DIN 6935 K-factor lookup, iterative moment-curvature springback solver, Karnezis forming force model, and calculation confidence intervals.
- **Roll Tooling:** K-factor + neutral axis calculations, per-roll specifications, roll gap calculator, cantilever beam deflection, and ISO 1101 concentricity flagging. Includes Roll Blank Size Calculator, Roll Tooling Calculator, Roll Cutting Safety Calculator (approach/retract distances, raw stock sizing, safety zones, G-code reference, DXF export for CAD editing), and Roll Tool Setup & Collision Checker (3-tool setup with insert/holder selection, collision detection, multi-tool G-code sequencing for Delta CNC 2X).
- **SolidCAM Tool Database:** Full ISO 1832 insert code parser (handles alphanumeric thickness codes like 09T304), 14 ISO insert shapes, 23 holders, 17 carbide grades, cutting data for 12 insert families across 6 ISO material groups (P/M/K/N/S/H), all SolidCAM formulas (RPM/Ra/MRR/Power/Torque/Force/Passes), 12-position turret map, SVG insert preview. **Admin Control System:** Admin/Operator mode toggle, tool lock/unlock, default tool marking, tool nose compensation (G41/G42/off + geometry/wear offsets), tool life management (minutes/pieces/progress bar/reset), tool crib/stock management (quantity/min-stock alerts/location), change log tracking, Lock All/Unlock All/Factory Reset, JSON import/export, full report export. localStorage persistence. **Factory tools loaded from actual SolidCAM TOOLKIT (VERIFIED from screenshots):** T02 VNMG 160408 Profile (Ext. Turning, R0.8, Dir R, F0.175), T04 VNMG 060108 Groove (Ext. Grooving, R0.8, Lead A 90deg, Dir R, F0.102/F0.051), T06 VNMG 160402 Profile (Ext. Turning, R0.2, Lead J 93deg, Dir L, M=32 N=45), T08 VNMG 060108 Profile (Ext. Turning, R0.8, Lead A 90deg, Dir R, M=25 N=25, F0.102/F0.051), T10 VNMG 160402 Profile (Ext. Grooving holder, R0.2, Lead L 95deg, Dir L, M=32 N=23, F2.5/F1.25). All inserts V(35deg), Clamp C, Shank 25x25mm, Length M(150mm). T02 full SolidCAM settings: TR_contour operation, Rough Smooth step 0.75 Adaptive, Offset X=0.6 Z=0.2, Finish ISO-Turning Rest material only, Strategies Descending motions, Geometry Start ext 0 End ext 10 Tangential.
- **3D Visualization:** `Studio3DView` uses Three.js/React Three Fiber for a unified 1 Three.js unit = 1mm scale system. Features include 3D strip forming visualization with stress/strain approximation, animated strip mesh, playback controls, and camera follow mode. `RollFormingViewport3D` specifically renders roll forming machine components.
- **Hardware Acceleration:** `src/lib/hardware-engine.ts` detects system specs, creates a Web Worker pool for heavy calculations (FEA, springback, forming force), and offloads computations to parallel threads. Adaptive 3D quality based on GPU tier.
- **CNC G-Code:** Generates lathe G-code (TurnAxis CAM-level) with adaptive chord tolerance, G71/G70 cycles, feed rate ramping, G50/G92/G96 CSS, rest machining, tool wear offsets, toolpath optimization, and multi-controller post-processors (Fanuc, Siemens, Haas, Mitsubishi, Delta 2X, etc.). Supports G-code split (RAW + FINAL). Includes Pro CNC Lathe Simulator.
- **5-Axis CAM:** Advanced modules for 3+2 positional milling, 5-axis simultaneous roughing/finishing, swarf cutting, and multi-axis turning.
- **Digital Twin:** Machine side-view SVG with animated strip flow, rolls, pass line, and station detail.
- **Smart Defect Diagnosis:** 12 defect types with station-specific numeric corrections based on machine data.
- **AI Integration:** GPT-4o-mini powered AI for design analysis, G-code optimization, power pattern advising, material/tool recommendations, and a Master Designer Chatbot. Open/Closed Section AI Model Selector for routing projects.
- **Offline AI & Resilience:** Extensive offline knowledge base (`src/lib/offline-ai-kb-expanded.ts`, `artifacts/api-server/src/lib/offline-knowledge-base.ts`) with TF-IDF engine and 50+ expert domains (springback 22 materials, r/t ratios, 6 design rules, 4 pass phases, 8 defect diagnoses, 5 roll types, production rate/OEE, DIN EN 10162 tolerances, machine frame design, coil/decoiler guide, Hindi general support). Context-aware scoring uses last 4 user messages as context clues (10% boost only — never overrides direct match). Smart fallback covers 12 topic patterns for free-form queries. Offline-first architecture with `safeFetchWithCache()`, offline queue for write operations, and `OfflineGuard` component. **Bug fixed (2026-03-22):** Context history contamination fixed by (1) filtering only user messages from memory (not assistant responses), and (2) reducing context boost multiplier 0.4→0.1 to prevent past conversations from overriding direct query matching.
- **Auto Backup System:** Auto-saves project state to localStorage every 5 minutes with smart change detection and 50 backup slots.
- **Validation Pipeline:** 5-layer validation (Geometry, Flower Pattern, Roll Tooling, G-Code, AI Review) with strict 100% gates.
- **BOM Generator:** Generates comprehensive Bill of Materials for roll forming lines and machines.
- **3D Solid Modeling:** Parametric solid modeling kernel with Boolean CSG, Revolve, Sweep, Loft, Shell, Fillet, Chamfer operations, feature tree, and STL/STEP export.
- **2D Drafting Tools:** AutoCAD-level manual drawing environment with hatching, editing commands (Trim, Extend, Fillet, Chamfer, Array), block/symbol library, multiline text, dimension styles, and print/plot layout.
- **Line → Sheet Converter** (`artifacts/design-tool/src/components/cnc/LineToSheetView.tsx`): AutoCAD-style canvas tool — click to draw polylines (profile cross-section), snap-to-grid, zoom/pan. Auto-calculates flat blank width (sum of all segment lengths), weight, area. DXF import (extract LINE entities), DXF export (flat_blank.dxf). Segment table with live dimensions. Material selector (CR/GI/SS304/AL5052/AL6061/HSLA350/CU110) + thickness + piece length inputs. Registered under Design panel as "Line → Sheet Converter".
- **FormAxis RF 2025 Specialized Modules:** 14 specialized modules for various roll forming applications (RF Tubes, SmartRolls, RF DTM, CageForming, etc.).
- **FormAxis Analysis Suite:** 8 analysis modules including 3D strip forming visualization, springback prediction, strip width calculator, roll gap analysis, production cost estimator, camber prediction, forming energy analysis, and a comprehensive material database.
- **20-Layer Testing Engine:** Offline validation across 20 levels (Data Integrity, Geometry, Bend Accuracy, G-Code Safety, etc.).
- **Desktop App (Electron):** Windows Electron app with GPU acceleration, worker threads, adaptive 3D quality, and auto-updater.

**Monorepo Structure:**
- `artifacts/api-server`: Express 5 API server, handling DXF parsing, power pattern, roll tooling, and G-code generation.
- `artifacts/design-tool`: React + Vite frontend, serving the main UI, 3D Studio, and workflow.
- `artifacts/desktop`: Electron desktop application for Windows.
- `lib/`: Shared libraries including API specifications, generated API clients, Drizzle ORM setup, and common utilities.

## External Dependencies

- **Authentication:** Firebase Auth (frontend)
- **Database:** PostgreSQL (via Drizzle ORM)
- **3D Graphics:** Three.js, React Three Fiber (`@react-three/fiber`, `@react-three/drei`)
- **UI Framework/State Management:** React, Zustand
- **API Framework:** Express 5
- **Package Management:** pnpm
- **Build Tools:** Vite, esbuild
- **TypeScript Tools:** Zod (`zod/v4`), Drizzle Kit, Orval (for OpenAPI spec generation)
- **PDF Generation:** jspdf (for professional PDF reports)
- **Mapping:** Konva (for 2D canvas visualizations)
- **G-Code Parsing/Generation:** Custom `dxf-parser`, `jszip`, `jose`
- **AI APIs:** Replit AI Integration (GPT-4o-mini, no personal API key needed), Gemini Flash, Claude Haiku, OpenRouter Llama, SambaNova Llama, Kimi Moonshot, NVIDIA Llama 3.1, GPT-5 Mini (all free tier)
- **Cloud Services:** Google Drive API (for backup and Sheets export)
- **Electron:** (for desktop application)
