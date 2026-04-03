# Sai Rolotech Smart Engines — Codex Agent Rules

## Project identity
Roll Forming Engineering Suite — React/Vite (port 5000) + Node/Express API (port 8080) + Python FastAPI (port 9000).
AI model: `o4-mini` via OpenRouter proxy at `AI_INTEGRATIONS_OPENROUTER_BASE_URL + /chat/completions`.

---

## Truthfulness

Never mark a task complete unless ALL of these are satisfied:
- The code path exists and is reachable
- The UI renders correctly without crashing on null, partial, or empty data
- Export output exists if applicable
- Validation passes on both normal AND edge-case inputs
- Fallback UI is present for every loading / error / empty state

---

## Safety

Never label output as CNC-ready unless the G-code safety validator passes with score ≥ 70.
Never show a green success toast for synthesized, partial, blocked, or empty results.
Never silently swallow exceptions — always propagate a visible error or warning.

---

## UI rules

- Do not show success toasts for partial, synthesized, blocked, or empty results.
- All disabled buttons must show exact reasons (tooltip or inline label).
- Every badge must reflect real underlying data — no optimistic fake states.
- Loading spinners must time out and show an error if the backend is unreachable.
- Empty state must be a clearly labelled fallback, not a blank panel.

---

## Station rules

Every station must be classified as exactly ONE of:
- **Complete** — rollProfile present, bendAngles present, gcodeOutput present
- **Incomplete** — rollProfile present but missing bendAngles or gcode
- **No Profile** — rollProfile is null/undefined
- **Blocked** — upstream data (geometry, flower) is missing

Every status must be backed by real validation data from `validateStationProfiles()`.

---

## Null safety

Never do direct unsafe member access on any of:
- `rollProfile` — check for null before any property access
- `bendAngles` — check array existence and length > 0
- `formingAngles` / `passDistribution` — guard against undefined
- `geometry.segments` — guard against null geometry
- `gcodeOutput` / `gcode` — check string length > 0
- `machineData` — null-guard before render
- `bomResult` — null-guard before render

---

## Export rules

Block export when:
- Any required station has no rollProfile
- Total complete stations < total stations
- machineData or bomResult is missing

Show exact blocking station numbers and reasons in the preflight modal.

---

## Springback rules

Always show springback factor in material info panel.
Always compute overbend target per bend as: `targetAngle × springbackFactor`.
Never claim flower angles are final without showing the overbend compensation.

---

## Material-aware warnings

Show a WARNING when:
- Line speed > material.maxFormingSpeed
- Thickness > material.maxThickness or < material.minThickness
- crackingRisk === "high" and materialThickness > 3mm

Show a CRITICAL WARNING when:
- materialType is TI (Titanium) — always flag slow speed + coolant requirement
- materialType is SS and any bend radius < 2× thickness

---

## Operator action suggestions

Always show operator the next required action based on project state:
1. No geometry → "Load a DXF profile or draw a profile"
2. Geometry present, no stations → "Run Flower Pattern generation"
3. Stations present, no roll tooling → "Generate Roll Tooling"
4. Roll tooling present, incomplete stations → "Regenerate incomplete stations"
5. Roll tooling complete, no gcode → "Generate G-Code for all stations"
6. All data present → "Run G-code safety check, then export package"

---

## Audit rules

For every patch:
- Explain the bug
- Explain the fix
- List remaining risks
- Identify which of the 8 audit buckets it touches (DXF / Centerline / Flower / Tooling / Export / Simulation / GCode / Auth)

---

## 8 audit buckets

1. DXF import and geometry normalization
2. Centerline / inner / outer conversion
3. Flower pattern engine
4. Roll tooling engine
5. Export engine (ZIP, CSV, XML, DXF)
6. Simulation / Digital Twin / Package views
7. G-code / CNC safety
8. Auth / backend / persistence

---

## Station readiness classification matrix

| Has rollProfile | Has bendAngles | Has gcode | Classification |
|---|---|---|---|
| No | — | — | No Profile |
| Yes | No | No | Incomplete |
| Yes | Yes | No | Incomplete |
| Yes | Yes | Yes | Complete |
| Any | — | — | Blocked (if geometry/flower missing) |

---

## Tech stack rules

- Always use `pnpm` — never `npm` or `yarn`
- TypeScript strict mode — no implicit any
- Zustand store access in callbacks: use `useCncStore.getState()` not reactive state
- API calls: use functions in `artifacts/design-tool/src/lib/api.ts`
- Toast: use `useToast()` hook, never `alert()`
- Modal: use `Dialog` from `@/components/ui/dialog`
- Never use `console.log` for user-visible output — use toast or UI panels
