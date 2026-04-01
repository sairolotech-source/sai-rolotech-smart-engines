"""
process_card_engine.py — Per-Station Process Parameter Card Generator

Generates a structured process card for each roll forming station.
This is the operator and tooling setup reference sheet.

Per-station data includes:
  • Station number and label
  • Stage type (flat / pre_bend / progressive / lip / calibration)
  • Target angle (degrees) and springback correction
  • Roll gap setting (mm) — corrected for material springback
  • Strip width at entry (mm)
  • Estimated forming force (kN) and motor power (kW)
  • Outer-fibre strain (%) with severity flag
  • Defect risk flags (cracking, wrinkling, edge wave, etc.)
  • Setup notes for operator

Process card is machine-agnostic — designed for setup sheet generation
and integration into MES / DMS (Document Management System) workflows.
"""
import math
from typing import Any, Dict, List, Optional

from app.utils.response import pass_response, fail_response
from app.engines.force_engine import estimate_forming_force
from app.engines.strain_engine import calculate_strain
from app.engines.springback_engine import calculate_springback
from app.engines.defect_engine import detect_defects
from app.utils.material_database import get_property


_STAGE_DESCRIPTIONS: Dict[str, str] = {
    "flat":                 "Entry — flat strip; check centering and edge guide contact",
    "pre_bend":             "Pre-bend — first deformation; verify strip tension",
    "initial_bend":         "Initial bend — monitor edge guide alignment",
    "progressive_forming":  "Progressive forming — check angle and gap at each station",
    "lip_forming":          "Lip forming — use side roll guides; verify lip angle",
    "calibration":          "Calibration — final sizing; check all dimensions per QC drawing",
    "unknown":              "General forming pass",
}

_SEVERITY_SYMBOL: Dict[str, str] = {
    "low":        "✓  LOW",
    "low_medium": "△  LOW-MED",
    "medium":     "⚠  MEDIUM",
    "high":       "✗  HIGH",
    "none":       "✓  NONE",
}


def _operator_note(stage: str, angle_deg: float, springback_deg: float,
                   defects: List[Dict], material: str) -> str:
    lines = [_STAGE_DESCRIPTIONS.get(stage, "General forming pass")]
    if springback_deg > 2.0:
        lines.append(
            f"Springback correction applied: over-bend by {springback_deg:.1f}° "
            f"(corrected target = {angle_deg + springback_deg:.1f}°)"
        )
    for d in defects:
        sev = d.get("severity", "")
        if sev in ("HIGH", "MEDIUM"):
            lines.append(f"[{sev}] {d.get('message', '')}")
    return " | ".join(lines)


def generate_process_card(
    simulation_result: Dict[str, Any],
    thickness_mm: float,
    material: str,
    bend_radius_mm: float = 2.0,
    machine_name: str = "Roll Forming Machine",
    project_ref: str = "PRJ-001",
) -> Dict[str, Any]:
    """
    Generate a per-station process card from simulation engine output.

    Args:
        simulation_result: Output of simulation_engine.run_simulation()
        thickness_mm:      Sheet thickness (mm)
        material:          Material code
        bend_radius_mm:    Inner bend radius (mm)
        machine_name:      Machine identifier for header
        project_ref:       Project reference number for header

    Returns:
        pass_response with process_card header and station_cards list
    """
    if not simulation_result or simulation_result.get("status") != "pass":
        return fail_response("process_card_engine", "Simulation result missing or failed")

    sim_passes = simulation_result.get("simulation_passes", [])
    if not sim_passes:
        return fail_response("process_card_engine", "No simulation passes found")

    mat = material.upper()
    Fy  = get_property(mat, "Fy_mpa", 250)
    E   = get_property(mat, "E_gpa", 200) * 1000
    mat_name = get_property(mat, "name", mat)

    station_cards: List[Dict[str, Any]] = []

    for p in sim_passes:
        angle      = float(p.get("target_angle_deg", 0.0))
        strip_w    = float(p.get("strip_width_mm", 150.0))
        roll_gap   = float(p.get("roll_gap_mm", thickness_mm + 0.1))
        forming_d  = float(p.get("forming_depth_mm", 0.0))
        stage      = p.get("stage_type", "progressive_forming")
        pass_no    = p.get("pass_no", 0)
        station_lbl = p.get("station_label", f"Station {pass_no}")

        # Pull from simulation output (already computed) or recompute
        strain_val = p.get("strain", 0.0)
        force_kn   = p.get("forming_force_kn", 0.0)
        power_kw   = p.get("motor_power_kw", 0.0)
        sb_deg     = p.get("springback_deg", 0.0)
        defects    = p.get("defects", [])

        # Strain severity
        strain_resp = calculate_strain(bend_radius_mm, thickness_mm, mat)
        strain_sev  = strain_resp.get("severity", "low")

        # Roll gap corrected for material springback
        gap_set = round(roll_gap, 3)

        # Defect severity flag
        sev_order = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}
        if defects:
            top_sev = max(defects, key=lambda d: sev_order.get(d.get("severity", "LOW"), 0))["severity"]
        else:
            top_sev = "NONE"

        op_note = _operator_note(stage, angle, sb_deg, defects, mat)

        station_cards.append({
            "station_no": pass_no,
            "station_label": station_lbl,
            "stage_type": stage,
            "target_angle_deg": round(angle, 2),
            "springback_correction_deg": round(sb_deg, 2),
            "corrected_bend_angle_deg": round(angle + sb_deg, 2),
            "roll_gap_set_mm": gap_set,
            "strip_width_entry_mm": round(strip_w, 1),
            "forming_depth_mm": round(forming_d, 2),
            "estimated_force_kn": round(force_kn, 3),
            "estimated_power_kw": round(power_kw, 3),
            "outer_fibre_strain_pct": round(strain_val * 100, 2),
            "strain_severity": _SEVERITY_SYMBOL.get(strain_sev, strain_sev),
            "defect_risk": top_sev,
            "defects": defects,
            "operator_note": op_note,
        })

    # Summary stats
    max_force  = max((s["estimated_force_kn"] for s in station_cards), default=0)
    max_power  = max((s["estimated_power_kw"] for s in station_cards), default=0)
    max_strain = max((s["outer_fibre_strain_pct"] for s in station_cards), default=0)
    high_risk  = [s["station_no"] for s in station_cards if s["defect_risk"] == "HIGH"]
    med_risk   = [s["station_no"] for s in station_cards if s["defect_risk"] == "MEDIUM"]

    header = {
        "project_ref": project_ref,
        "machine_name": machine_name,
        "material": mat,
        "material_name": mat_name,
        "thickness_mm": thickness_mm,
        "bend_radius_mm": bend_radius_mm,
        "yield_strength_mpa": Fy,
        "elastic_modulus_mpa": E,
        "total_stations": len(station_cards),
        "max_forming_force_kn": round(max_force, 3),
        "max_motor_power_kw": round(max_power, 3),
        "max_outer_fibre_strain_pct": round(max_strain, 2),
        "high_risk_stations": high_risk,
        "medium_risk_stations": med_risk,
        "quality_summary": simulation_result.get("quality", {}),
    }

    return pass_response("process_card_engine", {
        "header": header,
        "station_cards": station_cards,
        "card_count": len(station_cards),
        "confidence": "medium",
        "note": "Process card is a preliminary setup guide — verify all values against tooling drawings before production",
        "blocking": len(high_risk) > 0,
        "warnings": (
            [f"HIGH defect risk at station(s): {high_risk} — review required before production"] if high_risk else []
        ),
    })


def process_card_to_text(process_card_result: Dict[str, Any]) -> str:
    """
    Render a process card as a formatted text table for printing / PDF embedding.

    Args:
        process_card_result: Output of generate_process_card()

    Returns:
        Multi-line string suitable for display / export
    """
    if process_card_result.get("status") != "pass":
        return f"ERROR: {process_card_result.get('reason', 'Unknown error')}"

    header = process_card_result.get("header", {})
    cards  = process_card_result.get("station_cards", [])

    lines = []
    lines.append("=" * 110)
    lines.append(f"  PROCESS CARD — {header.get('project_ref', 'N/A')}  |  Machine: {header.get('machine_name', 'N/A')}")
    lines.append(f"  Material: {header.get('material_name', 'N/A')}  |  Thickness: {header.get('thickness_mm', 'N/A')} mm  |  "
                 f"Fy: {header.get('yield_strength_mpa', 'N/A')} MPa  |  Bend Radius: {header.get('bend_radius_mm', 'N/A')} mm")
    lines.append(f"  Stations: {header.get('total_stations', 'N/A')}  |  "
                 f"Peak Force: {header.get('max_forming_force_kn', 'N/A')} kN  |  "
                 f"Peak Power: {header.get('max_motor_power_kw', 'N/A')} kW  |  "
                 f"Max Strain: {header.get('max_outer_fibre_strain_pct', 'N/A')}%")
    lines.append("  *** PRELIMINARY — NOT FOR PRODUCTION WITHOUT ENGINEERING SIGN-OFF ***")
    lines.append("=" * 110)
    lines.append(
        f"  {'Stn':<5} {'Label':<28} {'Stage':<22} {'Angle':>7} {'SB':>6} {'Gap':>7} "
        f"{'StripW':>8} {'Force':>8} {'Pwr':>7} {'Strain%':>8} {'Risk':<8}"
    )
    lines.append("  " + "-" * 108)

    for c in cards:
        lines.append(
            f"  {str(c['station_no']):<5} {str(c['station_label'])[:27]:<28} "
            f"{str(c['stage_type'])[:21]:<22} "
            f"{c['target_angle_deg']:>6.1f}° "
            f"{c['springback_correction_deg']:>5.1f}° "
            f"{c['roll_gap_set_mm']:>6.3f}mm "
            f"{c['strip_width_entry_mm']:>7.1f}mm "
            f"{c['estimated_force_kn']:>7.2f}kN "
            f"{c['estimated_power_kw']:>6.2f}kW "
            f"{c['outer_fibre_strain_pct']:>7.2f}% "
            f"{c['defect_risk']:<8}"
        )

    lines.append("  " + "-" * 108)
    q = header.get("quality_summary", {})
    lines.append(f"  Quality: {q.get('label', 'N/A')} (score {q.get('score', 'N/A')}/100)  |  "
                 f"HIGH risk: {header.get('high_risk_stations', [])}  |  "
                 f"MEDIUM risk: {header.get('medium_risk_stations', [])}")
    lines.append("=" * 110)

    return "\n".join(lines)
