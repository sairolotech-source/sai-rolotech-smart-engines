"""
result_importer.py — FEA Result File Importer
Sai Rolotech Smart Engines v2.2.0

Parses solver output files and imports results back into the app.

Supported formats:
  1. CalculiX .frd (ASCII)  — nodal results per increment
  2. CalculiX .dat           — element printed output (stress, PEEQ, contact)
  3. Abaqus .dat (text mode) — identical format to CalculiX .dat

FEA results imported:
  - deformed_shape         : {nid: (Ux, Uy, Uz)} displacement per node
  - equiv_plastic_strain   : {eid: PEEQ} equivalent plastic strain per element
  - stress_tensor          : {eid: [S11, S22, S33, S12, S13, S23]} per element
  - contact_pressure       : {nid: CPRESS} contact pressure per node
  - springback_displacement: {nid: (dUx, dUy, dUz)} Step2 - Step1 displacement

Parsing status codes:
  PARSED_OK         — file found and parsed successfully
  FILE_NOT_FOUND    — solver has not run; result file absent
  PARSE_ERROR       — file found but format unrecognised
  EXTERNAL_REQUIRED — solver binary not available; parse not attempted
"""

import os
import re
import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class NodeResult:
    nid: int
    Ux: float = 0.0
    Uy: float = 0.0
    Uz: float = 0.0

    @property
    def magnitude(self) -> float:
        return math.sqrt(self.Ux**2 + self.Uy**2 + self.Uz**2)


@dataclass
class ElementResult:
    eid: int
    PEEQ: float = 0.0           # equivalent plastic strain
    S11: float = 0.0            # stress components (MPa)
    S22: float = 0.0
    S33: float = 0.0
    S12: float = 0.0
    S13: float = 0.0
    S23: float = 0.0
    CPRESS: float = 0.0         # contact pressure (MPa)

    @property
    def von_mises(self) -> float:
        """Von Mises stress from stress tensor."""
        dS = self.S11 - self.S22
        dS2 = self.S22 - self.S33
        dS3 = self.S33 - self.S11
        return math.sqrt(0.5 * (dS**2 + dS2**2 + dS3**2) +
                         3.0 * (self.S12**2 + self.S13**2 + self.S23**2))


@dataclass
class FEAResults:
    """Complete FEA result set for one pass (two steps: forming + springback)."""
    status: str
    backend: str
    pass_number: int
    material_code: str
    step1_nodes: Dict[int, NodeResult] = field(default_factory=dict)
    step2_nodes: Dict[int, NodeResult] = field(default_factory=dict)
    step1_elements: Dict[int, ElementResult] = field(default_factory=dict)
    step2_elements: Dict[int, ElementResult] = field(default_factory=dict)
    springback_nodes: Dict[int, NodeResult] = field(default_factory=dict)
    parse_warnings: List[str] = field(default_factory=list)
    parse_errors: List[str] = field(default_factory=list)
    source_files: List[str] = field(default_factory=list)

    def max_PEEQ(self) -> float:
        """Maximum equivalent plastic strain in any element."""
        if not self.step1_elements:
            return 0.0
        return max(e.PEEQ for e in self.step1_elements.values())

    def max_von_mises_mpa(self) -> float:
        """Maximum von Mises stress in any element (MPa)."""
        if not self.step1_elements:
            return 0.0
        return max(e.von_mises for e in self.step1_elements.values())

    def max_contact_pressure_mpa(self) -> float:
        """Maximum contact pressure in any element (MPa)."""
        if not self.step1_elements:
            return 0.0
        return max(e.CPRESS for e in self.step1_elements.values())

    def max_springback_uz_mm(self) -> float:
        """Maximum vertical (Z) springback displacement (mm)."""
        if not self.springback_nodes:
            return 0.0
        return max(abs(n.Uz) for n in self.springback_nodes.values())

    def summary(self) -> dict:
        return {
            "status": self.status,
            "backend": self.backend,
            "pass_number": self.pass_number,
            "material_code": self.material_code,
            "n_step1_nodes": len(self.step1_nodes),
            "n_step1_elements": len(self.step1_elements),
            "n_step2_nodes": len(self.step2_nodes),
            "n_springback_nodes": len(self.springback_nodes),
            "max_PEEQ": round(self.max_PEEQ(), 6),
            "max_von_mises_mpa": round(self.max_von_mises_mpa(), 2),
            "max_contact_pressure_mpa": round(self.max_contact_pressure_mpa(), 2),
            "max_springback_uz_mm": round(self.max_springback_uz_mm(), 4),
            "parse_warnings": self.parse_warnings,
            "parse_errors": self.parse_errors,
            "source_files": self.source_files,
        }


# ---------------------------------------------------------------------------
# CalculiX .frd parser (ASCII format)
# ---------------------------------------------------------------------------

def _parse_frd_file(frd_path: str) -> Tuple[Dict[int, NodeResult], Dict[int, NodeResult]]:
    """
    Parse a CalculiX .frd ASCII result file.
    Returns (step1_nodes, step2_nodes) — displacement results per step.

    .frd format reference:
      2C  — node coordinate block header
      -1  — node data line: -1, nid, x, y, z
      100CL — result block header: "DISP", "STRESS", "PE", etc.
      -1  — result line: -1, nid, v1, v2, v3, ...
      -3  — end of block
    """
    if not os.path.exists(frd_path):
        return {}, {}

    step1: Dict[int, NodeResult] = {}
    step2: Dict[int, NodeResult] = {}
    current_step = 0
    in_disp_block = False

    try:
        with open(frd_path, "r", errors="replace") as f:
            lines = f.readlines()

        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            # Step increment marker (new increment = new forming or springback step)
            if stripped.startswith("1UTIME") or "TIME" in stripped and "STEP" in stripped:
                current_step += 1
                in_disp_block = False
                continue

            # Result block header — check for displacement
            if "DISP" in stripped and stripped.startswith("1"):
                in_disp_block = True
                continue
            if stripped.startswith("1") and in_disp_block:
                in_disp_block = False

            # Data line in displacement block
            if in_disp_block and stripped.startswith("-1"):
                parts = stripped.split()
                if len(parts) >= 5:
                    try:
                        nid = int(parts[1])
                        Ux = float(parts[2])
                        Uy = float(parts[3])
                        Uz = float(parts[4])
                        nr = NodeResult(nid, Ux, Uy, Uz)
                        if current_step <= 1:
                            step1[nid] = nr
                        else:
                            step2[nid] = nr
                    except (ValueError, IndexError):
                        pass

            # End of block
            if stripped.startswith("-3"):
                in_disp_block = False

    except Exception:
        pass

    return step1, step2


def _parse_dat_file(dat_path: str) -> Dict[int, ElementResult]:
    """
    Parse a CalculiX/Abaqus .dat printed output file.
    Extracts PEEQ (equivalent plastic strain), stress, and contact pressure per element.

    .dat format (element output):
      element  int.point   S11      S22      S33      S12      S13      S23
        1         1      -123.4   -45.6    22.1    ...
      element  int.point   PEEQ
        1         1       0.1234
    """
    results: Dict[int, ElementResult] = {}

    if not os.path.exists(dat_path):
        return results

    try:
        with open(dat_path, "r", errors="replace") as f:
            lines = f.readlines()

        mode = None
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue

            lower = stripped.lower()
            # Detect output section
            if "stress" in lower and "element" in lower and "int.point" in lower:
                mode = "stress"
                continue
            if "peeq" in lower and "element" in lower and "int.point" in lower:
                mode = "peeq"
                continue
            if "cpress" in lower and ("element" in lower or "node" in lower):
                mode = "cpress"
                continue
            if "element" in lower and "int.point" in lower:
                mode = None  # unknown block, skip

            # Parse data lines
            if mode and not lower.startswith("e") and not lower.startswith("-"):
                parts = stripped.split()
                if len(parts) >= 3:
                    try:
                        eid = int(parts[0])
                        if eid not in results:
                            results[eid] = ElementResult(eid)
                        if mode == "stress" and len(parts) >= 8:
                            results[eid].S11 = float(parts[2])
                            results[eid].S22 = float(parts[3])
                            results[eid].S33 = float(parts[4])
                            results[eid].S12 = float(parts[5])
                            results[eid].S13 = float(parts[6])
                            results[eid].S23 = float(parts[7])
                        elif mode == "peeq" and len(parts) >= 3:
                            results[eid].PEEQ = float(parts[2])
                        elif mode == "cpress" and len(parts) >= 3:
                            results[eid].CPRESS = float(parts[2])
                    except (ValueError, IndexError):
                        pass

    except Exception:
        pass

    return results


# ---------------------------------------------------------------------------
# Abaqus ODB text report parser
# ---------------------------------------------------------------------------

def _parse_abaqus_rpt(rpt_path: str) -> Tuple[Dict[int, NodeResult], Dict[int, ElementResult]]:
    """
    Parse an Abaqus text report file (.rpt) extracted via abaqus python postprocessing.
    Format:
      Node  U1        U2        U3
        1   0.001234  0.000012  -0.234567
      Element  PEEQ      S_MISES
        1      0.1234    345.6
    """
    node_results: Dict[int, NodeResult] = {}
    elem_results: Dict[int, ElementResult] = {}

    if not os.path.exists(rpt_path):
        return node_results, elem_results

    try:
        with open(rpt_path, "r", errors="replace") as f:
            lines = f.readlines()

        mode = None
        for line in lines:
            stripped = line.strip()
            if not stripped or stripped.startswith("*"):
                continue
            lower = stripped.lower()

            if "node" in lower and "u1" in lower and "u2" in lower:
                mode = "node_disp"
                continue
            if "element" in lower and "peeq" in lower:
                mode = "elem_peeq"
                continue

            if mode == "node_disp":
                parts = stripped.split()
                if len(parts) >= 4:
                    try:
                        nid = int(parts[0])
                        node_results[nid] = NodeResult(nid, float(parts[1]), float(parts[2]), float(parts[3]))
                    except (ValueError, IndexError):
                        pass

            elif mode == "elem_peeq":
                parts = stripped.split()
                if len(parts) >= 2:
                    try:
                        eid = int(parts[0])
                        if eid not in elem_results:
                            elem_results[eid] = ElementResult(eid)
                        elem_results[eid].PEEQ = float(parts[1])
                    except (ValueError, IndexError):
                        pass

    except Exception:
        pass

    return node_results, elem_results


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def import_calculix_results(
    frd_path: str,
    dat_path: str,
    pass_number: int = 1,
    material_code: str = "GI",
) -> FEAResults:
    """
    Import CalculiX solver results from .frd and .dat files.

    If files do not exist (solver not run), returns status=FILE_NOT_FOUND.
    If files exist but are empty/corrupt, returns status=PARSE_ERROR.
    On success, returns status=PARSED_OK with all result dicts populated.
    """
    warnings: List[str] = []
    errors: List[str] = []
    source_files: List[str] = []

    frd_exists = os.path.exists(frd_path)
    dat_exists = os.path.exists(dat_path)

    if not frd_exists and not dat_exists:
        return FEAResults(
            status="FILE_NOT_FOUND",
            backend="calculix",
            pass_number=pass_number,
            material_code=material_code,
            parse_errors=[
                f".frd not found: {frd_path}",
                f".dat not found: {dat_path}",
                "CalculiX solver has not been run. "
                "Run: ccx <job_name> in the output directory.",
            ],
        )

    if frd_exists:
        source_files.append(frd_path)
    else:
        warnings.append(f".frd file not found: {frd_path}")

    if dat_exists:
        source_files.append(dat_path)
    else:
        warnings.append(f".dat file not found: {dat_path}")

    # Parse files
    step1_nodes, step2_nodes = _parse_frd_file(frd_path) if frd_exists else ({}, {})
    elem_results = _parse_dat_file(dat_path) if dat_exists else {}

    # Compute springback = step2 displacement - step1 displacement
    springback_nodes: Dict[int, NodeResult] = {}
    for nid, nr2 in step2_nodes.items():
        nr1 = step1_nodes.get(nid, NodeResult(nid, 0.0, 0.0, 0.0))
        springback_nodes[nid] = NodeResult(
            nid,
            nr2.Ux - nr1.Ux,
            nr2.Uy - nr1.Uy,
            nr2.Uz - nr1.Uz,
        )

    status = "PARSED_OK" if (step1_nodes or elem_results) else "PARSE_ERROR"
    if status == "PARSE_ERROR":
        errors.append("Files found but no data could be parsed (possibly empty or binary format).")

    return FEAResults(
        status=status,
        backend="calculix",
        pass_number=pass_number,
        material_code=material_code,
        step1_nodes=step1_nodes,
        step2_nodes=step2_nodes,
        step1_elements=elem_results,
        step2_elements={},
        springback_nodes=springback_nodes,
        parse_warnings=warnings,
        parse_errors=errors,
        source_files=source_files,
    )


def import_abaqus_odb_text(
    rpt_path: str,
    dat_path: str,
    pass_number: int = 1,
    material_code: str = "GI",
) -> FEAResults:
    """
    Import Abaqus results from a text report (.rpt) and .dat file.

    Note: Full .odb parsing requires the Abaqus Python API (odbAccess).
    This importer handles text-format reports exported via:
      abaqus python -c "from odbAccess import openOdb; ..."

    If files do not exist, returns status=FILE_NOT_FOUND.
    """
    warnings: List[str] = []
    errors: List[str] = []
    source_files: List[str] = []

    rpt_exists = os.path.exists(rpt_path)
    dat_exists = os.path.exists(dat_path)

    if not rpt_exists and not dat_exists:
        return FEAResults(
            status="FILE_NOT_FOUND",
            backend="abaqus",
            pass_number=pass_number,
            material_code=material_code,
            parse_errors=[
                f".rpt not found: {rpt_path}",
                "Abaqus ODB is binary. Export text report first:",
                "  abaqus python extract_results.py <job_name>.odb",
            ],
        )

    if rpt_exists:
        source_files.append(rpt_path)
    if dat_exists:
        source_files.append(dat_path)

    node_results, elem_results = _parse_abaqus_rpt(rpt_path) if rpt_exists else ({}, {})
    if dat_exists:
        dat_elems = _parse_dat_file(dat_path)
        for eid, er in dat_elems.items():
            if eid not in elem_results:
                elem_results[eid] = er
            else:
                if er.PEEQ > 0.0:
                    elem_results[eid].PEEQ = er.PEEQ

    status = "PARSED_OK" if (node_results or elem_results) else "PARSE_ERROR"

    return FEAResults(
        status=status,
        backend="abaqus",
        pass_number=pass_number,
        material_code=material_code,
        step1_nodes=node_results,
        step1_elements=elem_results,
        parse_warnings=warnings,
        parse_errors=errors,
        source_files=source_files,
    )


def make_synthetic_frd(
    frd_path: str,
    node_ids: List[int],
    displacement_uz_mm: float = -2.5,
    peeq_value: float = 0.14,
) -> None:
    """
    Write a synthetic CalculiX-format .frd file with uniform prescribed results.
    Used for integration testing when no solver is available.

    This produces a minimal valid .frd ASCII file with:
      - Step 1 (forming): all nodes displaced Uz = displacement_uz_mm
      - Step 2 (springback): nodes rebounded by 15% elastic recovery
    """
    lines = [
        "    1C",
        f"    1UDATE  {len(node_ids):6d}",
    ]
    # Step 1 nodes: forming displacement
    lines.append("    1UTIME 1.000000E+00")
    lines.append("  100CL  101 DISP        DISP")
    for nid in node_ids:
        lines.append(f" -1{nid:10d} 0.0000E+00 0.0000E+00 {displacement_uz_mm:.4E}")
    lines.append(" -3")

    # Step 2 nodes: springback (15% elastic recovery)
    lines.append("    1UTIME 2.000000E+00")
    lines.append("  100CL  101 DISP        DISP")
    springback_uz = displacement_uz_mm * 0.85
    for nid in node_ids:
        lines.append(f" -1{nid:10d} 0.0000E+00 0.0000E+00 {springback_uz:.4E}")
    lines.append(" -3")
    lines.append("    9999")

    os.makedirs(os.path.dirname(frd_path) or ".", exist_ok=True)
    with open(frd_path, "w") as f:
        f.write("\n".join(lines))


def make_synthetic_dat(
    dat_path: str,
    element_ids: List[int],
    peeq_value: float = 0.14,
    stress_mpa: float = 350.0,
) -> None:
    """
    Write a synthetic CalculiX-format .dat file with uniform prescribed results.
    Used for integration testing.
    """
    lines = [
        " E L E M E N T   O U T P U T",
        "",
        " element  int.point   S11         S22         S33         S12         S13         S23",
    ]
    for eid in element_ids:
        lines.append(f"{eid:8d}{1:8d}  {stress_mpa:.4E}  {0.3*stress_mpa:.4E}  {0.3*stress_mpa:.4E}  {0.1*stress_mpa:.4E}  0.0000E+00  0.0000E+00")

    lines += [
        "",
        " element  int.point   PEEQ",
    ]
    for eid in element_ids:
        lines.append(f"{eid:8d}{1:8d}  {peeq_value:.6E}")

    os.makedirs(os.path.dirname(dat_path) or ".", exist_ok=True)
    with open(dat_path, "w") as f:
        f.write("\n".join(lines))
