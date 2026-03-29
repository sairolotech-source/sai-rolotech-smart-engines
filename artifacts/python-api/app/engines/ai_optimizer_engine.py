"""
ai_optimizer_engine.py — AI Optimizer Engine

Analyses simulation results and recommends corrections:
  • station count adjustment
  • pass distribution changes
  • specific defect corrections per stand
  • optimization score (0–100)

This is a rule-based AI approximation (not a deep-learning model),
designed to be fast and deterministic for real-time use.
"""
from typing import Dict, Any, List
from app.utils.response import pass_response, fail_response


def optimize_roll_forming_plan(
    simulation_result: Dict[str, Any],
    station_result:    Dict[str, Any],
    profile_result:    Dict[str, Any],
    input_result:      Dict[str, Any],
) -> Dict[str, Any]:
    """
    Analyse simulation and generate optimization recommendations.

    Args:
        simulation_result: output from simulation_engine.run_simulation()
        station_result:    output from station_engine.estimate()
        profile_result:    output from profile_analysis_engine.analyze_profile()
        input_result:      output from input_engine.validate_inputs()

    Returns:
        pass_response with optimization_score, suggestions, recommended changes
    """
    sim_passes = simulation_result.get("simulation_passes", [])
    if not sim_passes:
        return fail_response("ai_optimizer_engine", "No simulation passes to analyse")

    rec_stations = int(station_result.get("recommended_station_count", 0))
    material     = str(input_result.get("material", "GI")).upper()
    thickness    = float(input_result.get("sheet_thickness_mm", 1.5))
    profile_type = str(profile_result.get("profile_type", "custom"))
    bend_count   = int(profile_result.get("bend_count", 4))

    suggestions:      List[str] = []
    corrections:      List[Dict] = []
    score = 100
    add_stations = 0

    for p in sim_passes:
        defects    = p.get("defects", [])
        stand_no   = p.get("pass_no", 0)
        stage      = p.get("stage_type", "")
        angle      = p.get("target_angle_deg", 0)
        ratio      = p.get("pass_progress_pct", 0) / 100.0

        for d in defects:
            dtype = d.get("type", "")
            sev   = d.get("severity", "LOW")

            if dtype == "cracking":
                if sev == "HIGH":
                    msg = (
                        f"Stand {stand_no}: CRACKING risk — "
                        f"increase inner bend radius or split station {stand_no} into 2 sub-passes"
                    )
                    corrections.append({
                        "stand": stand_no, "action": "split_pass",
                        "detail": f"Reduce bend progression at station {stand_no} by ~30%",
                        "priority": "HIGH",
                    })
                    add_stations += 1
                    score -= 20
                else:
                    msg = (
                        f"Stand {stand_no}: Strain approaching limit — "
                        f"consider larger bend radius (R/t ≥ 1.5)"
                    )
                    score -= 8
                suggestions.append(msg)

            elif dtype == "wrinkling":
                msg = f"Stand {stand_no}: Wrinkling risk — reduce roll gap by ~0.05mm and increase back-tension"
                corrections.append({
                    "stand": stand_no, "action": "reduce_roll_gap",
                    "detail": "Apply 5–10% back-tension on entry; reduce gap by 0.05mm",
                    "priority": "HIGH" if sev == "HIGH" else "MEDIUM",
                })
                score -= 15 if sev == "HIGH" else 6
                suggestions.append(msg)

            elif dtype == "edge_wave":
                msg = f"Stand {stand_no}: Edge wave risk — add side roll or increase strip tension between stands"
                corrections.append({
                    "stand": stand_no, "action": "add_side_roll",
                    "detail": "Insert passive side rolls between stands to constrain strip edge",
                    "priority": "MEDIUM",
                })
                score -= 5
                suggestions.append(msg)

            elif dtype == "bow_camber":
                msg = f"Stand {stand_no}: Bow risk — re-align upper/lower roll bearing and check entry guide"
                score -= 3
                suggestions.append(msg)

            elif dtype == "twist":
                msg = f"Stand {stand_no}: Twist/camber risk — verify roll geometry; add outboard guide rolls"
                score -= 5
                suggestions.append(msg)

            elif dtype == "springback":
                over_bend = {"GI": 1.5, "MS": 2.5, "CR": 2.5, "SS": 4.0}.get(material, 2.0)
                msg = (
                    f"Stand {stand_no}: Springback — over-bend by {over_bend}° "
                    f"(corrected angle = {round(angle + over_bend, 1)}°)"
                )
                corrections.append({
                    "stand": stand_no, "action": "increase_over_bend",
                    "detail": f"Set forming angle to {round(angle + over_bend, 1)}° (springback correction = {over_bend}°)",
                    "priority": "MEDIUM",
                })
                score -= 5
                suggestions.append(msg)

    # ── General structural suggestions ────────────────────────────
    if bend_count > 6 and rec_stations < bend_count * 2:
        suggestions.append(
            f"Complex profile ({bend_count} bends): Consider {bend_count * 2} stations "
            f"for progressive angle graduation ≤ 15°/pass"
        )
        score -= 3

    if thickness < 0.8 and rec_stations < 10:
        suggestions.append(
            "Thin gauge material: Add minimum 2 extra pre-forming stations to prevent flutter"
        )
        add_stations += 2
        score -= 5

    if material in {"SS", "HR"} and rec_stations < bend_count * 2.5:
        suggestions.append(
            f"High-strength {material}: Recommend {int(bend_count * 2.5)} stations "
            f"to keep per-pass angle increment ≤ 12°"
        )
        add_stations += 1
        score -= 4

    # ── Optimised station count ───────────────────────────────────
    optimised_stations = rec_stations + add_stations

    # ── Pass distribution suggestions ────────────────────────────
    pass_dist: List[str] = []
    if optimised_stations > rec_stations:
        pass_dist.append(f"Original: {rec_stations} stations → Optimised: {optimised_stations} stations")
        pass_dist.append("Add transitional pre-bend pass at entry")
    if not suggestions:
        pass_dist.append("No changes required — current station plan is optimal for this material")

    score = max(0, min(100, score))
    label = (
        "OPTIMAL"    if score >= 95 else
        "EXCELLENT"  if score >= 88 else
        "GOOD"       if score >= 75 else
        "ACCEPTABLE" if score >= 58 else "NEEDS_REVIEW"
    )

    # Deduplicate suggestions
    seen = set()
    unique_suggestions = []
    for s in suggestions:
        if s not in seen:
            seen.add(s)
            unique_suggestions.append(s)

    return pass_response("ai_optimizer_engine", {
        "optimization_score":     score,
        "optimization_label":     label,
        "suggestions":            unique_suggestions,
        "corrections":            corrections,
        "pass_distribution_notes": pass_dist,
        "recommended_station_count": rec_stations,
        "optimised_station_count":   optimised_stations,
        "stations_added":            add_stations,
        "profile_type":              profile_type,
        "material":                  material,
        "confidence":                "medium",
        "blocking":                  False,
        "note": "Rule-based AI approximation — not a machine-learning model",
    })
