# Demo Videos - React #300 Audit Report

Date: 2026-04-04
Status: Partial (source-verified, runtime-unverified)
Audit bucket: 6. Simulation / Digital Twin / Package views

## Scope

Crash observed on `demo-videos` route with React error:

> #300 - "Rendered fewer hooks than expected"

This indicates a hook-order violation during render.

Files audited:
- `artifacts/design-tool/src/pages/Home.tsx`
- `artifacts/design-tool/src/components/cnc/DemoVideoCenter.tsx`

## Verified (by source inspection)

### 1. Tab to Category Mapping Fix (Home.tsx)

- `demo-videos` -> `"ai"` (previously invalid `"system"`)
- `buddy-crm` -> `"ai"`

Impact:
Prevents invalid category state and UI desynchronization.

### 2. Removal of Scene-Local Hook Ownership

- `SceneSetup` no longer owns:
- `useState`
- `useEffect`
- All state now derived from parent `progress`

Impact:
Eliminates conditional hook execution risk during scene transitions.

### 3. Removal of Hook-Based Counter Pattern

- `AnimatedCounter` (hook-based) removed
- Values now computed from derived progress

Impact:
Removes hook lifecycle instability tied to animation timing.

### 4. Stabilized Scene Rendering Path

- Scene lookup now guarded (safe fallback)
- Rendering routed through stable `SceneRenderer`
- Parent owns timing/progress state

Impact:
Prevents dynamic hook tree reshaping during scene swaps.

## Unverified (runtime pending)

1. Full runtime resolution of React error `#300`
2. Absence of hook-order violations in other `demo-videos` subtree components
3. Stability under:
- rapid route switching
- long idle playback

Reason:
Node/pnpm runtime was unavailable, so local execution was not possible.

## Runtime Validation Checklist

1. Open app and navigate to `demo-videos`
2. Hard refresh on the route
3. Switch tabs 5-10 times
4. Idle playback for at least 60 seconds
5. Observe for:
- React error overlay
- ErrorBoundary fallback
- blank or frozen scenes
- console hook-order errors
6. Verify:
- continuous scene transitions
- strip-width updates with progress
7. Check adjacent tabs:
- `buddy-crm`
- other `ai` views

## Evidence Required (Sign-off)

- Screen recording of successful playback
- Console screenshot (no hook errors)
- Verification note:

```text
Verified at runtime on <build>, commit <sha>, date <YYYY-MM-DD>
```

## Acceptance Gate (Strict)

- If proof is missing, mark the item FAILED.
- If only code was changed but runtime was not verified, mark PARTIAL.
- If export/file/route cannot be reproduced live, mark NOT VERIFIED.

## If Issue Persists (Next Targets)

Prioritize inspection of:

1. Components with early returns before hooks, for example:

```tsx
if (...) return ...
```

2. Scene components whose identity changes based on:
- progress
- index
3. Inline component factories created during render
4. Conditional mount/unmount of hook-owning subtrees

## Team Status Note

`demo-videos` crash path has been reduced and structurally hardened via source-level fixes.

Verified:
- Tab/category mapping corrected
- Scene-local hooks removed
- Hook-based animation logic removed
- Rendering path stabilized

Unverified:
- Runtime validation pending (Node/pnpm unavailable)

Next step:
Execute browser validation and capture runtime proof.
