import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "admin" | "engineer" | "viewer";

interface RoleState {
  role: UserRole;
  setRole: (r: UserRole) => void;
  can: (action: RoleAction) => boolean;
}

export type RoleAction =
  | "edit_project"
  | "generate_gcode"
  | "run_flower"
  | "run_cnc"
  | "view_3d"
  | "export_dxf"
  | "share_project"
  | "access_admin"
  | "manage_users"
  | "super_pro_mode"
  | "delete_project";

const ROLE_PERMISSIONS: Record<UserRole, RoleAction[]> = {
  admin: [
    "edit_project","generate_gcode","run_flower","run_cnc","view_3d",
    "export_dxf","share_project","access_admin","manage_users","super_pro_mode","delete_project",
  ],
  engineer: [
    "edit_project","generate_gcode","run_flower","run_cnc","view_3d",
    "export_dxf","share_project","super_pro_mode",
  ],
  viewer: ["view_3d","export_dxf"],
};

export const useRoleStore = create<RoleState>()(
  persist(
    (set, get) => ({
      role: "engineer",
      setRole: (r) => set({ role: r }),
      can: (action) => ROLE_PERMISSIONS[get().role].includes(action),
    }),
    { name: "sai-user-role" }
  )
);

export const ROLE_LABELS: Record<UserRole, string> = {
  admin:    "Admin",
  engineer: "Engineer",
  viewer:   "Viewer",
};

export const ROLE_COLORS: Record<UserRole, string> = {
  admin:    "#f59e0b",
  engineer: "#06b6d4",
  viewer:   "#6b7280",
};
