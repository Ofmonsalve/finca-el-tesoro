import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  defaultFarmRegistry,
  displayFarmName,
  makeFarmId,
  slugifyFarmName,
  FARMS_REGISTRY_KEY,
} from "./farm-registry.ts";
import { FARM_ID } from "./roles.ts";

describe("farm-registry helpers", () => {
  it("defaults to El Tesoro as the first farm", () => {
    const d = defaultFarmRegistry();
    assert.equal(d.activeFarmId, FARM_ID);
    assert.equal(d.farms.length, 1);
    assert.equal(d.farms[0].name, "El Tesoro");
  });

  it("slugifies Colombian farm names into finca-* ids", () => {
    assert.equal(slugifyFarmName("La Esperanza"), "finca-la-esperanza");
    assert.equal(slugifyFarmName("El Tesoro"), "finca-el-tesoro");
  });

  it("makeFarmId avoids collisions", () => {
    const id = makeFarmId("La Esperanza", ["finca-la-esperanza"]);
    assert.equal(id, "finca-la-esperanza-2");
  });

  it("displayFarmName prefers the human name from the registry", () => {
    assert.equal(
      displayFarmName("finca-x", [
        { id: "finca-x", name: "La Cumbre", createdAt: "" },
      ]),
      "La Cumbre",
    );
    assert.equal(displayFarmName(FARM_ID), "El Tesoro");
  });

  it("registry storage key is stable", () => {
    assert.equal(FARMS_REGISTRY_KEY, "ft-farms-v1");
  });
});
