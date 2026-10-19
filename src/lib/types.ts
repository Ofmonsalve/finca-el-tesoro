import type { LotCode } from "./lots";
import type { PayMethodId, StageId } from "./process";

export type PayModel = "por_kg" | "jornal";
export type HarvestType = "Principal" | "Secundaria";

export type WorkerRow = {
  id: string;
  nombre: string;
  hi: string;
  hf: string;
  kg: number;
  horas: number;
  pago: number;
  alim: number;
};

export type HarvestSession = {
  id: string;
  code: string;
  fecha: string;
  lote: LotCode;
  bloque: string;
  tipo: HarvestType;
  pasada: number;
  modelo: PayModel;
  valorKg: number;
  jornal: number;
  alimUnit: number;
  factor: number;
  responsable: string;
  obs: string;
  trabajadores: WorkerRow[];
  totKg: number;
  totPay: number;
  totHrs: number;
  totAlim: number;
  totCost: number;
  /** Farm book tag — isolation + holding labels. Legacy rows may omit. */
  farmId?: string;
};

export type ProcessEvent = {
  id: string;
  stage: StageId;
  skipped: boolean;
  at: string;
  kgIn: number;
  kgOut: number;
  notas: string;
  responsable: string;
  /** True when kgOut came from plan (expectedAt), not a scale reading. */
  estimated?: boolean;
};

export type ProcessBatch = {
  id: string;
  sessionId: string;
  code: string;
  fecha: string;
  lote: LotCode;
  kgCereza: number;
  kgActual: number;
  factor: number;
  events: ProcessEvent[];
  saleId: string | null;
  /** Farm book tag — beneficio batches listed under that finca. Legacy may omit. */
  farmId?: string;
};

export type Liquidation = {
  id: string;
  fecha: string;
  trabajador: string;
  periodo: string;
  monto: number;
  tipo: "semana" | "anticipo";
  obs: string;
  sessionIds: string[];
};

export type Sale = {
  id: string;
  fecha: string;
  cliente: string;
  tipo: "pergamino" | "cereza";
  kg: number;
  precioKg: number;
  total: number;
  cobrado: number;
  metodo: PayMethodId;
  lote: LotCode | "";
  batchId: string;
  obs: string;
};

export type CostLine = {
  id: string;
  fecha: string;
  lote: LotCode | "";
  categoria: "fertilizacion" | "arvenses" | "renovacion" | "indirecto" | "otro";
  concepto: string;
  monto: number;
};

export type JournalLine = {
  cuenta: string;
  nombre: string;
  debe: number;
  haber: number;
};

export type JournalEntry = {
  id: string;
  fecha: string;
  origen: "cosecha" | "liquidacion" | "venta" | "costo" | "manual";
  origenId: string;
  glosa: string;
  lineas: JournalLine[];
};

export type Settings = {
  valorKg: number;
  jornal: number;
  alim: number;
  factor: number;
  responsable: string;
};

/**
 * Field work only (Labores face) — never fertilizer / abono.
 * plateo, poda, deschupone, broca, sombra… (+ otra for misc field work).
 */
export type LaborTipo =
  | "plateo"
  | "poda"
  | "deschupone"
  | "broca"
  | "sombra"
  | "otra";

/**
 * Farm task logged against a lot.
 * Always tagged farmId+lote. Optional jornal → talento/gente when set;
 * without cost fields these rows do not roll into Pulso/Inteligencia.
 */
export type LotLabor = {
  id: string;
  farmId: string;
  fecha: string;
  lote: LotCode;
  tipo: LaborTipo;
  /** Who did or supervised the work. */
  responsable: string;
  notas: string;
  /**
   * Optional jornal / MO cost (COP). When > 0, tagged for talento/gente.
   * Absent or 0 → do not roll into Pulso.
   */
  jornal?: number;
};

export type NutritionVia = "suelo" | "foliar";
export type NutritionEstado = "planificada" | "hecha";
export type NutritionUnidad = "kg" | "bultos";

/**
 * Soil / foliar application only (Nutrición face).
 * Product + quantity/unit + date. Soil analysis is context (notas), not a model.
 * Honesty: no Cenicafé science yet. Optional costoProducto → money out / $/kg
 * when set; without it, do not roll into Pulso/Inteligencia.
 */
export type LotNutrition = {
  id: string;
  farmId: string;
  fecha: string;
  lote: LotCode;
  via: NutritionVia;
  producto: string;
  cantidad: number;
  unidad: NutritionUnidad;
  estado: NutritionEstado;
  /** Context only (e.g. soil analysis note) — not scientific advice. */
  notas: string;
  /**
   * Optional product cost (COP). When > 0, tagged for money out / cost per kg.
   * Absent or 0 → do not roll into Pulso.
   */
  costoProducto?: number;
};

/**
 * Agronomic stage of the lot (Cultivo face).
 * Not harvest status; not a money signal for Pulso/Inteligencia.
 */
export type CultivoEstado =
  | "levante"
  | "produccion"
  | "zoca_renovacion";

/**
 * Crop design for one lot (Cultivo face) — LOCKED contract.
 * Single clean card: variedad (+ mix note), year/age, density or tree count,
 * estado, optional sombra. Title = lot NAME.
 * Does NOT mix labores / nutrición / harvest kg.
 * Does NOT feed money into Pulso/Inteligencia.
 */
export type LotCultivo = {
  id: string;
  farmId: string;
  lote: LotCode;
  /** Lot name at save time (readback title). */
  title: string;
  /** Variety name(s). If mix, set mezcla and/or note in variedadNota. */
  variedad: string;
  /** True when more than one variety on the lot. */
  mezcla?: boolean;
  /** Short note when mezcla (e.g. "Castillo + Caturra ~60/40"). */
  variedadNota?: string;
  /** Planting year (approx), e.g. 2021. */
  anioSiembra?: number;
  /** Approx age free text, e.g. "3 años" or "~2 desde zoca". */
  edadApprox?: string;
  /** Density free text: plantas/ha or marco (e.g. "5000" or "1.5 × 1.5 m"). */
  densidad?: string;
  /** Optional simple tree/plant count — not a plant-by-plant map. */
  plantasApprox?: number;
  /** Agronomic stage: levante | producción | zoca/renovación. */
  estado: CultivoEstado;
  /** Optional shade: false = pleno sol / no shade. */
  sombra?: boolean;
  /** Shade type when sombra is true (e.g. "guamo", "plátano"). */
  sombraTipo?: string;
  updatedAt: string;
};

/**
 * Work role on the finca (Talento / gente). Not auth/app permissions.
 * Locked catalog: recolector | mayordomo | jornalero | beneficio | otro.
 */
/**
 * Individual plant in a lot stand (Cultivo · mapa de plantas — v1 list).
 * Tagged farmId+lote. Not GIS coordinates — structured stand foundation.
 * Does NOT feed money into Pulso/Inteligencia.
 */
export type PlantEstado = "viva" | "zoca" | "muerta";

export type LotPlant = {
  id: string;
  farmId: string;
  lote: LotCode;
  /** Optional farmer code / tag on the plant. */
  code?: string;
  /** Row / surco number (1-based when set). */
  surco?: number;
  /** Position within the surco (1-based when set). */
  position?: number;
  variedad: string;
  estado: PlantEstado;
  /** Planting year (approx). */
  plantedYear?: number;
  notes?: string;
};

export type PersonRole =
  | "recolector"
  | "mayordomo"
  | "jornalero"
  | "beneficio"
  | "otro";

/**
 * Person in the farm registry (Talento · gente de finca).
 * Always tagged farmId — holding lists by farm; inside a farm only that farm.
 * Name links to harvest pay via workerKey. Does NOT carry app permissions,
 * predio/títulos, contracts, or harvest kg. Optional phone is edit-only
 * (not a list column). Feeds Pulso/Inteligencia gente only when farm-tagged.
 */
export type FarmPerson = {
  id: string;
  farmId: string;
  nombre: string;
  rol: PersonRole;
  /** Optional contact — edit form only; not shown as a list column. */
  telefono?: string;
  activo: boolean;
  updatedAt: string;
};
