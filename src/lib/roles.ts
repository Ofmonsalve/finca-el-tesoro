export const FARM_ID = "finca-el-tesoro";

export type FarmRole = "admin" | "operador" | "consulta" | "pendiente";

export const ROLES: { id: FarmRole; label: string; hint: string }[] = [
  {
    id: "admin",
    label: "Administrador",
    hint: "Libro, equipo, restaurar, todos los módulos.",
  },
  {
    id: "operador",
    label: "Operador de campo",
    hint: "Cosecha, beneficio, pagos, costos y ventas. No toca el equipo.",
  },
  {
    id: "consulta",
    label: "Consulta",
    hint: "Solo lectura. Sin registrar ni descargar el libro.",
  },
  {
    id: "pendiente",
    label: "Pendiente",
    hint: "Entró, pero aún no opera la finca. Sin escritura hasta que un admin asigne rol.",
  },
];

export type FarmMember = {
  userId: string;
  email: string;
  name: string;
  role: FarmRole;
};

/**
 * Privilege rules (P0 / F-17–F-18):
 * - pendiente: may see shell, must NOT write the farm book.
 * - consulta: read-only.
 * - operador / admin: write.
 * - Team management / restore: admin only.
 *
 * Bootstrap admin (claimAdmin / first ensureMembership):
 * - Allowed only when the farm has ZERO admins (empty team or orphaned roster).
 * - Thereafter, role changes require setMemberRole by an existing admin
 *   (invite / approval path). Never free self-promotion while an admin exists.
 */
export function canRead(role: FarmRole) {
  return (
    role === "admin" ||
    role === "operador" ||
    role === "consulta" ||
    role === "pendiente"
  );
}

export function canWrite(role: FarmRole) {
  return role === "admin" || role === "operador";
}

export function canManageTeam(role: FarmRole) {
  return role === "admin";
}

export function canRestore(role: FarmRole) {
  return role === "admin";
}

export function canExport(role: FarmRole) {
  return role === "admin" || role === "operador";
}

/** True only when no admin exists — empty-team / orphan bootstrap. */
export function canBootstrapAdmin(members: ReadonlyArray<{ role: FarmRole }>) {
  return !members.some((m) => m.role === "admin");
}

export function roleLabel(role: FarmRole) {
  return ROLES.find((r) => r.id === role)?.label ?? role;
}
