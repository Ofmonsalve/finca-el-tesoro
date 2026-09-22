import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateWorkerEarnings,
  computeSessionWorkers,
  computeWorker,
  computeWorkerPago,
  jornalClaimedOnDate,
  totalPayCapped,
  workerKey,
} from "./payroll.ts";
import type { HarvestSession, WorkerRow } from "./types.ts";

const JORNAL = 60_000;
const VALOR_KG = 1_200;

function row(
  nombre: string,
  kg: number,
  hi = "06:30",
  hf = "14:30",
): Pick<WorkerRow, "nombre" | "hi" | "hf" | "kg"> {
  return { nombre, hi, hf, kg };
}

function session(
  partial: Partial<HarvestSession> & {
    id: string;
    fecha: string;
    modelo: HarvestSession["modelo"];
    trabajadores: WorkerRow[];
  },
): HarvestSession {
  const trabajadores = partial.trabajadores;
  const totKg = trabajadores.reduce((a, w) => a + w.kg, 0);
  const totPay = trabajadores.reduce((a, w) => a + w.pago, 0);
  const totHrs = trabajadores.reduce((a, w) => a + w.horas, 0);
  const totAlim = trabajadores.reduce((a, w) => a + w.alim, 0);
  return {
    code: partial.code ?? partial.id,
    lote: partial.lote ?? "FT-CEN",
    bloque: partial.bloque ?? "General",
    tipo: partial.tipo ?? "Principal",
    pasada: partial.pasada ?? 1,
    valorKg: partial.valorKg ?? VALOR_KG,
    jornal: partial.jornal ?? JORNAL,
    alimUnit: partial.alimUnit ?? 8000,
    factor: partial.factor ?? 6,
    responsable: partial.responsable ?? "",
    obs: partial.obs ?? "",
    totKg,
    totPay,
    totHrs,
    totAlim,
    totCost: totPay + totAlim,
    ...partial,
    trabajadores,
  };
}

/** Helper mirroring buildSession pay path for tests without pulling zustand store. */
function buildSessionPay(
  fecha: string,
  modelo: HarvestSession["modelo"],
  workers: Array<Pick<WorkerRow, "nombre" | "hi" | "hf" | "kg">>,
  prior: HarvestSession[],
  id = "ses-new",
): HarvestSession {
  const claimed = jornalClaimedOnDate(prior, fecha, id);
  const trabajadores = computeSessionWorkers(
    workers,
    modelo,
    VALOR_KG,
    JORNAL,
    8000,
    claimed,
    fecha,
  );
  return session({ id, fecha, modelo, trabajadores, jornal: JORNAL, valorKg: VALOR_KG });
}

describe("workerKey", () => {
  it("normalizes trim + lowercase", () => {
    assert.equal(workerKey("  José Pérez "), "josé pérez");
  });
});

describe("computeWorkerPago / jornal day cap", () => {
  it("same worker, 2 sessions same day, jornal → total = 1×jornalRate", () => {
    const first = buildSessionPay("2026-09-22", "jornal", [row("Ana", 40)], []);
    const second = buildSessionPay(
      "2026-09-22",
      "jornal",
      [row("Ana", 25)],
      [first],
      "ses-2",
    );
    assert.equal(first.trabajadores[0].pago, JORNAL);
    assert.equal(second.trabajadores[0].pago, 0);
    const earned = aggregateWorkerEarnings([first, second]);
    const ana = earned.find((w) => workerKey(w.nombre) === "ana");
    assert.ok(ana);
    assert.equal(ana.earned, JORNAL);
    assert.equal(totalPayCapped([first, second]), JORNAL);
  });

  it("same worker, 2 sessions different days → 2×jornalRate", () => {
    const d1 = buildSessionPay("2026-09-21", "jornal", [row("Ana", 40)], []);
    const d2 = buildSessionPay(
      "2026-09-22",
      "jornal",
      [row("Ana", 30)],
      [d1],
      "ses-2",
    );
    assert.equal(d1.trabajadores[0].pago, JORNAL);
    assert.equal(d2.trabajadores[0].pago, JORNAL);
    assert.equal(totalPayCapped([d1, d2]), 2 * JORNAL);
  });

  it("por_kg unchanged (sum of kg×rate)", () => {
    const a = buildSessionPay("2026-09-22", "por_kg", [row("Ana", 40)], []);
    const b = buildSessionPay(
      "2026-09-22",
      "por_kg",
      [row("Ana", 25)],
      [a],
      "ses-2",
    );
    assert.equal(a.trabajadores[0].pago, Math.round(40 * VALOR_KG));
    assert.equal(b.trabajadores[0].pago, Math.round(25 * VALOR_KG));
    assert.equal(
      totalPayCapped([a, b]),
      Math.round(40 * VALOR_KG) + Math.round(25 * VALOR_KG),
    );
  });

  it("jornal with kg=0 and hours=0 → pago 0", () => {
    const pago = computeWorkerPago("jornal", 0, 0, VALOR_KG, JORNAL, false);
    assert.equal(pago, 0);
    const w = computeWorker(row("Ana", 0, "", ""), "jornal", VALOR_KG, JORNAL, 8000);
    assert.equal(w.pago, 0);
  });

  it("aggregate caps historical buggy sessions that stored N×jornal", () => {
    // Simulate old bug: each session stored full jornal
    const buggy = [
      session({
        id: "a",
        fecha: "2026-09-22",
        modelo: "jornal",
        jornal: JORNAL,
        trabajadores: [
          {
            id: "w1",
            nombre: "Ana",
            hi: "06:30",
            hf: "14:30",
            kg: 40,
            horas: 8,
            pago: JORNAL,
            alim: 8000,
          },
        ],
      }),
      session({
        id: "b",
        fecha: "2026-09-22",
        modelo: "jornal",
        jornal: JORNAL,
        trabajadores: [
          {
            id: "w2",
            nombre: "Ana",
            hi: "06:30",
            hf: "14:30",
            kg: 20,
            horas: 8,
            pago: JORNAL,
            alim: 8000,
          },
        ],
      }),
    ];
    assert.equal(
      buggy.reduce((a, s) => a + s.totPay, 0),
      2 * JORNAL,
    );
    assert.equal(totalPayCapped(buggy), JORNAL);
  });
});
