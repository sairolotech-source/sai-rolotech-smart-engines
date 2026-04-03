# Strict Audit Task Run Log

Date: 2026-04-04  
Mode: Strict no-fake verification  
Acceptance gate: FAILED / PARTIAL / NOT VERIFIED

## Task 1: Demo-videos React #300 root-cause + live proof

### Root cause (current state)

- Source-level hardening exists in `Home.tsx` + `DemoVideoCenter.tsx`.
- Current static scan does not show an obvious remaining hook-order violation in `DemoVideoCenter.tsx` root path.
- Live runtime proof is still blocked because Node/pnpm are unavailable in this environment.

### Files changed in this run

- No additional Task 1 code patch applied in this run (existing hardening from prior run retained).

### Exact commands run

```powershell
Get-Command node -ErrorAction SilentlyContinue | Format-List Name,Source,Version
Get-Command pnpm -ErrorAction SilentlyContinue | Format-List Name,Source,Version
where.exe node
where.exe pnpm
Test-Path 'C:\Program Files\nodejs\node.exe'
Test-Path 'C:\Program Files\nodejs\pnpm.cmd'
```

```powershell
Select-String -Path 'artifacts/design-tool/src/components/cnc/DemoVideoCenter.tsx' -Pattern 'useState|useEffect|useMemo|useCallback|if \(|return null|<SceneRenderer progress' -CaseSensitive:$false
Get-Content 'artifacts/design-tool/src/components/cnc/DemoVideoCenter.tsx' | Select-Object -Skip 520 -First 130
Get-Content 'artifacts/design-tool/src/pages/Home.tsx' | Select-Object -Skip 420 -First 150
```

### Test results

- Runtime launch: not executed (Node/pnpm missing).
- Build/test commands: not executed.

### Runtime proof

- Not available in this environment.

### Screenshots or generated artifacts

- None generated in this run.

### Remaining gaps

- Route-level live verification for `demo-videos`.
- Browser console before/after proof.
- Screenshot/video proof of stable route load and transitions.

### Final verdict

PARTIAL

---

## Task 2: DWG export truth audit

### Root cause

- CAD export backend is implemented as DXF + STEP, not native DWG writer.
- Prior wording was ambiguous (`DWG + STEP spec` reference) and could be misread as implemented capability.
- Frontend upload label claimed unconditional `.dwg supported`, but actual behavior depends on server converter path.

### Files changed

- `artifacts/python-api/app/engines/cad_export_engine.py`
- `artifacts/python-api/app/api/routes.py`
- `artifacts/design-tool/src/components/cnc/LeftPanel.tsx`

### Exact commands run

```powershell
Get-ChildItem -Path 'artifacts/python-api/app' -Recurse -File | Select-String -Pattern '\bDWG\b|dwg' -CaseSensitive:$false
Get-ChildItem -Path 'artifacts/design-tool/src' -Recurse -File | Select-String -Pattern '\bDWG\b|dwg' -CaseSensitive:$false
Get-Content 'artifacts/python-api/app/engines/import_engine.py' | Select-Object -First 220
Select-String -Path 'artifacts/python-api/app/api/routes.py' -Pattern '/cad-export|Only \.dxf files accepted|dxf-upload|dwg' -CaseSensitive:$false
Get-Content 'artifacts/api-server/src/routes/dxf.ts'
```

### Test results

- Code-level truth audit completed.
- Native DWG export runtime generation test not executed (runtime unavailable in this environment).

### Runtime proof

- Not available for DWG writer generation/open validation.

### Screenshots or generated artifacts

- No new `.dwg` artifact generated in this run.

### Remaining gaps

- If DWG export is required, a real DWG writer backend must be implemented and validated.
- Until then, capability must remain explicitly marked unsupported/not verified for DWG export.

### Final verdict

PARTIAL

---

## Task 3: Roll design + simulation reality check

### Status

- Not executed in this run.

### Final verdict

NOT VERIFIED
