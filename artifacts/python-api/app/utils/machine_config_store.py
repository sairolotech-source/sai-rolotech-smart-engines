"""
machine_config_store.py — Roll Forming Machine Configuration Store
═══════════════════════════════════════════════════════════════════
Phase C: Machine-aware engineering validation.

Stores machine master data: stand count, shaft dia, roll OD limits,
strip width range, thickness range, line speed, supported materials,
calibration offsets, and pass-limit rules.

4 pre-loaded machines:
  SAI-LITE-12  — Light duty (12 stands, shaft 40mm)
  SAI-STD-20   — Standard (20 stands, shaft 50mm)
  SAI-HD-30    — Heavy duty (30 stands, shaft 70mm)
  SAI-CNC-24   — CNC precision (24 stands, shaft 60mm)

Persistence: JSON files in machines/ directory.
"""
from __future__ import annotations

import json
import logging
import os
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("machine_config_store")

_THIS_DIR = Path(__file__).resolve().parent.parent.parent
MACHINE_DIR = _THIS_DIR / "machines"


def _ensure_dir() -> None:
    MACHINE_DIR.mkdir(parents=True, exist_ok=True)


# ─── MACHINE MASTER DATA ──────────────────────────────────────────────────────

MACHINE_REGISTRY: Dict[str, Dict[str, Any]] = {
    "SAI-LITE-12": {
        "machine_id":             "SAI-LITE-12",
        "display_name":           "SAI Light Duty — 12-Stand Mill",
        "machine_class":          "light_duty",
        "stand_count":            12,
        "shaft_diameter_mm":      40,
        "max_roll_od_mm":         180,
        "strip_width_min_mm":     60,
        "strip_width_max_mm":     300,
        "thickness_min_mm":       0.40,
        "thickness_max_mm":       2.00,
        "max_line_speed_mpm":     20.0,
        "motor_power_kw":         11.0,
        "supported_materials":    ["GI", "CR", "AL"],
        "calibration_offsets": {
            "roll_gap_correction_mm":  0.05,
            "angle_correction_deg":    0.5,
            "strip_tension_factor":    1.0,
        },
        "pass_limit_rules": {
            "max_forming_passes":        10,
            "max_calibration_passes":    2,
            "max_bends_per_profile":     6,
            "allow_lipped":              True,
            "allow_tube_profiles":       False,
            "min_bend_radius_x_t":       1.5,
        },
        "tooling_constraints": {
            "shaft_dia_mm":      40,
            "max_od_mm":         180,
            "bearing_series":    "6208",
            "keyway":            "DIN 6885 Form A",
        },
        "notes": "Suitable for GI/CR up to 2mm — shutter slats, door frames, light purlins",
    },

    "SAI-STD-20": {
        "machine_id":             "SAI-STD-20",
        "display_name":           "SAI Standard — 20-Stand Mill",
        "machine_class":          "standard",
        "stand_count":            20,
        "shaft_diameter_mm":      50,
        "max_roll_od_mm":         220,
        "strip_width_min_mm":     80,
        "strip_width_max_mm":     500,
        "thickness_min_mm":       0.50,
        "thickness_max_mm":       3.00,
        "max_line_speed_mpm":     18.0,
        "motor_power_kw":         22.0,
        "supported_materials":    ["GI", "CR", "HR", "MS", "SS", "AL"],
        "calibration_offsets": {
            "roll_gap_correction_mm":  0.08,
            "angle_correction_deg":    0.3,
            "strip_tension_factor":    1.0,
        },
        "pass_limit_rules": {
            "max_forming_passes":        18,
            "max_calibration_passes":    3,
            "max_bends_per_profile":     10,
            "allow_lipped":              True,
            "allow_tube_profiles":       False,
            "min_bend_radius_x_t":       1.2,
        },
        "tooling_constraints": {
            "shaft_dia_mm":      50,
            "max_od_mm":         220,
            "bearing_series":    "6210",
            "keyway":            "DIN 6885 Form A",
        },
        "notes": "Industry workhorse — C/Z purlins, lipped channels, hat sections, sigma profiles",
    },

    "SAI-HD-30": {
        "machine_id":             "SAI-HD-30",
        "display_name":           "SAI Heavy Duty — 30-Stand Mill",
        "machine_class":          "heavy_duty",
        "stand_count":            30,
        "shaft_diameter_mm":      70,
        "max_roll_od_mm":         320,
        "strip_width_min_mm":     100,
        "strip_width_max_mm":     800,
        "thickness_min_mm":       1.00,
        "thickness_max_mm":       6.00,
        "max_line_speed_mpm":     12.0,
        "motor_power_kw":         55.0,
        "supported_materials":    ["GI", "CR", "HR", "MS", "SS", "HSLA", "AL"],
        "calibration_offsets": {
            "roll_gap_correction_mm":  0.12,
            "angle_correction_deg":    0.2,
            "strip_tension_factor":    1.1,
        },
        "pass_limit_rules": {
            "max_forming_passes":        26,
            "max_calibration_passes":    4,
            "max_bends_per_profile":     16,
            "allow_lipped":              True,
            "allow_tube_profiles":       True,
            "min_bend_radius_x_t":       1.0,
        },
        "tooling_constraints": {
            "shaft_dia_mm":      70,
            "max_od_mm":         320,
            "bearing_series":    "6214",
            "keyway":            "DIN 6885 Form A",
        },
        "notes": "Structural purlins 2–6mm, sigma sections, square/rect tube — high-force applications",
    },

    "SAI-CNC-24": {
        "machine_id":             "SAI-CNC-24",
        "display_name":           "SAI CNC Precision — 24-Stand Servo Mill",
        "machine_class":          "cnc_precision",
        "stand_count":            24,
        "shaft_diameter_mm":      60,
        "max_roll_od_mm":         260,
        "strip_width_min_mm":     40,
        "strip_width_max_mm":     600,
        "thickness_min_mm":       0.30,
        "thickness_max_mm":       4.00,
        "max_line_speed_mpm":     25.0,
        "motor_power_kw":         37.0,
        "supported_materials":    ["GI", "CR", "HR", "MS", "SS", "AL", "TI"],
        "calibration_offsets": {
            "roll_gap_correction_mm":  0.02,
            "angle_correction_deg":    0.1,
            "strip_tension_factor":    0.98,
        },
        "pass_limit_rules": {
            "max_forming_passes":        22,
            "max_calibration_passes":    4,
            "max_bends_per_profile":     14,
            "allow_lipped":              True,
            "allow_tube_profiles":       True,
            "min_bend_radius_x_t":       0.8,
        },
        "tooling_constraints": {
            "shaft_dia_mm":      60,
            "max_od_mm":         260,
            "bearing_series":    "6212",
            "keyway":            "DIN 6885 Form A",
        },
        "notes": "Servo-driven CNC — stainless/titanium precision profiles, tight tolerances, thin gauges",
    },
}


# ─── VALIDATION ───────────────────────────────────────────────────────────────

def validate_profile_on_machine(
    machine_id: str,
    profile_type: str,
    thickness_mm: float,
    strip_width_mm: float,
    bend_count: int,
    material: str,
    required_stations: int,
    max_roll_od_needed_mm: float = 0.0,
) -> Dict[str, Any]:
    """
    Check whether a profile can be manufactured on a given machine.

    Returns a dict with:
      feasible: bool
      warnings: List[str]
      blocking_reasons: List[str]
      adjusted_params: Dict  (e.g. clipped station count)
      machine_utilisation: Dict  (% of limits used)
    """
    mc = MACHINE_REGISTRY.get(machine_id)
    if not mc:
        return {
            "feasible": False,
            "blocking_reasons": [f"Machine '{machine_id}' not found in registry"],
            "warnings": [],
            "adjusted_params": {},
            "machine_utilisation": {},
        }

    blocking: List[str] = []
    warnings: List[str] = []
    adjusted: Dict[str, Any] = {}

    plr = mc["pass_limit_rules"]
    tc  = mc["tooling_constraints"]

    # ── thickness check ────────────────────────────────────────────────────────
    if thickness_mm < mc["thickness_min_mm"]:
        blocking.append(
            f"Thickness {thickness_mm}mm < machine minimum {mc['thickness_min_mm']}mm"
        )
    elif thickness_mm > mc["thickness_max_mm"]:
        blocking.append(
            f"Thickness {thickness_mm}mm > machine maximum {mc['thickness_max_mm']}mm"
        )

    # ── strip width check ──────────────────────────────────────────────────────
    if strip_width_mm < mc["strip_width_min_mm"]:
        blocking.append(
            f"Strip width {strip_width_mm}mm < machine minimum {mc['strip_width_min_mm']}mm"
        )
    elif strip_width_mm > mc["strip_width_max_mm"]:
        blocking.append(
            f"Strip width {strip_width_mm}mm > machine maximum {mc['strip_width_max_mm']}mm"
        )

    # ── material check ─────────────────────────────────────────────────────────
    if material.upper() not in [m.upper() for m in mc["supported_materials"]]:
        blocking.append(
            f"Material '{material}' not supported on {machine_id}. "
            f"Supported: {mc['supported_materials']}"
        )

    # ── bend count / profile type check ───────────────────────────────────────
    if bend_count > plr["max_bends_per_profile"]:
        blocking.append(
            f"Profile has {bend_count} bends, machine limit is {plr['max_bends_per_profile']}"
        )

    if profile_type in ("square_tube", "rect_tube", "box_section") and not plr["allow_tube_profiles"]:
        blocking.append(
            f"Tube/closed profiles not supported on {machine_id} (requires seam-welding capability)"
        )

    # ── station count check ────────────────────────────────────────────────────
    if required_stations > mc["stand_count"]:
        blocking.append(
            f"Profile needs {required_stations} stations, machine has only {mc['stand_count']} stands"
        )
    elif required_stations > mc["stand_count"] * 0.90:
        warnings.append(
            f"Station utilisation >90% ({required_stations}/{mc['stand_count']}) — no capacity buffer"
        )
    adjusted["station_count"] = min(required_stations, mc["stand_count"])

    # ── roll OD check ──────────────────────────────────────────────────────────
    if max_roll_od_needed_mm > tc["max_od_mm"]:
        blocking.append(
            f"Profile needs roll OD {max_roll_od_needed_mm:.0f}mm, "
            f"machine max is {tc['max_od_mm']}mm — tooling will not fit"
        )
    elif max_roll_od_needed_mm > tc["max_od_mm"] * 0.90:
        warnings.append(
            f"Roll OD {max_roll_od_needed_mm:.0f}mm is >90% of machine limit {tc['max_od_mm']}mm"
        )

    # ── calibration offset application ────────────────────────────────────────
    offsets = mc["calibration_offsets"]
    adjusted["roll_gap_correction_mm"]  = offsets["roll_gap_correction_mm"]
    adjusted["angle_correction_deg"]    = offsets["angle_correction_deg"]
    adjusted["strip_tension_factor"]    = offsets["strip_tension_factor"]

    # ── utilisation ────────────────────────────────────────────────────────────
    utilisation = {
        "station_pct":   round(required_stations / mc["stand_count"] * 100, 1),
        "thickness_pct": round(
            (thickness_mm - mc["thickness_min_mm"]) /
            max(0.01, mc["thickness_max_mm"] - mc["thickness_min_mm"]) * 100, 1
        ),
        "strip_width_pct": round(
            (strip_width_mm - mc["strip_width_min_mm"]) /
            max(0.01, mc["strip_width_max_mm"] - mc["strip_width_min_mm"]) * 100, 1
        ),
        "od_pct": round(max_roll_od_needed_mm / tc["max_od_mm"] * 100, 1) if max_roll_od_needed_mm else 0.0,
    }

    feasible = len(blocking) == 0
    return {
        "feasible":           feasible,
        "machine_id":         machine_id,
        "machine_class":      mc["machine_class"],
        "blocking_reasons":   blocking,
        "warnings":           warnings,
        "adjusted_params":    adjusted,
        "machine_utilisation": utilisation,
        "stand_count":        mc["stand_count"],
        "shaft_diameter_mm":  mc["shaft_diameter_mm"],
        "max_roll_od_mm":     tc["max_od_mm"],
    }


def find_capable_machines(
    profile_type: str,
    thickness_mm: float,
    strip_width_mm: float,
    bend_count: int,
    material: str,
    required_stations: int,
    max_roll_od_needed_mm: float = 0.0,
) -> List[Dict[str, Any]]:
    """Return all machines capable of running this profile, ranked by utilisation."""
    results = []
    for mid in MACHINE_REGISTRY:
        v = validate_profile_on_machine(
            mid, profile_type, thickness_mm, strip_width_mm,
            bend_count, material, required_stations, max_roll_od_needed_mm,
        )
        v["machine_display_name"] = MACHINE_REGISTRY[mid]["display_name"]
        results.append(v)

    capable    = [r for r in results if r["feasible"]]
    not_capable = [r for r in results if not r["feasible"]]

    capable.sort(key=lambda r: r["machine_utilisation"].get("station_pct", 0))
    return capable + not_capable


# ─── PERSISTENCE ──────────────────────────────────────────────────────────────

def list_machines() -> List[Dict[str, Any]]:
    """Return all machines in the registry + any persisted custom machines."""
    _ensure_dir()
    machines = [deepcopy(v) for v in MACHINE_REGISTRY.values()]

    for fp in MACHINE_DIR.glob("*.json"):
        try:
            with open(fp) as f:
                custom = json.load(f)
            mid = custom.get("machine_id", "")
            if mid and mid not in MACHINE_REGISTRY:
                machines.append(custom)
        except Exception as exc:
            logger.warning("Failed to load custom machine %s: %s", fp, exc)

    return machines


def get_machine(machine_id: str) -> Optional[Dict[str, Any]]:
    """Return machine config by ID (built-in or persisted)."""
    if machine_id in MACHINE_REGISTRY:
        return deepcopy(MACHINE_REGISTRY[machine_id])

    _ensure_dir()
    fp = MACHINE_DIR / f"{machine_id}.json"
    if fp.is_file():
        with open(fp) as f:
            return json.load(f)
    return None


def save_machine(config: Dict[str, Any]) -> Dict[str, Any]:
    """Persist a custom machine config (overwrites if exists)."""
    _ensure_dir()
    mid = config.get("machine_id", "").strip()
    if not mid:
        raise ValueError("machine_id is required")

    fp = MACHINE_DIR / f"{mid}.json"
    with open(fp, "w") as f:
        json.dump(config, f, indent=2)
    logger.info("Saved machine config: %s → %s", mid, fp)
    return config


def delete_machine(machine_id: str) -> bool:
    """Delete a persisted machine (built-in machines cannot be deleted)."""
    if machine_id in MACHINE_REGISTRY:
        raise ValueError(f"Built-in machine '{machine_id}' cannot be deleted")

    _ensure_dir()
    fp = MACHINE_DIR / f"{machine_id}.json"
    if fp.is_file():
        fp.unlink()
        return True
    return False


def machine_summary() -> Dict[str, Any]:
    """High-level summary of the machine registry."""
    all_mc = list_machines()
    return {
        "total_machines":    len(all_mc),
        "machine_ids":       [m["machine_id"] for m in all_mc],
        "machine_classes":   sorted(set(m.get("machine_class", "custom") for m in all_mc)),
        "stand_count_range": {
            "min": min(m["stand_count"] for m in all_mc),
            "max": max(m["stand_count"] for m in all_mc),
        },
        "thickness_range_mm": {
            "min": min(m["thickness_min_mm"] for m in all_mc),
            "max": max(m["thickness_max_mm"] for m in all_mc),
        },
    }
