/**
 * Pure helpers for lot-scoped Labores, Nutrición & Cultivo records.
 * Keep side-effect free for node:test isolation coverage.
 *
 * Contract:
 * - Labores = field work only (not fertilizer)
 * - Nutrición = soil/foliar application only
 * - Cultivo = one design per farmId+lote (title = lot name); no money to Pulso
 * - Plantas = stand list per farmId+lote (foundation for later map; not GIS)
 * - Rows tagged farmId+lote; list by date (labores/nutrition)
 * - jornal / costoProducto optional — no cost tag → do not roll into Pulso
 */
import type {
  CultivoEstado,
  LaborTipo,
  LotCultivo,
  LotLabor,
  LotNutrition,
  LotPlant,
  NutritionEstado,
  NutritionUnidad,
  NutritionVia,
  PlantEstado,
} from "./types";

export const LABOR_TIPOS: { id: LaborTipo; label: string }[] = [
  { id: "plateo", label: "Plateo" },
  { id: "poda", label: "Poda" },
  { id: "deschupone", label: "Deschupone" },
  { id: "broca", label: "Broca" },
  { id: "sombra", label: "Sombra" },
  { id: "otra", label: "Otra labor" },
];

export const NUTRITION_VIAS: { id: NutritionVia; label: string }[] = [
  { id: "suelo", label: "Suelo" },
  { id: "foliar", label: "Foliar" },
];

export const NUTRITION_ESTADOS: { id: NutritionEstado; label: string }[] = [
  { id: "planificada", label: "Planificada" },
  { id: "hecha", label: "Hecha" },
];

export const NUTRITION_UNIDADES: { id: NutritionUnidad; label: string }[] = [
  { id: "kg", label: "kg" },
  { id: "bultos", label: "bultos" },
];

export function laborTipoLabel(tipo: LaborTipo): string {
  return LABOR_TIPOS.find((t) => t.id === tipo)?.label ?? tipo;
}

export function nutritionEstadoLabel(estado: NutritionEstado): string {
  return NUTRITION_ESTADOS.find((e) => e.id === estado)?.label ?? estado;
}

export function nutritionViaLabel(via: NutritionVia): string {
  return NUTRITION_VIAS.find((v) => v.id === via)?.label ?? via;
}

/** Sort newest fecha first (stable list-by-date). */
function byFechaDesc<T extends { fecha: string }>(a: T, b: T): number {
  return a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0;
}

/**
 * Labores for one lot (and optional farmId). Newest first.
 * Isolation: never mixes other lots / farms.
 */
export function laboresForLot(
  items: LotLabor[] | undefined | null,
  lote: string,
  opts?: { farmId?: string; limit?: number },
): LotLabor[] {
  if (!Array.isArray(items) || !lote) return [];
  const farmId = opts?.farmId;
  const limit = opts?.limit ?? 50;
  return items
    .filter(
      (x) =>
        x &&
        x.lote === lote &&
        (farmId == null || farmId === "" || x.farmId === farmId),
    )
    .slice()
    .sort(byFechaDesc)
    .slice(0, limit);
}

/** Nutrition for one lot (and optional farmId). Newest first. */
export function nutritionForLot(
  items: LotNutrition[] | undefined | null,
  lote: string,
  opts?: { farmId?: string; limit?: number },
): LotNutrition[] {
  if (!Array.isArray(items) || !lote) return [];
  const farmId = opts?.farmId;
  const limit = opts?.limit ?? 50;
  return items
    .filter(
      (x) =>
        x &&
        x.lote === lote &&
        (farmId == null || farmId === "" || x.farmId === farmId),
    )
    .slice()
    .sort(byFechaDesc)
    .slice(0, limit);
}

/** Upsert by id, newest-first when inserting. */
export function upsertById<T extends { id: string }>(
  list: T[],
  row: T,
): T[] {
  const i = list.findIndex((x) => x.id === row.id);
  if (i >= 0) return list.map((x, k) => (k === i ? row : x));
  return [row, ...list];
}

export function isLaborTipo(v: unknown): v is LaborTipo {
  return LABOR_TIPOS.some((t) => t.id === v);
}

export function isNutritionEstado(v: unknown): v is NutritionEstado {
  return v === "planificada" || v === "hecha";
}

export function isNutritionVia(v: unknown): v is NutritionVia {
  return v === "suelo" || v === "foliar";
}

/** True when labor has a jornal cost tagged for talento/gente. */
export function laborHasTalentoCost(row: LotLabor): boolean {
  return typeof row.jornal === "number" && row.jornal > 0;
}

/** True when nutrition has product cost tagged for money out. */
export function nutritionHasProductCost(row: LotNutrition): boolean {
  return typeof row.costoProducto === "number" && row.costoProducto > 0;
}

export const CULTIVO_ESTADOS: { id: CultivoEstado; label: string }[] = [
  { id: "levante", label: "Levante" },
  { id: "produccion", label: "Producción" },
  { id: "zoca_renovacion", label: "Zoca / renovación" },
];

export function cultivoEstadoLabel(e: CultivoEstado): string {
  return CULTIVO_ESTADOS.find((x) => x.id === e)?.label ?? e;
}

export function isCultivoEstado(v: unknown): v is CultivoEstado {
  return v === "levante" || v === "produccion" || v === "zoca_renovacion";
}

/**
 * Crop design for one lot (and optional farmId). At most one row.
 * Isolation: never mixes other lots / farms.
 */
export function cultivoForLot(
  items: LotCultivo[] | undefined | null,
  lote: string,
  opts?: { farmId?: string },
): LotCultivo | null {
  if (!Array.isArray(items) || !lote) return null;
  const farmId = opts?.farmId;
  const found = items.find(
    (x) =>
      x &&
      x.lote === lote &&
      (farmId == null || farmId === "" || x.farmId === farmId),
  );
  return found ?? null;
}

/**
 * Upsert crop design keyed by farmId+lote (one design per lot).
 * Keeps id of existing row when replacing; otherwise uses row.id.
 */
export function upsertCultivoForLot(
  list: LotCultivo[],
  row: LotCultivo,
): LotCultivo[] {
  const i = list.findIndex(
    (x) => x.farmId === row.farmId && x.lote === row.lote,
  );
  if (i >= 0) {
    const merged = { ...row, id: list[i].id };
    return list.map((x, k) => (k === i ? merged : x));
  }
  return [row, ...list];
}

/** True when design has meaningful crop fields filled. */
export function hasCultivoDesign(row: LotCultivo | null | undefined): boolean {
  if (!row) return false;
  return Boolean(
    (row.variedad && row.variedad.trim()) ||
      (row.densidad && row.densidad.trim()) ||
      (row.plantasApprox != null && row.plantasApprox > 0) ||
      row.anioSiembra != null ||
      (row.edadApprox && row.edadApprox.trim()) ||
      row.sombra != null ||
      (row.variedadNota && row.variedadNota.trim()),
  );
}

/**
 * Yield/cost comparisons are misleading for levante / zoca-renovación.
 * Prefer label or hide totals for those stages.
 */
export function cultivoYieldComparable(
  row: LotCultivo | null | undefined,
): boolean {
  return row?.estado === "produccion";
}

/* ── Plants (stand list · Cultivo foundation) ─────────────────────────── */

export const PLANT_ESTADOS: { id: PlantEstado; label: string }[] = [
  { id: "viva", label: "Viva" },
  { id: "zoca", label: "Zoca" },
  { id: "muerta", label: "Muerta" },
];

export function plantEstadoLabel(e: PlantEstado): string {
  return PLANT_ESTADOS.find((x) => x.id === e)?.label ?? e;
}

export function isPlantEstado(v: unknown): v is PlantEstado {
  return v === "viva" || v === "zoca" || v === "muerta";
}

/**
 * Plants for one lot (and optional farmId). Sorted by surco, then position, then code/id.
 * Isolation: never mixes other lots / farms.
 */
export function plantsForLot(
  items: LotPlant[] | undefined | null,
  lote: string,
  opts?: { farmId?: string },
): LotPlant[] {
  if (!Array.isArray(items) || !lote) return [];
  const farmId = opts?.farmId;
  return items
    .filter(
      (x) =>
        x &&
        x.lote === lote &&
        (farmId == null || farmId === "" || x.farmId === farmId),
    )
    .slice()
    .sort(comparePlants);
}

function comparePlants(a: LotPlant, b: LotPlant): number {
  const sa = a.surco ?? Number.POSITIVE_INFINITY;
  const sb = b.surco ?? Number.POSITIVE_INFINITY;
  if (sa !== sb) return sa - sb;
  const pa = a.position ?? Number.POSITIVE_INFINITY;
  const pb = b.position ?? Number.POSITIVE_INFINITY;
  if (pa !== pb) return pa - pb;
  const ca = (a.code || a.id).localeCompare(b.code || b.id, "es");
  return ca;
}

/** Group plants by surco (null/undefined → "Sin surco"). Order preserved from sorted list. */
export function groupPlantsBySurco(
  plants: LotPlant[],
): { surco: number | null; label: string; plants: LotPlant[] }[] {
  const map = new Map<string, { surco: number | null; plants: LotPlant[] }>();
  const order: string[] = [];
  for (const p of plants) {
    const key = p.surco == null ? "__none__" : String(p.surco);
    if (!map.has(key)) {
      map.set(key, { surco: p.surco ?? null, plants: [] });
      order.push(key);
    }
    map.get(key)!.plants.push(p);
  }
  return order.map((k) => {
    const g = map.get(k)!;
    return {
      surco: g.surco,
      label: g.surco == null ? "Sin surco" : `Surco ${g.surco}`,
      plants: g.plants,
    };
  });
}

/** Count plants that still occupy the stand (viva + zoca). */
export function plantStandCount(plants: LotPlant[]): number {
  return plants.filter((p) => p.estado === "viva" || p.estado === "zoca").length;
}

/**
 * Build N plants for one surco with sequential positions starting at `fromPosition`.
 * Defaults variedad/estado from opts.
 */
export function buildPlantRow(opts: {
  farmId: string;
  lote: string;
  surco: number;
  count: number;
  variedad: string;
  estado?: PlantEstado;
  plantedYear?: number;
  fromPosition?: number;
  idFactory: () => string;
}): LotPlant[] {
  const n = Math.max(0, Math.floor(opts.count));
  const from = opts.fromPosition ?? 1;
  const estado = opts.estado ?? "viva";
  const out: LotPlant[] = [];
  for (let i = 0; i < n; i += 1) {
    const row: LotPlant = {
      id: opts.idFactory(),
      farmId: opts.farmId,
      lote: opts.lote,
      surco: opts.surco,
      position: from + i,
      variedad: opts.variedad,
      estado,
    };
    if (opts.plantedYear != null) row.plantedYear = opts.plantedYear;
    out.push(row);
  }
  return out;
}
