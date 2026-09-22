/**
 * Cosecha hub — farm-scoped summary for Cereza (harvest) + Grano (beneficio).
 * Isolation: prefer explicit farmId on rows; legacy untagged rows count only
 * when they live in the active farm book (caller passes that farm's arrays).
 */
import { kgVendibleFromBatches } from "./farm-consolidado";
import { nextPendingStage } from "./process";
import type { HarvestSession, ProcessBatch } from "./types";

/** Keep row if tagged for farmId, or untagged (legacy book already farm-scoped). */
export function belongsToFarm(
  row: { farmId?: string } | null | undefined,
  farmId: string,
): boolean {
  if (!row || !farmId) return false;
  const tag = typeof row.farmId === "string" ? row.farmId.trim() : "";
  if (!tag) return true; // legacy: trust active book
  return tag === farmId;
}

export function sessionsForFarm(
  sessions: HarvestSession[] | undefined | null,
  farmId: string,
): HarvestSession[] {
  if (!Array.isArray(sessions) || !farmId) return [];
  return sessions.filter((s) => belongsToFarm(s, farmId));
}

export function batchesForFarm(
  batches: ProcessBatch[] | undefined | null,
  farmId: string,
): ProcessBatch[] {
  if (!Array.isArray(batches) || !farmId) return [];
  return batches.filter((b) => belongsToFarm(b, farmId));
}

export type CosechaBatchRow = {
  batch: ProcessBatch;
  nextLabel: string;
  inBodega: boolean;
  sold: boolean;
};

export type CosechaHubSummary = {
  farmId: string;
  farmName: string;
  /** kg cereza from harvest sessions */
  kgCereza: number;
  /** kg pergamino en bodega sin venta */
  kgPergamino: number;
  sessionCount: number;
  batchOpenCount: number;
  batchBodegaCount: number;
  sessions: HarvestSession[];
  batches: CosechaBatchRow[];
};

export function cosechaHubSummary(
  farmId: string,
  farmName: string,
  sessions: HarvestSession[] | undefined | null,
  batches: ProcessBatch[] | undefined | null,
): CosechaHubSummary {
  const ses = sessionsForFarm(sessions, farmId)
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  const bats = batchesForFarm(batches, farmId);
  const kgCereza = ses.reduce((a, s) => a + (s.totKg || 0), 0);
  const kgPergamino = kgVendibleFromBatches(bats);

  const rows: CosechaBatchRow[] = bats.map((batch) => {
    const done = batch.events.map((e) => e.stage);
    const next = nextPendingStage(done);
    const inBodega =
      done.includes("bodega") && !done.includes("venta") && !batch.saleId;
    return {
      batch,
      nextLabel: batch.saleId
        ? "Vendido"
        : next?.label ?? "Cerrado",
      inBodega,
      sold: Boolean(batch.saleId),
    };
  });

  // Open first (not sold), then by fecha desc
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
    kgPergamino,
    sessionCount: ses.length,
    batchOpenCount: bats.filter((b) => !b.saleId).length,
    batchBodegaCount: rows.filter((r) => r.inBodega).length,
    sessions: ses,
    batches: rows,
  };
}

/** Stamp farmId on a batch when creating/updating in the active book. */
export function withFarmTag<T extends { farmId?: string }>(
  row: T,
  farmId: string,
): T {
  const id = (farmId || "").trim();
  if (!id) return row;
  return { ...row, farmId: id };
}
