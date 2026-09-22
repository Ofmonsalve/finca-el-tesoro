/**
 * Pure helpers for lot-scoped Labores & Nutrición records.
 * Keep side-effect free for node:test isolation coverage.
 *
 * Contract:
 * - Labores = field work only (not fertilizer)
 * - Nutrición = soil/foliar application only
 * - Rows tagged farmId+lote; list by date
 * - jornal / costoProducto optional — no cost tag → do not roll into Pulso
 */
import type {
  LaborTipo,
  LotLabor,
  LotNutrition,
  NutritionEstado,
  NutritionUnidad,
  NutritionVia,
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
