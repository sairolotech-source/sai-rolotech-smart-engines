from app.engines.oss_cad_stack_engine import (
    detect_oss_cad_stack_status,
    get_cad_stack_architecture_map,
)


def test_cad_stack_architecture_has_required_layers():
    architecture = get_cad_stack_architecture_map()
    pipeline = architecture.get("pipeline", [])
    assert "flower_pass_plan" in pipeline
    assert "roll_contour_geometry" in pipeline
    assert "step_export" in pipeline


def test_cad_stack_status_keeps_dwg_truth_gate():
    status = detect_oss_cad_stack_status()
    assert status.get("status") == "pass"
    truth = status.get("truth_controls", {})
    assert truth.get("no_fake_dwg_claim") is True
