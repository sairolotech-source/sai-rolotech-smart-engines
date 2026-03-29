from typing import Dict, Any, List
from app.utils.response import pass_response, fail_response

VALID_SECTION_TYPES = {
    "simple_channel", "c_channel", "angle_section",
    "lipped_channel", "z_purlin", "hat_section",
    "box_section", "complex_section", "shutter_profile", "unknown"
}


def generate_advanced_flower(
    profile_result: Dict[str, Any],
    input_result: Dict[str, Any]
) -> Dict[str, Any]:
    if not profile_result:
        return fail_response("advanced_flower_engine", "Profile result missing")

    if not input_result:
        return fail_response("advanced_flower_engine", "Input result missing")

    bend_count = int(profile_result.get("bend_count", 0))
    return_bends = int(profile_result.get("return_bends_count", 0))
    section_features = profile_result.get("section_features", {})
    section_payload = section_features if isinstance(section_features, dict) else {}

    section_type = extract_section_type(section_payload, profile_result)
    if section_type not in VALID_SECTION_TYPES:
        section_type = "unknown"

    symmetry = extract_symmetry(section_payload)
    flanges = extract_flanges(section_payload)
    lips = extract_lips(section_payload)
    flange_count = len(flanges)
    lip_count = len(lips)
    web_length = extract_web_length(section_payload)

    thickness = float(input_result.get("sheet_thickness_mm", 0))
    material = str(input_result.get("material", "")).upper()

    if bend_count <= 0:
        return fail_response("advanced_flower_engine", "Bend count not detected")

    # Extract actual bend angles from profile or infer from section type
    raw_bends = profile_result.get("bend_angles_deg", [])
    if not raw_bends or not isinstance(raw_bends, list):
        raw_bends = _infer_bend_angles(section_type, bend_count, flanges, lips)

    complexity_score = calculate_complexity_score(
        bend_count=bend_count,
        return_bends=return_bends,
        flange_count=flange_count,
        lip_count=lip_count,
        symmetry=symmetry,
        thickness=thickness,
        material=material,
        web_length=web_length,
        section_type=section_type
    )

    complexity_class = classify_complexity(complexity_score)
    estimated_passes = estimate_passes(
        bend_count=bend_count,
        return_bends=return_bends,
        lip_count=lip_count,
        thickness=thickness,
        material=material,
        complexity_class=complexity_class,
        section_type=section_type
    )

    pass_plan = build_pass_plan(
        section_type=section_type,
        complexity_class=complexity_class,
        estimated_passes=estimated_passes,
        lip_count=lip_count,
        return_bends=return_bends,
        symmetry=symmetry,
        bend_angles=raw_bends
    )

    warnings = build_warnings(
        section_type=section_type,
        complexity_class=complexity_class,
        thickness=thickness,
        material=material,
        return_bends=return_bends
    )

    return pass_response("advanced_flower_engine", {
        "section_type": section_type,
        "complexity_score": complexity_score,
        "forming_complexity_class": complexity_class,
        "estimated_forming_passes": estimated_passes,
        "pass_distribution_logic": [p["label"] for p in pass_plan],
        "pass_plan": pass_plan,
        "warnings": warnings,
        "assumptions": [
            "Per-bend angle arrays are fractional progressions toward target angles",
            "Calibration passes include 2% springback overbend compensation",
            "Final pass design still needs expert review for production tooling"
        ]
    })


def calculate_complexity_score(
    bend_count: int,
    return_bends: int,
    flange_count: int,
    lip_count: int,
    symmetry: str,
    thickness: float,
    material: str,
    web_length: float,
    section_type: str
) -> int:
    score = bend_count

    score += return_bends * 2
    score += lip_count

    if flange_count > 2:
        score += 2

    if symmetry == "asymmetric":
        score += 2

    if thickness > 2.0:
        score += 3
    elif thickness > 1.2:
        score += 2
    elif thickness >= 0.8:
        score += 1

    if material in {"SS", "HR"}:
        score += 2
    elif material in {"MS", "CR"}:
        score += 1

    if web_length > 150:
        score += 1

    if section_type == "lipped_channel":
        score += 1
    elif section_type == "complex_section":
        score += 3
    elif section_type == "shutter_profile":
        score += 4

    return score


def classify_complexity(score: int) -> str:
    if score <= 4:
        return "simple"
    if score <= 8:
        return "medium"
    if score <= 13:
        return "complex"
    return "very_complex"


def estimate_passes(
    bend_count: int,
    return_bends: int,
    lip_count: int,
    thickness: float,
    material: str,
    complexity_class: str,
    section_type: str
) -> int:
    passes = bend_count

    if complexity_class == "simple":
        passes += 2
    elif complexity_class == "medium":
        passes += 3
    elif complexity_class == "complex":
        passes += 5
    else:
        passes += 7

    passes += return_bends
    passes += min(lip_count, 2)

    if thickness >= 1.2:
        passes += 1
    if thickness >= 2.0:
        passes += 1

    if material in {"SS", "HR"}:
        passes += 1

    if section_type in {"complex_section", "shutter_profile"}:
        passes += 2

    return max(passes, bend_count + 2)


def _infer_bend_angles(
    section_type: str,
    bend_count: int,
    flanges: list,
    lips: list
) -> List[float]:
    """Return inferred target angles (deg) for each bend when DXF data is unavailable."""
    if section_type in {"simple_channel", "c_channel", "angle_section",
                        "lipped_channel", "z_purlin"}:
        flange_angles = [90.0] * min(len(flanges) or 2, bend_count)
        lip_angles = [90.0] * min(len(lips), bend_count - len(flange_angles))
        result = flange_angles + lip_angles
    elif section_type == "hat_section":
        result = [90.0] * min(4, bend_count)
    elif section_type in {"box_section", "complex_section"}:
        result = [90.0] * bend_count
    else:
        result = [90.0] * bend_count
    # Pad or trim to bend_count
    while len(result) < bend_count:
        result.append(90.0)
    return result[:bend_count]


def _compute_pass_angle_progression(
    bend_angles: List[float],
    num_passes: int,
    final_pass_offset: int = 2
) -> List[List[float]]:
    """
    For each forming pass (excluding calibration), compute fractional angle targets.
    Calibration passes use overbend (angle * 1.02) to compensate springback.
    Returns a list of per-pass angle arrays.
    """
    forming_passes = max(1, num_passes - final_pass_offset)
    result: List[List[float]] = []
    for p in range(num_passes):
        if p < forming_passes:
            pct = (p + 1) / forming_passes
            pass_angles = [round(a * pct, 2) for a in bend_angles]
        else:
            # calibration: target final angle + springback overbend
            pass_angles = [round(a * 1.02, 2) for a in bend_angles]
        result.append(pass_angles)
    return result


def build_pass_plan(
    section_type: str,
    complexity_class: str,
    estimated_passes: int,
    lip_count: int,
    return_bends: int,
    symmetry: str,
    bend_angles: List[float] = None
) -> List[Dict[str, Any]]:
    """
    Build a structured pass plan with per-bend numeric angle targets.
    Returns List[{pass, label, bend_angles_deg, progression_pct, is_calibration}]
    """
    if bend_angles is None:
        bend_angles = []

    labels: List[str] = []
    labels.append("edge pickup")
    labels.append("initial leg pre-form")

    if symmetry == "symmetric":
        labels.append("balanced two-side progression")
    else:
        labels.append("asymmetric side-controlled progression")

    if section_type in {"simple_channel", "c_channel", "angle_section", "lipped_channel"}:
        labels.append("web stabilization")
        labels.append("main flange angle progression")

    if lip_count > 0:
        labels.append("lip initiation")
        labels.append("lip angle progression")

    if return_bends > 0:
        labels.append("return bend controlled forming")

    if complexity_class in {"complex", "very_complex"}:
        labels.append("intermediate shape stabilization")
        labels.append("progressive closure control")

    if section_type in {"complex_section", "shutter_profile"}:
        labels.append("multi-feature sequential forming")

    labels.append("pre-calibration")
    labels.append("final calibration")

    # Compress/expand labels to match estimated_passes
    labels = _compress_labels_to_target(labels, estimated_passes)
    n = len(labels)

    # Compute per-pass angle arrays
    calibration_passes = 2 if n >= 4 else 1
    angle_progressions = _compute_pass_angle_progression(bend_angles, n, calibration_passes)

    plan: List[Dict[str, Any]] = []
    for i, (label, angles) in enumerate(zip(labels, angle_progressions)):
        is_cal = i >= (n - calibration_passes)
        pct = round(100 * (i + 1) / n, 1)
        plan.append({
            "pass": i + 1,
            "label": label,
            "bend_angles_deg": angles,
            "progression_pct": pct,
            "is_calibration": is_cal,
        })

    return plan


def _compress_labels_to_target(labels: List[str], target: int) -> List[str]:
    if len(labels) == target:
        return labels
    if len(labels) < target:
        out = list(labels)
        idx = 1
        while len(out) < target:
            out.insert(-2, f"intermediate forming stage {idx}")
            idx += 1
        return out
    seen: set = set()
    essential: List[str] = []
    for item in labels:
        if item not in seen:
            essential.append(item)
            seen.add(item)
    return essential[:target]


def build_warnings(
    section_type: str,
    complexity_class: str,
    thickness: float,
    material: str,
    return_bends: int
) -> List[str]:
    warnings: List[str] = []

    if return_bends > 0:
        warnings.append("Return bends may require more careful progressive forming")

    if material == "SS":
        warnings.append("SS material may increase springback risk")

    if thickness > 1.2:
        warnings.append("Higher thickness may require stronger station support")

    if complexity_class in {"complex", "very_complex"}:
        warnings.append("Complex profile should be manually reviewed before production")

    if section_type == "shutter_profile":
        warnings.append("Shutter-like profiles usually need tighter sequence control")

    return warnings


def extract_section_type(section_payload: Dict[str, Any], profile_result: Dict[str, Any]) -> str:
    if "section_type" in section_payload:
        return str(section_payload["section_type"])
    return str(profile_result.get("profile_type", "custom"))


def extract_symmetry(section_payload: Dict[str, Any]) -> str:
    return str(section_payload.get("symmetry", "unknown"))


def extract_flanges(section_payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    flanges = section_payload.get("flanges", [])
    return flanges if isinstance(flanges, list) else []


def extract_lips(section_payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    lips = section_payload.get("lips", [])
    return lips if isinstance(lips, list) else []


def extract_web_length(section_payload: Dict[str, Any]) -> float:
    web = section_payload.get("web", {})
    if isinstance(web, dict):
        return float(web.get("length", 0) or 0)
    return 0.0
