import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  KG_OUT_TOLERANCE_PCT,
  deviationPct,
  resolveStageKgOut,
  stageRequiresExplicitKg,
} from "./beneficio-weigh.ts";

describe("stageRequiresExplicitKg", () => {
  it("requires despulpado, lavado, secado, bodega", () => {
    assert.equal(stageRequiresExplicitKg("despulpado"), true);
    assert.equal(stageRequiresExplicitKg("lavado"), true);
    assert.equal(stageRequiresExplicitKg("secado"), true);
    assert.equal(stageRequiresExplicitKg("bodega"), true);
  });

  it("does not require skippable or zero-merma stages", () => {
    assert.equal(stageRequiresExplicitKg("flotacion"), false);
    assert.equal(stageRequiresExplicitKg("fermentacion_aire"), false);
    assert.equal(stageRequiresExplicitKg("fermentacion_tanque"), false);
    assert.equal(stageRequiresExplicitKg("tolva"), false);
    assert.equal(stageRequiresExplicitKg("despacho"), false);
    assert.equal(stageRequiresExplicitKg("venta"), false);
  });
});

describe("resolveStageKgOut", () => {
  const base = {
    kgCereza: 600,
    kgActual: 600,
    factor: 6,
  };

  it("skip path copies kgActual and never blocks as missing weigh", () => {
    const r = resolveStageKgOut({
      ...base,
      stage: "flotacion",
      skipped: true,
      kgOutRaw: "",
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.kgOut, 600);
      assert.equal(r.estimated, false);
      assert.equal(r.deviationWarn, false);
    }
  });

  it("blocks empty kgOut on despulpado without estimated", () => {
    const r = resolveStageKgOut({
      ...base,
      stage: "despulpado",
      skipped: false,
      kgOutRaw: "",
    });
    assert.equal(r.ok, false);
    assert.equal(r.blocked, true);
    assert.equal(r.kgOut, null);
    assert.match(r.message ?? "", /pesado|estimado/i);
  });

  it("does not fall back to kgActual when raw is empty on secado", () => {
    const r = resolveStageKgOut({
      ...base,
      kgActual: 288,
      stage: "secado",
      skipped: false,
      kgOutRaw: "   ",
    });
    assert.equal(r.ok, false);
    assert.equal(r.blocked, true);
  });

  it("blocks zero kgOut on bodega", () => {
    const r = resolveStageKgOut({
      ...base,
      kgActual: 100,
      stage: "bodega",
      skipped: false,
      kgOutRaw: "0",
    });
    assert.equal(r.ok, false);
    assert.equal(r.blocked, true);
  });

  it("accepts explicit kg near expected on despulpado", () => {
    // STAGE_RETAIN despulpado = 0.52 → 600 * 0.52 = 312
    const r = resolveStageKgOut({
      ...base,
      stage: "despulpado",
      skipped: false,
      kgOutRaw: "310",
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.kgOut, 310);
      assert.equal(r.estimated, false);
      assert.equal(r.deviationWarn, false);
    }
  });

  it("warns when far from expected but does not block", () => {
    const r = resolveStageKgOut({
      ...base,
      stage: "secado",
      skipped: false,
      kgOutRaw: "50", // expected 100 (600/6)
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.kgOut, 50);
      assert.equal(r.deviationWarn, true);
      assert.ok(r.deviationPct > KG_OUT_TOLERANCE_PCT);
      assert.ok(r.message);
    }
  });

  it("estimated uses expectedAt and flags estimated", () => {
    const r = resolveStageKgOut({
      ...base,
      stage: "bodega",
      skipped: false,
      kgOutRaw: "",
      estimated: true,
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.kgOut, 100);
      assert.equal(r.estimated, true);
      assert.equal(r.deviationWarn, false);
    }
  });

  it("non-weigh stage may copy kgActual when empty", () => {
    const r = resolveStageKgOut({
      ...base,
      kgActual: 580,
      stage: "despacho",
      skipped: false,
      kgOutRaw: "",
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.kgOut, 580);
      assert.equal(r.estimated, false);
    }
  });

  it("parses es-CO decimal comma", () => {
    const r = resolveStageKgOut({
      ...base,
      stage: "lavado",
      skipped: false,
      kgOutRaw: "288,5",
      kgActual: 300,
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.kgOut, 288.5);
  });
});

describe("deviationPct", () => {
  it("is relative to expected", () => {
    assert.equal(deviationPct(85, 100), 15);
    assert.equal(deviationPct(0, 0), 0);
    assert.equal(deviationPct(10, 0), 100);
  });
});
