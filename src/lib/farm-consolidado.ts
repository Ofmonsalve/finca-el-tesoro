/**
 * Holding / Consolidado: rollups across ALL farms for owner Pulso + Inteligencia.
 * Reads each farm book from scoped storage without switching the active farm.
 *
 * Six owner metrics (contract order):
 * 1. Entra (ventas)
 * 2. Sale (cosecha + gastos)
 * 3. Cosecha del período (kg cereza)
 * 4. Vendible listo (kg pergamino en bodega sin vender)
 * 5. Costo / kg cereza (solo si hay kg — misma unidad; nunca promedio mentiroso)
 * 6. Talento / gente (pagos del período)
 * + alertas: placeholder legal honesto si no hay datos.
 *
 * Every figure must be tagged with a farm name (or «todas las fincas»).
 */
import { areaActiva } from "./lots";
import {
  readFarmBookFromStorage,
  type PersistedFarmBookSlice,
} from "./farm-book-init";
import type { FarmMeta } from "./farm-registry";
import type {
  CostLine,
  HarvestSession,
  Liquidation,
  ProcessBatch,
  Sale,
} from "./types";

export type FarmRollup = {
  farmId: string;
  name: string;
  /** kg cereza cosechada */
  kg: number;
  /** alias explícito */
  kgCereza: number;
  /** kg pergamino en bodega sin venta */
  kgVendible: number;
  moneyIn: number;
  moneyOut: number;
  costoCosecha: number;
  otherCosts: number;
  /** null si no hay kg (no inventar) */
  costoKg: number | null;
  talentoPay: number;
  talentoPaid: number;
  pendMO: number;
  ha: number;
  lotCount: number;
  sessionCount: number;
  saleCount: number;
  costCount: number;
  predio: {
    name: string;
    ha: number;
    lotCount: number;
    responsable: string;
  };
  alerts: string[];
};

export type ConsolidadoSummary = {
  farms: FarmRollup[];
  totalKg: number;
  totalKgCereza: number;
  totalKgVendible: number;
  totalMoneyIn: number;
  totalMoneyOut: number;
  totalCostoCosecha: number;
  totalTalentoPay: number;
  totalPendMO: number;
  totalHa: number;
  farmCount: number;
  alertCount: number;
  /** Suma costo ÷ suma kg (misma unidad). null si no hay kg. */
  costoKg: number | null;
};

const LEGAL_ALERT =
  "Alertas legales: aún sin contratos ni obligaciones en el libro.";

function asSessions(raw: unknown[]): HarvestSession[] {
  return raw.filter(
    (s): s is HarvestSession =>
      !!s &&
      typeof s === "object" &&
      typeof (s as HarvestSession).totKg === "number",
  );
}

function asLiquidations(raw: unknown[]): Liquidation[] {
  return raw.filter(
    (l): l is Liquidation =>
      !!l &&
      typeof l === "object" &&
      typeof (l as Liquidation).monto === "number",
  );
}

function asSales(raw: unknown[]): Sale[] {
  return raw.filter(
    (s): s is Sale =>
      !!s &&
      typeof s === "object" &&
      typeof (s as Sale).total === "number" &&
      typeof (s as Sale).kg === "number",
  );
}

function asCosts(raw: unknown[]): CostLine[] {
  return raw.filter(
    (c): c is CostLine =>
      !!c &&
      typeof c === "object" &&
      typeof (c as CostLine).monto === "number",
  );
}

function asBatches(raw: unknown[]): ProcessBatch[] {
  return raw.filter(
    (b): b is ProcessBatch =>
      !!b &&
      typeof b === "object" &&
      typeof (b as ProcessBatch).kgActual === "number" &&
      Array.isArray((b as ProcessBatch).events),
  );
}

/** Pergamino listo: sin venta y pasó por bodega. */
export function kgVendibleFromBatches(batches: ProcessBatch[]): number {
  let kg = 0;
  for (const b of batches) {
    if (b.saleId) continue;
    const reached = b.events.some((e) => e.stage === "bodega" && !e.skipped);
    if (!reached) continue;
    kg += b.kgActual || 0;
  }
  return kg;
}

/** Build rollup for one farm from an already-loaded book slice (or null). */
export function rollupFarmBook(
  farmId: string,
  name: string,
  book: PersistedFarmBookSlice | null,
): FarmRollup {
  const sessions = asSessions(book?.sessions ?? []);
  const liquidations = asLiquidations(book?.liquidations ?? []);
  const sales = asSales(book?.sales ?? []);
  const costs = asCosts(book?.costs ?? []);
  const batches = asBatches(book?.batches ?? []);
  const lots = book?.lots ?? [];
  const responsable =
    typeof book?.settings?.responsable === "string"
      ? book.settings.responsable
      : "";

  const kg = sessions.reduce((a, s) => a + (s.totKg || 0), 0);
  const pay = sessions.reduce((a, s) => a + (s.totPay || 0), 0);
  const alim = sessions.reduce((a, s) => a + (s.totAlim || 0), 0);
  const paid = liquidations.reduce((a, l) => a + (l.monto || 0), 0);
  const pendMO = Math.max(0, pay - paid);
  const otherCosts = costs.reduce((a, c) => a + (c.monto || 0), 0);
  const costoCosecha = pay + alim;
  const moneyIn = sales.reduce((a, v) => a + (v.total || 0), 0);
  const moneyOut = costoCosecha + otherCosts;
  const kgVendible = kgVendibleFromBatches(batches);
  const ha = areaActiva(lots);
  const lotCount = lots.length;
  const costoKg = kg > 0 ? costoCosecha / kg : null;

  const alerts: string[] = [];
  if (lotCount === 0) alerts.push("Sin lotes aún");
  if (pendMO > 0) {
    alerts.push(
      `Pagos pendientes · $${Math.round(pendMO).toLocaleString("es-CO")}`,
    );
  }
  if (lotCount > 0 && sessions.length === 0) {
    alerts.push("Sin cosecha registrada");
  }
  alerts.push(LEGAL_ALERT);

  return {
    farmId,
    name,
    kg,
    kgCereza: kg,
    kgVendible,
    moneyIn,
    moneyOut,
    costoCosecha,
    otherCosts,
    costoKg,
    talentoPay: pay,
    talentoPaid: paid,
    pendMO,
    ha,
    lotCount,
    sessionCount: sessions.length,
    saleCount: sales.length,
    costCount: costs.length,
    predio: { name, ha, lotCount, responsable },
    alerts,
  };
}

/** Sum every registered farm’s book (storage read; no active-farm switch). */
export function buildConsolidado(
  farms: readonly FarmMeta[],
): ConsolidadoSummary {
  const rows = farms.map((f) =>
    rollupFarmBook(f.id, f.name, readFarmBookFromStorage(f.id)),
  );
  const totalKg = rows.reduce((a, r) => a + r.kg, 0);
  const totalCostoCosecha = rows.reduce((a, r) => a + r.costoCosecha, 0);
  return {
    farms: rows,
    totalKg,
    totalKgCereza: totalKg,
    totalKgVendible: rows.reduce((a, r) => a + r.kgVendible, 0),
    totalMoneyIn: rows.reduce((a, r) => a + r.moneyIn, 0),
    totalMoneyOut: rows.reduce((a, r) => a + r.moneyOut, 0),
    totalCostoCosecha,
    totalTalentoPay: rows.reduce((a, r) => a + r.talentoPay, 0),
    totalPendMO: rows.reduce((a, r) => a + r.pendMO, 0),
    totalHa: rows.reduce((a, r) => a + r.ha, 0),
    farmCount: rows.length,
    alertCount: rows.reduce((a, r) => a + r.alerts.length, 0),
    costoKg: totalKg > 0 ? totalCostoCosecha / totalKg : null,
  };
}
