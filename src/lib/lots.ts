export const LOT_CODES = [
  "FT-FINCA",
  "FT-CEN",
  "FT-LRS",
  "FT-TRI",
  "FT-LRI",
  "FT-INF",
  "FT-SUP",
] as const;

export type LotCode = (typeof LOT_CODES)[number];

export type LotDef = {
  code: LotCode;
  nombre: string;
  rol: string;
  accion: string;
  estado: string;
  areaHa: number;
  bloques: string[];
  harvestPriority: number;
};

export const LOTS: Record<LotCode, LotDef> = {
  "FT-FINCA": {
    code: "FT-FINCA",
    nombre: "Finca completa",
    rol: "Consolidado",
    accion: "Registrar jornada global",
    estado: "0,87 ha · 6 lotes",
    areaHa: 0.87,
    bloques: ["General"],
    harvestPriority: 0,
  },
  "FT-CEN": {
    code: "FT-CEN",
    nombre: "Centro",
    rol: "Núcleo productivo",
    accion: "Maximizar cosecha",
    estado: "Soca ~3 años, en producción",
    areaHa: 0.28,
    bloques: ["Centro-A", "Centro-B", "Centro-C"],
    harvestPriority: 1,
  },
  "FT-LRS": {
    code: "FT-LRS",
    nombre: "Línea Roja Superior",
    rol: "Caja 2",
    accion: "Producir, no intervenir ciclo",
    estado: "Soca a mitad ~2 años",
    areaHa: 0.12,
    bloques: ["LRS-1", "LRS-2"],
    harvestPriority: 2,
  },
  "FT-TRI": {
    code: "FT-TRI",
    nombre: "Triangular",
    rol: "Decisión",
    accion: "Medir kg/h y decidir",
    estado: "Pendiente soqueo vs renovación",
    areaHa: 0.12,
    bloques: ["TRI-base", "TRI-punta"],
    harvestPriority: 3,
  },
  "FT-LRI": {
    code: "FT-LRI",
    nombre: "Línea Roja Inferior",
    rol: "Decisión",
    accion: "Medir kg/h y decidir",
    estado: "Pendiente soqueo vs renovación",
    areaHa: 0.1,
    bloques: ["LRI-1", "LRI-2"],
    harvestPriority: 4,
  },
  "FT-INF": {
    code: "FT-INF",
    nombre: "Inferior",
    rol: "Renovación 1",
    accion: "Cosechar y planificar renovación",
    estado: "Café viejo",
    areaHa: 0.18,
    bloques: ["INF-1", "INF-2"],
    harvestPriority: 5,
  },
  "FT-SUP": {
    code: "FT-SUP",
    nombre: "Superior",
    rol: "Renovación 2",
    accion: "Cosechar y planificar renovación",
    estado: "Café viejo, menor área",
    areaHa: 0.07,
    bloques: ["SUP-1"],
    harvestPriority: 6,
  },
};

export const HARVEST_LOTS = LOT_CODES.filter((c) => c !== "FT-FINCA");
