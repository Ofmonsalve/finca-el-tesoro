export type LotCode = string;
export type LotStatus = "activo" | "inactivo" | "unificado";

export type FarmLot = {
  id: string;
  code: string;
  nombre: string;
  rol: string;
  accion: string;
  estado: string;
  areaHa: number;
  bloques: string[];
  harvestPriority: number;
  status: LotStatus;
  unifiedInto: string | null;
  variedad: string;
};

function def(
  code: string,
  nombre: string,
  rol: string,
  accion: string,
  estado: string,
  areaHa: number,
  bloques: string[],
  harvestPriority: number,
): FarmLot {
  return {
    id: code,
    code,
    nombre,
    rol,
    accion,
    estado,
    areaHa,
    bloques,
    harvestPriority,
    status: "activo",
    unifiedInto: null,
    variedad: "Caturra / Castillo",
  };
}

export const DEFAULT_LOTS: FarmLot[] = [
  def("FT-CEN", "Centro", "Núcleo productivo", "Maximizar cosecha", "Soca ~3 años, en producción", 0.28, ["Centro-A", "Centro-B", "Centro-C"], 1),
  def("FT-LRS", "Línea Roja Superior", "Caja 2", "Producir, no intervenir ciclo", "Soca a mitad ~2 años", 0.12, ["LRS-1", "LRS-2"], 2),
  def("FT-TRI", "Triangular", "Decisión", "Medir kg/h y decidir", "Pendiente soqueo vs renovación", 0.12, ["TRI-base", "TRI-punta"], 3),
  def("FT-LRI", "Línea Roja Inferior", "Decisión", "Medir kg/h y decidir", "Pendiente soqueo vs renovación", 0.1, ["LRI-1", "LRI-2"], 4),
  def("FT-INF", "Inferior", "Renovación 1", "Cosechar y planificar renovación", "Café viejo", 0.18, ["INF-1", "INF-2"], 5),
  def("FT-SUP", "Superior", "Renovación 2", "Cosechar y planificar renovación", "Café viejo, menor área", 0.07, ["SUP-1"], 6),
];

export function harvestLots(lots: FarmLot[] | undefined | null): FarmLot[] {
  return (lots?.length ? lots : DEFAULT_LOTS)
    .filter((l) => l.status === "activo")
    .slice()
    .sort((a, b) => a.harvestPriority - b.harvestPriority);
}

export function allLots(lots: FarmLot[] | undefined | null): FarmLot[] {
  return (lots?.length ? lots : DEFAULT_LOTS).slice().sort((a, b) => a.harvestPriority - b.harvestPriority);
}

export function lotByCode(lots: FarmLot[] | undefined | null, code: string): FarmLot | undefined {
  return (lots?.length ? lots : DEFAULT_LOTS).find((l) => l.code === code);
}

export function areaActiva(lots: FarmLot[] | undefined | null): number {
  return harvestLots(lots).reduce((a, l) => a + (l.areaHa || 0), 0);
}

export function rollupCode(lots: FarmLot[] | undefined | null, code: string): string {
  const list = lots?.length ? lots : DEFAULT_LOTS;
  let cur = code;
  for (let i = 0; i < 8; i += 1) {
    const L = list.find((l) => l.code === cur);
    if (!L || L.status !== "unificado" || !L.unifiedInto) return cur;
    cur = L.unifiedInto;
  }
  return cur;
}

export function lotNombre(lots: FarmLot[] | undefined | null, code: string): string {
  return lotByCode(lots, code)?.nombre ?? code;
}

export function nextLotCode(lots: FarmLot[], nombre: string): string {
  const slug = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 3)
    .toUpperCase() || "LOT";
  const used = new Set(lots.map((l) => l.code));
  let code = `FT-${slug}`;
  let n = 2;
  while (used.has(code)) {
    code = `FT-${slug}${n}`;
    n += 1;
  }
  return code;
}

/** Compat: mapa de defaults. Preferir lotByCode(farm.lots, code). */
export const LOTS: Record<string, FarmLot> = Object.fromEntries(
  DEFAULT_LOTS.map((l) => [l.code, l]),
);
export const HARVEST_LOTS = DEFAULT_LOTS.map((l) => l.code);
export const LOT_CODES = HARVEST_LOTS;
