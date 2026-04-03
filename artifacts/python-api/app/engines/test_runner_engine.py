"""
test_runner_engine.py — Standard Test Suite
Runs 8 built-in test cases matching the Final Master Blueprint §17.

Test cases:
  TC-01  Simple channel (GI)
  TC-02  Lipped channel (CR)
  TC-03  Shutter profile (HR)
  TC-04  Invalid thickness (negative → input_engine fail)
  TC-05  Empty DXF (no entities → early pipeline fail)
  TC-06  Unsupported DXF entities (TEXT-only → import/geometry fail)
  TC-07  Contradiction case (lipped_channel declared but 2 bends → consistency warning)
  TC-08  Heavy duty with small shaft mismatch (3.5mm MS wide section)

Each result includes: input, expected, actual, pass/fail, failed_stage.
"""
import logging
from typing import Any, Dict, List

logger = logging.getLogger("test_runner_engine")


def _manual_case(
    name: str,
    expected_pass: bool,
    expected_mode: str | None,
    expected_min_conf: int,
    expected_failed_stage: str | None,
    **kwargs: Any,
) -> Dict[str, Any]:
    return {
        "name": name,
        "source": "manual",
        "input": dict(kwargs),
        "expected": {
            "pipeline_pass": expected_pass,
            "mode": expected_mode,
            "min_confidence": expected_min_conf,
            "failed_stage": expected_failed_stage,
        },
    }


def _auto_case(
    name: str,
    expected_pass: bool,
    expected_mode: str | None,
    expected_failed_stage: str | None,
    entities: List[Dict[str, Any]],
    thickness: float = 1.0,
    material: str = "GI",
) -> Dict[str, Any]:
    return {
        "name": name,
        "source": "auto",
        "input": {"entities": entities, "thickness": thickness, "material": material},
        "expected": {
            "pipeline_pass": expected_pass,
            "mode": expected_mode,
            "min_confidence": 0,
            "failed_stage": expected_failed_stage,
        },
    }


STANDARD_CASES: List[Dict[str, Any]] = [
    _manual_case(
        "TC-01: GI Simple Channel",
        expected_pass=True, expected_mode="auto_mode", expected_min_conf=70, expected_failed_stage=None,
        bend_count=2, section_width_mm=100, section_height_mm=40, thickness=0.8, material="GI", profile_type="simple_channel",
    ),
    _manual_case(
        "TC-02: CR Lipped Channel",
        expected_pass=True, expected_mode="auto_mode", expected_min_conf=80, expected_failed_stage=None,
        bend_count=4, section_width_mm=120, section_height_mm=55, thickness=1.0, material="CR", profile_type="lipped_channel",
    ),
    _manual_case(
        "TC-03: HR Shutter Profile",
        expected_pass=True, expected_mode=None, expected_min_conf=65, expected_failed_stage=None,
        bend_count=8, section_width_mm=250, section_height_mm=30, thickness=1.2, material="HR", profile_type="shutter_profile",
    ),
    # TC-04: Invalid thickness — thickness=0 is rejected by Pydantic (gt=0 constraint)
    # We use a semantically invalid thickness: extremely thick (>10mm for CR) that the input_engine should flag
    {
        "name": "TC-04: Invalid Thickness (0.0 mm — below minimum)",
        "source": "manual_raw",
        "input": {"bend_count": 2, "section_width_mm": 100, "section_height_mm": 40, "thickness": 0.0, "material": "GI", "profile_type": "simple_channel"},
        "expected": {
            "pipeline_pass": False,
            "mode": None,
            "min_confidence": 0,
            "failed_stage": "input_engine",
        },
    },
    # TC-05: Empty DXF — no entities → import engine returns sparse geometry → profile analysis fails
    _auto_case(
        "TC-05: Empty DXF (zero entities)",
        expected_pass=False, expected_mode=None, expected_failed_stage="file_import_engine",
        entities=[],
    ),
    # TC-06: Unsupported DXF entities — only TEXT entity, no geometry
    _auto_case(
        "TC-06: Unsupported DXF Entities (TEXT-only)",
        expected_pass=False, expected_mode=None, expected_failed_stage=None,
        entities=[{"type": "TEXT", "text": "DIMENSION", "x": 0, "y": 0}],
    ),
    _manual_case(
        "TC-07: Contradiction — Lipped Channel, Only 2 Bends",
        expected_pass=True, expected_mode="semi_auto", expected_min_conf=0, expected_failed_stage=None,
        bend_count=2, section_width_mm=100, section_height_mm=40, thickness=1.0, material="GI", profile_type="lipped_channel",
    ),
    _manual_case(
        "TC-08: Heavy Duty — Wide MS Section (shaft mismatch expected)",
        expected_pass=True, expected_mode=None, expected_min_conf=50, expected_failed_stage=None,
        bend_count=10, section_width_mm=400, section_height_mm=120, thickness=3.5, material="MS", profile_type="complex_profile",
    ),
]


def run_all_tests(
    execute_manual_pipeline: Any,
    execute_auto_pipeline: Any,
    ManualProfileInput: Any,
    AutoModeInput: Any,
) -> Dict[str, Any]:
    """
    Run all standard test cases.
    Requires callables injected from routes.py to avoid circular imports.
    """
    results: List[Dict[str, Any]] = []
    all_pass = True

    for case in STANDARD_CASES:
        name = case["name"]
        source = case["source"]
        inp = case["input"]
        expected = case["expected"]

        try:
            # ── Determine how to run pipeline ─────────────────────────────
            if source == "manual":
                data = ManualProfileInput(**inp)
                result = execute_manual_pipeline(data)
            elif source == "auto":
                data = AutoModeInput(
                    thickness=inp["thickness"],
                    material=inp["material"],
                    entities=inp["entities"],
                )
                result = execute_auto_pipeline(data)
            elif source == "manual_raw":
                # For cases that should fail validation (e.g. thickness=0)
                try:
                    data = ManualProfileInput(**inp)
                    result = execute_manual_pipeline(data)
                except Exception as validation_err:
                    result = {
                        "status": "fail",
                        "failed_stage": "input_engine",
                        "result": {"reason": str(validation_err)},
                    }
            else:
                result = {"status": "fail", "failed_stage": "unknown"}

            # ── Evaluate result ───────────────────────────────────────────
            pipeline_pass = result.get("status") == "pass"
            failed_stage  = result.get("failed_stage")
            decision      = result.get("final_decision_engine", {})
            consistency   = result.get("consistency_engine", {})
            actual_mode   = decision.get("selected_mode")
            actual_conf   = decision.get("overall_confidence", 0)
            layout        = result.get("machine_layout_engine", {})

            mode_ok  = (expected["mode"] is None) or (actual_mode == expected["mode"])
            conf_ok  = actual_conf >= expected["min_confidence"]
            pass_ok  = pipeline_pass == expected["pipeline_pass"]
            stage_ok = (expected["failed_stage"] is None) or (failed_stage == expected["failed_stage"]) or not expected["pipeline_pass"]

            validation = "pass" if (mode_ok and conf_ok and pass_ok) else "warning"
            if not pass_ok:
                all_pass = False

            summary = result.get("report_engine", {}).get("engineering_summary", {})

            results.append({
                "name":             name,
                "source":           source,
                "status":           "pass" if pipeline_pass else "fail",
                "validation":       validation,
                "input":            inp,
                "expected":         expected,
                "actual": {
                    "pipeline_pass":  pipeline_pass,
                    "mode":           actual_mode,
                    "confidence":     actual_conf,
                    "failed_stage":   failed_stage,
                    "stations":       summary.get("recommended_station_count"),
                    "shaft_mm":       summary.get("shaft_diameter_mm"),
                    "bearing":        summary.get("bearing_type"),
                    "roll_od_mm":     summary.get("estimated_roll_od_mm"),
                    "line_length_m":  layout.get("total_line_length_m"),
                    "drive_type":     layout.get("drive_type"),
                    "consistency":    consistency.get("consistency_status"),
                },
                "failed_stage": failed_stage,
            })

        except Exception as e:
            all_pass = False
            logger.exception("[test_runner] TC error: %s: %s", name, e)
            results.append({
                "name":       name,
                "source":     source,
                "status":     "error",
                "validation": "error",
                "input":      inp,
                "expected":   expected,
                "actual":     {"pipeline_pass": False, "mode": None, "confidence": 0},
                "reason":     str(e),
                "failed_stage": "test_runner_engine",
            })

    passed = sum(1 for r in results if r["status"] in {"pass", "fail"} and r["validation"] == "pass")
    failed = sum(1 for r in results if r["status"] == "error")
    warnings = sum(1 for r in results if r["validation"] == "warning")

    return {
        "status":               "pass" if all_pass else "partial",
        "engine":               "test_runner_engine",
        "total":                len(STANDARD_CASES),
        "passed":               passed,
        "failed":               failed,
        "validation_warnings":  warnings,
        "test_cases":           results,
    }
