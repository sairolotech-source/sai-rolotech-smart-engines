"""
engineering_rules.py — Single Source of Truth for all Rule Book constants.
Mirrors artifacts/api-server/src/lib/engineering-rules.ts exactly.

Rule Book version: v2.2.0
"""
from typing import Dict, Tuple

# ─── Supported materials ──────────────────────────────────────────────────────
SUPPORTED_MATERIALS = ["GI", "CR", "HR", "SS", "AL", "MS", "CU", "TI", "PP", "HSLA"]

# ─── K-factors (DIN 6935 neutral axis) ───────────────────────────────────────
K_FACTORS: Dict[str, float] = {
    "GI": 0.44,
    "CR": 0.44,
    "HR": 0.42,
    "SS": 0.50,
    "AL": 0.43,
    "MS": 0.42,
    "CU": 0.44,
    "TI": 0.50,
    "PP": 0.44,
    "HSLA": 0.45,
}

# ─── Springback factors ───────────────────────────────────────────────────────
SPRINGBACK_FACTORS: Dict[str, float] = {
    "GI": 1.02,
    "CR": 1.02,
    "HR": 1.03,
    "SS": 1.06,
    "AL": 1.04,
    "MS": 1.03,
    "CU": 1.01,
    "TI": 1.08,
    "PP": 1.10,
    "HSLA": 1.05,
}

# ─── Complexity tiers (bend count → tier) ────────────────────────────────────
# SIMPLE: 1–4 bends, MEDIUM: 5–8, COMPLEX: 9–12, VERY_COMPLEX: 13+

COMPLEXITY_LABELS: Dict[str, str] = {
    "SIMPLE": "Simple channel / U-section",
    "MEDIUM": "Standard C/Z / lipped channel",
    "COMPLEX": "Shutter / complex return profile",
    "VERY_COMPLEX": "Ultra-complex / multi-return",
}

COMPLEXITY_CORRECTION: Dict[str, int] = {
    "SIMPLE": 0,
    "MEDIUM": 2,
    "COMPLEX": 4,
    "VERY_COMPLEX": 6,
}


def classify_complexity(bend_count: int) -> str:
    if bend_count <= 4:
        return "SIMPLE"
    if bend_count <= 8:
        return "MEDIUM"
    if bend_count <= 12:
        return "COMPLEX"
    return "VERY_COMPLEX"


# ─── Thickness station correction ─────────────────────────────────────────────
def thickness_station_correction(t: float) -> int:
    if t < 0.8:
        return 0
    if t < 1.2:
        return 1
    if t < 2.0:
        return 2
    return 3


def thickness_category(t: float) -> str:
    if t < 0.8:
        return "thin"
    if t < 1.2:
        return "standard"
    if t < 2.0:
        return "medium-heavy"
    return "heavy"


# ─── Material station correction ─────────────────────────────────────────────
MATERIAL_STATION_CORRECTION: Dict[str, int] = {
    "GI": 0, "CR": 0, "AL": 0, "PP": 0,
    "HR": 1, "MS": 1, "CU": 1,
    "SS": 2, "HSLA": 2,
    "TI": 3,
}

MATERIAL_FORMING_DIFFICULTY: Dict[str, str] = {
    "GI": "easy", "CR": "easy", "AL": "easy", "PP": "easy",
    "HR": "moderate", "MS": "moderate", "CU": "moderate",
    "SS": "hard", "HSLA": "hard",
    "TI": "very_hard",
}


# ─── Station estimation — Rule Book §4 ───────────────────────────────────────
def estimate_stations_rule_book(
    bend_count: int,
    material: str,
    thickness: float,
) -> Dict:
    complexity = classify_complexity(bend_count)
    complexity_corr = COMPLEXITY_CORRECTION[complexity]
    thickness_corr = thickness_station_correction(thickness)
    material_corr = MATERIAL_STATION_CORRECTION.get(material.upper(), 0)

    base = max(bend_count, 2)
    raw = base + complexity_corr + thickness_corr + material_corr
    recommended = max(4, raw)
    minimum = max(4, recommended - 2)
    maximum = recommended + 4

    formula = (
        f"bend_count({base}) + complexity(+{complexity_corr}) + "
        f"thickness(+{thickness_corr}) + material(+{material_corr}) = {raw} "
        f"→ recommended {recommended}"
    )

    return {
        "complexity": complexity,
        "complexity_label": COMPLEXITY_LABELS[complexity],
        "recommended": recommended,
        "minimum": minimum,
        "maximum": maximum,
        "formula": formula,
        "corrections": {
            "base": base,
            "complexity": complexity_corr,
            "thickness": thickness_corr,
            "material": material_corr,
        },
    }


# ─── Duty class — Rule Book §5 ────────────────────────────────────────────────
# LIGHT: thin + simple | MEDIUM: standard | HEAVY: complex/thick | INDUSTRIAL: very heavy
def calc_duty_class(thickness: float, complexity: str, material: str) -> str:
    mat_corr = MATERIAL_STATION_CORRECTION.get(material.upper(), 0)
    if thickness < 0.8 and complexity == "SIMPLE" and mat_corr == 0:
        return "LIGHT"
    if thickness <= 1.2 and complexity in ("SIMPLE", "MEDIUM") and mat_corr <= 1:
        return "MEDIUM"
    if thickness <= 2.5 and complexity in ("SIMPLE", "MEDIUM", "COMPLEX") and mat_corr <= 2:
        return "HEAVY"
    return "INDUSTRIAL"


# ─── Shaft diameter table — Rule Book §6 ─────────────────────────────────────
SHAFT_DIAMETER_MM: Dict[str, int] = {
    "LIGHT": 40,
    "MEDIUM": 50,
    "HEAVY": 60,
    "INDUSTRIAL": 70,
}

# ─── Bearing by shaft diameter — Rule Book §7 ────────────────────────────────
BEARING_BY_SHAFT: Dict[int, str] = {
    40: "6208",
    50: "6210",
    60: "6212",
    70: "6214",
}


def select_bearing_for_shaft(shaft_dia_mm: int) -> str:
    return BEARING_BY_SHAFT.get(shaft_dia_mm, "6210")
