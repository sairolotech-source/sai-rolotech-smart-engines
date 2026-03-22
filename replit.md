# SAI Rolotech Smart Engines — Professional Roll Forming & CNC Engineering Suite

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
- **Offline AI & Resilience:** Extensive offline knowledge base (`src/lib/offline-ai-kb-expanded.ts`, `artifacts/api-server/src/lib/offline-knowledge-base.ts`) with TF-IDF engine and 38+ expert domains. Offline-first architecture with `safeFetchWithCache()`, offline queue for write operations, and `OfflineGuard` component.
- **Auto Backup System:** Auto-saves project state to localStorage every 5 minutes with smart change detection and 50 backup slots.
- **Validation Pipeline:** 5-layer validation (Geometry, Flower Pattern, Roll Tooling, G-Code, AI Review) with strict 100% gates.
- **BOM Generator:** Generates comprehensive Bill of Materials for roll forming lines and machines.
- **3D Solid Modeling:** Parametric solid modeling kernel with Boolean CSG, Revolve, Sweep, Loft, Shell, Fillet, Chamfer operations, feature tree, and STL/STEP export.
- **2D Drafting Tools:** AutoCAD-level manual drawing environment with hatching, editing commands (Trim, Extend, Fillet, Chamfer, Array), block/symbol library, multiline text, dimension styles, and print/plot layout.
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