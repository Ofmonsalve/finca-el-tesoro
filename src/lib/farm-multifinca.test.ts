import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyFarmBook,
  readFarmBookFromStorage,
  writeFarmBookToStorage,
  storageKeyForFarm,
  setActivePersistFarmId,
  EMPTY_SETTINGS,
} from "./farm-book-init.ts";
import { buildConsolidado, rollupFarmBook } from "./farm-consolidado.ts";
import { makeFarmId } from "./farm-registry.ts";
import type { FarmLot } from "./lots.ts";
import type { HarvestSession } from "./types.ts";

function fakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
}

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
  };
}

function lot(code: string, nombre: string): FarmLot {
  return {
    id: code,
    code,
    nombre,
    rol: "Producción",
    accion: "Cosechar",
    estado: "Activo",
    areaHa: 0.5,
    bloques: ["General"],
    harvestPriority: 1,
    status: "activo",
    unifiedInto: null,
    variedad: "Caturra",
  };
}

describe("multifinca isolation", () => {
  let prev: unknown;

  beforeEach(() => {
    prev = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: fakeLocalStorage(),
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: prev,
    });
  });

  it("saving on farm A does not appear on farm B", () => {
    const farmA = "finca-a";
    const farmB = "finca-b";
    assert.notEqual(storageKeyForFarm(farmA), storageKeyForFarm(farmB));

    writeFarmBookToStorage(farmA, {
      farmId: farmA,
      settings: { ...EMPTY_SETTINGS },
      sessions: [
        session({ id: "ses-a", totKg: 100, totPay: 50000, totAlim: 8000 }),
      ],
      batches: [],
      liquidations: [],
      sales: [],
      costs: [],
      journals: [],
      lots: [lot("L1", "Lote A")],
    });

    assert.equal(readFarmBookFromStorage(farmB), null);

    const a = readFarmBookFromStorage(farmA);
    assert.ok(a);
    assert.equal(a!.sessions.length, 1);
    assert.equal((a!.sessions[0] as HarvestSession).totKg, 100);
    assert.equal(a!.lots.length, 1);

    const emptyB = createEmptyFarmBook(farmB);
    writeFarmBookToStorage(farmB, {
      farmId: farmB,
      settings: emptyB.settings,
      sessions: [],
      batches: [],
      liquidations: [],
      sales: [],
      costs: [],
      journals: [],
      lots: [],
    });
    const b2 = readFarmBookFromStorage(farmB);
    assert.ok(b2);
    assert.deepEqual(b2!.sessions, []);
    assert.deepEqual(b2!.lots, []);

    const a2 = readFarmBookFromStorage(farmA);
    assert.equal(a2!.lots.length, 1);
    assert.equal((a2!.sessions[0] as HarvestSession).totKg, 100);
  });

  it("new farm rollup starts empty (no demo lots)", () => {
    const id = makeFarmId("Nueva", []);
    setActivePersistFarmId(id);
    const roll = rollupFarmBook(id, "Nueva", null);
    assert.equal(roll.kg, 0);
    assert.equal(roll.lotCount, 0);
    assert.ok(roll.alerts.some((a) => /lotes/i.test(a)));
  });

  it("consolidado sums across farms without mixing", () => {
    writeFarmBookToStorage("finca-a", {
      farmId: "finca-a",
      settings: { ...EMPTY_SETTINGS },
      sessions: [session({ id: "1", totKg: 40, totPay: 10 })],
      batches: [],
      liquidations: [],
      sales: [],
      costs: [],
      journals: [],
      lots: [],
    });
    writeFarmBookToStorage("finca-b", {
      farmId: "finca-b",
      settings: { ...EMPTY_SETTINGS },
      sessions: [session({ id: "2", totKg: 60, totPay: 20 })],
      batches: [],
      liquidations: [],
      sales: [],
      costs: [],
      journals: [],
      lots: [],
    });

    const summary = buildConsolidado([
      { id: "finca-a", name: "A", createdAt: "" },
      { id: "finca-b", name: "B", createdAt: "" },
    ]);
    assert.equal(summary.totalKg, 100);
    assert.equal(summary.farms[0].kg, 40);
    assert.equal(summary.farms[1].kg, 60);
    assert.equal(summary.farmCount, 2);
  });
});
