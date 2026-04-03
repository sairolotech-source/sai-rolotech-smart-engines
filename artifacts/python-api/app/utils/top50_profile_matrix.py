"""
top50_profile_matrix.py — Top-50 Commercial Roll Forming Profile Matrix
════════════════════════════════════════════════════════════════════════
Phase A: Master profile database with machine-wise compatibility and exact tooling IDs.

Each profile entry contains:
  - profile_id          : unique slug
  - profile_type        : section_type key (matches tooling_library + station_engine)
  - description         : commercial name / standard reference
  - typical_dims        : representative section dimensions
  - material            : preferred material code
  - thickness_mm        : representative design thickness
  - bend_count          : number of bends
  - flat_blank_mm       : typical strip width / flat blank width
  - tooling_id          : exact TOOLING_LIBRARY entry ID (or None if custom-only)
  - machine_compat      : per-machine feasibility dict (from live validation)
  - validation_status   : overall status ('validated' | 'partial' | 'rejected_all')
  - notes               : design / production notes

Machine IDs: SAI-LITE-12 | SAI-STD-20 | SAI-HD-30 | SAI-CNC-24
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from app.utils.machine_config_store import validate_profile_on_machine, MACHINE_REGISTRY
from app.utils.tooling_library import get_best_match, get_best_match_for_machine

logger = logging.getLogger("top50_profile_matrix")

MACHINES = ["SAI-LITE-12", "SAI-STD-20", "SAI-HD-30", "SAI-CNC-24"]


# ─── PROFILE DATABASE (Top-50) ────────────────────────────────────────────────

TOP50_PROFILES: List[Dict[str, Any]] = [
    # ── 1–6: C-CHANNEL / PLAIN CHANNEL ────────────────────────────────────────
    {
        "profile_id":    "P001-CC-LIGHT-GI",
        "profile_type":  "c_channel",
        "description":   "Light C-channel 75×40 — GI 1.0mm (cable tray, light framing)",
        "typical_dims":  {"height_mm": 75, "flange_mm": 40},
        "material":      "GI",
        "thickness_mm":  1.0,
        "bend_count":    2,
        "flat_blank_mm": 155.0,
        "tooling_id":    "CC-STD-MS",
        "notes":         "High-volume light cable-tray section; GI or CR interchangeable",
    },
    {
        "profile_id":    "P002-CC-STD-GI",
        "profile_type":  "c_channel",
        "description":   "Standard C-channel 100×50 — GI 1.5mm (cable tray, framing, brackets)",
        "typical_dims":  {"height_mm": 100, "flange_mm": 50},
        "material":      "GI",
        "thickness_mm":  1.5,
        "bend_count":    2,
        "flat_blank_mm": 200.0,
        "tooling_id":    "CC-STD-MS",
        "notes":         "Most common C-channel in construction market",
    },
    {
        "profile_id":    "P003-CC-MED-GI",
        "profile_type":  "c_channel",
        "description":   "Medium C-channel 150×65 — GI 2.5mm (structural framing)",
        "typical_dims":  {"height_mm": 150, "flange_mm": 65},
        "material":      "GI",
        "thickness_mm":  2.5,
        "bend_count":    2,
        "flat_blank_mm": 280.0,
        "tooling_id":    "CC-STD-MS",
        "notes":         "Structural channel — verify deflection limits per EN 1993",
    },
    {
        "profile_id":    "P004-CC-HEAVY-HR",
        "profile_type":  "c_channel",
        "description":   "Heavy C-channel 200×80 — HR 4.0mm (industrial rack, structural)",
        "typical_dims":  {"height_mm": 200, "flange_mm": 80},
        "material":      "HR",
        "thickness_mm":  4.0,
        "bend_count":    2,
        "flat_blank_mm": 360.0,
        "tooling_id":    "CC-HEAVY-MS",
        "notes":         "Heavy-duty pallet rack upright base; requires HD or CNC machine",
    },
    {
        "profile_id":    "P005-CC-STD-SS",
        "profile_type":  "c_channel",
        "description":   "C-channel SS304 100×40 — 1.5mm (food processing, pharma)",
        "typical_dims":  {"height_mm": 100, "flange_mm": 40},
        "material":      "SS",
        "thickness_mm":  1.5,
        "bend_count":    2,
        "flat_blank_mm": 180.0,
        "tooling_id":    "CC-STD-MS",
        "notes":         "SS304 — polished D2 rolls; Ra ≤ 0.8μm finish",
    },
    {
        "profile_id":    "P006-CC-LIGHT-AL",
        "profile_type":  "c_channel",
        "description":   "Aluminium C-channel 80×30 — AL 1.5mm (solar panel framing)",
        "typical_dims":  {"height_mm": 80, "flange_mm": 30},
        "material":      "AL",
        "thickness_mm":  1.5,
        "bend_count":    2,
        "flat_blank_mm": 140.0,
        "tooling_id":    "CC-STD-MS",
        "notes":         "Solar mounting extrusion alternative; anodising required post-forming",
    },
    # ── 7–13: LIPPED CHANNEL / C-PURLIN ───────────────────────────────────────
    {
        "profile_id":    "P007-LC-LIGHT-GI",
        "profile_type":  "lipped_channel",
        "description":   "Lipped channel C80×40×15 — GI 1.2mm (light purlin, racking)",
        "typical_dims":  {"height_mm": 80, "flange_mm": 40, "lip_mm": 15},
        "material":      "GI",
        "thickness_mm":  1.2,
        "bend_count":    4,
        "flat_blank_mm": 170.0,
        "tooling_id":    "LC-STD-MS",
        "notes":         "Light-gauge purlin — verify lip angle (standard 90° or 45°)",
    },
    {
        "profile_id":    "P008-LC-STD-GI",
        "profile_type":  "lipped_channel",
        "description":   "C-purlin C150×65×20 — GI 2.0mm (roof/wall purlin, EN 10162)",
        "typical_dims":  {"height_mm": 150, "flange_mm": 65, "lip_mm": 20},
        "material":      "GI",
        "thickness_mm":  2.0,
        "bend_count":    4,
        "flat_blank_mm": 300.0,
        "tooling_id":    "LC-STD-MS",
        "notes":         "Industry standard purlin — most common roll forming section globally",
    },
    {
        "profile_id":    "P009-LC-STD2-GI",
        "profile_type":  "lipped_channel",
        "description":   "C-purlin C200×75×20 — GI 2.5mm (large span roof structures)",
        "typical_dims":  {"height_mm": 200, "flange_mm": 75, "lip_mm": 20},
        "material":      "GI",
        "thickness_mm":  2.5,
        "bend_count":    4,
        "flat_blank_mm": 350.0,
        "tooling_id":    "LC-STD-MS",
        "notes":         "Large-span purlin — check motor power ≥22kW on machine",
    },
    {
        "profile_id":    "P010-LC-HEAVY-HR",
        "profile_type":  "lipped_channel",
        "description":   "C-purlin C250×90×25 — HR 3.5mm (heavy industrial)",
        "typical_dims":  {"height_mm": 250, "flange_mm": 90, "lip_mm": 25},
        "material":      "HR",
        "thickness_mm":  3.5,
        "bend_count":    4,
        "flat_blank_mm": 430.0,
        "tooling_id":    "LC-HEAVY-MS",
        "notes":         "Structural purlin — heavy gauge; HD machine required",
    },
    {
        "profile_id":    "P011-LC-STD-SS",
        "profile_type":  "lipped_channel",
        "description":   "Lipped channel SS304 100×40×15 — 1.5mm (medical/food)",
        "typical_dims":  {"height_mm": 100, "flange_mm": 40, "lip_mm": 15},
        "material":      "SS",
        "thickness_mm":  1.5,
        "bend_count":    4,
        "flat_blank_mm": 195.0,
        "tooling_id":    "LC-STD-SS",
        "notes":         "4-bend SS lipped channel — extra forming passes for springback",
    },
    {
        "profile_id":    "P012-LC-STD-AL",
        "profile_type":  "lipped_channel",
        "description":   "Lipped channel AL6061 100×50×15 — 2.0mm (curtain wall)",
        "typical_dims":  {"height_mm": 100, "flange_mm": 50, "lip_mm": 15},
        "material":      "AL",
        "thickness_mm":  2.0,
        "bend_count":    4,
        "flat_blank_mm": 215.0,
        "tooling_id":    "LC-STD-AL",
        "notes":         "Aluminium curtain wall sub-frame; corrosion resistant",
    },
    {
        "profile_id":    "P013-LC-HSLA-HEAVY",
        "profile_type":  "lipped_channel",
        "description":   "HSLA lipped channel C200×75 — 2.5mm S550MC (automotive, trailer)",
        "typical_dims":  {"height_mm": 200, "flange_mm": 75, "lip_mm": 20},
        "material":      "HSLA",
        "thickness_mm":  2.5,
        "bend_count":    4,
        "flat_blank_mm": 350.0,
        "tooling_id":    "LC-STD-MS",
        "notes":         "High-strength purlin — significant springback; extra calibration passes",
    },
    # ── 14–17: Z SECTION ──────────────────────────────────────────────────────
    {
        "profile_id":    "P014-ZP-STD-GI",
        "profile_type":  "z_purlin",
        "description":   "Z-purlin Z150×65×20 — GI 2.0mm (overlap/sleeve joint roof)",
        "typical_dims":  {"height_mm": 150, "flange_mm": 65, "lip_mm": 20},
        "material":      "GI",
        "thickness_mm":  2.0,
        "bend_count":    4,
        "flat_blank_mm": 300.0,
        "tooling_id":    "ZP-STD-MS",
        "notes":         "Asymmetric Z — requires mirrored toolset for LH+RH variants",
    },
    {
        "profile_id":    "P015-ZP-MED-GI",
        "profile_type":  "z_purlin",
        "description":   "Z-purlin Z200×75×25 — GI 2.5mm (long-span roofing)",
        "typical_dims":  {"height_mm": 200, "flange_mm": 75, "lip_mm": 25},
        "material":      "GI",
        "thickness_mm":  2.5,
        "bend_count":    4,
        "flat_blank_mm": 375.0,
        "tooling_id":    "ZP-STD-MS",
        "notes":         "Standard commercial Z-purlin — paired with sleeve connection",
    },
    {
        "profile_id":    "P016-ZS-HEAVY-HR",
        "profile_type":  "z_section",
        "description":   "Z-section Z250×90×30 — HR 4.0mm (heavy industrial mezzanine)",
        "typical_dims":  {"height_mm": 250, "flange_mm": 90, "lip_mm": 30},
        "material":      "HR",
        "thickness_mm":  4.0,
        "bend_count":    4,
        "flat_blank_mm": 430.0,
        "tooling_id":    "ZS-HEAVY-MS",
        "notes":         "Structural Z — only SAI-HD-30 can form t=4.0mm HR",
    },
    {
        "profile_id":    "P017-ZS-STD-GI",
        "profile_type":  "z_section",
        "description":   "Z-section Z100×50×15 — GI 1.5mm (light industrial)",
        "typical_dims":  {"height_mm": 100, "flange_mm": 50, "lip_mm": 15},
        "material":      "GI",
        "thickness_mm":  1.5,
        "bend_count":    4,
        "flat_blank_mm": 195.0,
        "tooling_id":    "ZS-STD-MS",
        "notes":         "Light Z-purlin — warehouse racking cross-member",
    },
    # ── 18–21: HAT SECTION / OMEGA TRACK ──────────────────────────────────────
    {
        "profile_id":    "P018-HAT-STD-GI",
        "profile_type":  "hat_section",
        "description":   "Hat section 80×40×25 — GI 1.2mm (suspended ceiling track)",
        "typical_dims":  {"width_mm": 80, "flange_mm": 40, "depth_mm": 25},
        "material":      "GI",
        "thickness_mm":  1.2,
        "bend_count":    4,
        "flat_blank_mm": 165.0,
        "tooling_id":    "HAT-STD-MS",
        "notes":         "Ceiling cross-tee profile; used in drywall framing systems",
    },
    {
        "profile_id":    "P019-HAT-MED-CR",
        "profile_type":  "hat_section",
        "description":   "Hat section 100×50×30 — CR 1.5mm (automotive floor cross-member)",
        "typical_dims":  {"width_mm": 100, "flange_mm": 50, "depth_mm": 30},
        "material":      "CR",
        "thickness_mm":  1.5,
        "bend_count":    4,
        "flat_blank_mm": 200.0,
        "tooling_id":    "HAT-STD-MS",
        "notes":         "Automotive floor/sill — spot-weld flanges in assembly",
    },
    # ── 20–22: SIGMA SECTION ──────────────────────────────────────────────────
    {
        "profile_id":    "P020-SIG-STD-GI",
        "profile_type":  "sigma_section",
        "description":   "Sigma purlin Σ150×65×20 — GI 2.0mm (sandwich panel sub-frame)",
        "typical_dims":  {"height_mm": 150, "flange_mm": 65, "stiffener_mm": 20},
        "material":      "GI",
        "thickness_mm":  2.0,
        "bend_count":    6,
        "flat_blank_mm": 340.0,
        "tooling_id":    "SIG-STD-MS",
        "notes":         "6-bend sigma — web stiffener lip critical for torsion resistance",
    },
    {
        "profile_id":    "P021-SIG-MED-GI",
        "profile_type":  "sigma_section",
        "description":   "Sigma purlin Σ200×75×25 — GI 2.5mm (industrial shed roofing)",
        "typical_dims":  {"height_mm": 200, "flange_mm": 75, "stiffener_mm": 25},
        "material":      "GI",
        "thickness_mm":  2.5,
        "bend_count":    6,
        "flat_blank_mm": 425.0,
        "tooling_id":    "SIG-STD-MS",
        "notes":         "High-load sigma — used where Z-purlins cannot provide torsion control",
    },
    {
        "profile_id":    "P022-SIG-HEAVY-HR",
        "profile_type":  "sigma_section",
        "description":   "Sigma purlin Σ300×100×30 — HR 5.0mm (heavy structural)",
        "typical_dims":  {"height_mm": 300, "flange_mm": 100, "stiffener_mm": 30},
        "material":      "HR",
        "thickness_mm":  5.0,
        "bend_count":    6,
        "flat_blank_mm": 600.0,
        "tooling_id":    "SIG-HEAVY-MS",
        "notes":         "Structural sigma — SAI-HD-30 only; high forming force ~180kN",
    },
    # ── 23–25: OMEGA / TOP-HAT ────────────────────────────────────────────────
    {
        "profile_id":    "P023-OMG-LIGHT-GI",
        "profile_type":  "omega_section",
        "description":   "Omega channel 50×25×15 — GI 0.8mm (cable management, capping)",
        "typical_dims":  {"web_mm": 50, "flange_mm": 25, "depth_mm": 15},
        "material":      "GI",
        "thickness_mm":  0.8,
        "bend_count":    4,
        "flat_blank_mm": 100.0,
        "tooling_id":    "OMG-STD-MS",
        "notes":         "Thin-gauge cable tray omega cap — continuous production typical",
    },
    {
        "profile_id":    "P024-OMG-STD-SS",
        "profile_type":  "omega_section",
        "description":   "Omega channel 80×30×20 — SS304 1.0mm (pharma cleanroom track)",
        "typical_dims":  {"web_mm": 80, "flange_mm": 30, "depth_mm": 20},
        "material":      "SS",
        "thickness_mm":  1.0,
        "bend_count":    4,
        "flat_blank_mm": 140.0,
        "tooling_id":    "OMG-STD-SS",
        "notes":         "Pharmaceutical grade — mirror Ra finish; D2 polished rolls",
    },
    {
        "profile_id":    "P025-OMG-MED-GI",
        "profile_type":  "omega_section",
        "description":   "Omega purlin 100×50×25 — GI 1.5mm (suspended ceiling main runner)",
        "typical_dims":  {"web_mm": 100, "flange_mm": 50, "depth_mm": 25},
        "material":      "GI",
        "thickness_mm":  1.5,
        "bend_count":    4,
        "flat_blank_mm": 200.0,
        "tooling_id":    "OMG-STD-MS",
        "notes":         "Ceiling main runner — wide web for acoustic tile support",
    },
    # ── 26–28: ANGLE SECTION ──────────────────────────────────────────────────
    {
        "profile_id":    "P026-ANG-STD-GI",
        "profile_type":  "angle_section",
        "description":   "Equal angle 50×50 — GI 2.0mm (shelf bracket, corner protector)",
        "typical_dims":  {"leg_mm": 50},
        "material":      "GI",
        "thickness_mm":  2.0,
        "bend_count":    1,
        "flat_blank_mm": 100.0,
        "tooling_id":    "ANG-STD-MS",
        "notes":         "Simplest profile — 1 bend, high-speed production possible",
    },
    {
        "profile_id":    "P027-ANG-STD-SS",
        "profile_type":  "angle_section",
        "description":   "Equal angle SS304 50×50 — 1.5mm (hygienic corner guards)",
        "typical_dims":  {"leg_mm": 50},
        "material":      "SS",
        "thickness_mm":  1.5,
        "bend_count":    1,
        "flat_blank_mm": 100.0,
        "tooling_id":    "ANG-STD-SS",
        "notes":         "Hygienic corner angle — Ra 0.8μm max; CNC preferred for tight tolerances",
    },
    {
        "profile_id":    "P028-ANG-HEAVY-HR",
        "profile_type":  "angle_section",
        "description":   "Unequal angle 100×50 — HR 4.0mm (structural bracket)",
        "typical_dims":  {"leg1_mm": 100, "leg2_mm": 50},
        "material":      "HR",
        "thickness_mm":  4.0,
        "bend_count":    1,
        "flat_blank_mm": 150.0,
        "tooling_id":    "ANG-STD-MS",
        "notes":         "Heavy structural angle — SAI-HD-30 only for t=4.0mm HR",
    },
    # ── 29–32: TRAPEZOID / ROOFING SHEET ──────────────────────────────────────
    {
        "profile_id":    "P029-TRAP-THIN-GI",
        "profile_type":  "trapezoid",
        "description":   "Trapezoidal roofing sheet T45 — GI 0.5mm (domestic roofing)",
        "typical_dims":  {"rib_height_mm": 45, "rib_pitch_mm": 250},
        "material":      "GI",
        "thickness_mm":  0.5,
        "bend_count":    4,
        "flat_blank_mm": 1000.0,
        "tooling_id":    "TRAP-THIN-MS",
        "notes":         "Multi-rib simultaneous forming — all ribs formed in same pass set",
    },
    {
        "profile_id":    "P030-TRAP-STD-GI",
        "profile_type":  "trapezoid",
        "description":   "Trapezoidal decking T50×200 — GI 1.0mm (floor deck, industrial)",
        "typical_dims":  {"rib_height_mm": 50, "rib_pitch_mm": 200},
        "material":      "GI",
        "thickness_mm":  1.0,
        "bend_count":    6,
        "flat_blank_mm": 1200.0,
        "tooling_id":    "TRAP-STD-MS",
        "notes":         "Floor deck — check anti-buckle bars in entry guides",
    },
    {
        "profile_id":    "P031-TRAP-RIBBED-GI",
        "profile_type":  "trapezoid",
        "description":   "IBR corrugated sheet — GI 0.7mm (industrial roofing, Africa/ME)",
        "typical_dims":  {"rib_height_mm": 38, "rib_pitch_mm": 150},
        "material":      "GI",
        "thickness_mm":  0.7,
        "bend_count":    8,
        "flat_blank_mm": 840.0,
        "tooling_id":    "TRAP-THIN-MS",
        "notes":         "IBR (Inverted Box Rib) — high-volume commodity roofing sheet",
    },
    {
        "profile_id":    "P032-TRAP-HEAVY-GI",
        "profile_type":  "trapezoid",
        "description":   "Heavy decking T75×300 — GI 1.5mm (composite floor slab)",
        "typical_dims":  {"rib_height_mm": 75, "rib_pitch_mm": 300},
        "material":      "GI",
        "thickness_mm":  1.5,
        "bend_count":    6,
        "flat_blank_mm": 1000.0,
        "tooling_id":    "TRAP-STD-MS",
        "notes":         "Composite decking — interlocking ribs; HF weld NOT required",
    },
    # ── 33–36: SHUTTER SLAT ───────────────────────────────────────────────────
    {
        "profile_id":    "P033-SHT-THIN-GI",
        "profile_type":  "shutter_slat",
        "description":   "Shutter slat 77mm wide — GI 0.5mm (residential roller shutter)",
        "typical_dims":  {"slat_width_mm": 77, "depth_mm": 14},
        "material":      "GI",
        "thickness_mm":  0.5,
        "bend_count":    3,
        "flat_blank_mm": 95.0,
        "tooling_id":    "SHT-THIN-MS",
        "notes":         "Light residential slat — hook-lock formed in last 2 passes",
    },
    {
        "profile_id":    "P034-SHT-STD-GI",
        "profile_type":  "shutter_slat",
        "description":   "Shutter slat 77mm — GI 0.8mm (commercial roller shutter)",
        "typical_dims":  {"slat_width_mm": 77, "depth_mm": 17},
        "material":      "GI",
        "thickness_mm":  0.8,
        "bend_count":    3,
        "flat_blank_mm": 100.0,
        "tooling_id":    "SHT-THIN-MS",
        "notes":         "Commercial grade slat — higher forming force than P033",
    },
    {
        "profile_id":    "P035-SHT-FIRE-GI",
        "profile_type":  "shutter_slat",
        "description":   "Fire-rated shutter slat 90mm — GI 1.2mm (industrial/fire-rated)",
        "typical_dims":  {"slat_width_mm": 90, "depth_mm": 22},
        "material":      "GI",
        "thickness_mm":  1.2,
        "bend_count":    3,
        "flat_blank_mm": 120.0,
        "tooling_id":    "SHT-STD-MS",
        "notes":         "Fire door shutter — intumescent strip groove may need extra pass",
    },
    {
        "profile_id":    "P036-SHT-SS-FIRE",
        "profile_type":  "shutter_slat",
        "description":   "Shutter slat SS304 77mm — 0.8mm (architectural/high-end)",
        "typical_dims":  {"slat_width_mm": 77, "depth_mm": 17},
        "material":      "SS",
        "thickness_mm":  0.8,
        "bend_count":    3,
        "flat_blank_mm": 100.0,
        "tooling_id":    "SHT-THIN-MS",
        "notes":         "Stainless shutter — high springback; CNC preferred for hook accuracy",
    },
    # ── 37–38: SHUTTER GUIDE ──────────────────────────────────────────────────
    {
        "profile_id":    "P037-SHTP-STD-GI",
        "profile_type":  "shutter_profile",
        "description":   "Shutter guide channel U60×30 — GI 0.8mm (roller shutter guide)",
        "typical_dims":  {"web_mm": 60, "flange_mm": 30},
        "material":      "GI",
        "thickness_mm":  0.8,
        "bend_count":    2,
        "flat_blank_mm": 120.0,
        "tooling_id":    "SHTP-STD-MS",
        "notes":         "Precision U-guide — smooth finish required for low-friction slat travel",
    },
    {
        "profile_id":    "P038-SHTP-HVY-GI",
        "profile_type":  "shutter_profile",
        "description":   "Heavy shutter guide J-channel 80×40 — GI 1.2mm (industrial shutter)",
        "typical_dims":  {"web_mm": 80, "flange_mm": 40},
        "material":      "GI",
        "thickness_mm":  1.2,
        "bend_count":    2,
        "flat_blank_mm": 160.0,
        "tooling_id":    "SHTP-STD-MS",
        "notes":         "Industrial J-guide — heavier gauge for fire/security shutter duty",
    },
    # ── 39–41: DOOR FRAME ─────────────────────────────────────────────────────
    {
        "profile_id":    "P039-DFR-STD-GI",
        "profile_type":  "door_frame",
        "description":   "Steel door frame 900×2100 — GI 1.2mm (residential hollow-metal frame)",
        "typical_dims":  {"width_mm": 900, "depth_mm": 100},
        "material":      "GI",
        "thickness_mm":  1.2,
        "bend_count":    5,
        "flat_blank_mm": 300.0,
        "tooling_id":    "DFR-STD-MS",
        "notes":         "Multi-return frame profile — rebate, stop, face flange all formed",
    },
    {
        "profile_id":    "P040-DFR-HVY-GI",
        "profile_type":  "door_frame",
        "description":   "Steel door frame industrial — GI 1.5mm (fire-rated HM frame)",
        "typical_dims":  {"width_mm": 900, "depth_mm": 125},
        "material":      "GI",
        "thickness_mm":  1.5,
        "bend_count":    6,
        "flat_blank_mm": 380.0,
        "tooling_id":    "DFR-STD-MS",
        "notes":         "Fire-rated hollow-metal frame — tested per EN 1634-1",
    },
    {
        "profile_id":    "P041-DFR-SS-ARCH",
        "profile_type":  "door_frame",
        "description":   "Stainless door frame SS316 — 1.0mm (hospital/cleanroom)",
        "typical_dims":  {"width_mm": 900, "depth_mm": 100},
        "material":      "SS",
        "thickness_mm":  1.0,
        "bend_count":    5,
        "flat_blank_mm": 300.0,
        "tooling_id":    "DFR-STD-SS",
        "notes":         "Hospital-grade SS316 frame — mirror finish; welded corners",
    },
    # ── 42–43: BOX SECTION ────────────────────────────────────────────────────
    {
        "profile_id":    "P042-BOX-STD-GI",
        "profile_type":  "box_section",
        "description":   "Box section 100×50×2.0 — GI (cable tray, solar frame structure)",
        "typical_dims":  {"height_mm": 100, "width_mm": 50},
        "material":      "GI",
        "thickness_mm":  2.0,
        "bend_count":    4,
        "flat_blank_mm": 300.0,
        "tooling_id":    "BOX-STD-MS",
        "notes":         "Closed section — HF seam weld + sizing passes mandatory",
    },
    {
        "profile_id":    "P043-BOX-HEAVY-HR",
        "profile_type":  "box_section",
        "description":   "Box section 150×100×4.0 — HR (structural, mezzanine floor beam)",
        "typical_dims":  {"height_mm": 150, "width_mm": 100},
        "material":      "HR",
        "thickness_mm":  4.0,
        "bend_count":    4,
        "flat_blank_mm": 500.0,
        "tooling_id":    "BOX-STD-MS",
        "notes":         "Heavy RHS substitute — SAI-HD-30 only; ERW or HF weld required",
    },
    # ── 44–45: SQUARE TUBE ────────────────────────────────────────────────────
    {
        "profile_id":    "P044-SQT-STD-GI",
        "profile_type":  "square_tube",
        "description":   "Square tube 50×50×2.0 — GI (furniture, handrail, sign post)",
        "typical_dims":  {"side_mm": 50},
        "material":      "GI",
        "thickness_mm":  2.0,
        "bend_count":    4,
        "flat_blank_mm": 200.0,
        "tooling_id":    "SQT-STD-MS",
        "notes":         "SHS — corner radius typically 2×t; sizing pass for roundness",
    },
    {
        "profile_id":    "P045-SQT-HEAVY-HR",
        "profile_type":  "square_tube",
        "description":   "Square tube 100×100×4.0 — HR (structural column, gate post)",
        "typical_dims":  {"side_mm": 100},
        "material":      "HR",
        "thickness_mm":  4.0,
        "bend_count":    4,
        "flat_blank_mm": 400.0,
        "tooling_id":    "SQT-STD-MS",
        "notes":         "Heavy SHS — ERW weld station required after forming rolls",
    },
    # ── 46–48: RECT TUBE ──────────────────────────────────────────────────────
    {
        "profile_id":    "P046-RHT-THIN-GI",
        "profile_type":  "rect_tube",
        "description":   "Rect tube 100×50×1.5 — GI (cable tray, false ceiling)",
        "typical_dims":  {"height_mm": 100, "width_mm": 50},
        "material":      "GI",
        "thickness_mm":  1.5,
        "bend_count":    4,
        "flat_blank_mm": 300.0,
        "tooling_id":    "RHT-THIN-MS",
        "notes":         "Thin-wall RHS — lock-seam or HF weld; sizing critical for squareness",
    },
    {
        "profile_id":    "P047-RHT-STD-GI",
        "profile_type":  "rect_tube",
        "description":   "Rect tube 150×75×2.0 — GI (structural secondary beam)",
        "typical_dims":  {"height_mm": 150, "width_mm": 75},
        "material":      "GI",
        "thickness_mm":  2.0,
        "bend_count":    4,
        "flat_blank_mm": 450.0,
        "tooling_id":    "RHT-THIN-MS",
        "notes":         "Standard RHS — structural use; verify weld seam quality",
    },
    {
        "profile_id":    "P048-RHT-HEAVY-HR",
        "profile_type":  "rect_tube",
        "description":   "Rect tube 200×100×4.0 — HR (truck body frame, trailer cross-member)",
        "typical_dims":  {"height_mm": 200, "width_mm": 100},
        "material":      "HR",
        "thickness_mm":  4.0,
        "bend_count":    4,
        "flat_blank_mm": 600.0,
        "tooling_id":    "RHT-HEAVY-MS",
        "notes":         "Heavy RHS — automotive/trailer structural; ERW mandatory",
    },
    # ── 49–50: SPECIAL / MULTI-RETURN ─────────────────────────────────────────
    {
        "profile_id":    "P049-LC-EAVES-GI",
        "profile_type":  "lipped_channel",
        "description":   "Eaves gutter C250×120×30 — GI 1.2mm (box gutter, roof drainage)",
        "typical_dims":  {"height_mm": 250, "flange_mm": 120, "lip_mm": 30},
        "material":      "GI",
        "thickness_mm":  1.2,
        "bend_count":    4,
        "flat_blank_mm": 400.0,
        "tooling_id":    "LC-STD-MS",
        "notes":         "Wide-flange gutter — side roll guides mandatory; check edge wave",
    },
    {
        "profile_id":    "P050-LC-RAFTER-GI",
        "profile_type":  "lipped_channel",
        "description":   "Cold-formed rafter C300×90×25 — GI 2.0mm (portal frame rafter)",
        "typical_dims":  {"height_mm": 300, "flange_mm": 90, "lip_mm": 25},
        "material":      "GI",
        "thickness_mm":  2.0,
        "bend_count":    4,
        "flat_blank_mm": 480.0,
        "tooling_id":    "LC-STD-MS",
        "notes":         "Portal frame cold rafter — used in pre-engineered buildings (PEB)",
    },
]


# ─── MACHINE COMPATIBILITY GENERATOR ─────────────────────────────────────────

def _check_machine_with_tooling(
    machine_id: str,
    profile: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Full per-machine compatibility check: machine limits + tooling shaft/OD.

    Hard rules (user requirement):
      1. Machine dimension/material/station checks (via validate_profile_on_machine)
      2. Tooling shaft mismatch  → blocked (not validated)
      3. Tooling OD mismatch     → blocked (not validated)
      4. No tooling in library   → blocked (not validated)

    Returns a dict with:
      feasible             : bool  (True only if machine AND tooling both pass)
      tooling_id           : str | None   (from live get_best_match_for_machine)
      tooling_shaft_dia_mm : int  | None
      tooling_max_od_mm    : float| None
      machine_shaft_dia_mm : int
      machine_max_od_mm    : float
      machine_class        : str
      blocking_reasons     : List[str]  (machine-level + tooling-level combined)
      warnings             : List[str]
    """
    mc = MACHINE_REGISTRY[machine_id]
    machine_shaft = mc["shaft_diameter_mm"]
    machine_max_od = mc["max_roll_od_mm"]

    # ── Step 1: Machine dimension / material / station check ──────────────────
    v = validate_profile_on_machine(
        machine_id,
        profile["profile_type"],
        profile["thickness_mm"],
        profile["flat_blank_mm"],
        profile["bend_count"],
        profile["material"],
        required_stations=max(profile["bend_count"] * 3, 8),
        max_roll_od_needed_mm=0.0,
    )
    blocking: List[str] = list(v["blocking_reasons"])
    warnings: List[str] = list(v["warnings"])

    # ── Step 2: Live tooling compatibility (shaft + OD) ───────────────────────
    tool = get_best_match_for_machine(
        profile["profile_type"],
        profile["material"],
        profile["thickness_mm"],
        machine_shaft,
        machine_max_od,
    )

    tooling_id: Optional[str] = None
    tooling_shaft: Optional[int] = None
    tooling_max_od: Optional[float] = None
    tooling_feasible = False

    if tool is None:
        # No library entry fits this machine's shaft + OD constraints
        blocking.append(
            f"No tooling in library fits machine shaft={machine_shaft}mm "
            f"/ max_OD={machine_max_od}mm for {profile['profile_type']} "
            f"{profile['material']} t={profile['thickness_mm']}mm — "
            f"custom tooling required (shaft bore mismatch)"
        )
    else:
        tooling_id = tool["id"]
        tooling_shaft = tool.get("shaft_dia_mm")
        tooling_max_od = tool.get("roll_od_max_mm")

        # Hard rule: shaft mismatch blocks
        if tooling_shaft is not None and tooling_shaft > machine_shaft:
            blocking.append(
                f"Tooling shaft {tooling_shaft}mm > machine shaft {machine_shaft}mm "
                f"(tooling_id={tooling_id}) — shaft bore mismatch, NOT validated"
            )
        # Hard rule: OD mismatch blocks
        elif tooling_max_od is not None and tooling_max_od > machine_max_od:
            blocking.append(
                f"Tooling max OD {tooling_max_od}mm > machine max OD {machine_max_od}mm "
                f"(tooling_id={tooling_id}) — OD mismatch, NOT validated"
            )
        else:
            tooling_feasible = True
            # Pass through any tooling constraint warnings (non-blocking)
            if "_machine_constraint_warning" in tool:
                warnings.append(tool["_machine_constraint_warning"])

    overall_feasible = v["feasible"] and tooling_feasible

    return {
        "feasible":             overall_feasible,
        "tooling_id":           tooling_id,
        "tooling_shaft_dia_mm": tooling_shaft,
        "tooling_max_od_mm":    tooling_max_od,
        "machine_shaft_dia_mm": machine_shaft,
        "machine_max_od_mm":    machine_max_od,
        "machine_class":        mc["machine_class"],
        "blocking_reasons":     blocking,
        "warnings":             warnings,
    }


def _validate_all_machines(profile: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run full compatibility check (machine limits + tooling shaft/OD) for all 4 machines.
    Returns per-machine result dict from _check_machine_with_tooling.
    """
    return {mid: _check_machine_with_tooling(mid, profile) for mid in MACHINES}


def get_profile_matrix(include_machine_compat: bool = True) -> List[Dict[str, Any]]:
    """
    Return the full top-50 profile matrix.

    If include_machine_compat=True, each entry includes:
      - machine_compat       : per-machine result (machine limits + tooling shaft/OD)
      - validation_status    : 'validated' (≥1 machine feasible) | 'rejected_all'
      - capable_machines     : list of machine_ids where both machine AND tooling pass
      - recommended_machine  : first capable machine
      - tooling_id           : live tooling_id for recommended machine (NOT static)

    Hard rules applied:
      shaft mismatch  → machine not capable
      OD mismatch     → machine not capable
      no library tool → machine not capable
    """
    matrix = []
    for p in TOP50_PROFILES:
        entry = dict(p)
        if include_machine_compat:
            compat = _validate_all_machines(p)
            capable = [mid for mid, r in compat.items() if r["feasible"]]
            rec_machine = capable[0] if capable else None

            # tooling_id = live result for recommended machine; None if no capable machine
            live_tooling_id = (
                compat[rec_machine]["tooling_id"] if rec_machine else None
            )

            entry["machine_compat"]       = compat
            entry["capable_machines"]     = capable
            entry["recommended_machine"]  = rec_machine
            entry["validation_status"]    = "validated" if capable else "rejected_all"
            # Override static tooling_id with live per-machine result
            entry["tooling_id"]           = live_tooling_id
        matrix.append(entry)
    return matrix


def get_profile_by_id(profile_id: str) -> Optional[Dict[str, Any]]:
    """Return a single profile entry by its profile_id."""
    for p in TOP50_PROFILES:
        if p["profile_id"] == profile_id:
            return p
    return None


def matrix_summary() -> Dict[str, Any]:
    """
    Return high-level summary of the top-50 matrix.
    All counts recomputed from live matrix (not from static profile list).
    """
    matrix = get_profile_matrix(include_machine_compat=True)
    validated = [p for p in matrix if p["validation_status"] == "validated"]
    rejected  = [p for p in matrix if p["validation_status"] == "rejected_all"]

    by_section: Dict[str, int] = {}
    for p in TOP50_PROFILES:
        pt = p["profile_type"]
        by_section[pt] = by_section.get(pt, 0) + 1

    # Machine coverage: count from live capable_machines (not static data)
    machine_coverage: Dict[str, int] = {mid: 0 for mid in MACHINES}
    for p in matrix:
        for mid in p.get("capable_machines", []):
            machine_coverage[mid] += 1

    # Tooling IDs: collect from live matrix results (per recommended machine)
    live_tooling_ids = sorted(set(
        p["tooling_id"] for p in matrix if p.get("tooling_id")
    ))

    return {
        "total_profiles":        len(matrix),
        "validated_count":       len(validated),
        "rejected_count":        len(rejected),
        "profiles_by_section":   by_section,
        "machine_coverage":      machine_coverage,
        "tooling_ids_used":      live_tooling_ids,
        "materials_represented": sorted(set(p["material"] for p in TOP50_PROFILES)),
        "thickness_range_mm": {
            "min": min(p["thickness_mm"] for p in TOP50_PROFILES),
            "max": max(p["thickness_mm"] for p in TOP50_PROFILES),
        },
    }
