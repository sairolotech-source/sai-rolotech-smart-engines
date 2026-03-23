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