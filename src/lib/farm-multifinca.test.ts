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


  it("two farms: isolation of money + sum of kg/pay (no mixing)", () => {
    writeFarmBookToStorage("finca-a", {
      farmId: "finca-a",
      settings: { ...EMPTY_SETTINGS },
      sessions: [
        session({ id: "a1", totKg: 100, totPay: 50000, totAlim: 8000 }),
      ],
      batches: [],
      liquidations: [],
      sales: [
        {
          id: "v1",
          fecha: "2026-09-10",
          cliente: "FNC",
          tipo: "pergamino",
          kg: 10,
          precioKg: 20000,
          total: 200000,
          cobrado: 200000,
          metodo: "efectivo",
          lote: "",
          batchId: "",
          obs: "",
        },
      ],
      costs: [
        {
          id: "c1",
          fecha: "2026-09-10",
          lote: "",
          categoria: "otro",
          concepto: "insumo",
          monto: 30000,
        },
      ],
      journals: [],
      lots: [lot("L1", "Lote A")],
    });
    writeFarmBookToStorage("finca-b", {
      farmId: "finca-b",
      settings: { ...EMPTY_SETTINGS },
      sessions: [
        session({ id: "b1", totKg: 50, totPay: 20000, totAlim: 0 }),
      ],
      batches: [],
      liquidations: [],
      sales: [],
      costs: [],
      journals: [],
      lots: [lot("L2", "Lote B")],
    });

    const a = rollupFarmBook(
      "finca-a",
      "A",
      readFarmBookFromStorage("finca-a"),
    );
    const b = rollupFarmBook(
      "finca-b",
      "B",
      readFarmBookFromStorage("finca-b"),
    );

    // Isolation
    assert.equal(a.kgCereza, 100);
    assert.equal(b.kgCereza, 50);
    assert.equal(a.moneyIn, 200000);
    assert.equal(b.moneyIn, 0);
    assert.equal(a.moneyOut, 50000 + 8000 + 30000);
    assert.equal(b.moneyOut, 20000);
    assert.equal(a.talentoPay, 50000);
    assert.equal(b.talentoPay, 20000);
    assert.ok(a.costoKg != null);
    assert.equal(Math.round(a.costoKg! * 1000) / 1000, (50000 + 8000) / 100);
    assert.equal(b.costoKg, 20000 / 50);

    const summary = buildConsolidado([
      { id: "finca-a", name: "A", createdAt: "" },
      { id: "finca-b", name: "B", createdAt: "" },
    ]);
    assert.equal(summary.totalKgCereza, 150);
    assert.equal(summary.totalMoneyIn, 200000);
    assert.equal(summary.totalMoneyOut, a.moneyOut + b.moneyOut);
    assert.equal(summary.totalTalentoPay, 70000);
    assert.equal(summary.farmCount, 2);
    // costo/kg consolidado = suma costo cosecha / suma kg (no promedio de ratios)
    assert.ok(summary.costoKg != null);
    assert.equal(
      Math.round(summary.costoKg! * 1000) / 1000,
      (58000 + 20000) / 150,
    );
  });

  it("vendible kg is pergamino in bodega without sale; empty if none", () => {
    writeFarmBookToStorage("finca-a", {
      farmId: "finca-a",
      settings: { ...EMPTY_SETTINGS },
      sessions: [],
      batches: [
        {
          id: "bat1",
          sessionId: "s1",
          code: "B-1",
          fecha: "2026-09-10",
          lote: "L1",
          kgCereza: 120,
          kgActual: 20,
          factor: 6,
          events: [
            {
              id: "e1",
              stage: "bodega",
              skipped: false,
              at: "2026-09-10T12:00:00.000Z",
              kgIn: 20,
              kgOut: 20,
              notas: "",
              responsable: "",
            },
          ],
          saleId: null,
        },
      ],
      liquidations: [],
      sales: [],
      costs: [],
      journals: [],
      lots: [],
    });
    writeFarmBookToStorage("finca-b", {
      farmId: "finca-b",
      settings: { ...EMPTY_SETTINGS },
      sessions: [],
      batches: [],
      liquidations: [],
      sales: [],
      costs: [],
      journals: [],
      lots: [],
    });
    const a = rollupFarmBook(
      "finca-a",
      "A",
      readFarmBookFromStorage("finca-a"),
    );
    const b = rollupFarmBook(
      "finca-b",
      "B",
      readFarmBookFromStorage("finca-b"),
    );
    assert.equal(a.kgVendible, 20);
    assert.equal(b.kgVendible, 0);
    const summary = buildConsolidado([
      { id: "finca-a", name: "A", createdAt: "" },
      { id: "finca-b", name: "B", createdAt: "" },
    ]);
    assert.equal(summary.totalKgVendible, 20);
  });

});
