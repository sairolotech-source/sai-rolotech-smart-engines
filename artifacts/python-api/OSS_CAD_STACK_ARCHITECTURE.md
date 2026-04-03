# OSS CAD Stack Architecture (License-Aware)

## Objective
Upgrade CAD capabilities with an open-source stack while preserving truth-first export behavior:
- DXF + STEP remain first-class.
- No fake DWG claim.
- Contour-driven tooling preferred over placeholder cylinders.

## Layer Mapping
1. Flower + pass plan
- Engine: `advanced_flower_engine`
- Output: pass-wise bend schedule and stage labels.

2. Contour derivation
- Engine: `roll_contour_engine`
- Output: per-station upper/lower contour geometry.

3. Parametric solid generation
- Primary (when available): CadQuery/OCP (OpenCascade runtime)
- Fallback: legacy STEP hollow-cylinder generator.

4. 2D drawing generation
- Library: `ezdxf`
- Output: contour-overlaid roll drawings + shaft/assembly DXF.

5. 3D preview + section validation (optional)
- Library: `PyVista/VTK`

6. Mesh validation/slicing (optional)
- Library: `trimesh`

7. Meshing/solver-prep (optional, license-sensitive)
- Library: `gmsh`

## Runtime Capability Proof
New endpoints:
- `GET /api/cad-stack/status`
- `GET /api/cad-stack/architecture`

`/api/cad-stack/status` reports:
- module import availability
- core/preview/mesh readiness
- license-risk notes
- DWG truth controls

## Installation
Base:
```bash
pip install -r requirements.txt
```

Optional OSS CAD stack:
```bash
pip install -r requirements.txt -r requirements-oss-cad.txt
```

## License/Risk Notes
- OCCT/CadQuery/OCP: requires redistribution compliance review.
- Gmsh: treat as optional; perform explicit license review before closed-source distribution.
- DWG: keep unsupported unless a proven backend is added and runtime-validated.

## Truth Gates
- If contour-based STEP generation is unavailable, system must fall back and report fallback mode.
- If module imports are missing, status endpoint must show not-ready instead of claiming support.
- No native DWG success claim without real backend and artifact proof.
