import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PERSON_ROLES,
  isPersonRole,
  personRoleLabel,
  personasForFarm,
  personasHolding,
  upsertPersona,
  talentoPeriodSummary,
  validatePersonaInput,
} from "./talento.ts";
import type { FarmPerson, HarvestSession, Liquidation } from "./types.ts";
import { createEmptyFarmBook } from "./farm-book-init.ts";

function person(
  partial: Partial<FarmPerson> & { id: string; nombre: string; farmId?: string },
): FarmPerson {
  return {
    id: partial.id,
    farmId: partial.farmId ?? "farm-a",
    nombre: partial.nombre,
    rol: partial.rol ?? "recolector",
    activo: partial.activo ?? true,
    updatedAt: partial.updatedAt ?? "2026-09-20",
    ...(partial.telefono != null ? { telefono: partial.telefono } : {}),
  };
}

function sessionJornal(
  id: string,
  fecha: string,
  workers: Array<{ nombre: string; kg?: number; horas?: number; pago?: number }>,
  jornal = 60000,
): HarvestSession {
  return {
    id,
    code: id,
    fecha,
    lote: "L1",
    bloque: "",
    tipo: "Secundaria",
    pasada: 1,
    modelo: "jornal",
    valorKg: 0,
    jornal,
    alimUnit: 0,
    factor: 6,
    responsable: "",
    obs: "",
    trabajadores: workers.map((w, i) => ({
      id: `${id}-w${i}`,
      nombre: w.nombre,
      hi: "07:00",
      hf: "15:00",
      kg: w.kg ?? 20,
      horas: w.horas ?? 8,
      pago: w.pago ?? jornal,
      alim: 0,
    })),
    totKg: 20,
    totPay: jornal,
    totHrs: 8,
    totAlim: 0,
    totCost: jornal,
  };
}

describe("PersonRole catalog (locked)", () => {
  it("includes recolector, mayordomo, jornalero, beneficio, otro", () => {
    const ids = PERSON_ROLES.map((r) => r.id);
    for (const id of [
      "recolector",
      "mayordomo",
      "jornalero",
      "beneficio",
      "otro",
    ]) {
      assert.ok(ids.includes(id as never), id);
      assert.equal(isPersonRole(id), true);
    }
    assert.equal(isPersonRole("admin"), false);
    assert.equal(personRoleLabel("jornalero"), "Jornalero");
  });
});

describe("personasForFarm isolation", () => {
  it("lists only people tagged with the requested farmId", () => {
    const all = [
      person({ id: "1", nombre: "Ana", farmId: "farm-a", rol: "recolector" }),
      person({ id: "2", nombre: "Beto", farmId: "farm-b", rol: "mayordomo" }),
      person({
        id: "3",
        nombre: "Cata",
        farmId: "farm-a",
        rol: "jornalero",
        activo: false,
      }),
    ];
    const a = personasForFarm(all, "farm-a");
    assert.equal(a.length, 2);
    assert.deepEqual(
      a.map((p) => p.id),
      ["1", "3"],
    );
    assert.equal(personasForFarm(all, "farm-b").length, 1);
    assert.deepEqual(personasForFarm(all, "farm-z"), []);
    assert.deepEqual(personasForFarm(all, ""), []);
    assert.deepEqual(personasForFarm(null, "farm-a"), []);
  });

  it("can hide inactive", () => {
    const all = [
      person({ id: "1", nombre: "Ana", activo: true }),
      person({ id: "2", nombre: "Beto", activo: false }),
    ];
    assert.equal(
      personasForFarm(all, "farm-a", { includeInactive: false }).length,
      1,
    );
  });
});

describe("upsertPersona requires farm tag", () => {
  it("refuses rows without farmId (no rollup without tag)", () => {
    const row = person({ id: "x", nombre: "X" });
    row.farmId = "  ";
    assert.deepEqual(upsertPersona([], row), []);
  });

  it("upserts by id within farm book list", () => {
    const a = person({ id: "1", nombre: "Ana", rol: "recolector" });
    const b = { ...a, rol: "mayordomo" as const, nombre: "Ana M." };
    const list = upsertPersona(upsertPersona([], a), b);
    assert.equal(list.length, 1);
    assert.equal(list[0].rol, "mayordomo");
    assert.equal(list[0].nombre, "Ana M.");
  });
});

describe("personasHolding", () => {
  it("keeps farm tags across farms", () => {
    const all = [
      person({ id: "1", nombre: "Ana", farmId: "a" }),
      person({ id: "2", nombre: "Beto", farmId: "b" }),
      person({ id: "3", nombre: "Cata", farmId: "c" }),
    ];
    const h = personasHolding(all, ["a", "b"]);
    assert.equal(h.length, 2);
    assert.ok(h.every((p) => p.farmId === "a" || p.farmId === "b"));
  });
});

describe("talentoPeriodSummary + P0 jornal day-cap", () => {
  it("joins registry by name and respects ≤1 jornal/day", () => {
    const personas = [
      person({ id: "1", nombre: "Carlos", rol: "recolector" }),
      person({ id: "2", nombre: "Diana", rol: "jornalero" }),
    ];
    // Two jornal sessions same day for Carlos → 1× jornal in aggregate
    const sessions = [
      sessionJornal("s1", "2026-09-10", [{ nombre: "Carlos" }], 60000),
      sessionJornal("s2", "2026-09-10", [{ nombre: "Carlos" }], 60000),
      sessionJornal("s3", "2026-09-11", [{ nombre: "Carlos" }], 60000),
      sessionJornal("s4", "2026-09-10", [{ nombre: "Fuera" }], 50000),
    ];
    const liquidations: Liquidation[] = [
      {
        id: "l1",
        fecha: "2026-09-12",
        trabajador: "Carlos",
        periodo: "semana",
        monto: 60000,
        tipo: "semana",
        obs: "",
        sessionIds: ["s1"],
      },
    ];
    const s = talentoPeriodSummary(personas, sessions, liquidations, "farm-a");
    const carlos = s.rows.find((r) => r.key === "carlos");
    assert.ok(carlos);
    assert.equal(carlos!.linked, true);
    assert.equal(carlos!.rol, "recolector");
    assert.equal(carlos!.farmId, "farm-a");
    assert.equal(carlos!.earned, 120000); // 2 days × 60k (P0 day-cap)
    assert.equal(carlos!.jornalDays, 2);
    assert.equal(carlos!.paid, 60000);
    assert.equal(carlos!.pend, 60000);

    const fuera = s.rows.find((r) => r.key === "fuera");
    assert.ok(fuera);
    assert.equal(fuera!.linked, false);
    assert.equal(fuera!.earned, 50000);

    // Diana in registry, no harvest yet
    const diana = s.rows.find((r) => r.key === "diana");
    assert.ok(diana);
    assert.equal(diana!.earned, 0);

    assert.equal(s.activeCount, 2);
  });

  it("returns empty when farmId missing (no untagged rollup)", () => {
    const s = talentoPeriodSummary(
      [person({ id: "1", nombre: "A" })],
      [],
      [],
      "",
    );
    assert.deepEqual(s.rows, []);
    assert.equal(s.totalEarned, 0);
  });
});

describe("validatePersonaInput", () => {
  it("requires nombre, farmId and locked role", () => {
    assert.equal(
      validatePersonaInput({
        nombre: "",
        rol: "recolector",
        farmId: "f1",
      }).ok,
      false,
    );
    assert.equal(
      validatePersonaInput({
        nombre: "Ana",
        rol: "admin",
        farmId: "f1",
      }).ok,
      false,
    );
    assert.equal(
      validatePersonaInput({
        nombre: "Ana",
        rol: "beneficio",
        farmId: "",
      }).ok,
      false,
    );
    const ok = validatePersonaInput({
      nombre: "  Ana  Pérez ",
      rol: "beneficio",
      farmId: "f1",
      telefono: "300",
    });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.nombre, "Ana Pérez");
      assert.equal(ok.rol, "beneficio");
      assert.equal(ok.farmId, "f1");
    }
  });
});

describe("empty farm book includes personas", () => {
  it("createEmptyFarmBook has personas: []", () => {
    const book = createEmptyFarmBook("finca-x");
    assert.deepEqual(book.personas, []);
  });
});
