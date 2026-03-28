# SAI Rolotech Smart Engines — Professional Roll Forming & CNC Engineering Suite

## Overview

SAI Rolotech Smart Engines is a pnpm workspace monorepo project focused on developing an advanced roll forming machine roll design tool. It provides engineers with capabilities for roll forming machine design, CNC G-code generation, and engineering calculations. The project aims to deliver a high-quality, stable, and accurate engineering suite with a premium user experience, incorporating advanced AI features and robust offline functionality for the roll forming and CNC engineering domain.

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

The project is structured as a pnpm workspace monorepo comprising `api-server`, `design-tool`, and `desktop` applications, along with shared `lib` packages.

**UI/UX Decisions:**
- **Design System:** Premium desktop UI with a deep midnight navy background, electric amber/orange accents, and cyan highlights, utilizing glassmorphism panels and subtle depth.
- **Navigation:** Sidebar-first with a slim left icon sidebar expanding into a tool panel; a slim top bar for branding, navigation, and user controls.
- **Typography:** Inter font with a refined hierarchy.
- **Interactivity:** Micro-animations and amber glow shadows on primary buttons.
- **Responsiveness:** Laptop-optimized layout with a responsive ribbon for smaller screens.
- **Enhancements:** Figma-quality dashboards, shimmer loading, toast notifications, keyboard shortcut overlay, smooth transitions, polished error boundaries, contextual empty states.
- **Theming:** Supports Dark/Light theme toggling via `useThemeStore.ts`.
- **User Roles:** Implements a user role system (`admin`, `engineer`, `viewer`) with action-based access control.

**Technical Implementations & Feature Specifications:**
- **DXF/DWG Profile Upload:** Imports profiles with AutoCAD dimension extraction, reference point detection, and spline interpolation.
- **Power Pattern:** Station-by-station bend progression with springback compensation, K-factor lookup, and iterative solvers.
- **Roll Tooling:** K-factor + neutral axis calculations, per-roll specifications, roll gap calculator, and cantilever beam deflection. Includes various roll tooling calculators.
- **SolidCAM Tool Database:** Comprehensive ISO 1832 insert code parser with cutting data and SVG insert preview, managed via an Admin Control System.
- **3D Visualization:** Uses Three.js/React Three Fiber for 3D strip forming visualization with stress/strain approximation and animated mesh.
- **Hardware Acceleration:** Leverages Web Workers for heavy calculations, offloading computations to parallel threads.
- **CNC G-Code:** Generates lathe G-code with adaptive chord tolerance, G71/G70 cycles, feed rate ramping, and multi-controller post-processors, including a Pro CNC Lathe Simulator.
- **5-Axis CAM:** Advanced modules for 3+2 positional milling and 5-axis simultaneous operations.
- **Digital Twin:** Machine side-view SVG with animated strip flow, rolls, and station detail.
- **Smart Defect Diagnosis:** Identifies 12 defect types with station-specific numeric corrections.
- **AI Integration:** GPT-4o-mini powered AI for design analysis, G-code optimization, power pattern advising, material/tool recommendations, and a Master Designer Chatbot. Expanded with enhanced prompts and live project data context.
- **Offline AI & Resilience:** Extensive offline knowledge base with a TF-IDF engine and an offline-first architecture with caching and an offline queue.
- **Auto Backup System:** Auto-saves project state to localStorage every 5 minutes with smart change detection.
- **Validation Pipeline:** 5-layer validation (Geometry, Flower Pattern, Roll Tooling, G-Code, AI Review) with strict gates.
- **BOM Generator:** Generates comprehensive Bill of Materials.
- **3D Solid Modeling:** Parametric solid modeling kernel with Boolean CSG operations and STL/STEP export.
- **2D Drafting Tools:** AutoCAD-level manual drawing environment with hatching, editing commands, and print/plot layout.
- **Line → Sheet Converter:** AutoCAD-style canvas tool to calculate flat blank width, weight, and area.
- **Specialized Engineering Engines:** Includes Thickness Range, Geometry Recognition, Pass Angle, Engineering Formula Calculator, Design Rule, Defect Prediction, and Machine Fitment engines.
- **AI Ultra Validation System:** Injects comprehensive rule sets into AI system prompts to enforce engineering standards and safety.
- **Production Build Serving:** API Server serves gzipped production-built frontend with immutable cache headers.
- **Critical Chunk Splitting:** Lazy loading of large dependencies like `@mlc-ai/web-llm` to reduce initial bundle size.
- **SW Recovery System:** Recovery page at `/` clears stale Service Workers and CacheStorage before redirecting to the app (`/?_app=1`). Cookie-based (`_sw_ok`) skip ensures recovery runs only once per browser. Self-destruct `sw.js` replaces any old SW (install→skipWaiting, activate→claim+clear+navigate, fetch→network-only). **IMPORTANT: Do NOT restore `manualChunks` in vite.config.ts** — it caused circular chunk dependencies (vendor-react ↔ vendor-radix) that crashed the app.

## External Dependencies

- **Authentication:** Offline Token Auth
- **Database:** PostgreSQL (via Drizzle ORM)
- **3D Graphics:** Three.js, React Three Fiber (`@react-three/fiber`, `@react-three/drei`)
- **UI Framework/State Management:** React, Zustand
- **API Framework:** Express 5
- **Package Management:** pnpm
- **Build Tools:** Vite, esbuild
- **TypeScript Tools:** Zod, Drizzle Kit, Orval
- **PDF Generation:** jspdf
- **Mapping:** Konva
- **G-Code Parsing/Generation:** Custom `dxf-parser`, `jszip`, `jose`
- **AI APIs:** Replit AI Integration (GPT-4o-mini), Gemini Flash, Claude Haiku, OpenRouter Llama, SambaNova Llama, Kimi Moonshot, NVIDIA Llama 3.1, GPT-5 Mini
- **Cloud Services:** Google Drive API
- **Desktop Application Framework:** Electron

## Electron Desktop App Notes
- **Native Splash Window:** Electron main process creates its own splash window (`createSplashWindow`) with real-time progress (license check → server start → frontend load). This is separate from the web-based SplashScreen3D component.
- **Splash auto-closes** when `ready-to-show` fires on main window, with a 3-second failsafe timeout.
- **Single instance lock** is handled ONCE at line ~1773 — do NOT add a second `requestSingleInstanceLock()` call.
- **Google Fonts** in index.html uses `media="print" onload="this.media='all'"` pattern to avoid blocking render in offline Electron.
- **API server** runs on port 3001 in packaged mode. Splash shows real progress during server startup.
- **GPU acceleration flags** are set in main.ts: d3d11 ANGLE, GPU rasterization, WebGPU, ignore-gpu-blocklist.