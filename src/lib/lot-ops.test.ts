import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  laboresForLot,
  nutritionForLot,
  upsertById,
  laborTipoLabel,
  nutritionEstadoLabel,
  laborHasTalentoCost,
  nutritionHasProductCost,
} from "./lot-ops.ts";
import type { LotLabor, LotNutrition } from "./types.ts";
import {
  createEmptyFarmBook,
  readFarmBookFromStorage,
  writeFarmBookToStorage,
  setActivePersistFarmId,
} from "./farm-book-init.ts";

function labor(
  partial: Partial<LotLabor> & { id: string; lote: string; farmId?: string },
): LotLabor {
  return {
    id: partial.id,
    farmId: partial.farmId ?? "farm-a",
    fecha: partial.fecha ?? "2026-09-01",
    lote: partial.lote,
    tipo: partial.tipo ?? "plateo",
    notas: partial.notas ?? "",
    responsable: partial.responsable ?? "Omar",
    ...(partial.jornal != null ? { jornal: partial.jornal } : {}),
  };
}

function nut(
  partial: Partial<LotNutrition> & { id: string; lote: string; farmId?: string },
): LotNutrition {
  return {
    id: partial.id,
    farmId: partial.farmId ?? "farm-a",
    fecha: partial.fecha ?? "2026-09-01",
    lote: partial.lote,
    via: partial.via ?? "suelo",
    producto: partial.producto ?? "15-15-15",
    cantidad: partial.cantidad ?? 50,
    unidad: partial.unidad ?? "kg",
    estado: partial.estado ?? "planificada",
    notas: partial.notas ?? "",
    ...(partial.costoProducto != null
      ? { costoProducto: partial.costoProducto }
      : {}),
  };
}

describe("laboresForLot isolation", () => {
  it("lists only records for the requested lot and farm", () => {
    const all = [
      labor({ id: "a", lote: "L1", fecha: "2026-09-10", tipo: "poda" }),
      labor({ id: "b", lote: "L2", fecha: "2026-09-11", tipo: "plateo" }),
      labor({ id: "c", lote: "L1", fecha: "2026-09-12", tipo: "broca" }),
      labor({
        id: "d",
        lote: "L1",
        fecha: "2026-09-13",
        farmId: "farm-b",
        tipo: "sombra",
      }),
    ];
    const l1 = laboresForLot(all, "L1", { farmId: "farm-a" });
    assert.equal(l1.length, 2);
    assert.deepEqual(
      l1.map((x) => x.id),
      ["c", "a"],
    );
    const l2 = laboresForLot(all, "L2", { farmId: "farm-a" });
    assert.equal(l2.length, 1);
    assert.equal(l2[0].id, "b");
    assert.deepEqual(laboresForLot(all, "L99", { farmId: "farm-a" }), []);
    // other farm's L1 does not leak
    assert.equal(laboresForLot(all, "L1", { farmId: "farm-b" }).length, 1);
  });

  it("handles empty / null lists", () => {
    assert.deepEqual(laboresForLot([], "L1"), []);
    assert.deepEqual(laboresForLot(null, "L1"), []);
    assert.deepEqual(laboresForLot(undefined, ""), []);
  });
});

describe("nutritionForLot isolation", () => {
  it("lists only nutrition for the requested lot and farm", () => {
    const all = [
      nut({ id: "n1", lote: "A", fecha: "2026-08-01", estado: "hecha" }),
      nut({ id: "n2", lote: "B", fecha: "2026-08-02", via: "foliar" }),
      nut({ id: "n3", lote: "A", fecha: "2026-08-03", producto: "cal" }),
      nut({ id: "n4", lote: "A", farmId: "farm-b", fecha: "2026-08-04" }),
    ];
    const a = nutritionForLot(all, "A", { farmId: "farm-a" });
    assert.equal(a.length, 2);
    assert.equal(a[0].id, "n3");
    assert.equal(nutritionForLot(all, "B", { farmId: "farm-a" }).length, 1);
    assert.equal(nutritionForLot(all, "Z", { farmId: "farm-a" }).length, 0);
  });
});

describe("upsertById save semantics", () => {
  it("inserts newest-first and replaces by id", () => {
    let list: LotLabor[] = [];
    list = upsertById(list, labor({ id: "1", lote: "L1" }));
    list = upsertById(list, labor({ id: "2", lote: "L1", tipo: "poda" }));
    assert.equal(list.length, 2);
    assert.equal(list[0].id, "2");
    list = upsertById(
      list,
      labor({ id: "1", lote: "L1", notas: "updated", tipo: "deschupone" }),
    );
    assert.equal(list.length, 2);
    const row = list.find((x) => x.id === "1");
    assert.equal(row?.notas, "updated");
    assert.equal(row?.tipo, "deschupone");
  });
});

describe("labels and cost tags", () => {
  it("maps field-work tipos (not fertilizer)", () => {
    assert.equal(laborTipoLabel("plateo"), "Plateo");
    assert.equal(laborTipoLabel("poda"), "Poda");
    assert.equal(laborTipoLabel("deschupone"), "Deschupone");
    assert.equal(laborTipoLabel("broca"), "Broca");
    assert.equal(laborTipoLabel("sombra"), "Sombra");
    assert.equal(nutritionEstadoLabel("planificada"), "Planificada");
    assert.equal(nutritionEstadoLabel("hecha"), "Hecha");
  });

  it("cost tags gate Pulso rollup", () => {
    assert.equal(laborHasTalentoCost(labor({ id: "1", lote: "L1" })), false);
    assert.equal(
      laborHasTalentoCost(labor({ id: "2", lote: "L1", jornal: 60000 })),
      true,
    );
    assert.equal(nutritionHasProductCost(nut({ id: "n", lote: "L1" })), false);
    assert.equal(
      nutritionHasProductCost(
        nut({ id: "n2", lote: "L1", costoProducto: 120000 }),
      ),
      true,
    );
  });
});

describe("farm book persistence of labores/nutrition", () => {
  it("round-trips labores and nutrition tagged by farmId+lot", () => {
    const prev = globalThis.localStorage;
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
    });
    try {
      const farmA = "farm-ops-a";
      const farmB = "farm-ops-b";
      setActivePersistFarmId(farmA);
      const empty = createEmptyFarmBook(farmA);
      assert.deepEqual(empty.labores, []);
      assert.deepEqual(empty.nutrition, []);

      const labores = [
        labor({ id: "la", lote: "L1", farmId: farmA, tipo: "plateo" }),
        labor({ id: "lb", lote: "L2", farmId: farmA, tipo: "poda" }),
      ];
      const nutrition = [
        nut({ id: "na", lote: "L1", farmId: farmA, estado: "hecha", via: "suelo" }),
      ];

      writeFarmBookToStorage(farmA, {
        farmId: farmA,
        settings: empty.settings,
        sessions: [],
        batches: [],
        liquidations: [],
        sales: [],
        costs: [],
        journals: [],
        lots: [],
        labores,
        nutrition,
      });

      writeFarmBookToStorage(farmB, {
        ...createEmptyFarmBook(farmB),
        sessions: [],
        batches: [],
        liquidations: [],
        sales: [],
        costs: [],
        journals: [],
        lots: [],
        labores: [],
        nutrition: [],
      });

      const loadedA = readFarmBookFromStorage(farmA);
      assert.ok(loadedA);
      assert.equal((loadedA!.labores as LotLabor[]).length, 2);
      assert.equal((loadedA!.nutrition as LotNutrition[]).length, 1);
      assert.equal(
        laboresForLot(loadedA!.labores as LotLabor[], "L1", { farmId: farmA })
          .length,
        1,
      );
      assert.equal(
        laboresForLot(loadedA!.labores as LotLabor[], "L2", { farmId: farmA })
          .length,
        1,
      );

      const loadedB = readFarmBookFromStorage(farmB);
      assert.ok(loadedB);
      assert.deepEqual(loadedB!.labores, []);
      assert.deepEqual(loadedB!.nutrition, []);
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: prev,
      });
    }
  });
});
