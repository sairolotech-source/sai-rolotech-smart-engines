"""
simulation_decision_engine.py — Simulation Go/No-Go Decision Engine

Makes a final forming readiness decision by combining:
  - simulation defect severity
  - optimizer score
  - quality score

Three possible decisions:
  • acceptable_for_preliminary_export  — proceed to tooling (green)
  • semi_auto_rework                   — apply corrections, re-simulate (yellow)
  • manual_review                      — engineering intervention required (red)
"""
from typing import Dict, Any, List
from app.utils.response import pass_response


def decide_simulation_status(
    simulation_result: Dict[str, Any],
    optimizer_result:  Dict[str, Any],
    quality:           Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """
    Determine overall forming readiness.

    Args:
        simulation_result: from simulation_engine
        optimizer_result:  from ai_optimizer_engine
        quality:           quality dict from simulation_engine.run_simulation()

    Returns:
        pass_response with decision, action, traffic_light, readiness_pct
    """
    sim_passes   = simulation_result.get("simulation_passes", [])
    opt_score    = int(optimizer_result.get("optimization_score", 100))
    qual_score   = int((quality or {}).get("score", 100))
    suggestions  = optimizer_result.get("suggestions", [])
    corrections  = optimizer_result.get("corrections", [])
    stations_added = int(optimizer_result.get("stations_added", 0))

    # Count defects across all passes (deduplicated by type)
    high_types: set = set()
    med_types:  set = set()
    for p in sim_passes:
        for d in p.get("defects", []):
            sev = d.get("severity", "LOW")
            if sev == "HIGH":   high_types.add(d.get("type", "unknown"))
            elif sev == "MEDIUM": med_types.add(d.get("type", "unknown"))

    blocking_defects = list(high_types)

    # ── Decision logic ────────────────────────────────────────────
    if blocking_defects:
        decision     = "manual_review"
        traffic_light = "RED"
        action = (
            f"Blocking defects detected: {', '.join(blocking_defects)}. "
            f"Engineering correction required before tooling can proceed."
        )
        readiness_pct = max(0, 40 - len(blocking_defects) * 10)

    elif opt_score < 70 or qual_score < 55:
        decision      = "semi_auto_rework"
        traffic_light = "YELLOW"
        action = (
            f"Apply {len(corrections)} optimizer correction(s) and re-simulate. "
            f"Optimizer score: {opt_score}/100. "
            + (f"Add {stations_added} station(s) as recommended." if stations_added else "")
        ).strip()
        readiness_pct = max(40, min(75, (opt_score + qual_score) // 2))

    else:
        decision      = "acceptable_for_preliminary_export"
        traffic_light = "GREEN"
        action = (
            "Simulation acceptable for preliminary tooling export. "
            "Validate with physical trial run before production."
            + (f" Note: {len(suggestions)} minor suggestion(s) available." if suggestions else "")
        )
        readiness_pct = max(75, min(100, (opt_score + qual_score) // 2))

    # ── Summary bullets ───────────────────────────────────────────
    summary: List[str] = []
    if high_types:
        summary.append(f"🔴 {len(high_types)} HIGH-severity defect type(s): {', '.join(sorted(high_types))}")
    if med_types:
        summary.append(f"🟡 {len(med_types)} MEDIUM-severity defect type(s): {', '.join(sorted(med_types))}")
    if stations_added:
        summary.append(f"➕ {stations_added} station(s) recommended by AI optimizer")
    if not summary:
        summary.append("✅ All stations clear — no defects detected")

    return pass_response("simulation_decision_engine", {
        "decision":        decision,
        "traffic_light":   traffic_light,
        "recommended_action": action,
        "readiness_pct":   readiness_pct,
        "summary":         summary,
        "blocking_defects": blocking_defects,
        "high_defect_types": list(high_types),
        "med_defect_types":  list(med_types),
        "optimizer_score":   opt_score,
        "quality_score":     qual_score,
        "confidence":        "medium",
        "blocking":          decision == "manual_review",
    })
