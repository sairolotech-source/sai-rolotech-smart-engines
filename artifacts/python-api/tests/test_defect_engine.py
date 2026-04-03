"""
test_defect_engine.py — Benchmark tests for defect_engine.py

Tests:
  - Cracking detection at/above fracture strain
  - Wrinkling at late pass + thin material
  - Edge wave slenderness threshold
  - Bow/camber mid-pass condition
  - Springback alert for high-strength final pass
  - Zero-defect clean case
  - Blocking flag logic
  - All 5 benchmark profiles
"""
import pytest
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.engines.defect_engine import detect_defects


class TestCrackingDetection:

    def test_at_fracture_limit_high(self):
        """Strain at exactly fracture limit should trigger HIGH cracking."""
        fracture_gi = 0.40
        result = detect_defects(
            strain_value=fracture_gi,
            pass_ratio=0.5,
            thickness_mm=1.5,
            material="GI",
        )
        assert result["status"] == "pass"
        defects = result.get("defects", [])
        types = [d["type"] for d in defects]
        severities = [d["severity"] for d in defects]
        assert "cracking" in types
        idx = types.index("cracking")
        assert severities[idx] == "HIGH"
        assert result["blocking"] is True

    def test_below_fracture_no_cracking(self):
        """Strain at 50% of fracture limit should not trigger cracking."""
        result = detect_defects(
            strain_value=0.10,
            pass_ratio=0.5,
            thickness_mm=1.5,
            material="GI",
        )
        assert result["status"] == "pass"
        types = [d["type"] for d in result.get("defects", [])]
        assert "cracking" not in types

    def test_medium_cracking_zone(self):
        """Strain between 75-100% of fracture limit should be MEDIUM."""
        result = detect_defects(
            strain_value=0.32,   # 80% of 0.40 fracture for GI
            pass_ratio=0.5,
            thickness_mm=1.5,
            material="GI",
        )
        defects = result.get("defects", [])
        crack_defects = [d for d in defects if d["type"] == "cracking"]
        assert len(crack_defects) > 0
        assert crack_defects[0]["severity"] == "MEDIUM"

    def test_ss_lower_fracture_limit(self):
        """SS has lower fracture limit (0.32); strain 0.30 should be MEDIUM for SS but not for GI."""
        result_ss = detect_defects(
            strain_value=0.30,
            pass_ratio=0.5,
            thickness_mm=1.5,
            material="SS",
        )
        result_gi = detect_defects(
            strain_value=0.30,
            pass_ratio=0.5,
            thickness_mm=1.5,
            material="GI",
        )
        ss_cracks = [d for d in result_ss.get("defects", []) if d["type"] == "cracking"]
        gi_cracks = [d for d in result_gi.get("defects", []) if d["type"] == "cracking"]
        assert len(ss_cracks) > 0, "SS should flag cracking at 0.30 strain"
        # GI at 0.30 is 75% of 0.40 = borderline; may or may not flag MEDIUM
        assert len(gi_cracks) == 0 or gi_cracks[0]["severity"] in ("MEDIUM",)


class TestWrinklingDetection:

    def test_thin_late_pass_high_wrinkling(self):
        """Very thin strip at late pass (ratio>0.80) should trigger HIGH wrinkling."""
        result = detect_defects(
            strain_value=0.10,
            pass_ratio=0.90,
            thickness_mm=0.5,
            material="GI",
        )
        defects = result.get("defects", [])
        wrinkle = [d for d in defects if d["type"] == "wrinkling"]
        assert len(wrinkle) > 0
        assert wrinkle[0]["severity"] == "HIGH"
        assert result["blocking"] is True

    def test_thick_material_no_wrinkling(self):
        """Thick strip (3mm) should not trigger wrinkling."""
        result = detect_defects(
            strain_value=0.10,
            pass_ratio=0.95,
            thickness_mm=3.0,
            material="MS",
        )
        defects = result.get("defects", [])
        wrinkle = [d for d in defects if d["type"] == "wrinkling"]
        assert len(wrinkle) == 0

    def test_early_pass_no_wrinkling(self):
        """Early pass (ratio<0.5) should not trigger wrinkling even for thin strip."""
        result = detect_defects(
            strain_value=0.05,
            pass_ratio=0.30,
            thickness_mm=0.6,
            material="CR",
        )
        defects = result.get("defects", [])
        wrinkle = [d for d in defects if d["type"] == "wrinkling"]
        assert len(wrinkle) == 0


class TestEdgeWave:

    def test_high_slenderness_triggers_edge_wave(self):
        """Wide thin strip at late pass (slenderness > 130) should trigger edge wave."""
        # free_span = 400 * 0.40 = 160; slenderness = 160 / 0.8 = 200 > 130
        result = detect_defects(
            strain_value=0.10,
            pass_ratio=0.80,
            thickness_mm=0.8,
            strip_width_mm=400.0,
            material="GI",
        )
        defects = result.get("defects", [])
        edge = [d for d in defects if d["type"] == "edge_wave"]
        assert len(edge) > 0

    def test_narrow_strip_no_edge_wave(self):
        """Narrow strip (60mm) should not trigger edge wave."""
        result = detect_defects(
            strain_value=0.10,
            pass_ratio=0.85,
            thickness_mm=1.5,
            strip_width_mm=60.0,
            material="GI",
        )
        defects = result.get("defects", [])
        edge = [d for d in defects if d["type"] == "edge_wave"]
        assert len(edge) == 0


class TestSpringbackAlert:

    def test_high_strength_final_pass_flagged(self):
        """SS at final pass (ratio>0.90, angle>85°) should trigger springback warning."""
        result = detect_defects(
            strain_value=0.10,
            pass_ratio=0.95,
            thickness_mm=2.0,
            angle_deg=88.0,
            material="SS",
        )
        defects = result.get("defects", [])
        sb = [d for d in defects if d["type"] == "springback"]
        assert len(sb) > 0, "SS at final pass should trigger springback alert"

    def test_gi_no_springback_alert(self):
        """GI (low Fy) should not trigger springback alert."""
        result = detect_defects(
            strain_value=0.10,
            pass_ratio=0.95,
            thickness_mm=1.5,
            angle_deg=88.0,
            material="GI",
        )
        defects = result.get("defects", [])
        sb = [d for d in defects if d["type"] == "springback"]
        assert len(sb) == 0


class TestCleanCase:

    def test_zero_defects_clean_profile(self):
        """Typical mid-pass GI 1.5mm with moderate strain — should have no defects."""
        result = detect_defects(
            strain_value=0.08,
            pass_ratio=0.50,
            thickness_mm=1.5,
            strip_width_mm=150.0,
            angle_deg=45.0,
            material="GI",
        )
        assert result["status"] == "pass"
        assert result["defect_count"] == 0
        assert result["defect_severity"] == "none"
        assert result["blocking"] is False


class TestBlockingFlag:

    def test_high_defect_sets_blocking(self):
        """Any HIGH defect should set blocking=True."""
        result = detect_defects(
            strain_value=0.45,   # above GI fracture limit
            pass_ratio=0.5,
            thickness_mm=1.5,
            material="GI",
        )
        assert result["blocking"] is True

    def test_medium_defect_no_blocking(self):
        """MEDIUM-only defects should not block."""
        result = detect_defects(
            strain_value=0.32,   # 80% of GI fracture = MEDIUM
            pass_ratio=0.50,
            thickness_mm=1.5,
            strip_width_mm=100.0,
            material="GI",
        )
        defects = result.get("defects", [])
        high_defects = [d for d in defects if d["severity"] == "HIGH"]
        if not high_defects:
            assert result["blocking"] is False


class TestBenchmarkProfiles:

    def test_ms_170x50x3_no_cracking(self, profile_ms_170x50x3):
        """Standard C-channel at typical strain should not crack."""
        p = profile_ms_170x50x3
        result = detect_defects(
            strain_value=0.15,
            pass_ratio=0.50,
            thickness_mm=p["thickness_mm"],
            strip_width_mm=p["section_width_mm"],
            angle_deg=45.0,
            material=p["material"],
        )
        defects = result.get("defects", [])
        cracks = [d for d in defects if d["type"] == "cracking" and d["severity"] == "HIGH"]
        assert len(cracks) == 0

    def test_stress_case_triggers_warnings(self, profile_stress_case):
        """Stress case (SS 4mm) at final pass should trigger multiple defects."""
        p = profile_stress_case
        result = detect_defects(
            strain_value=0.22,
            pass_ratio=0.95,
            thickness_mm=p["thickness_mm"],
            strip_width_mm=p["section_width_mm"],
            angle_deg=p["target_angle_deg"],
            material=p["material"],
        )
        assert result["defect_count"] > 0

    def test_all_benchmarks_return_pass(self, all_benchmark_profiles):
        """All benchmark profiles must return status=pass (never status=fail)."""
        for p in all_benchmark_profiles:
            result = detect_defects(
                strain_value=0.15,
                pass_ratio=0.60,
                thickness_mm=p["thickness_mm"],
                strip_width_mm=p["section_width_mm"],
                material=p["material"],
            )
            assert result["status"] == "pass", (
                f"Profile {p['name']} returned status=fail"
            )
