from typing import Dict, Any, List
from app.utils.response import pass_response, fail_response


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
    symmetry = extract_symmetry(section_payload)
    flange_count = len(extract_flanges(section_payload))
    lip_count = len(extract_lips(section_payload))
    web_length = extract_web_length(section_payload)

    thickness = float(input_result.get("sheet_thickness_mm", 0))
    material = str(input_result.get("material", "")).upper()

    if bend_count <= 0:
        return fail_response("advanced_flower_engine", "Bend count not detected")

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
        symmetry=symmetry
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
        "pass_distribution_logic": pass_plan,
        "warnings": warnings,
        "assumptions": [
            "Preliminary rule-based flower logic used",
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


def build_pass_plan(
    section_type: str,
    complexity_class: str,
    estimated_passes: int,
    lip_count: int,
    return_bends: int,
    symmetry: str
) -> List[str]:
    plan: List[str] = []

    plan.append("edge pickup")
    plan.append("initial leg pre-form")

    if symmetry == "symmetric":
        plan.append("balanced two-side progression")
    else:
        plan.append("asymmetric side-controlled progression")

    if section_type in {"simple_channel", "lipped_channel"}:
        plan.append("web stabilization")
        plan.append("main flange angle progression")

    if lip_count > 0:
        plan.append("lip initiation")
        plan.append("lip angle progression")

    if return_bends > 0:
        plan.append("return bend controlled forming")

    if complexity_class in {"complex", "very_complex"}:
        plan.append("intermediate shape stabilization")
        plan.append("progressive closure control")

    if section_type in {"complex_section", "shutter_profile"}:
        plan.append("multi-feature sequential forming")

    plan.append("pre-calibration")
    plan.append("final calibration")

    return compress_plan_to_target(plan, estimated_passes)


def compress_plan_to_target(plan: List[str], target: int) -> List[str]:
    if len(plan) == target:
        return plan

    if len(plan) < target:
        out = list(plan)
        idx = 1
        while len(out) < target:
            out.insert(-2, f"intermediate forming stage {idx}")
            idx += 1
        return out

    essential = []
    seen = set()
    for item in plan:
        if item not in seen:
            essential.append(item)
            seen.add(item)

    if len(essential) <= target:
        return essential[:target]

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
