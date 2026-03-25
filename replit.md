# SAI Rolotech Smart Engines — Professional Roll Forming & CNC Engineering Suite

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
- Machine-verified Delta 2X CNC patterns from actual SolidCAM production TAP files.

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

The project is structured as a pnpm workspace monorepo containing `api-server`, `design-tool`, and `desktop` applications, alongside shared `lib` packages.

**UI/UX Decisions:**
- **Design System:** Premium desktop UI with a deep midnight navy background, electric amber/orange accents, and cyan highlights. Utilizes glassmorphism panels, subtle borders, and depth shadows.
- **Navigation:** Sidebar-first architecture with a slim left icon sidebar for categories, revealing a tool panel. A slim top bar displays logo, breadcrumbs, status, and user menu.
- **Typography:** Uses the Inter font with a refined hierarchy.
- **Interactivity:** Micro-animations and amber glow shadows on primary buttons.
- **Responsiveness:** Laptop-optimized layout with a responsive ribbon for smaller screens.
- **Enhancements:** Figma-quality dashboards, shimmer loading, toast notifications, keyboard shortcut overlay, smooth transitions, polished error boundaries, contextual empty states.

**Technical Implementations & Feature Specifications:**
- **DXF/DWG Profile Upload:** Imports profiles with AutoCAD dimension extraction, reference point detection, ellipse support, and adaptive spline interpolation.
- **Power Pattern:** Station-by-station bend progression with springback compensation, DIN 6935 K-factor lookup, iterative springback solver, and Karnezis forming force model.
- **Roll Tooling:** K-factor + neutral axis calculations, per-roll specifications, roll gap calculator, cantilever beam deflection, and ISO 1101 concentricity flagging. Includes Roll Blank Size Calculator, Roll Tooling Calculator, Roll Cutting Safety Calculator, and Roll Tool Setup & Collision Checker.
- **SolidCAM Tool Database:** Full ISO 1832 insert code parser, cutting data for 12 insert families, all SolidCAM formulas, 12-position turret map, and SVG insert preview. Features an Admin Control System for tool management and persistence.
- **3D Visualization:** Uses Three.js/React Three Fiber for 3D strip forming visualization with stress/strain approximation, animated strip mesh, and camera follow mode.
- **Hardware Acceleration:** Detects system specs, creates a Web Worker pool for heavy calculations, and offloads computations to parallel threads.
- **CNC G-Code:** Generates lathe G-code with adaptive chord tolerance, G71/G70 cycles, feed rate ramping, CSS, rest machining, tool wear offsets, toolpath optimization, and multi-controller post-processors. Includes Pro CNC Lathe Simulator.
- **5-Axis CAM:** Advanced modules for 3+2 positional milling, 5-axis simultaneous roughing/finishing, swarf cutting, and multi-axis turning.
- **Digital Twin:** Machine side-view SVG with animated strip flow, rolls, pass line, and station detail.
- **Smart Defect Diagnosis:** 12 defect types with station-specific numeric corrections.
- **AI Integration:** GPT-4o-mini powered AI for design analysis, G-code optimization, power pattern advising, material/tool recommendations, and a Master Designer Chatbot.
- **Offline AI & Resilience:** Extensive offline knowledge base with TF-IDF engine and 50+ expert domains. Offline-first architecture with caching and offline queue for write operations.
- **Auto Backup System:** Auto-saves project state to localStorage every 5 minutes with smart change detection and 50 backup slots.
- **Validation Pipeline:** 5-layer validation (Geometry, Flower Pattern, Roll Tooling, G-Code, AI Review) with strict 100% gates.
- **BOM Generator:** Generates comprehensive Bill of Materials.
- **3D Solid Modeling:** Parametric solid modeling kernel with Boolean CSG operations, feature tree, and STL/STEP export.
- **2D Drafting Tools:** AutoCAD-level manual drawing environment with hatching, editing commands, block/symbol library, multiline text, dimension styles, and print/plot layout.
- **Line → Sheet Converter:** AutoCAD-style canvas tool to draw polylines, calculate flat blank width, weight, and area. Supports DXF import/export.
- **FormAxis RF 2025 Specialized Modules:** 14 specialized modules for various roll forming applications.
- **FormAxis Analysis Suite:** 8 analysis modules including 3D strip forming visualization, springback prediction, and production cost estimator.
- **20-Layer Testing Engine:** Offline validation across 20 levels.
- **Desktop App (Electron):** Windows Electron app with GPU acceleration, worker threads, adaptive 3D quality, and auto-updater.

## v2.2.15+ New Features (March 2026 — AI Suggestions Implemented)

**1. Dark/Light Theme Toggle (`useThemeStore.ts`)**
- Zustand persist store with `dark` and `light` themes
- `applyTheme()` adds `light-mode` / `dark-mode` class to `document.documentElement`
- Light mode CSS variables added to `index.css` (`.light-mode` class)
- Toggle button in `FloatingToolbar` (bottom-left, moon/sun icon)

**2. User Role System (`useRoleStore.ts`)**
- Roles: `admin`, `engineer`, `viewer` — persisted via Zustand
- `ROLE_PERMISSIONS` map for action-based access control
- Role badge in `FloatingToolbar` with inline role switcher
- Role-aware via `can(action)` utility

**3. Interactive Tutorial (`OnboardingTutorial.tsx`)**
- 7-step guided onboarding overlay with progress dots
- Auto-shows on first login (after `sai-tutorial-done` localStorage check)
- Steps: Welcome → DXF → Flower → G-Code → Super Pro Mode → Project Share → Done
- Replay via 📚 button in FloatingToolbar

**4. Project Share (`ProjectShare.tsx`)**
- Export project as base64-encoded JSON share code
- Import from share code — restores `profileName`, `materialType`, `materialThickness`, `numStations`, `openSectionType`, `stations`, `rollDiameter`, `shaftDiameter`
- Access via 🔗 button in FloatingToolbar

**5. Super Pro Mode AI Upgrade (`AutoCADEngineeringDrawing.tsx`)**
- Expanded QUICK_CMDS from 6 → 14 (springback, bend radius, machine speed, roll tooling material, cost estimate, defect diagnosis, station angles, section convert)
- Richer system prompt: K-factor rules, springback math, cost data injected as AI context
- Live project data (paper size, drawn by, rev, sheet) included in every prompt

**6. DXF Enhancement (`DXFImportView.tsx`)**
- Smart validation panel in Info tab: Quality Score (0-100), progress bar
- Profile type auto-detection from aspect ratio (U-Section/Hat, C-Section/Z-Section, Sigma/Omega, Closed/Tube)
- Contextual warnings: too few entities, too many layers, no arcs, scale verification

**FloatingToolbar (bottom-left of screen when logged in):**
- 🌙/☀️ — Theme Toggle
- 🔗 — Project Share
- 📚 — Tutorial Replay
- ⚙/★/👁 — Role Switcher (Admin/Engineer/Viewer)

## Engineering Bug Fixes — Session 3 (2026-03-25)

**K-Factor Corrections (DIN 6935 Roll Forming Standard)**

Canon K-factor values: GI=0.44, CR=0.44, HR=0.42, SS=0.50, AL=0.43, CU=0.44, TI=0.50, PP=0.44, HSLA=0.45

Files fixed:
- `artifacts/api-server/src/lib/roll-tooling.ts`: fallback `?? 0.38` → `?? 0.44`
- `artifacts/api-server/src/routes/ai-chatbots.ts`: K-factor text updated to DIN 6935 values (was 0.33/0.38)
- `artifacts/api-server/src/routes/materials.ts`: GI 0.45→0.44, CR 0.42→0.44, HR 0.48→0.42, AL* 0.37-0.40→0.43
- `artifacts/design-tool/src/components/ContextualGuide.tsx`: "GI K-factor 0.33" → "0.44 (DIN 6935)"
- `artifacts/design-tool/src/components/cnc/RollToolingDrawingView.tsx`: computeBendAllowance default 0.33→0.44; drawing note
- `artifacts/design-tool/src/components/cnc/SheetMetalView.tsx`: CR 0.33→0.44, GI 0.35→0.44, SS 0.38→0.50, AL 0.40→0.43, HSLA 0.30→0.45; state init 0.33→0.44
- `artifacts/design-tool/src/components/cnc/AutoProfileConverter.tsx`: kFactor state 0.33→0.44
- `artifacts/design-tool/src/components/cnc/RollDesignSuite.tsx`: kFactor state 0.35→0.44
- `artifacts/design-tool/src/components/cnc/StripWidthCalculator.tsx`: SS 0.40→0.50, TI 0.38→0.50, HR 0.38→0.42, CR 0.42→0.44, HSLA 0.40→0.45
- `artifacts/design-tool/src/components/cnc/RollToolingCalculator.tsx`: HR 0.50→0.42, MS 0.50→0.42, GI 0.47→0.44, PP 0.47→0.44, HSLA 0.48→0.45
- `artifacts/design-tool/src/components/cnc/MaterialDatabaseView.tsx`: GI 0.45→0.44, CR 0.42→0.44

**CR/HR Yield Strength SWAP Fix (CRITICAL — affected 4 files)**

- CR was showing 250 MPa (actually HR-grade), HR was showing 350 MPa (actually CR-grade) — a systemic data copy error
- Correct values: CR=340 MPa (SPCC/DC01 grade), HR=250 MPa (SPHC grade) for roll forming
- Files fixed: `FormingSimulationView.tsx`, `FormingEnergyView.tsx`, `hardware-engine.ts`, `RollFormingMachineView.tsx`

**PP Material Fix (Pre-Painted Steel vs Polypropylene)**

- PP in roll forming context = Pre-Painted Steel (E=200000 MPa, yield=280 MPa)
- Multiple frontend components had PP set to polypropylene values (E=1500, yield=35) — CRITICAL error
- Files fixed: `FormingEnergyView.tsx`, `FormingSimulationView.tsx`, `hardware-engine.ts`

**Aluminium Yield Strength Fix**

- AL yieldStrength was 110 MPa (annealed/O-temper) — roll forming uses 6061-T4/T6 ≈ 270 MPa
- Fixed in: `FormingSimulationView.tsx`, `FormingEnergyView.tsx`, `hardware-engine.ts`, `FEASimulationView.tsx`, `StripWidthCalculator.tsx`, `RollToolingCalculator.tsx`

**FEASimulationView Material Data (DIN EN 10327 / ASTM A653 corrections)**

- GI: yield 240→280 MPa, CR: yield 280→340 MPa, HSLA: yield 420→550 MPa, AL: yield 110→270 MPa, E 70→69 GPa

## External Dependencies

- **Authentication:** Offline Token Auth (no external provider)
- **Database:** PostgreSQL (via Drizzle ORM)
- **3D Graphics:** Three.js, React Three Fiber (`@react-three/fiber`, `@react-three/drei`)
- **UI Framework/State Management:** React, Zustand
- **API Framework:** Express 5
- **Package Management:** pnpm
- **Build Tools:** Vite, esbuild
- **TypeScript Tools:** Zod (`zod/v4`), Drizzle Kit, Orval
- **PDF Generation:** jspdf
- **Mapping:** Konva
- **G-Code Parsing/Generation:** Custom `dxf-parser`, `jszip`, `jose`
- **AI APIs:** Replit AI Integration (GPT-4o-mini), Gemini Flash, Claude Haiku, OpenRouter Llama, SambaNova Llama, Kimi Moonshot, NVIDIA Llama 3.1, GPT-5 Mini
- **Cloud Services:** Google Drive API
- **Electron:** (for desktop application)