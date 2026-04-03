"""
tooling_library.py — Reusable Roll Tooling Library

A structured library of standard roll tooling configurations indexed by:
  - section_type  (lipped_channel, c_channel, z_purlin, hat_section, box_section, angle_section)
  - thickness range (t_min_mm, t_max_mm)
  - material family (mild_steel_family, stainless_family, aluminium_family)

Each entry provides:
  - recommended shaft diameter (mm)
  - roll OD range (mm)
  - bearing type
  - roll material grade
  - station pitch (mm)
  - typical station count range
  - keyway standard
  - notes

Implements COPRA audit criterion I — reusable tooling library.
Implements criterion A — central data/project management.

Source: Industry standard roll forming rulebook (DIN/ISO, EN 10327, BS EN 10130).
"""
from typing import Any, Dict, List, Optional
import logging

logger = logging.getLogger("tooling_library")


# ─── LIBRARY DATA ─────────────────────────────────────────────────────────────
# Key format: (section_type, material_family, thickness_class)
# thickness_class: "thin" (<1.0mm), "standard" (1.0–3.0mm), "heavy" (>3.0mm)

TOOLING_LIBRARY: List[Dict[str, Any]] = [
    # ── ANGLE SECTION ─────────────────────────────────────────────────────────
    {
        "id": "ANG-STD-MS",
        "section_type": "angle_section",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 1.0,
        "thickness_max_mm": 3.0,
        "description": "Equal angle section — standard mild steel / GI",
        "shaft_dia_mm": 40,
        "roll_od_min_mm": 100,
        "roll_od_max_mm": 140,
        "bearing_type": "6208",
        "roll_material": "EN31",
        "roll_hardness_hrc": 58,
        "station_pitch_mm": 250,
        "station_count_min": 6,
        "station_count_max": 10,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 80,
        "notes": "Simple 2-bend profile; 4–6 forming passes + entry + calibration",
    },
    {
        "id": "ANG-STD-SS",
        "section_type": "angle_section",
        "material_family": "stainless_family",
        "thickness_min_mm": 0.8,
        "thickness_max_mm": 2.0,
        "description": "Equal angle — stainless steel 304/316",
        "shaft_dia_mm": 40,
        "roll_od_min_mm": 110,
        "roll_od_max_mm": 150,
        "bearing_type": "6208",
        "roll_material": "D2",
        "roll_hardness_hrc": 60,
        "station_pitch_mm": 280,
        "station_count_min": 8,
        "station_count_max": 12,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 80,
        "notes": "Higher springback — add 2 calibration stations over mild steel equivalent",
    },
    # ── C / U CHANNEL ─────────────────────────────────────────────────────────
    {
        "id": "CC-THIN-MS",
        "section_type": "c_channel",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 0.5,
        "thickness_max_mm": 1.0,
        "description": "C-channel / U-channel — thin GI / CR",
        "shaft_dia_mm": 40,
        "roll_od_min_mm": 120,
        "roll_od_max_mm": 160,
        "bearing_type": "6208",
        "roll_material": "EN31",
        "roll_hardness_hrc": 56,
        "station_pitch_mm": 250,
        "station_count_min": 8,
        "station_count_max": 12,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 80,
        "notes": "Wrinkling risk at thin gauges — monitor edge wave",
    },
    {
        "id": "CC-STD-MS",
        "section_type": "c_channel",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 1.0,
        "thickness_max_mm": 3.0,
        "description": "C-channel / U-channel — standard GI / CR / HR",
        "shaft_dia_mm": 50,
        "roll_od_min_mm": 140,
        "roll_od_max_mm": 180,
        "bearing_type": "6210",
        "roll_material": "EN31",
        "roll_hardness_hrc": 58,
        "station_pitch_mm": 280,
        "station_count_min": 10,
        "station_count_max": 16,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 100,
        "notes": "Industry workhorse — 2 forming bends + entry + calibration stations",
    },
    {
        "id": "CC-HEAVY-MS",
        "section_type": "c_channel",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 3.0,
        "thickness_max_mm": 6.0,
        "description": "C-channel — heavy gauge HR / MS",
        "shaft_dia_mm": 60,
        "roll_od_min_mm": 180,
        "roll_od_max_mm": 220,
        "bearing_type": "6212",
        "roll_material": "D2",
        "roll_hardness_hrc": 60,
        "station_pitch_mm": 350,
        "station_count_min": 14,
        "station_count_max": 20,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 120,
        "notes": "Heavy duty — wider pitch, higher force, D2 rolls recommended",
    },
    # ── LIPPED CHANNEL ────────────────────────────────────────────────────────
    {
        "id": "LC-THIN-MS",
        "section_type": "lipped_channel",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 0.5,
        "thickness_max_mm": 1.0,
        "description": "Lipped channel — thin GI / CR (rack uprights, cable tray)",
        "shaft_dia_mm": 50,
        "roll_od_min_mm": 140,
        "roll_od_max_mm": 180,
        "bearing_type": "6210",
        "roll_material": "EN31",
        "roll_hardness_hrc": 56,
        "station_pitch_mm": 270,
        "station_count_min": 14,
        "station_count_max": 20,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 100,
        "notes": "Lip forming adds 4 passes over plain C-channel — monitor edge quality",
    },
    {
        "id": "LC-STD-MS",
        "section_type": "lipped_channel",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 1.0,
        "thickness_max_mm": 3.0,
        "description": "Lipped channel — standard GI / CR (purlins, roof structures)",
        "shaft_dia_mm": 60,
        "roll_od_min_mm": 160,
        "roll_od_max_mm": 200,
        "bearing_type": "6212",
        "roll_material": "EN31",
        "roll_hardness_hrc": 58,
        "station_pitch_mm": 300,
        "station_count_min": 18,
        "station_count_max": 26,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 100,
        "notes": "Standard purlin tooling — most common lipped channel configuration",
    },
    {
        "id": "LC-HEAVY-MS",
        "section_type": "lipped_channel",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 3.0,
        "thickness_max_mm": 6.0,
        "description": "Lipped channel — heavy HR / MS (structural)",
        "shaft_dia_mm": 70,
        "roll_od_min_mm": 200,
        "roll_od_max_mm": 250,
        "bearing_type": "6214",
        "roll_material": "D2",
        "roll_hardness_hrc": 60,
        "station_pitch_mm": 380,
        "station_count_min": 22,
        "station_count_max": 30,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 140,
        "notes": "High forming forces — verify motor torque capacity before build",
    },
    {
        "id": "LC-STD-SS",
        "section_type": "lipped_channel",
        "material_family": "stainless_family",
        "thickness_min_mm": 0.8,
        "thickness_max_mm": 2.5,
        "description": "Lipped channel — stainless 304/316",
        "shaft_dia_mm": 60,
        "roll_od_min_mm": 170,
        "roll_od_max_mm": 210,
        "bearing_type": "6212",
        "roll_material": "D2",
        "roll_hardness_hrc": 62,
        "station_pitch_mm": 320,
        "station_count_min": 22,
        "station_count_max": 30,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 110,
        "notes": "High springback SS — add 4 extra calibration passes over GI equivalent",
    },
    {
        "id": "LC-STD-AL",
        "section_type": "lipped_channel",
        "material_family": "aluminium_family",
        "thickness_min_mm": 1.0,
        "thickness_max_mm": 3.0,
        "description": "Lipped channel — aluminium 6061/5052",
        "shaft_dia_mm": 50,
        "roll_od_min_mm": 140,
        "roll_od_max_mm": 180,
        "bearing_type": "6210",
        "roll_material": "EN31",
        "roll_hardness_hrc": 55,
        "station_pitch_mm": 270,
        "station_count_min": 16,
        "station_count_max": 22,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 90,
        "notes": "Lower forces than steel — chrome-plate rolls recommended for AL wear",
    },
    # ── Z PURLIN ──────────────────────────────────────────────────────────────
    {
        "id": "ZP-STD-MS",
        "section_type": "z_purlin",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 1.5,
        "thickness_max_mm": 3.0,
        "description": "Z-purlin — standard GI (roof/wall systems)",
        "shaft_dia_mm": 60,
        "roll_od_min_mm": 160,
        "roll_od_max_mm": 200,
        "bearing_type": "6212",
        "roll_material": "EN31",
        "roll_hardness_hrc": 58,
        "station_pitch_mm": 300,
        "station_count_min": 20,
        "station_count_max": 28,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 100,
        "notes": "Asymmetric profile — requires careful pass balance. Top/bottom lip at different heights.",
    },
    # ── HAT SECTION ───────────────────────────────────────────────────────────
    {
        "id": "HAT-STD-MS",
        "section_type": "hat_section",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 0.7,
        "thickness_max_mm": 2.5,
        "description": "Hat section / Omega section — GI / CR",
        "shaft_dia_mm": 50,
        "roll_od_min_mm": 150,
        "roll_od_max_mm": 190,
        "bearing_type": "6210",
        "roll_material": "EN31",
        "roll_hardness_hrc": 58,
        "station_pitch_mm": 280,
        "station_count_min": 16,
        "station_count_max": 22,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 100,
        "notes": "Symmetric 4-bend profile — standard hat/omega used in track systems, framing",
    },
    # ── BOX SECTION ───────────────────────────────────────────────────────────
    {
        "id": "BOX-STD-MS",
        "section_type": "box_section",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 1.5,
        "thickness_max_mm": 4.0,
        "description": "Closed box / RHS — GI / HR (requires seam welding or lock-seam)",
        "shaft_dia_mm": 70,
        "roll_od_min_mm": 180,
        "roll_od_max_mm": 240,
        "bearing_type": "6214",
        "roll_material": "D2",
        "roll_hardness_hrc": 60,
        "station_pitch_mm": 350,
        "station_count_min": 24,
        "station_count_max": 34,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 130,
        "notes": "Requires seam welding station + sizing passes. Most complex open-section profile.",
    },
    # ── Z SECTION (open asymmetric — aliases z_purlin for engine lookup) ───────
    {
        "id": "ZS-STD-MS",
        "section_type": "z_section",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 1.2,
        "thickness_max_mm": 3.0,
        "description": "Z-section / Z-purlin — standard GI / CR (structural purlins)",
        "shaft_dia_mm": 60,
        "roll_od_min_mm": 160,
        "roll_od_max_mm": 210,
        "bearing_type": "6212",
        "roll_material": "EN31",
        "roll_hardness_hrc": 58,
        "station_pitch_mm": 300,
        "station_count_min": 18,
        "station_count_max": 26,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 100,
        "notes": "Asymmetric 2-bend profile — mirror-image stations required for left/right versions",
    },
    {
        "id": "ZS-HEAVY-MS",
        "section_type": "z_section",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 3.0,
        "thickness_max_mm": 6.0,
        "description": "Z-section heavy gauge — HR / MS (industrial purlins > 200mm height)",
        "shaft_dia_mm": 70,
        "roll_od_min_mm": 200,
        "roll_od_max_mm": 260,
        "bearing_type": "6214",
        "roll_material": "D2",
        "roll_hardness_hrc": 60,
        "station_pitch_mm": 380,
        "station_count_min": 24,
        "station_count_max": 34,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 130,
        "notes": "Heavy structural purlin — high forming force; verify motor kW capacity",
    },
    # ── SIGMA SECTION ──────────────────────────────────────────────────────────
    {
        "id": "SIG-STD-MS",
        "section_type": "sigma_section",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 1.5,
        "thickness_max_mm": 3.0,
        "description": "Sigma purlin — standard GI / CR (sandwich panel sub-structure)",
        "shaft_dia_mm": 60,
        "roll_od_min_mm": 170,
        "roll_od_max_mm": 220,
        "bearing_type": "6212",
        "roll_material": "EN31",
        "roll_hardness_hrc": 58,
        "station_pitch_mm": 320,
        "station_count_min": 22,
        "station_count_max": 30,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 110,
        "notes": "Symmetric sigma — 6 bends; intermediate stiffener lip adds 4 extra passes over hat section",
    },
    {
        "id": "SIG-HEAVY-MS",
        "section_type": "sigma_section",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 3.0,
        "thickness_max_mm": 6.0,
        "description": "Sigma purlin heavy — HR / MS structural",
        "shaft_dia_mm": 70,
        "roll_od_min_mm": 220,
        "roll_od_max_mm": 270,
        "bearing_type": "6214",
        "roll_material": "D2",
        "roll_hardness_hrc": 60,
        "station_pitch_mm": 380,
        "station_count_min": 26,
        "station_count_max": 36,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 140,
        "notes": "Heavy sigma — requires side-roll assemblies to prevent web buckling",
    },
    # ── OMEGA SECTION ──────────────────────────────────────────────────────────
    {
        "id": "OMG-STD-MS",
        "section_type": "omega_section",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 0.7,
        "thickness_max_mm": 2.0,
        "description": "Omega / Top-hat section — GI / CR (cable tray, suspended ceiling track)",
        "shaft_dia_mm": 50,
        "roll_od_min_mm": 150,
        "roll_od_max_mm": 190,
        "bearing_type": "6210",
        "roll_material": "EN31",
        "roll_hardness_hrc": 56,
        "station_pitch_mm": 270,
        "station_count_min": 14,
        "station_count_max": 20,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 90,
        "notes": "4-bend open-bottom hat; flanges fold outward — similar to hat_section but with wider web",
    },
    {
        "id": "OMG-STD-SS",
        "section_type": "omega_section",
        "material_family": "stainless_family",
        "thickness_min_mm": 0.5,
        "thickness_max_mm": 1.5,
        "description": "Omega section — stainless 304 (hygienic / pharmaceutical channels)",
        "shaft_dia_mm": 50,
        "roll_od_min_mm": 160,
        "roll_od_max_mm": 200,
        "bearing_type": "6210",
        "roll_material": "D2",
        "roll_hardness_hrc": 62,
        "station_pitch_mm": 290,
        "station_count_min": 16,
        "station_count_max": 22,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 90,
        "notes": "SS omega — Ra finish critical; polished rolls required for pharmaceutical grade",
    },
    # ── TRAPEZOID SHEET / CORRUGATED ──────────────────────────────────────────
    {
        "id": "TRAP-THIN-MS",
        "section_type": "trapezoid",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 0.4,
        "thickness_max_mm": 1.0,
        "description": "Trapezoidal roofing / cladding sheet — GI 0.40–1.0mm (IBR, T-rib profiles)",
        "shaft_dia_mm": 40,
        "roll_od_min_mm": 110,
        "roll_od_max_mm": 150,
        "bearing_type": "6208",
        "roll_material": "EN31",
        "roll_hardness_hrc": 55,
        "station_pitch_mm": 220,
        "station_count_min": 12,
        "station_count_max": 18,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 75,
        "notes": "Multi-rib profile — simultaneous bend at all ribs; edge guides critical",
    },
    {
        "id": "TRAP-STD-MS",
        "section_type": "trapezoid",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 1.0,
        "thickness_max_mm": 2.0,
        "description": "Trapezoidal decking sheet — GI / HR 1.0–2.0mm (floor deck, industrial roofing)",
        "shaft_dia_mm": 50,
        "roll_od_min_mm": 140,
        "roll_od_max_mm": 180,
        "bearing_type": "6210",
        "roll_material": "EN31",
        "roll_hardness_hrc": 58,
        "station_pitch_mm": 260,
        "station_count_min": 16,
        "station_count_max": 24,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 90,
        "notes": "Floor deck variant — wider rib, higher web stiffness requirement",
    },
    # ── SHUTTER SLAT ──────────────────────────────────────────────────────────
    {
        "id": "SHT-THIN-MS",
        "section_type": "shutter_slat",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 0.4,
        "thickness_max_mm": 0.9,
        "description": "Rolling shutter slat — GI 0.40–0.9mm (residential/commercial shutters)",
        "shaft_dia_mm": 40,
        "roll_od_min_mm": 120,
        "roll_od_max_mm": 160,
        "bearing_type": "6208",
        "roll_material": "EN31",
        "roll_hardness_hrc": 54,
        "station_pitch_mm": 200,
        "station_count_min": 8,
        "station_count_max": 14,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 70,
        "notes": "Curved-web slat — gentle radius; inter-locking hooks form in last 2 passes",
    },
    {
        "id": "SHT-STD-MS",
        "section_type": "shutter_slat",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 0.9,
        "thickness_max_mm": 1.5,
        "description": "Rolling shutter slat — GI 0.9–1.5mm (industrial / fire-rated shutters)",
        "shaft_dia_mm": 50,
        "roll_od_min_mm": 150,
        "roll_od_max_mm": 190,
        "bearing_type": "6210",
        "roll_material": "EN31",
        "roll_hardness_hrc": 56,
        "station_pitch_mm": 240,
        "station_count_min": 12,
        "station_count_max": 18,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 80,
        "notes": "Heavier gauge slat — fire-rated version may need galv + PVC coating station",
    },
    # ── SHUTTER GUIDE / PROFILE ────────────────────────────────────────────────
    {
        "id": "SHTP-STD-MS",
        "section_type": "shutter_profile",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 0.5,
        "thickness_max_mm": 1.2,
        "description": "Roller shutter guide channel — GI 0.5–1.2mm (door guide / frame extrusion)",
        "shaft_dia_mm": 40,
        "roll_od_min_mm": 120,
        "roll_od_max_mm": 160,
        "bearing_type": "6208",
        "roll_material": "EN31",
        "roll_hardness_hrc": 55,
        "station_pitch_mm": 220,
        "station_count_min": 10,
        "station_count_max": 16,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 75,
        "notes": "U-guide or J-guide variants — precision forming required for smooth slat travel",
    },
    # ── DOOR FRAME ─────────────────────────────────────────────────────────────
    {
        "id": "DFR-STD-MS",
        "section_type": "door_frame",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 0.7,
        "thickness_max_mm": 1.6,
        "description": "Steel door frame — GI / CR 0.7–1.6mm (residential / commercial door frames)",
        "shaft_dia_mm": 50,
        "roll_od_min_mm": 140,
        "roll_od_max_mm": 185,
        "bearing_type": "6210",
        "roll_material": "EN31",
        "roll_hardness_hrc": 56,
        "station_pitch_mm": 260,
        "station_count_min": 14,
        "station_count_max": 22,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 90,
        "notes": "Complex multi-return profile — requires 4–6 extra passes over plain lipped channel",
    },
    {
        "id": "DFR-STD-SS",
        "section_type": "door_frame",
        "material_family": "stainless_family",
        "thickness_min_mm": 0.5,
        "thickness_max_mm": 1.2,
        "description": "Stainless door frame — SS 304/316 (architectural / hospital grade)",
        "shaft_dia_mm": 50,
        "roll_od_min_mm": 150,
        "roll_od_max_mm": 200,
        "bearing_type": "6210",
        "roll_material": "D2",
        "roll_hardness_hrc": 62,
        "station_pitch_mm": 280,
        "station_count_min": 18,
        "station_count_max": 26,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 95,
        "notes": "Mirror-finish SS — polished ground rolls; avoid iron contamination",
    },
    # ── SQUARE TUBE ───────────────────────────────────────────────────────────
    {
        "id": "SQT-STD-MS",
        "section_type": "square_tube",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 1.2,
        "thickness_max_mm": 4.0,
        "description": "Square hollow section (SHS) — GI / HR (structural, furniture, handrails)",
        "shaft_dia_mm": 70,
        "roll_od_min_mm": 180,
        "roll_od_max_mm": 240,
        "bearing_type": "6214",
        "roll_material": "D2",
        "roll_hardness_hrc": 60,
        "station_pitch_mm": 350,
        "station_count_min": 22,
        "station_count_max": 32,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 125,
        "notes": "Closed section — HF seam-welding mandatory after roll forming; sizing passes critical",
    },
    # ── RECT TUBE ─────────────────────────────────────────────────────────────
    {
        "id": "RHT-THIN-MS",
        "section_type": "rect_tube",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 0.8,
        "thickness_max_mm": 2.0,
        "description": "Rectangular hollow section (RHS) — GI / CR (cable trays, false ceiling frames)",
        "shaft_dia_mm": 60,
        "roll_od_min_mm": 160,
        "roll_od_max_mm": 210,
        "bearing_type": "6212",
        "roll_material": "EN31",
        "roll_hardness_hrc": 58,
        "station_pitch_mm": 310,
        "station_count_min": 18,
        "station_count_max": 26,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 110,
        "notes": "Rectangular tube — seam weld + stretch-bend sizing; corner radius control critical",
    },
    {
        "id": "RHT-HEAVY-MS",
        "section_type": "rect_tube",
        "material_family": "mild_steel_family",
        "thickness_min_mm": 2.0,
        "thickness_max_mm": 6.0,
        "description": "Rectangular hollow section heavy — HR / MS (structural frames, automotive)",
        "shaft_dia_mm": 70,
        "roll_od_min_mm": 200,
        "roll_od_max_mm": 260,
        "bearing_type": "6214",
        "roll_material": "D2",
        "roll_hardness_hrc": 60,
        "station_pitch_mm": 380,
        "station_count_min": 24,
        "station_count_max": 36,
        "keyway_standard": "DIN 6885 Form A",
        "typical_face_width_mm": 140,
        "notes": "Heavy RHS — high motor torque required; ERW welding + hot sizing passes",
    },
]

MATERIAL_FAMILY_MAP: Dict[str, str] = {
    "GI": "mild_steel_family",
    "CR": "mild_steel_family",
    "HR": "mild_steel_family",
    "MS": "mild_steel_family",
    "CU": "mild_steel_family",
    "SS": "stainless_family",
    "AL": "aluminium_family",
    "TI": "aluminium_family",
    "HSLA": "mild_steel_family",
    "PP": "aluminium_family",
}


# ─── PUBLIC API ───────────────────────────────────────────────────────────────

def query_tooling_library(
    section_type: Optional[str] = None,
    material_code: Optional[str] = None,
    thickness_mm: Optional[float] = None,
) -> List[Dict[str, Any]]:
    """
    Query the tooling library with optional filters.

    Args:
        section_type: e.g. "lipped_channel", "c_channel" etc.
        material_code: e.g. "GI", "SS", "AL"
        thickness_mm: filter to entries where t_min <= thickness_mm <= t_max

    Returns:
        List of matching tooling entries.
    """
    results = TOOLING_LIBRARY[:]

    if section_type:
        results = [r for r in results if r["section_type"] == section_type.lower()]

    if material_code:
        family = MATERIAL_FAMILY_MAP.get(material_code.upper(), "mild_steel_family")
        results = [r for r in results if r["material_family"] == family]

    if thickness_mm is not None:
        results = [
            r for r in results
            if r["thickness_min_mm"] <= thickness_mm <= r["thickness_max_mm"]
        ]

    return results


def get_tooling_entry(entry_id: str) -> Optional[Dict[str, Any]]:
    """Return a single tooling library entry by its ID."""
    for entry in TOOLING_LIBRARY:
        if entry["id"] == entry_id:
            return entry
    return None


def get_best_match(
    section_type: str,
    material_code: str,
    thickness_mm: float,
) -> Optional[Dict[str, Any]]:
    """
    Return the single best-matching tooling entry for a given spec.

    Priority: exact section_type + exact material_family + thickness in range.
    Falls back to section_type match if no material match found.
    """
    matches = query_tooling_library(section_type, material_code, thickness_mm)
    if matches:
        return matches[0]

    # Fallback: ignore material, match section + thickness
    fallback = query_tooling_library(section_type=section_type, thickness_mm=thickness_mm)
    if fallback:
        logger.info("[tooling_library] using fallback match (ignoring material family)")
        return fallback[0]

    # Fallback 2: section only
    section_only = query_tooling_library(section_type=section_type)
    if section_only:
        logger.info("[tooling_library] using section-only fallback")
        return section_only[0]

    return None


def list_all_section_types() -> List[str]:
    """Return sorted list of all section types in the library."""
    return sorted(set(e["section_type"] for e in TOOLING_LIBRARY))


def library_summary() -> Dict[str, Any]:
    """Return high-level summary of the tooling library."""
    return {
        "total_entries": len(TOOLING_LIBRARY),
        "section_types": list_all_section_types(),
        "material_families": sorted(set(e["material_family"] for e in TOOLING_LIBRARY)),
        "thickness_range_mm": {
            "min": min(e["thickness_min_mm"] for e in TOOLING_LIBRARY),
            "max": max(e["thickness_max_mm"] for e in TOOLING_LIBRARY),
        },
        "shaft_diameter_range_mm": {
            "min": min(e["shaft_dia_mm"] for e in TOOLING_LIBRARY),
            "max": max(e["shaft_dia_mm"] for e in TOOLING_LIBRARY),
        },
    }


# ── MACHINE-AWARE MATCHING (Phase C) ──────────────────────────────────────────

def get_best_match_for_machine(
    section_type: str,
    material_code: str,
    thickness_mm: float,
    machine_shaft_dia_mm: int,
    machine_max_od_mm: float,
) -> Optional[Dict[str, Any]]:
    """
    Return best tooling entry that fits within machine constraints.

    Filters by section_type + material + thickness, then rejects any entry
    where shaft_dia_mm > machine_shaft_dia_mm or roll_od_max_mm > machine_max_od_mm.

    Falls back to looser material matching if needed.
    Returns None if no tooling entry is compatible with the machine.
    """
    candidates = query_tooling_library(section_type, material_code, thickness_mm)
    if not candidates:
        candidates = query_tooling_library(section_type=section_type, thickness_mm=thickness_mm)
    if not candidates:
        candidates = query_tooling_library(section_type=section_type)

    # Filter by machine constraints
    compatible = [
        e for e in candidates
        if e.get("shaft_dia_mm", 0) <= machine_shaft_dia_mm
        and e.get("roll_od_max_mm", 0) <= machine_max_od_mm
    ]

    if compatible:
        return compatible[0]

    # Partial match: shaft fits but OD exceeds — flag with warning
    shaft_ok = [e for e in candidates if e.get("shaft_dia_mm", 0) <= machine_shaft_dia_mm]
    if shaft_ok:
        entry = dict(shaft_ok[0])
        entry["_machine_constraint_warning"] = (
            f"Standard tooling OD {shaft_ok[0].get('roll_od_max_mm')}mm "
            f"exceeds machine max {machine_max_od_mm}mm — custom OD reduction required"
        )
        return entry

    # Nothing fits: return None so caller knows no valid tooling exists
    if candidates:
        logger.warning(
            "[tooling_library] Machine constraint violation: shaft_dia=%d > all candidates "
            "(min shaft in library for %s = %d)",
            machine_shaft_dia_mm, section_type,
            min(e.get("shaft_dia_mm", 0) for e in candidates),
        )
    return None


def check_tooling_machine_compatibility(
    tooling_entry_id: str,
    machine_shaft_dia_mm: int,
    machine_max_od_mm: float,
) -> Dict[str, Any]:
    """
    Check a specific tooling entry against machine constraints.
    Returns a compatibility dict with pass/warn/fail status.
    """
    entry = get_tooling_entry(tooling_entry_id)
    if not entry:
        return {"compatible": False, "reason": f"Tooling entry '{tooling_entry_id}' not found"}

    shaft_ok = entry.get("shaft_dia_mm", 0) <= machine_shaft_dia_mm
    od_ok    = entry.get("roll_od_max_mm", 0) <= machine_max_od_mm

    status = "pass" if (shaft_ok and od_ok) else "fail"
    warnings = []
    if not shaft_ok:
        warnings.append(
            f"Tooling shaft {entry['shaft_dia_mm']}mm > machine shaft {machine_shaft_dia_mm}mm"
        )
    if not od_ok:
        warnings.append(
            f"Tooling OD {entry['roll_od_max_mm']}mm > machine max OD {machine_max_od_mm}mm"
        )

    return {
        "compatible":            status == "pass",
        "status":                status,
        "tooling_id":            tooling_entry_id,
        "tooling_shaft_dia_mm":  entry.get("shaft_dia_mm"),
        "tooling_max_od_mm":     entry.get("roll_od_max_mm"),
        "machine_shaft_dia_mm":  machine_shaft_dia_mm,
        "machine_max_od_mm":     machine_max_od_mm,
        "warnings":              warnings,
    }
