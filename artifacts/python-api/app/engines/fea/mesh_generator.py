"""
mesh_generator.py — FEA Shell Element Mesh Generator
Sai Rolotech Smart Engines v2.2.0

Generates:
  1. Strip mesh: S4R shell elements on mid-surface of strip blank
  2. Roll rigid surface: R3D4 rigid shell elements forming roll arc
     (or analytical rigid surface node-set for CalculiX *RIGID BODY)

Coordinate system:
  X — machine direction (strip travel direction, 0 → station_pitch_mm)
  Y — strip width direction (-flat_blank/2 → +flat_blank/2)
  Z — thickness / vertical bending direction (initially 0 — flat strip)

Shell element S4R:
  - 4-node quadrilateral, reduced integration, hourglass control
  - Standard for sheet metal forming (Abaqus/CalculiX)
  - Node ordering: counter-clockwise when viewed from +Z

Roll rigid surface:
  - Upper roll: arc of R3D4 elements from θ=180° to θ=270° (bottom of upper roll)
  - Lower roll: arc of R3D4 elements from θ=90° to θ=0° (top of lower roll)
  - Roll axis: X direction (roll rotates about X)
  - Roll center: (0, flat_blank/2, ± (R_roll + t/2))
    (positioned to just touch strip top/bottom surface initially)
"""

import math
from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Optional


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class MeshNode:
    nid: int
    x: float
    y: float
    z: float

    def as_inp_line(self) -> str:
        return f"{self.nid:8d},{self.x:16.8f},{self.y:16.8f},{self.z:16.8f}"


@dataclass
class ShellElement:
    eid: int
    n1: int
    n2: int
    n3: int
    n4: int
    elset: str = "ESTRIP"

    def as_inp_line(self) -> str:
        return f"{self.eid:8d},{self.n1:8d},{self.n2:8d},{self.n3:8d},{self.n4:8d}"


@dataclass
class RigidElement:
    eid: int
    n1: int
    n2: int
    n3: int
    n4: int
    elset: str = "EROLL_UPPER"

    def as_inp_line(self) -> str:
        return f"{self.eid:8d},{self.n1:8d},{self.n2:8d},{self.n3:8d},{self.n4:8d}"


@dataclass
class NodeSet:
    name: str
    node_ids: List[int]


@dataclass
class ElementSet:
    name: str
    element_ids: List[int]


@dataclass
class StripMesh:
    """Complete strip shell mesh."""
    nodes: List[MeshNode]
    elements: List[ShellElement]
    node_sets: Dict[str, NodeSet]
    element_sets: Dict[str, ElementSet]
    n_x: int
    n_y: int
    flat_blank_mm: float
    station_pitch_mm: float
    thickness_mm: float
    total_nodes: int
    total_elements: int

    def node_id(self, iy: int, ix: int) -> int:
        """Node ID at width-index iy (0..n_y), length-index ix (0..n_x)."""
        return iy * (self.n_x + 1) + ix + 1

    def summary(self) -> dict:
        return {
            "total_nodes": self.total_nodes,
            "total_elements": self.total_elements,
            "element_type": "S4R",
            "n_x_elements": self.n_x,
            "n_y_elements": self.n_y,
            "flat_blank_mm": self.flat_blank_mm,
            "station_pitch_mm": self.station_pitch_mm,
            "thickness_mm": self.thickness_mm,
            "element_size_x_mm": round(self.station_pitch_mm / self.n_x, 3),
            "element_size_y_mm": round(self.flat_blank_mm / self.n_y, 3),
            "node_sets": list(self.node_sets.keys()),
            "element_sets": list(self.element_sets.keys()),
        }


@dataclass
class RollSurface:
    """Rigid roll surface (upper or lower)."""
    label: str
    nodes: List[MeshNode]
    elements: List[RigidElement]
    ref_node: MeshNode
    ref_node_set: str
    element_set: str
    surface_name: str
    roll_radius_mm: float
    n_arc: int
    n_face: int
    center_y: float
    center_z: float

    def summary(self) -> dict:
        return {
            "label": self.label,
            "roll_radius_mm": self.roll_radius_mm,
            "total_nodes": len(self.nodes),
            "total_elements": len(self.elements),
            "ref_node_id": self.ref_node.nid,
            "ref_node_set": self.ref_node_set,
            "element_set": self.element_set,
            "surface_name": self.surface_name,
            "center_y_mm": self.center_y,
            "center_z_mm": self.center_z,
        }


# ---------------------------------------------------------------------------
# Strip mesh generator
# ---------------------------------------------------------------------------

def generate_strip_mesh(
    flat_blank_mm: float,
    station_pitch_mm: float,
    thickness_mm: float,
    n_x: int = 12,
    n_y: int = 24,
) -> StripMesh:
    """
    Generate S4R shell element mesh for the strip blank.

    Parameters
    ----------
    flat_blank_mm    : total strip width (Y direction)
    station_pitch_mm : length of strip modelled = one roll pitch (X direction)
    thickness_mm     : strip thickness (assigned to shell section, not mesh)
    n_x              : number of elements in machine direction X  (default 12)
    n_y              : number of elements in width direction Y    (default 24)

    Returns
    -------
    StripMesh with nodes, S4R elements, named node/element sets.
    """
    if flat_blank_mm <= 0:
        raise ValueError(f"flat_blank_mm must be positive, got {flat_blank_mm}")
    if station_pitch_mm <= 0:
        raise ValueError(f"station_pitch_mm must be positive, got {station_pitch_mm}")
    if thickness_mm <= 0:
        raise ValueError(f"thickness_mm must be positive, got {thickness_mm}")
    if n_x < 2:
        raise ValueError(f"n_x must be >= 2, got {n_x}")
    if n_y < 2:
        raise ValueError(f"n_y must be >= 2, got {n_y}")

    dx = station_pitch_mm / n_x
    dy = flat_blank_mm / n_y

    # --- Nodes ---
    nodes: List[MeshNode] = []
    for iy in range(n_y + 1):
        for ix in range(n_x + 1):
            nid = iy * (n_x + 1) + ix + 1
            x = ix * dx
            y = iy * dy - flat_blank_mm / 2.0
            z = 0.0
            nodes.append(MeshNode(nid, x, y, z))

    # --- S4R Elements ---
    # Counter-clockwise node ordering viewed from +Z:
    # n1(iy, ix) → n2(iy, ix+1) → n3(iy+1, ix+1) → n4(iy+1, ix)
    elements: List[ShellElement] = []
    for iy in range(n_y):
        for ix in range(n_x):
            eid = iy * n_x + ix + 1
            n1 = iy * (n_x + 1) + ix + 1
            n2 = iy * (n_x + 1) + ix + 2
            n3 = (iy + 1) * (n_x + 1) + ix + 2
            n4 = (iy + 1) * (n_x + 1) + ix + 1
            elements.append(ShellElement(eid, n1, n2, n3, n4))

    # --- Named Node Sets ---
    node_sets: Dict[str, NodeSet] = {}

    # All strip nodes
    all_nids = [n.nid for n in nodes]
    node_sets["NSTRIP_ALL"] = NodeSet("NSTRIP_ALL", all_nids)

    # Inlet face: ix=0 (nodes where strip enters roll nip)
    inlet_nids = [iy * (n_x + 1) + 1 for iy in range(n_y + 1)]
    node_sets["NSTRIP_INLET"] = NodeSet("NSTRIP_INLET", inlet_nids)

    # Outlet face: ix=n_x (nodes where strip exits roll nip)
    outlet_nids = [iy * (n_x + 1) + n_x + 1 for iy in range(n_y + 1)]
    node_sets["NSTRIP_OUTLET"] = NodeSet("NSTRIP_OUTLET", outlet_nids)

    # Symmetry edge: iy=0 (one longitudinal edge, y=-flat_blank/2)
    edge_lo_nids = [ix + 1 for ix in range(n_x + 1)]
    node_sets["NSTRIP_EDGE_LO"] = NodeSet("NSTRIP_EDGE_LO", edge_lo_nids)

    # Symmetry edge: iy=n_y (y=+flat_blank/2)
    edge_hi_nids = [n_y * (n_x + 1) + ix + 1 for ix in range(n_x + 1)]
    node_sets["NSTRIP_EDGE_HI"] = NodeSet("NSTRIP_EDGE_HI", edge_hi_nids)

    # Centreline: iy = n_y//2
    mid_iy = n_y // 2
    centre_nids = [mid_iy * (n_x + 1) + ix + 1 for ix in range(n_x + 1)]
    node_sets["NSTRIP_CENTRE"] = NodeSet("NSTRIP_CENTRE", centre_nids)

    # --- Named Element Sets ---
    element_sets: Dict[str, ElementSet] = {}

    all_eids = [e.eid for e in elements]
    element_sets["ESTRIP"] = ElementSet("ESTRIP", all_eids)

    # Inlet row elements (ix=0)
    inlet_eids = [iy * n_x + 1 for iy in range(n_y)]
    element_sets["ESTRIP_INLET"] = ElementSet("ESTRIP_INLET", inlet_eids)

    # Outlet row elements (ix=n_x-1)
    outlet_eids = [iy * n_x + n_x for iy in range(n_y)]
    element_sets["ESTRIP_OUTLET"] = ElementSet("ESTRIP_OUTLET", outlet_eids)

    # Centre column elements (iy = n_y//2)
    centre_eids = [(n_y // 2) * n_x + ix + 1 for ix in range(n_x)]
    element_sets["ESTRIP_CENTRE"] = ElementSet("ESTRIP_CENTRE", centre_eids)

    total_nodes = len(nodes)
    total_elements = len(elements)

    return StripMesh(
        nodes=nodes,
        elements=elements,
        node_sets=node_sets,
        element_sets=element_sets,
        n_x=n_x,
        n_y=n_y,
        flat_blank_mm=flat_blank_mm,
        station_pitch_mm=station_pitch_mm,
        thickness_mm=thickness_mm,
        total_nodes=total_nodes,
        total_elements=total_elements,
    )


# ---------------------------------------------------------------------------
# Roll rigid surface generator
# ---------------------------------------------------------------------------

def generate_roll_rigid_surface(
    roll_radius_mm: float,
    face_width_mm: float,
    flat_blank_mm: float,
    thickness_mm: float,
    position: str = "upper",
    n_arc: int = 18,
    n_face: int = 4,
    node_id_offset: int = 100000,
    elem_id_offset: int = 100000,
) -> RollSurface:
    """
    Generate rigid R3D4 shell element mesh for one roll (upper or lower).

    The roll is a cylinder:
      - Axis: X direction (machine direction)
      - Radius: roll_radius_mm
      - Face width: face_width_mm (in X direction)
      - Positioned to just touch strip top/bottom surface at t=0 (flat strip)

    For the upper roll:
      - Center at Z = +(roll_radius + thickness/2)
      - Arc from θ=180° to θ=360° (270° = bottom of roll, touching strip top)
      - Only the lower 180° arc is meshed (contact region)

    For the lower roll:
      - Center at Z = -(roll_radius + thickness/2)
      - Arc from θ=0° to θ=180° (90° = top of roll, touching strip bottom)

    Parameters
    ----------
    roll_radius_mm   : outer radius of roll
    face_width_mm    : roll face width in machine direction X
    flat_blank_mm    : strip width (used to position roll centre in Y)
    thickness_mm     : strip thickness
    position         : "upper" or "lower"
    n_arc            : number of arc divisions (elements around circumference)
    n_face           : number of divisions along roll face width (X direction)
    node_id_offset   : starting node ID to avoid overlap with strip mesh
    elem_id_offset   : starting element ID to avoid overlap with strip mesh
    """
    if position not in ("upper", "lower"):
        raise ValueError(f"position must be 'upper' or 'lower', got {position!r}")
    if roll_radius_mm <= 0:
        raise ValueError(f"roll_radius_mm must be positive, got {roll_radius_mm}")
    if face_width_mm <= 0:
        raise ValueError(f"face_width_mm must be positive, got {face_width_mm}")
    if n_arc < 4:
        raise ValueError(f"n_arc must be >= 4, got {n_arc}")

    is_upper = position == "upper"

    # Roll centre Y = strip centreline = 0.0
    # Roll centre X = face_width / 2 (centred in model)
    center_y = 0.0
    center_z = (roll_radius_mm + thickness_mm / 2.0) * (1.0 if is_upper else -1.0)

    # Arc angle range
    # Upper: bottom half of roll (θ from 180° to 360° = -180° to 0°, i.e. the strip-facing half)
    # In standard: upper roll bottom point at θ=270° (pointing down)
    # Arc: θ from 180° to 360° (lower semicircle of upper roll)
    if is_upper:
        theta_start = math.pi        # 180° (left side of roll)
        theta_end = 2.0 * math.pi    # 360° (right side, wraps through bottom 270°)
    else:
        theta_start = 0.0            # 0° (right side of roll)
        theta_end = math.pi          # 180° (left side, wraps through top 90°)

    # X positions along face width
    x_positions = [face_width_mm * k / n_face for k in range(n_face + 1)]

    # --- Generate arc nodes ---
    nodes: List[MeshNode] = []
    n_arc_pts = n_arc + 1  # nodes per arc
    n_face_pts = n_face + 1

    for j in range(n_face_pts):
        for i in range(n_arc_pts):
            nid = node_id_offset + j * n_arc_pts + i + 1
            theta = theta_start + (theta_end - theta_start) * i / n_arc
            x = x_positions[j]
            y = center_y + roll_radius_mm * math.cos(theta)
            z = center_z - roll_radius_mm * math.sin(theta)
            nodes.append(MeshNode(nid, x, y, z))

    # --- Reference node (roll axis midpoint) ---
    ref_nid = node_id_offset + (n_face_pts * n_arc_pts) + 1
    ref_node = MeshNode(ref_nid, face_width_mm / 2.0, center_y, center_z)
    nodes.append(ref_node)

    # --- Generate R3D4 rigid elements ---
    elements: List[RigidElement] = []
    elset = f"EROLL_{position.upper()}"
    for j in range(n_face):
        for i in range(n_arc):
            eid = elem_id_offset + j * n_arc + i + 1
            n1 = node_id_offset + j * n_arc_pts + i + 1
            n2 = node_id_offset + j * n_arc_pts + i + 2
            n3 = node_id_offset + (j + 1) * n_arc_pts + i + 2
            n4 = node_id_offset + (j + 1) * n_arc_pts + i + 1
            elements.append(RigidElement(eid, n1, n2, n3, n4, elset=elset))

    # --- Node and element sets ---
    ref_nset = f"NROLL_{position.upper()}_RP"
    surface_name = f"SURF_ROLL_{position.upper()}"

    return RollSurface(
        label=f"Roll ({position}), R={roll_radius_mm}mm",
        nodes=nodes,
        elements=elements,
        ref_node=ref_node,
        ref_node_set=ref_nset,
        element_set=elset,
        surface_name=surface_name,
        roll_radius_mm=roll_radius_mm,
        n_arc=n_arc,
        n_face=n_face,
        center_y=center_y,
        center_z=center_z,
    )


# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------

def compute_roll_penetration(
    target_angle_deg: float,
    roll_radius_mm: float,
    station_pitch_mm: float,
    strip_thickness_mm: float,
) -> float:
    """
    Estimate required vertical displacement of upper roll reference node
    to achieve the target bending angle at the strip centreline.

    Uses a simplified geometric estimate:
      delta_z = R_bend * (1 - cos(theta/2))  where R_bend = roll_radius + t/2

    Returns displacement magnitude (positive = downward for upper roll).
    """
    theta_rad = math.radians(target_angle_deg)
    R_bend = roll_radius_mm + strip_thickness_mm / 2.0
    # Geometric relationship: arc sagitta = R*(1-cos(theta/2))
    # This is approximate; true kinematic coupling is handled in solver
    delta_z = R_bend * (1.0 - math.cos(theta_rad / 2.0))
    return round(delta_z, 6)


def strip_mesh_quality_check(mesh: StripMesh) -> dict:
    """
    Check mesh quality metrics.
    Returns aspect_ratio (should be < 5 for good FEA), and other metrics.
    """
    dx = mesh.station_pitch_mm / mesh.n_x
    dy = mesh.flat_blank_mm / mesh.n_y
    aspect_ratio = max(dx, dy) / min(dx, dy)
    total_area = mesh.flat_blank_mm * mesh.station_pitch_mm
    elem_area = dx * dy
    return {
        "element_size_x_mm": round(dx, 3),
        "element_size_y_mm": round(dy, 3),
        "aspect_ratio": round(aspect_ratio, 3),
        "total_nodes": mesh.total_nodes,
        "total_elements": mesh.total_elements,
        "total_area_mm2": round(total_area, 1),
        "element_area_mm2": round(elem_area, 3),
        "quality_pass": aspect_ratio <= 5.0,
        "quality_note": "PASS (aspect ratio ≤ 5)" if aspect_ratio <= 5.0 else f"WARN (aspect ratio {aspect_ratio:.2f} > 5 — refine mesh)",
    }
