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
  cultivoForLot,
  upsertCultivoForLot,
  cultivoEstadoLabel,
  hasCultivoDesign,
  cultivoYieldComparable,
} from "./lot-ops.ts";
import type { LotCultivo, LotLabor, LotNutrition } from "./types.ts";
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


function cultivo(
  partial: Partial<LotCultivo> & { id: string; lote: string; farmId?: string },
): LotCultivo {
  return {
    id: partial.id,
    farmId: partial.farmId ?? "farm-a",
    lote: partial.lote,
    title: partial.title ?? partial.lote,
    variedad: partial.variedad ?? "Castillo",
    mezcla: partial.mezcla,
    variedadNota: partial.variedadNota,
    anioSiembra: partial.anioSiembra,
    edadApprox: partial.edadApprox,
    densidad: partial.densidad,
    plantasApprox: partial.plantasApprox,
    estado: partial.estado ?? "produccion",
    sombra: partial.sombra,
    sombraTipo: partial.sombraTipo,
    updatedAt: partial.updatedAt ?? "2026-09-22T00:00:00.000Z",
  };
}

describe("cultivoForLot isolation", () => {
  it("returns only the design for the requested lot and farm", () => {
    const all = [
      cultivo({ id: "c1", lote: "L1", variedad: "Castillo", estado: "produccion" }),
      cultivo({ id: "c2", lote: "L2", variedad: "Caturra", estado: "levante" }),
      cultivo({
        id: "c3",
        lote: "L1",
        farmId: "farm-b",
        variedad: "Bourbon",
        estado: "zoca_renovacion",
      }),
    ];
    const l1 = cultivoForLot(all, "L1", { farmId: "farm-a" });
    assert.ok(l1);
    assert.equal(l1!.id, "c1");
    assert.equal(l1!.variedad, "Castillo");
    assert.equal(cultivoForLot(all, "L2", { farmId: "farm-a" })?.estado, "levante");
    assert.equal(cultivoForLot(all, "L99", { farmId: "farm-a" }), null);
    // other farm's L1 does not leak
    assert.equal(cultivoForLot(all, "L1", { farmId: "farm-b" })?.id, "c3");
  });

  it("handles empty / null lists", () => {
    assert.equal(cultivoForLot([], "L1"), null);
    assert.equal(cultivoForLot(null, "L1"), null);
    assert.equal(cultivoForLot(undefined, ""), null);
  });
});

describe("upsertCultivoForLot", () => {
  it("keeps one design per farmId+lote and replaces in place", () => {
    let list: LotCultivo[] = [];
    list = upsertCultivoForLot(
      list,
      cultivo({ id: "a", lote: "L1", variedad: "Castillo" }),
    );
    list = upsertCultivoForLot(
      list,
      cultivo({ id: "b", lote: "L2", variedad: "Caturra", estado: "levante" }),
    );
    assert.equal(list.length, 2);
    list = upsertCultivoForLot(
      list,
      cultivo({
        id: "new-id-ignored",
        lote: "L1",
        variedad: "Castillo + Geisha",
        mezcla: true,
        variedadNota: "mix ~70/30",
        estado: "produccion",
      }),
    );
    assert.equal(list.length, 2);
    const l1 = cultivoForLot(list, "L1", { farmId: "farm-a" });
    assert.equal(l1?.id, "a"); // keep original id
    assert.equal(l1?.variedad, "Castillo + Geisha");
    assert.equal(l1?.mezcla, true);
    // L2 untouched
    assert.equal(cultivoForLot(list, "L2", { farmId: "farm-a" })?.variedad, "Caturra");
  });
});

describe("cultivo labels and yield gate", () => {
  it("maps estado labels", () => {
    assert.equal(cultivoEstadoLabel("levante"), "Levante");
    assert.equal(cultivoEstadoLabel("produccion"), "Producción");
    assert.equal(cultivoEstadoLabel("zoca_renovacion"), "Zoca / renovación");
  });

  it("only producción is yield-comparable for Inteligencia", () => {
    assert.equal(
      cultivoYieldComparable(cultivo({ id: "1", lote: "L1", estado: "produccion" })),
      true,
    );
    assert.equal(
      cultivoYieldComparable(cultivo({ id: "2", lote: "L1", estado: "levante" })),
      false,
    );
    assert.equal(
      cultivoYieldComparable(
        cultivo({ id: "3", lote: "L1", estado: "zoca_renovacion" }),
      ),
      false,
    );
    assert.equal(cultivoYieldComparable(null), false);
  });

  it("hasCultivoDesign detects filled cards", () => {
    assert.equal(hasCultivoDesign(null), false);
    assert.equal(
      hasCultivoDesign(cultivo({ id: "1", lote: "L1", variedad: "  " })),
      false,
    );
    assert.equal(
      hasCultivoDesign(
        cultivo({ id: "2", lote: "L1", variedad: "Castillo", densidad: "5000" }),
      ),
      true,
    );
  });
});

describe("farm book persistence of cultivos", () => {
  it("round-trips cultivos tagged by farmId+lot; title = lot name", () => {
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
      const farmA = "farm-cultivo-a";
      const farmB = "farm-cultivo-b";
      setActivePersistFarmId(farmA);
      const empty = createEmptyFarmBook(farmA);
      assert.deepEqual(empty.cultivos, []);

      const cultivos = [
        cultivo({
          id: "ca",
          lote: "L1",
          farmId: farmA,
          title: "Centro",
          variedad: "Castillo",
          estado: "produccion",
        }),
        cultivo({
          id: "cb",
          lote: "L2",
          farmId: farmA,
          title: "Triangular",
          variedad: "Caturra",
          estado: "levante",
          sombra: true,
          sombraTipo: "guamo",
        }),
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
        labores: [],
        nutrition: [],
        cultivos,
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
        cultivos: [],
      });

      const loadedA = readFarmBookFromStorage(farmA);
      assert.ok(loadedA);
      assert.equal((loadedA!.cultivos as LotCultivo[]).length, 2);
      const centro = cultivoForLot(loadedA!.cultivos as LotCultivo[], "L1", {
        farmId: farmA,
      });
      assert.equal(centro?.title, "Centro");
      assert.equal(centro?.variedad, "Castillo");
      assert.equal(
        cultivoForLot(loadedA!.cultivos as LotCultivo[], "L2", { farmId: farmA })
          ?.estado,
        "levante",
      );

      const loadedB = readFarmBookFromStorage(farmB);
      assert.ok(loadedB);
      assert.deepEqual(loadedB!.cultivos, []);
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: prev,
      });
    }
  });
});
