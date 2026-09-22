/**
 * Holding / Consolidado: rollups across ALL farms for the owner home.
 * Reads each farm book from scoped storage without switching the active farm.
 */
import { areaActiva } from "./lots";
import {
  readFarmBookFromStorage,
  type PersistedFarmBookSlice,
} from "./farm-book-init";
import type { FarmMeta } from "./farm-registry";
import type { HarvestSession, Liquidation } from "./types";

export type FarmRollup = {
  farmId: string;
  name: string;
  kg: number;
  costoCosecha: number;
  pendMO: number;
  ha: number;
  lotCount: number;
  sessionCount: number;
  alerts: string[];
};

export type ConsolidadoSummary = {
  farms: FarmRollup[];
  totalKg: number;
  totalCostoCosecha: number;
  totalPendMO: number;
  totalHa: number;
  farmCount: number;
  alertCount: number;
};

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

/** Build rollup for one farm from an already-loaded book slice (or null). */
export function rollupFarmBook(
  farmId: string,
  name: string,
  book: PersistedFarmBookSlice | null,
): FarmRollup {
  const sessions = asSessions(book?.sessions ?? []);
  const liquidations = asLiquidations(book?.liquidations ?? []);
  const lots = book?.lots ?? [];
  const kg = sessions.reduce((a, s) => a + (s.totKg || 0), 0);
  const pay = sessions.reduce((a, s) => a + (s.totPay || 0), 0);
  const alim = sessions.reduce((a, s) => a + (s.totAlim || 0), 0);
  const paid = liquidations.reduce((a, l) => a + (l.monto || 0), 0);
  const pendMO = Math.max(0, pay - paid);
  const ha = areaActiva(lots);
  const lotCount = lots.length;
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
  return {
    farmId,
    name,
    kg,
    costoCosecha: pay + alim,
    pendMO,
    ha,
    lotCount,
    sessionCount: sessions.length,
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
  return {
    farms: rows,
    totalKg: rows.reduce((a, r) => a + r.kg, 0),
    totalCostoCosecha: rows.reduce((a, r) => a + r.costoCosecha, 0),
    totalPendMO: rows.reduce((a, r) => a + r.pendMO, 0),
    totalHa: rows.reduce((a, r) => a + r.ha, 0),
    farmCount: rows.length,
    alertCount: rows.reduce((a, r) => a + r.alerts.length, 0),
  };
}
