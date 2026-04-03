"""
defect_engine.py — Forming Defect Detection Engine

Detects the following defect types:
  • cracking      — outer-fibre strain near / over fracture limit
  • wrinkling     — thin strip at late pass under high ratio
  • edge_wave     — high free-span slenderness between roll sets
  • bow_camber    — longitudinal bow from uneven forming
  • twist         — complex profiles or high return-bend count
  • springback    — under-compensated springback at final pass

Each defect has: type, severity (HIGH/MEDIUM/LOW), icon, message, blocking
"""
from typing import Dict, Any, List
from app.utils.response import pass_response

_FRACTURE: Dict[str, float] = {
    "GI": 0.40, "GP": 0.40, "MS": 0.38, "CR": 0.38,
    "HR": 0.35, "SS": 0.32, "AL": 0.28, "ALUMINIUM": 0.28,
}

_YIELD: Dict[str, float] = {
    "GI": 250, "GP": 250, "MS": 250, "CR": 280,
    "HR": 240, "SS": 310, "AL": 160, "ALUMINIUM": 160,
}


def detect_defects(
    strain_value:       float,
    pass_ratio:         float,
    thickness_mm:       float,
    profile_type:       str  = "unknown",
    return_bends_count: int  = 0,
    strip_width_mm:     float = 150.0,
    angle_deg:          float = 0.0,
    material:           str  = "GI",
) -> Dict[str, Any]:
    """
    Detect forming defects for a single pass.

    Returns:
        pass_response with defects list, defect_severity, blocking
    """
    mat      = str(material).upper()
    fracture = _FRACTURE.get(mat, 0.38)
    Fy       = _YIELD.get(mat, 250)
    defects: List[Dict] = []
    blocking = False

    # ── 1. Cracking ──────────────────────────────────────────────
    if strain_value >= fracture:
        defects.append({
            "type": "cracking", "severity": "HIGH", "icon": "💥",
            "message": f"Outer-fibre strain {strain_value:.1%} ≥ fracture limit {fracture:.0%}",
        })
        blocking = True
    elif strain_value >= fracture * 0.75:
        defects.append({
            "type": "cracking", "severity": "MEDIUM", "icon": "⚠️",
            "message": f"Strain {strain_value:.1%} approaching fracture limit — monitor bend zone",
        })

    # ── 2. Wrinkling ─────────────────────────────────────────────
    if pass_ratio > 0.80 and thickness_mm < 0.8:
        defects.append({
            "type": "wrinkling", "severity": "HIGH", "icon": "〰️",
            "message": f"Thin strip ({thickness_mm}mm) at pass {pass_ratio:.0%} — wrinkling risk; reduce roll gap",
        })
        blocking = True
    elif pass_ratio > 0.85 and thickness_mm < 1.2:
        defects.append({
            "type": "wrinkling", "severity": "MEDIUM", "icon": "〰️",
            "message": f"Light gauge ({thickness_mm}mm) at late pass — verify roll gap and strip tension",
        })

    # ── 3. Edge wave ─────────────────────────────────────────────
    free_span = strip_width_mm * 0.40
    slenderness = free_span / thickness_mm if thickness_mm > 0 else 0
    if pass_ratio > 0.70 and slenderness > 130:
        defects.append({
            "type": "edge_wave", "severity": "MEDIUM", "icon": "🌊",
            "message": f"Free-span slenderness {slenderness:.0f} — edge wave risk; increase inter-pass strip tension",
        })
    elif pass_ratio > 0.50 and slenderness > 180:
        defects.append({
            "type": "edge_wave", "severity": "HIGH", "icon": "🌊",
            "message": f"Very high slenderness {slenderness:.0f} — edge wave likely; add side roll or strip guide",
        })
        blocking = True

    # ── 4. Bow / Camber ──────────────────────────────────────────
    if 0.30 < pass_ratio < 0.70 and angle_deg > 35 and slenderness > 80:
        defects.append({
            "type": "bow_camber", "severity": "LOW", "icon": "🏹",
            "message": "Longitudinal bow possible — verify roll bearing alignment and entry guide",
        })

    # ── 5. Twist (complex profiles / return bends) ───────────────
    complex_profiles = {"complex_profile", "complex_section", "shutter_profile", "z_section"}
    if profile_type.lower() in complex_profiles:
        defects.append({
            "type": "twist", "severity": "MEDIUM", "icon": "🌀",
            "message": f"Complex profile '{profile_type}' — twist/camber review required; verify roll geometry",
        })
    if return_bends_count > 0:
        defects.append({
            "type": "twist", "severity": "MEDIUM", "icon": "🔄",
            "message": f"{return_bends_count} return bend(s) — closure instability risk; use controlled return-bend stage",
        })

    # ── 6. Springback (high-strength, final passes) ───────────────
    if pass_ratio > 0.90 and Fy > 300 and angle_deg > 85:
        defects.append({
            "type": "springback", "severity": "MEDIUM", "icon": "↩️",
            "message": f"High-strength material (Fy={Fy}MPa) at final pass — verify springback over-bend is applied",
        })

    # ── Compute overall severity ──────────────────────────────────
    sev_order = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}
    if defects:
        max_sev = max(defects, key=lambda d: sev_order.get(d["severity"], 0))["severity"]
    else:
        max_sev = "none"

    return pass_response("defect_engine", {
        "defects":         defects,
        "defect_count":    len(defects),
        "defect_severity": max_sev.lower() if max_sev != "none" else "none",
        "confidence":      "medium",
        "blocking":        blocking,
    })
