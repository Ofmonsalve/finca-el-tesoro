import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LEGACY_STORAGE_KEY,
  cloneDemoLots,
  createEmptyFarmBook,
  createFarmPersistStorage,
  lotsFromImport,
  mergeLotsFromPersist,
  shouldOfferDemoLots,
  storageKeyForFarm,
} from "./farm-book-init.ts";
import { DEMO_LOTS, harvestLots, allLots, lotByCode } from "./lots.ts";
import { FARM_ID } from "./roles.ts";

describe("createEmptyFarmBook", () => {
  it("starts with structure but no lots or harvests", () => {
    const book = createEmptyFarmBook("finca-nueva");
    assert.equal(book.farmId, "finca-nueva");
    assert.deepEqual(book.lots, []);
    assert.deepEqual(book.sessions, []);
    assert.deepEqual(book.batches, []);
    assert.deepEqual(book.liquidations, []);
    assert.deepEqual(book.sales, []);
    assert.deepEqual(book.costs, []);
    assert.deepEqual(book.journals, []);
    assert.equal(book.settings.factor, 6);
  });

  it("defaults farmId to FARM_ID", () => {
    assert.equal(createEmptyFarmBook().farmId, FARM_ID);
  });
});

describe("storageKeyForFarm", () => {
  it("scopes key by farmId so two farms do not share a blob", () => {
    const a = storageKeyForFarm("finca-a");
    const b = storageKeyForFarm("finca-b");
    assert.notEqual(a, b);
    assert.match(a, /finca-a/);
    assert.match(b, /finca-b/);
    assert.notEqual(a, LEGACY_STORAGE_KEY);
  });
});

describe("demo lots are opt-in only", () => {
  it("cloneDemoLots returns a copy of the El Tesoro template", () => {
    const demo = cloneDemoLots();
    assert.equal(demo.length, DEMO_LOTS.length);
    assert.equal(demo[0].code, "FT-CEN");
    demo[0].nombre = "MUTATED";
    assert.notEqual(DEMO_LOTS[0].nombre, "MUTATED");
  });

  it("shouldOfferDemoLots only when catalog empty", () => {
    assert.equal(shouldOfferDemoLots([]), true);
    assert.equal(shouldOfferDemoLots(undefined), true);
    assert.equal(shouldOfferDemoLots(cloneDemoLots()), false);
  });

  it("harvestLots / allLots never fall back to demo when empty", () => {
    assert.deepEqual(harvestLots([]), []);
    assert.deepEqual(harvestLots(undefined), []);
    assert.deepEqual(allLots([]), []);
    assert.equal(lotByCode([], "FT-CEN"), undefined);
  });
});

describe("mergeLotsFromPersist / lotsFromImport", () => {
  it("keeps explicit empty array (no demo injection)", () => {
    assert.deepEqual(mergeLotsFromPersist([], cloneDemoLots()), []);
    assert.deepEqual(lotsFromImport([], cloneDemoLots()), []);
  });

  it("uses persisted / imported lots when present", () => {
    const one = [cloneDemoLots()[0]];
    assert.equal(mergeLotsFromPersist(one, []).length, 1);
    assert.equal(lotsFromImport(one, []).length, 1);
  });

  it("falls back to current only when lots key is absent", () => {
    const current = cloneDemoLots().slice(0, 2);
    assert.equal(mergeLotsFromPersist(undefined, current).length, 2);
    assert.equal(lotsFromImport(undefined, current).length, 2);
  });
});

describe("createFarmPersistStorage migration", () => {
  it("migrates legacy ft-tesoro-v1 into farm-scoped key without wiping", () => {
    const store = new Map<string, string>();
    const fake = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
    // Shim localStorage for this test
    const prev = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: fake,
    });
    try {
      const primary = storageKeyForFarm(FARM_ID);
      store.set(LEGACY_STORAGE_KEY, JSON.stringify({ state: { lots: [{ code: "REAL" }] } }));
      const storage = createFarmPersistStorage(FARM_ID);
      const got = storage.getItem(primary) as string;
      assert.ok(got);
      assert.equal(store.get(primary), got);
      // legacy retained (safe migration)
      assert.ok(store.get(LEGACY_STORAGE_KEY));
      assert.match(got, /REAL/);
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: prev,
      });
    }
  });

  it("fresh install has no seed blob", () => {
    const store = new Map<string, string>();
    const fake = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
    const prev = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: fake,
    });
    try {
      const storage = createFarmPersistStorage("otra-finca");
      const key = storageKeyForFarm("otra-finca");
      assert.equal(storage.getItem(key), null);
    } finally {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: prev,
      });
    }
  });
});
