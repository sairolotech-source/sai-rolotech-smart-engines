"""
bom_engine.py — Bill of Materials (BOM) Generator

Generates a structured roll forming tooling BOM from engineering pipeline data.

BOM Line Items:
  1. Roll Set         — upper + lower forming rolls per station (D2/H13 tool steel)
  2. Shafts           — upper + lower shaft per station
  3. Spacer Set       — per station (inner + outer spacers)
  4. Bearings         — 2 per shaft × 2 shafts = 4 per station
  5. Keys (Woodruff)  — 2 per shaft (drive end + dead end)
  6. Side Roll Set    — where edge wave risk is flagged (optional)
  7. Entry Guide Set  — decoiler-side entry guide (1 per machine)
  8. Coil Stand       — mandrel decoiler (1 per machine)
  9. Exit Runout      — exit runout table (1 per machine)
  10. Hardware Pack   — per station (bolts, nuts, grub screws)

Material / grade assumptions:
  Roll body:    D2 tool steel (HRC 58–62), chrome ground OD, bore H7
  Shaft:        EN24 / 4340 steel, ground and keyed
  Bearing:      SKF deep groove ball bearing, selected by shaft dia
  Spacers:      4140 steel, precision ground
  Hardware:     Grade 8.8 DIN bolts

BOM quantity rules:
  - Each station has 1 upper roll + 1 lower roll
  - Calibration station has 1 upper + 1 lower (same rule, flagged differently)
  - Side rolls added only if edge_wave risk detected in simulation
  - 2 spare rolls (10%) recommended for production run
"""
import math
from typing import Any, Dict, List, Optional

from app.utils.response import pass_response, fail_response
from app.utils.material_database import get_property


_BEARING_BY_SHAFT: Dict[int, str] = {
    40: "SKF 6208",
    50: "SKF 6210",
    60: "SKF 6212",
    70: "SKF 6214",
    80: "SKF 6216",
}

_ROLL_MATERIAL = "D2 Tool Steel (HRC 58–62, chrome ground OD, bore H7)"
_SHAFT_MATERIAL = "EN24 / AISI 4340 alloy steel, ground and keyed"
_SPACER_MATERIAL = "4140 alloy steel, precision ground"


def _bearing_for_shaft(shaft_dia_mm: int) -> str:
    candidates = [d for d in sorted(_BEARING_BY_SHAFT) if d >= shaft_dia_mm]
    dia = candidates[0] if candidates else max(_BEARING_BY_SHAFT)
    return _BEARING_BY_SHAFT[dia]


def _roll_od(station_result: Dict[str, Any]) -> float:
    return float(station_result.get("estimated_roll_od_mm", 180.0))


def generate_bom(
    station_result: Dict[str, Any],
    shaft_result: Dict[str, Any],
    bearing_result: Dict[str, Any],
    machine_layout_result: Optional[Dict[str, Any]] = None,
    simulation_result: Optional[Dict[str, Any]] = None,
    material: str = "GI",
    include_spares: bool = True,
) -> Dict[str, Any]:
    """
    Generate a full Bill of Materials for a roll forming tooling set.

    Args:
        station_result:       Output of station_engine.estimate()
        shaft_result:         Output of shaft_engine
        bearing_result:       Output of bearing_engine
        machine_layout_result: Output of machine_layout_engine (optional)
        simulation_result:    Output of simulation_engine (optional, for side roll qty)
        material:             Material code of the product being formed
        include_spares:       Add spare rolls (recommended 10%)

    Returns:
        pass_response with bom_lines, total_items, weight_kg_estimate, summary
    """
    if not station_result or station_result.get("status") != "pass":
        return fail_response("bom_engine", "Station result missing or failed")
    if not shaft_result or shaft_result.get("status") != "pass":
        return fail_response("bom_engine", "Shaft result missing or failed")

    station_count = int(station_result.get("recommended_station_count", 8))
    shaft_dia_mm = int(shaft_result.get("suggested_shaft_diameter_mm", 50))
    bearing_type = bearing_result.get("suggested_bearing_type", _bearing_for_shaft(shaft_dia_mm)) if bearing_result else _bearing_for_shaft(shaft_dia_mm)
    ml = machine_layout_result or {}

    roll_od = float(station_result.get("estimated_roll_od_mm",
                    ml.get("roll_od_mm", 180.0)))
    roll_length_face = float(station_result.get("estimated_working_face_mm",
                             ml.get("shaft_center_distance_mm", 250.0) * 0.4))

    # Detect edge wave stations from simulation (for side roll requirement)
    edge_wave_stations = 0
    if simulation_result and simulation_result.get("status") == "pass":
        for p in simulation_result.get("simulation_passes", []):
            for d in p.get("defects", []):
                if d.get("type") in ("edge_wave",) and d.get("severity") == "MEDIUM":
                    edge_wave_stations += 1
                    break

    # ── Roll set weight estimate ──────────────────────────────────────────────
    density_steel_kg_m3 = 7850
    r_outer = roll_od / 2 / 1000          # m
    r_inner = shaft_dia_mm / 2 / 1000     # m (bore ~ shaft dia)
    face_m  = max(roll_length_face, 50) / 1000
    vol_m3  = math.pi * (r_outer**2 - r_inner**2) * face_m
    roll_weight_kg = round(vol_m3 * density_steel_kg_m3, 2)

    shaft_length_m = ml.get("shaft_center_distance_mm", 400.0) / 1000
    r_sh = shaft_dia_mm / 2 / 1000
    shaft_weight_kg = round(math.pi * r_sh**2 * shaft_length_m * density_steel_kg_m3, 2)

    bom_lines: List[Dict[str, Any]] = []
    item_no = 1

    # ── 1. Forming Rolls ─────────────────────────────────────────────────────
    roll_qty = station_count * 2   # upper + lower per station
    spare_qty = math.ceil(roll_qty * 0.10) if include_spares else 0
    bom_lines.append({
        "item_no": item_no,
        "description": "Forming Roll",
        "part_category": "Roll Tooling",
        "material_grade": _ROLL_MATERIAL,
        "qty": roll_qty,
        "spare_qty": spare_qty,
        "total_qty": roll_qty + spare_qty,
        "unit": "Nos",
        "roll_od_mm": roll_od,
        "bore_dia_mm": shaft_dia_mm,
        "face_width_mm": round(roll_length_face, 1),
        "unit_weight_kg": roll_weight_kg,
        "total_weight_kg": round((roll_qty + spare_qty) * roll_weight_kg, 2),
        "notes": "Profile ground to roll contour drawing; bore H7 tolerance",
    })
    item_no += 1

    # ── 2. Shafts ────────────────────────────────────────────────────────────
    shaft_qty = station_count * 2  # upper + lower per station
    bom_lines.append({
        "item_no": item_no,
        "description": "Forming Shaft",
        "part_category": "Shafts",
        "material_grade": _SHAFT_MATERIAL,
        "qty": shaft_qty,
        "spare_qty": 2 if include_spares else 0,
        "total_qty": shaft_qty + (2 if include_spares else 0),
        "unit": "Nos",
        "shaft_dia_mm": shaft_dia_mm,
        "shaft_length_mm": round(shaft_length_m * 1000, 0),
        "unit_weight_kg": shaft_weight_kg,
        "total_weight_kg": round(shaft_qty * shaft_weight_kg, 2),
        "notes": "Ground to h6; keyed both ends; thread for lock nut",
    })
    item_no += 1

    # ── 3. Bearings ──────────────────────────────────────────────────────────
    bearing_qty = station_count * 4  # 2 per shaft × 2 shafts
    bom_lines.append({
        "item_no": item_no,
        "description": f"Deep Groove Ball Bearing ({bearing_type})",
        "part_category": "Bearings",
        "material_grade": "Bearing steel 52100 / SKF or equivalent",
        "qty": bearing_qty,
        "spare_qty": 4 if include_spares else 0,
        "total_qty": bearing_qty + (4 if include_spares else 0),
        "unit": "Nos",
        "shaft_dia_mm": shaft_dia_mm,
        "notes": f"SKF or equivalent; grease packed; fitted to bearing housing",
    })
    item_no += 1

    # ── 4. Spacer Sets ───────────────────────────────────────────────────────
    spacer_sets = station_count * 2
    bom_lines.append({
        "item_no": item_no,
        "description": "Spacer Set (Inner + Outer per shaft side)",
        "part_category": "Spacers",
        "material_grade": _SPACER_MATERIAL,
        "qty": spacer_sets,
        "spare_qty": 0,
        "total_qty": spacer_sets,
        "unit": "Sets",
        "notes": "Ground to station-specific spacer widths; marked per station no.",
    })
    item_no += 1

    # ── 5. Keys (Woodruff / Parallel) ────────────────────────────────────────
    key_qty = station_count * 4  # 2 per shaft × 2 shafts
    bom_lines.append({
        "item_no": item_no,
        "description": "Shaft Key (Woodruff or Parallel)",
        "part_category": "Hardware",
        "material_grade": "Bright steel EN8",
        "qty": key_qty,
        "spare_qty": 4 if include_spares else 0,
        "total_qty": key_qty + (4 if include_spares else 0),
        "unit": "Nos",
        "shaft_dia_mm": shaft_dia_mm,
        "notes": "DIN 6885 Form A parallel key; size to match shaft dia",
    })
    item_no += 1

    # ── 6. Side Rolls (only if edge wave detected) ────────────────────────────
    if edge_wave_stations > 0:
        bom_lines.append({
            "item_no": item_no,
            "description": "Side Roll Set (Edge Guide)",
            "part_category": "Auxiliary Tooling",
            "material_grade": "D2 tool steel (HRC 55–58)",
            "qty": edge_wave_stations * 2,
            "spare_qty": 0,
            "total_qty": edge_wave_stations * 2,
            "unit": "Nos",
            "notes": f"Required at {edge_wave_stations} station(s) — edge wave risk identified in simulation",
        })
        item_no += 1

    # ── 7. Entry Guide Set ───────────────────────────────────────────────────
    entry_guide_needed = ml.get("entry_guide_recommended", True)
    if entry_guide_needed:
        bom_lines.append({
            "item_no": item_no,
            "description": "Entry Guide Set (Decoiler-side strip guide)",
            "part_category": "Machine Ancillary",
            "material_grade": "MS fabricated with hardened guide inserts",
            "qty": 1,
            "spare_qty": 0,
            "total_qty": 1,
            "unit": "Set",
            "notes": ml.get("entry_guide_type", "Standard pre-entry guide with lateral adjusters"),
        })
        item_no += 1

    # ── 8. Hardware Pack (per station) ───────────────────────────────────────
    bom_lines.append({
        "item_no": item_no,
        "description": "Hardware Pack per Station (Bolts, Nuts, Lock Nuts, Grub Screws)",
        "part_category": "Hardware",
        "material_grade": "Grade 8.8 / Grade 10.9 DIN",
        "qty": station_count,
        "spare_qty": 1 if include_spares else 0,
        "total_qty": station_count + (1 if include_spares else 0),
        "unit": "Sets",
        "notes": "Per-station kit includes: 4× M16 bolts, 4× hex nuts, 2× M8 grub screws, 2× lock nuts",
    })
    item_no += 1

    # ── 9. Coil Stand / Decoiler ─────────────────────────────────────────────
    bom_lines.append({
        "item_no": item_no,
        "description": "Motorized Decoiler / Coil Stand",
        "part_category": "Machine Assembly",
        "material_grade": "MS fabricated structure",
        "qty": 1,
        "spare_qty": 0,
        "total_qty": 1,
        "unit": "Nos",
        "notes": ml.get("coil_stand_type", "Motorized mandrel decoiler with brake"),
    })
    item_no += 1

    # ── 10. Exit Runout Table ─────────────────────────────────────────────────
    bom_lines.append({
        "item_no": item_no,
        "description": "Exit Runout Table",
        "part_category": "Machine Assembly",
        "material_grade": "MS fabricated with roller conveyor",
        "qty": 1,
        "spare_qty": 0,
        "total_qty": 1,
        "unit": "Nos",
        "notes": "Roller conveyor runout table; 3–5m length typical",
    })

    # ── Summary ───────────────────────────────────────────────────────────────
    total_items = sum(l["total_qty"] for l in bom_lines)
    total_weight = sum(l.get("total_weight_kg", 0) for l in bom_lines)

    return pass_response("bom_engine", {
        "station_count": station_count,
        "shaft_dia_mm": shaft_dia_mm,
        "roll_od_mm": round(roll_od, 1),
        "bearing_type": bearing_type,
        "edge_wave_stations": edge_wave_stations,
        "include_spares": include_spares,
        "bom_lines": bom_lines,
        "total_line_items": len(bom_lines),
        "total_item_qty": total_items,
        "total_tooling_weight_kg": round(total_weight, 2),
        "confidence": "medium",
        "warnings": [
            "BOM is preliminary — verify all dimensions against final tooling drawings",
            "Roll face widths depend on profile flange/web geometry; confirm before ordering",
            "Spare quantities are indicative (10%) — adjust based on production volume",
        ],
    })
