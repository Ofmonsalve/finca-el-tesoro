import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  batchesForFarm,
  belongsToFarm,
  cosechaHubSummary,
  sessionsForFarm,
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

function ev(stage: ProcessEvent["stage"]): ProcessEvent {
  return {
    id: `ev-${stage}`,
    stage,
    skipped: false,
    at: "2026-09-01T12:00:00.000Z",
    kgIn: 100,
    kgOut: stage === "bodega" ? 18 : 90,
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
  it("belongsToFarm: legacy untagged counts for active farm", () => {
    assert.equal(belongsToFarm({ farmId: undefined }, "finca-a"), true);
    assert.equal(belongsToFarm({ farmId: "finca-a" }, "finca-a"), true);
    assert.equal(belongsToFarm({ farmId: "finca-b" }, "finca-a"), false);
    assert.equal(belongsToFarm(null, "finca-a"), false);
  });

  it("sessionsForFarm / batchesForFarm drop other farm tags", () => {
    const ses = [
      session({ id: "1", totKg: 10, farmId: "a" }),
      session({ id: "2", totKg: 20, farmId: "b" }),
      session({ id: "3", totKg: 5 }), // legacy
    ];
    const onlyA = sessionsForFarm(ses, "a");
    assert.equal(onlyA.length, 2);
    assert.deepEqual(
      onlyA.map((s) => s.id).sort(),
      ["1", "3"],
    );

    const bats = [
      batch({ id: "x", kgCereza: 10, farmId: "a" }),
      batch({ id: "y", kgCereza: 99, farmId: "b" }),
    ];
    assert.equal(batchesForFarm(bats, "a").length, 1);
    assert.equal(batchesForFarm(bats, "a")[0].id, "x");
  });

  it("hub summarizes kg cereza vs kg pergamino (bodega)", () => {
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
        events: [ev("tolva"), ev("bodega")],
      }),
      batch({
        id: "sold",
        kgCereza: 50,
        kgActual: 9,
        farmId,
        saleId: "sale-1",
        events: [ev("tolva"), ev("bodega")],
      }),
    ];
    const hub = cosechaHubSummary(farmId, "El Tesoro", sessions, batches);
    assert.equal(hub.kgCereza, 200);
    assert.equal(hub.kgPergamino, 14); // only unsold bodega
    assert.equal(hub.sessionCount, 2);
    assert.equal(hub.batchOpenCount, 2);
    assert.equal(hub.batchBodegaCount, 1);
    assert.equal(hub.farmName, "El Tesoro");
    // open batches listed before sold
    assert.equal(hub.batches[hub.batches.length - 1].batch.id, "sold");
  });

  it("withFarmTag stamps farmId", () => {
    const row = withFarmTag({ id: "1", farmId: undefined as string | undefined }, "f1");
    assert.equal(row.farmId, "f1");
    const keep = withFarmTag({ id: "2", farmId: "old" }, "f1");
    assert.equal(keep.farmId, "f1");
  });
});
