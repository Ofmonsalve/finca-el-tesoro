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
    hint: "Entró, pero aún no opera la finca.",
  },
];

export type FarmMember = {
  userId: string;
  email: string;
  name: string;
  role: FarmRole;
};

export function canRead(role: FarmRole) {
  return role === "admin" || role === "operador" || role === "consulta";
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

export function roleLabel(role: FarmRole) {
  return ROLES.find((r) => r.id === role)?.label ?? role;
}
