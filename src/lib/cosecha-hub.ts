/**
 * Cosecha hub — locked Grano/beneficio contract under Cosecha (no 6th nav):
 *
 * Timeline: cereza (recolección) → wet and/or dry beneficio → pergamino
 *           → optional almendra/verde vendible
 *
 * Rules:
 * - Every mass figure carries a unit label (kg cereza | kg pergamino | …).
 * - Never sum cereza with pergamino into one total.
 * - Yield cereza→pergamino is a separate ratio (factor), not another kg line.
 * - Titles use farm or lot NAME.
 * - Filter to active farm (+ optional lot). farmId (+ lote) tags required to
 *   roll into Pulso/Inteligencia; hub may still show legacy untagged rows
 *   that already live in the active farm book.
 * - Cosecha period metric = kg cereza only (same unit).
 * - Vendible = pergamino (parchment) or almendra/verde ready to sell.
 * - P0 explicit weigh rules stay in beneficio-weigh.ts.
 */
import { kgVendibleFromBatches } from "./farm-consolidado";
import { nextPendingStage } from "./process";
import type { HarvestSession, ProcessBatch } from "./types";
import { batchYield } from "./yield";

/** Locked unit labels — never mix in one total. */
export const UNIT_CEREZA = "kg cereza";
export const UNIT_PERGAMINO = "kg pergamino";
export const UNIT_ALMENDRA = "kg almendra/verde";

export const GRANO_TIMELINE = [
  { id: "cereza", label: "Cereza", hint: "Recolección" },
  { id: "beneficio", label: "Beneficio", hint: "Húmedo y/o seco" },
  { id: "pergamino", label: "Pergamino", hint: "Bodega" },
  { id: "vendible", label: "Vendible", hint: "Pergamino o almendra/verde" },
] as const;

/**
 * Hub / finca book: untagged legacy rows count (book is already farm-scoped).
 * Pass requireTag=true for Pulso/Inteligencia roll-up.
 */
export function belongsToFarm(
  row: { farmId?: string } | null | undefined,
  farmId: string,
  opts?: { requireTag?: boolean },
): boolean {
  if (!row || !farmId) return false;
  const tag = typeof row.farmId === "string" ? row.farmId.trim() : "";
  if (!tag) return opts?.requireTag ? false : true;
  return tag === farmId;
}

export function sessionsForFarm(
  sessions: HarvestSession[] | undefined | null,
  farmId: string,
  opts?: { requireTag?: boolean; lote?: string },
): HarvestSession[] {
  if (!Array.isArray(sessions) || !farmId) return [];
  const lote = opts?.lote?.trim();
  return sessions.filter((s) => {
    if (!belongsToFarm(s, farmId, opts)) return false;
    if (lote && s.lote !== lote) return false;
    return true;
  });
}

export function batchesForFarm(
  batches: ProcessBatch[] | undefined | null,
  farmId: string,
  opts?: { requireTag?: boolean; lote?: string },
): ProcessBatch[] {
  if (!Array.isArray(batches) || !farmId) return [];
  const lote = opts?.lote?.trim();
  return batches.filter((b) => {
    if (!belongsToFarm(b, farmId, opts)) return false;
    if (lote && b.lote !== lote) return false;
    return true;
  });
}

export type CosechaBatchRow = {
  batch: ProcessBatch;
  nextLabel: string;
  inBodega: boolean;
  sold: boolean;
  /** Phase on locked timeline */
  phase: "beneficio" | "pergamino" | "vendible" | "vendido";
};

export type CosechaHubSummary = {
  farmId: string;
  /** Display title — farm NAME */
  farmName: string;
  /** kg cereza only (Cosecha period metric — same unit) */
  kgCereza: number;
  unitCereza: typeof UNIT_CEREZA;
  /**
   * Vendible mass: pergamino (parchment) ready to sell.
   * Never add this to kgCereza.
   */
  kgVendible: number;
  unitVendible: typeof UNIT_PERGAMINO;
  /** Alias explicit for UI copy */
  kgPergamino: number;
  /**
   * Yield cereza→pergamino as ratio (kg cereza / kg pergamino), not a kg line.
   * null when no bodega mass yet.
   */
  ratioCerezaPergamino: number | null;
  sessionCount: number;
  batchOpenCount: number;
  batchBodegaCount: number;
  sessions: HarvestSession[];
  batches: CosechaBatchRow[];
};

function batchPhase(batch: ProcessBatch): CosechaBatchRow["phase"] {
  if (batch.saleId) return "vendido";
  const done = batch.events.map((e) => e.stage);
  const reachedBodega = done.some((s) => s === "bodega");
  if (reachedBodega) return "pergamino";
  return "beneficio";
}

/**
 * Farm-level hub summary. Optional lote narrows to one lot (title still farm
 * unless caller substitutes lot name).
 */
export function cosechaHubSummary(
  farmId: string,
  farmName: string,
  sessions: HarvestSession[] | undefined | null,
  batches: ProcessBatch[] | undefined | null,
  opts?: { lote?: string; requireTag?: boolean },
): CosechaHubSummary {
  const ses = sessionsForFarm(sessions, farmId, opts)
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  const bats = batchesForFarm(batches, farmId, opts);
  const kgCereza = ses.reduce((a, s) => a + (s.totKg || 0), 0);
  // Vendible = parchment (or green) ready to sell — never mixed into cereza.
  const kgVendible = kgVendibleFromBatches(bats);

  let ratioCerezaPergamino: number | null = null;
  const measured = bats
    .map((b) => batchYield(b))
    .filter((y) => y.kgBodega != null && y.kgBodega > 0 && y.factorReal != null);
  if (measured.length) {
    const sumCereza = measured.reduce((a, y) => a + y.kgCereza, 0);
    const sumPerg = measured.reduce((a, y) => a + (y.kgBodega ?? 0), 0);
    if (sumPerg > 0) {
      ratioCerezaPergamino = Math.round((sumCereza / sumPerg) * 100) / 100;
    }
  }

  const rows: CosechaBatchRow[] = bats.map((batch) => {
    const done = batch.events.map((e) => e.stage);
    const next = nextPendingStage(done);
    const phase = batchPhase(batch);
    const inBodega = phase === "pergamino";
    return {
      batch,
      nextLabel: batch.saleId
        ? "Vendido"
        : next?.label ?? "Cerrado",
      inBodega,
      sold: Boolean(batch.saleId),
      phase,
    };
  });

  rows.sort((a, b) => {
    if (a.sold !== b.sold) return a.sold ? 1 : -1;
    return a.batch.fecha < b.batch.fecha
      ? 1
      : a.batch.fecha > b.batch.fecha
        ? -1
        : 0;
  });

  return {
    farmId,
    farmName,
    kgCereza,
    unitCereza: UNIT_CEREZA,
    kgVendible,
    unitVendible: UNIT_PERGAMINO,
    kgPergamino: kgVendible,
    ratioCerezaPergamino,
    sessionCount: ses.length,
    batchOpenCount: bats.filter((b) => !b.saleId).length,
    batchBodegaCount: rows.filter((r) => r.inBodega).length,
    sessions: ses,
    batches: rows,
  };
}

/** Stamp farmId on a batch/session when creating/updating in the active book. */
export function withFarmTag<T extends { farmId?: string }>(
  row: T,
  farmId: string,
): T {
  const id = (farmId || "").trim();
  if (!id) return row;
  return { ...row, farmId: id };
}

/** True when row may roll into Pulso/Inteligencia (farm tag required). */
export function taggedForPulso(
  row: { farmId?: string } | null | undefined,
  farmId: string,
): boolean {
  return belongsToFarm(row, farmId, { requireTag: true });
}
