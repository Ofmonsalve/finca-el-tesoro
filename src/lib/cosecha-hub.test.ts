import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  UNIT_CEREZA,
  UNIT_PERGAMINO,
  batchesForFarm,
  belongsToFarm,
  cosechaHubSummary,
  sessionsForFarm,
  taggedForPulso,
  withFarmTag,
} from "./cosecha-hub.ts";
import type { HarvestSession, ProcessBatch, ProcessEvent } from "./types.ts";

function session(
  partial: Partial<HarvestSession> & { totKg: number },
): HarvestSession {
  return {
    id: partial.id ?? "ses",
    code: partial.code ?? "C-1",
    fecha: partial.fecha ?? "2026-09-01",
    lote: partial.lote ?? "L1",
    bloque: partial.bloque ?? "General",
    tipo: partial.tipo ?? "Principal",
    pasada: partial.pasada ?? 1,
    modelo: partial.modelo ?? "por_kg",
    valorKg: partial.valorKg ?? 1200,
    jornal: partial.jornal ?? 60000,
    alimUnit: partial.alimUnit ?? 8000,
    factor: partial.factor ?? 6,
    responsable: partial.responsable ?? "",
    obs: partial.obs ?? "",
    trabajadores: partial.trabajadores ?? [],
    totKg: partial.totKg,
    totPay: partial.totPay ?? 0,
    totHrs: partial.totHrs ?? 0,
    totAlim: partial.totAlim ?? 0,
    totCost: partial.totCost ?? 0,
    farmId: partial.farmId,
  };
}

function ev(stage: ProcessEvent["stage"], kgOut = 90): ProcessEvent {
  return {
    id: `ev-${stage}`,
    stage,
    skipped: false,
    at: "2026-09-01T12:00:00.000Z",
    kgIn: 100,
    kgOut: stage === "bodega" ? kgOut : kgOut,
    notas: "",
    responsable: "",
  };
}

function batch(
  partial: Partial<ProcessBatch> & { kgCereza: number },
): ProcessBatch {
  return {
    id: partial.id ?? "b1",
    sessionId: partial.sessionId ?? "ses",
    code: partial.code ?? "C-1",
    fecha: partial.fecha ?? "2026-09-01",
    lote: partial.lote ?? "L1",
    kgCereza: partial.kgCereza,
    kgActual: partial.kgActual ?? partial.kgCereza,
    factor: partial.factor ?? 6,
    events: partial.events ?? [ev("tolva")],
    saleId: partial.saleId ?? null,
    farmId: partial.farmId,
  };
}

describe("cosecha-hub farm isolation", () => {
  it("belongsToFarm: legacy untagged OK in hub; requireTag for Pulso", () => {
    assert.equal(belongsToFarm({ farmId: undefined }, "finca-a"), true);
    assert.equal(
      belongsToFarm({ farmId: undefined }, "finca-a", { requireTag: true }),
      false,
    );
    assert.equal(taggedForPulso({ farmId: "finca-a" }, "finca-a"), true);
    assert.equal(taggedForPulso({ farmId: undefined }, "finca-a"), false);
    assert.equal(belongsToFarm({ farmId: "finca-b" }, "finca-a"), false);
  });

  it("sessionsForFarm / batchesForFarm drop other farm tags + lote filter", () => {
    const ses = [
      session({ id: "1", totKg: 10, farmId: "a", lote: "L1" }),
      session({ id: "2", totKg: 20, farmId: "b", lote: "L1" }),
      session({ id: "3", totKg: 5, lote: "L2" }),
    ];
    assert.equal(sessionsForFarm(ses, "a").length, 2);
    assert.equal(sessionsForFarm(ses, "a", { lote: "L1" }).length, 1);

    const bats = [
      batch({ id: "x", kgCereza: 10, farmId: "a", lote: "L1" }),
      batch({ id: "y", kgCereza: 99, farmId: "b" }),
    ];
    assert.equal(batchesForFarm(bats, "a").length, 1);
    assert.equal(batchesForFarm(bats, "a", { lote: "L2" }).length, 0);
  });

  it("hub: kg cereza ≠ kg pergamino; ratio separate; units locked", () => {
    const farmId = "tesoro";
    const sessions = [
      session({ id: "s1", totKg: 120, farmId, fecha: "2026-09-10" }),
      session({ id: "s2", totKg: 80, farmId, fecha: "2026-09-11" }),
      session({ id: "other", totKg: 999, farmId: "otra" }),
    ];
    const batches = [
      batch({
        id: "open",
        kgCereza: 120,
        kgActual: 100,
        farmId,
        events: [ev("tolva")],
      }),
      batch({
        id: "bodega",
        kgCereza: 80,
        kgActual: 14,
        farmId,
        events: [ev("tolva", 80), ev("bodega", 14)],
      }),
      batch({
        id: "sold",
        kgCereza: 50,
        kgActual: 9,
        farmId,
        saleId: "sale-1",
        events: [ev("tolva", 50), ev("bodega", 9)],
      }),
    ];
    const hub = cosechaHubSummary(farmId, "El Tesoro", sessions, batches);
    assert.equal(hub.farmName, "El Tesoro");
    assert.equal(hub.kgCereza, 200);
    assert.equal(hub.unitCereza, UNIT_CEREZA);
    assert.equal(hub.kgVendible, 14);
    assert.equal(hub.kgPergamino, 14);
    assert.equal(hub.unitVendible, UNIT_PERGAMINO);
    // Never a combined total — cereza and vendible stay separate
    assert.notEqual(hub.kgCereza + hub.kgVendible, hub.kgCereza);
    // Ratio = 80/14 ≈ 5.71 (only bodega measured; sold also measured)
    // measured = bodega (80/14) + sold (50/9) → (80+50)/(14+9) = 130/23 ≈ 5.65
    assert.ok(hub.ratioCerezaPergamino != null);
    assert.equal(hub.ratioCerezaPergamino, Math.round((130 / 23) * 100) / 100);
    assert.equal(hub.sessionCount, 2);
    assert.equal(hub.batchOpenCount, 2);
    assert.equal(hub.batchBodegaCount, 1);
    assert.equal(hub.batches[hub.batches.length - 1].batch.id, "sold");
  });

  it("withFarmTag stamps farmId", () => {
    const row = withFarmTag(
      { id: "1", farmId: undefined as string | undefined },
      "f1",
    );
    assert.equal(row.farmId, "f1");
  });
});
