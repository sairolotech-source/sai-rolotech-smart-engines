"""
cam_prep_engine.py — CAM Machining Prep Engine

Generates structured machining notes for roll tooling:
  • Rough turning specs (DOC, feed, speed)
  • Finish turning specs
  • Profile / groove cut specs
  • Keyway slot specs
  • Insert recommendations
  • CAM-ready JSON for SolidCAM bridge

Blueprint source: Ultra Pro – SolidCAM Auto Toolpath Blueprint.
"""
import logging
from typing import Any, Dict, List

logger = logging.getLogger("cam_prep_engine")

# ── Roll material machining properties ────────────────────────────────────────
# Roll material: EN31 or D2 tool steel (HRC 58-62 hardened)
ROLL_MATERIAL_DB = {
    "EN31": {
        "hardness_hrc":   58,
        "cutting_speed_mpm": 80,   # before hardening (annealed EN31)
        "finish_speed_mpm":  60,
        "rough_feed_mpm":    0.25,
        "finish_feed_mpm":   0.10,
        "rough_doc_mm":      2.0,
        "finish_doc_mm":     0.2,
        "insert_type":       "CCMT 09T304 (TiN coated carbide)",
        "cooling":           "flood coolant",
    },
    "D2": {
        "hardness_hrc":   62,
        "cutting_speed_mpm": 60,
        "finish_speed_mpm":  45,
        "rough_feed_mpm":    0.20,
        "finish_feed_mpm":   0.08,
        "rough_doc_mm":      1.5,
        "finish_doc_mm":     0.15,
        "insert_type":       "CNMG 12 04 08 (CBN / cermet for post-hardening)",
        "cooling":           "minimum quantity lubrication (MQL)",
    },
}

# ── Keyway rules (DIN 6885 key size by shaft dia) ─────────────────────────────
KEYWAY_TABLE: Dict[int, Dict[str, float]] = {
    40:  {"b": 12, "h": 8,  "t1": 5.0, "t2": 3.3},
    50:  {"b": 14, "h": 9,  "t1": 5.5, "t2": 3.8},
    60:  {"b": 18, "h": 11, "t1": 7.0, "t2": 4.4},
    70:  {"b": 20, "h": 12, "t1": 7.5, "t2": 4.9},
}

def _get_keyway(shaft_dia_mm: int) -> Dict[str, Any]:
    for dia, kw in sorted(KEYWAY_TABLE.items()):
        if shaft_dia_mm <= dia:
            return {"shaft_dia_mm": shaft_dia_mm, **kw, "standard": "DIN 6885 Part 1"}
    dia, kw = max(KEYWAY_TABLE.items())
    return {"shaft_dia_mm": shaft_dia_mm, **kw, "standard": "DIN 6885 Part 1 (extrapolated)"}


def _rpm(speed_mpm: float, od_mm: float) -> int:
    if od_mm <= 0:
        return 0
    return round(speed_mpm * 1000 / (3.14159 * od_mm))


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _extract_xy_points(points: Any) -> List[tuple[float, float]]:
    out: List[tuple[float, float]] = []
    if not isinstance(points, list):
        return out
    for p in points:
        if isinstance(p, dict):
            if "x" in p and "y" in p:
                out.append((_safe_float(p.get("x")), _safe_float(p.get("y"))))
        elif isinstance(p, (list, tuple)) and len(p) >= 2:
            out.append((_safe_float(p[0]), _safe_float(p[1])))
    return out


def _contour_depth_mm(top_pts: Any, bottom_pts: Any) -> float:
    pts = _extract_xy_points(top_pts) + _extract_xy_points(bottom_pts)
    if not pts:
        return 0.0
    ys = [p[1] for p in pts]
    return round(max(ys) - min(ys), 3)


def _derive_station_dimensions(
    pass_data: Dict[str, Any],
    default_roll_od: float,
    shaft_dia: int,
    default_face_mm: float,
) -> Dict[str, float]:
    tooling = pass_data.get("tooling", {}) if isinstance(pass_data.get("tooling"), dict) else {}
    top_contour = tooling.get("top_roll_contour") or pass_data.get("upper_roll_profile") or []
    bottom_contour = tooling.get("bottom_roll_contour") or pass_data.get("lower_roll_profile") or []

    contour_depth = _safe_float(tooling.get("groove_depth_mm"), 0.0)
    if contour_depth <= 0:
        contour_depth = _safe_float(pass_data.get("forming_depth_mm"), 0.0)
    if contour_depth <= 0:
        contour_depth = _contour_depth_mm(top_contour, bottom_contour)
    contour_depth = max(0.0, contour_depth)

    upper_r = _safe_float(pass_data.get("upper_roll_radius_mm"), 0.0)
    lower_r = _safe_float(pass_data.get("lower_roll_radius_mm"), 0.0)
    gap = _safe_float(pass_data.get("roll_gap_mm"), 0.0)

    od_from_radii = max(upper_r * 2.0, lower_r * 2.0)
    od_from_contour = contour_depth + gap + shaft_dia + 18.0
    station_od = max(default_roll_od, od_from_radii, od_from_contour, shaft_dia + 20.0)

    face_candidates = [
        _safe_float(tooling.get("face_width_mm"), 0.0),
        _safe_float(pass_data.get("roll_width_mm"), 0.0),
        _safe_float(pass_data.get("strip_width_mm"), 0.0) + 12.0,
        default_face_mm,
    ]
    station_face = max(c for c in face_candidates if c > 0)

    return {
        "od_mm": round(station_od, 3),
        "face_width_mm": round(station_face, 3),
        "profile_depth_mm": round(contour_depth, 3),
    }


def _operations_for_roll(
    roll: Dict[str, Any],
    roll_material: str,
    shaft_dia: int,
) -> List[Dict[str, Any]]:
    props      = ROLL_MATERIAL_DB.get(roll_material, ROLL_MATERIAL_DB["EN31"])
    od_mm      = roll.get("od_mm", 120)
    bore_mm    = shaft_dia
    face_mm    = roll.get("face_width_mm", 40)
    profile_depth = roll.get("profile_depth_mm", 10)
    kw = _get_keyway(shaft_dia)

    ops: List[Dict[str, Any]] = []

    # 1. Rough turning OD
    ops.append({
        "op_no":      10,
        "operation":  "Rough Turning — OD",
        "tool":       props["insert_type"],
        "cutting_speed_mpm": props["cutting_speed_mpm"],
        "feed_mm_rev": props["rough_feed_mpm"],
        "doc_mm":     props["rough_doc_mm"],
        "rpm":        _rpm(props["cutting_speed_mpm"], od_mm),
        "coolant":    props["cooling"],
        "note":       f"Turn OD to +0.5 mm stock. Target OD {od_mm:.1f} mm",
    })

    # 2. Boring / turning bore
    ops.append({
        "op_no":      20,
        "operation":  "Boring — Bore (ID)",
        "tool":       "Boring bar — CCMT insert TiN coated",
        "cutting_speed_mpm": props["finish_speed_mpm"],
        "feed_mm_rev": props["finish_feed_mpm"],
        "doc_mm":     0.5,
        "rpm":        _rpm(props["finish_speed_mpm"], bore_mm),
        "coolant":    props["cooling"],
        "note":       f"Bore to Ø{bore_mm} H7 ({bore_mm:.3f}/{bore_mm + 0.030:.3f})",
    })

    # 3. Face milling / turning face
    ops.append({
        "op_no":      30,
        "operation":  "Finish Turning — Face & OD",
        "tool":       props["insert_type"],
        "cutting_speed_mpm": props["finish_speed_mpm"],
        "feed_mm_rev": props["finish_feed_mpm"],
        "doc_mm":     props["finish_doc_mm"],
        "rpm":        _rpm(props["finish_speed_mpm"], od_mm),
        "coolant":    props["cooling"],
        "note":       f"Final OD {od_mm:.1f} mm | Face width {face_mm:.1f} mm | Ra ≤ 0.8 μm",
    })

    # 4. Profile / groove turning
    if profile_depth > 0:
        ops.append({
            "op_no":      40,
            "operation":  "Profile Turning — Forming Contour",
            "tool":       "Form tool / grooving insert radius matched to profile",
            "cutting_speed_mpm": props["finish_speed_mpm"] * 0.8,
            "feed_mm_rev": 0.05,
            "doc_mm":     0.1,
            "rpm":        _rpm(props["finish_speed_mpm"] * 0.8, od_mm),
            "coolant":    "flood coolant",
            "note": (
                f"Profile depth {profile_depth:.1f} mm. "
                "Multi-pass CNC contour cycle. Verify with profile projector."
            ),
        })

    # 5. Keyway
    ops.append({
        "op_no":      50,
        "operation":  "Keyway Milling",
        "tool":       f"End mill Ø{kw['b']} mm HSS-Co",
        "feed_mm_rev": 0.02,
        "doc_mm":     kw["t1"],
        "rpm":        800,
        "coolant":    "flood coolant",
        "note": (
            f"DIN 6885 keyway: b={kw['b']} mm, h={kw['h']} mm, "
            f"t1={kw['t1']} mm. Tolerance H9/D10."
        ),
    })

    # 6. Heat treatment note (between rough and finish)
    ops.append({
        "op_no":      60,
        "operation":  "Heat Treatment — Hardening",
        "tool":       "N/A (sub-contract process)",
        "feed_mm_rev": None,
        "doc_mm":     None,
        "rpm":        None,
        "coolant":    "None",
        "note": (
            f"Heat treat {roll_material} to HRC {props['hardness_hrc']}. "
            "Quench & temper. Leave 0.2 mm grinding stock post-HT."
        ),
    })

    # 7. OD grinding after HT
    ops.append({
        "op_no":      70,
        "operation":  "OD Grinding (post heat treatment)",
        "tool":       "Cylindrical grinder — CBN wheel",
        "cutting_speed_mpm": 30,
        "feed_mm_rev": 0.005,
        "doc_mm":     0.05,
        "rpm":        _rpm(30, od_mm),
        "coolant":    "flood coolant",
        "note": (
            f"Grind OD to final {od_mm:.1f} mm. Tolerance h6 "
            f"({od_mm - 0.011:.3f}/{od_mm:.3f}). Roundness ≤ 0.005 mm."
        ),
    })

    return sorted(ops, key=lambda o: o["op_no"])


def generate_cam_prep(
    roll_contour_result: Dict[str, Any],
    shaft_result: Dict[str, Any],
    roll_calc_result: Dict[str, Any],
    input_result: Dict[str, Any],
    station_result: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Generate CAM prep spec for all rolls in the set.
    """
    shaft_dia   = int(shaft_result.get("suggested_shaft_diameter_mm", 50))
    roll_od     = float(roll_calc_result.get("estimated_roll_od_mm", 120))
    n_stations  = int(station_result.get("recommended_station_count", 6))
    material    = input_result.get("material", "GI")
    thickness   = float(input_result.get("sheet_thickness_mm", 1.0))
    passes_data = roll_contour_result.get("passes", [])

    # Choose roll steel — D2 for SS/HR/heavy, EN31 for everything else
    roll_material = "D2" if material in {"SS", "HR"} or thickness > 2.0 else "EN31"
    roll_props    = ROLL_MATERIAL_DB[roll_material]

    default_face = _safe_float(
        roll_calc_result.get("spacer_recommendation", {}).get("suggested_working_face_mm", 50),
        50.0,
    )

    # Build per-station roll specs from contour-derived station geometry.
    rolls: List[Dict[str, Any]] = []
    for p in passes_data:
        station_dims = _derive_station_dimensions(
            pass_data=p,
            default_roll_od=roll_od,
            shaft_dia=shaft_dia,
            default_face_mm=default_face,
        )
        roll_spec = {
            "roll_label":      f"Stand {p['pass_no']} Upper + Lower",
            "station_no":      p["pass_no"],
            "stage_type":      p["stage_type"],
            "od_mm":           station_dims["od_mm"],
            "bore_mm":         shaft_dia,
            "face_width_mm":   station_dims["face_width_mm"],
            "profile_depth_mm": station_dims["profile_depth_mm"],
            "hardness_hrc":    roll_props["hardness_hrc"],
            "roll_material":   roll_material,
            "dimension_source": "contour_station_derived",
            "top_roll_contour": (p.get("tooling", {}) or {}).get("top_roll_contour", p.get("upper_roll_profile", [])),
            "bottom_roll_contour": (p.get("tooling", {}) or {}).get("bottom_roll_contour", p.get("lower_roll_profile", [])),
        }
        rolls.append({
            **roll_spec,
            "operations": _operations_for_roll(roll_spec, roll_material, shaft_dia),
        })

    # Calibration roll
    cal_pass = roll_contour_result.get("calibration_pass", {}) if isinstance(roll_contour_result, dict) else {}
    cal_dims = _derive_station_dimensions(
        pass_data=cal_pass,
        default_roll_od=roll_od,
        shaft_dia=shaft_dia,
        default_face_mm=default_face,
    )
    cal_station = int(cal_pass.get("pass_no", n_stations)) if isinstance(cal_pass, dict) else n_stations
    cal_spec = {
        "roll_label":      f"Stand {cal_station} Cal. Upper + Lower",
        "station_no":      cal_station,
        "stage_type":      "calibration",
        "od_mm":           cal_dims["od_mm"],
        "bore_mm":         shaft_dia,
        "face_width_mm":   cal_dims["face_width_mm"],
        "profile_depth_mm": cal_dims["profile_depth_mm"],
        "hardness_hrc":    roll_props["hardness_hrc"],
        "roll_material":   roll_material,
        "dimension_source": "contour_station_derived",
        "top_roll_contour": (cal_pass.get("tooling", {}) or {}).get("top_roll_contour", cal_pass.get("upper_roll_profile", []))
            if isinstance(cal_pass, dict) else [],
        "bottom_roll_contour": (cal_pass.get("tooling", {}) or {}).get("bottom_roll_contour", cal_pass.get("lower_roll_profile", []))
            if isinstance(cal_pass, dict) else [],
    }
    rolls.append({
        **cal_spec,
        "operations": _operations_for_roll(cal_spec, roll_material, shaft_dia),
    })

    # ── General machining notes ────────────────────────────────────────────────
    general_notes = [
        f"Roll material: {roll_material} (EN31 = general; D2 = SS/HR/thick material)",
        f"Hardness after HT: HRC {roll_props['hardness_hrc']}",
        "Machine in pre-hardened state, leave 0.2 mm grinding stock",
        f"OD tolerance: h6. Bore tolerance: H7. Face perpendicularity: 0.01 mm TIR",
        "Profile verified with optical projector or CMM before assembly",
        "Mark each roll: 'U' for upper, 'L' for lower; stand number engraved",
        "Keyway per DIN 6885 — broach after boring, deburr all edges",
        f"Insert: {roll_props['insert_type']}",
    ]

    # ── SolidCAM bridge data ───────────────────────────────────────────────────
    max_roll_od = max((r.get("od_mm", roll_od) for r in rolls), default=roll_od)
    max_roll_face = max((r.get("face_width_mm", default_face) for r in rolls), default=default_face)

    solidcam_bridge = {
        "cam_software":   "SolidCAM 2024 / SolidWorks 2024",
        "stock_od_mm":    round(max_roll_od + 6, 3),
        "stock_bore_mm":  shaft_dia - 4,
        "stock_length_mm": round(max_roll_face + 10, 3),
        "finish_tolerance_mm": 0.01,
        "surface_finish_ra":   0.8,
        "operations_sequence": [
            "10 - Rough turning OD",
            "20 - Boring / ID turning",
            "30 - Finish turning OD + faces",
            "40 - Profile contour (CNC form cycle)",
            "50 - Keyway milling",
            "60 - Send for heat treatment",
            "70 - OD cylindrical grinding",
            "80 - Final inspection + marking",
        ],
        "toolpath_strategy": "Turn-Mill. Profile cycle for forming contour. CNC turning centre preferred.",
        "material_handoff":  f"Export STEP from SolidWorks → import to SolidCAM → apply strategy above",
    }

    logger.info(
        "[cam_prep] roll_material=%s shaft=%d roll_od=%.1f stations=%d",
        roll_material, shaft_dia, roll_od, n_stations,
    )

    return {
        "status":          "pass",
        "engine":          "cam_prep_engine",
        "roll_material":   roll_material,
        "hardness_hrc":    roll_props["hardness_hrc"],
        "shaft_dia_mm":    shaft_dia,
        "roll_od_mm":      round(max_roll_od, 3),
        "total_rolls":     len(rolls),
        "rolls":           rolls,
        "keyway":          _get_keyway(shaft_dia),
        "general_notes":   general_notes,
        "solidcam_bridge": solidcam_bridge,
    }
