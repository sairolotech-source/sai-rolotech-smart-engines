# 90+ Trust-Chain Evidence Execution Plan

## Scope
Generate raw evidence for benchmark reproducibility and integrity:
1. Runtime workflow trace
2. SHA256 manifest + verification + tamper-fail proof
3. CI bundle identifier artifact
4. Negative fixtures and expected failures

## Execution
Run:

```bash
python artifacts/python-api/scripts/run_benchmark_evidence.py
```

## Required output folders
- `artifacts/evidence/runtime_trace/`
- `artifacts/evidence/manifest/`
- `artifacts/evidence/ci/`
- `artifacts/evidence/negative_cases/`
- `artifacts/evidence/benchmark/`

## Truthfulness policy
- Do not claim solver-backed FEA unless solver runtime result is present.
- Do not claim CNC-ready G-code if only CAD/CAM artifacts exist.
- If COPRA +4 cannot be proven with repository evidence, mark category FAIL with blockers.
