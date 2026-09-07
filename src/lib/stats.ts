import { areaActiva, harvestLots, rollupCode, DEFAULT_LOTS, type LotCode, type FarmLot } from "./lots";
import type { FarmState } from "./store";
import type { CostLine, ProcessBatch, Sale } from "./types";
import {
  AREA_FINCA_HA,
  ARROBA_KG,
  CARGA_KG,
  cargaCost,
  farmYield,
  stageMermaBook,
} from "./yield";

export function farmStats(s: FarmState) {
  const sessions = s.sessions ?? [];
  const sales = s.sales ?? [];
  const liquidations = s.liquidations ?? [];
  const costs = s.costs ?? [];
  const lots: FarmLot[] = s.lots?.length ? s.lots : DEFAULT_LOTS;
  const active = harvestLots(lots);
  const ha = areaActiva(lots) || 0.87;
  const codes = [
    ...new Set([
      ...active.map((l) => l.code),
      ...sessions.map((x) => rollupCode(lots, x.lote)),
    ]),
  ];
  const kg = sessions.reduce((a, x) => a + x.totKg, 0);
  const pay = sessions.reduce((a, x) => a + x.totPay, 0);
  const alim = sessions.reduce((a, x) => a + x.totAlim, 0);
  const hrs = sessions.reduce((a, x) => a + x.totHrs, 0);
  const costoCosecha = pay + alim;
  const otherCosts = costs.reduce((a, c) => a + c.monto, 0);
  const costoTotal = costoCosecha + otherCosts;
  const ing = sales.reduce((a, v) => a + v.total, 0);
  const cobrado = sales.reduce((a, v) => a + v.cobrado, 0);
  const kgVenta = sales.reduce((a, v) => a + v.kg, 0);
  const paid = liquidations.reduce((a, l) => a + l.monto, 0);
  const pendMO = Math.max(0, pay - paid);
  const cartera = Math.max(0, ing - cobrado);
  const margen = ing - costoTotal;
  const byLot: Record<
    string,
    { kg: number; cost: number; hrs: number; n: number }
  > = {};
  for (const code of codes) byLot[code] = { kg: 0, cost: 0, hrs: 0, n: 0 };
  byLot["FT-FINCA"] = { kg: 0, cost: 0, hrs: 0, n: 0 };
  sessions.forEach((ses) => {
    const key = rollupCode(lots, ses.lote);
    if (!byLot[key]) byLot[key] = { kg: 0, cost: 0, hrs: 0, n: 0 };
    byLot[key].kg += ses.totKg;
    byLot[key].cost += ses.totCost;
    byLot[key].hrs += ses.totHrs;
    byLot[key].n += 1;
  });
  const workers = new Map<
    string,
    { nombre: string; kg: number; hrs: number; pago: number; dias: number }
  >();
  sessions.forEach((ses) => {
    ses.trabajadores.forEach((w) => {
      const k = w.nombre.toLowerCase();
      const cur = workers.get(k) || {
        nombre: w.nombre,
        kg: 0,
        hrs: 0,
        pago: 0,
        dias: 0,
      };
      cur.kg += w.kg;
      cur.hrs += w.horas;
      cur.pago += w.pago;
      cur.dias += 1;
      workers.set(k, cur);
    });
  });
  const byDay = new Map<string, { kg: number; cost: number }>();
  sessions.forEach((ses) => {
    const cur = byDay.get(ses.fecha) || { kg: 0, cost: 0 };
    cur.kg += ses.totKg;
    cur.cost += ses.totCost;
    byDay.set(ses.fecha, cur);
  });
  const batches = s.batches ?? [];
  const inProcess = batches.filter((b) => !b.saleId).length;
  const yieldBook = farmYield(sessions, batches, ha, lots);
  const factor = yieldBook.factorPlanW || 6;
  const cps = yieldBook.cpsEst;
  const kgCpsVendido = sales.reduce((a, v) => {
    if (v.tipo === "pergamino") return a + v.kg;
    return a + v.kg / factor;
  }, 0);
  const mermaBook = stageMermaBook(batches);
  const vanosKg =
    mermaBook.find((m) => m.stage === "flotacion")?.mermaKg ?? 0;
  const cargaBook = cargaCost({
    costoCosecha,
    pay,
    alim,
    otherCosts,
    costoTotal,
    kgCpsEst: yieldBook.cpsEst,
    kgCpsReal: yieldBook.cpsReal,
    ing,
    vanosKg,
    factor: yieldBook.factorReal ?? yieldBook.factorPlanW,
  });
  const sheet = buildCostSheet({
    sessions,
    costs,
    kg,
    pay,
    alim,
    hrs,
    otherCosts,
    costoCosecha,
    costoTotal,
    cpsKg: cargaBook.denomKg,
    cpsFuente: yieldBook.cpsReal != null ? "bodega" : "estimado",
    cargas: cargaBook.denomCargas,
    factor: yieldBook.factorReal ?? yieldBook.factorPlanW,
    lots,
    ha,
  });
  return {
    kg,
    pay,
    alim,
    hrs,
    cps,
    factor,
    costoCosecha,
    otherCosts,
    costoTotal,
    ing,
    cobrado,
    kgVenta,
    kgCpsVendido,
    paid,
    pendMO,
    cartera,
    margen,
    unitCereza: kg ? costoCosecha / kg : 0,
    unitCps: cps ? costoCosecha / cps : 0,
    kgh: hrs ? kg / hrs : 0,
    nSess: sessions.length,
    nVen: sales.length,
    inProcess,
    byLot,
    workers: [...workers.values()].sort((a, b) => b.kg - a.kg),
    byDay: [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([fecha, v]) => ({ fecha, ...v })),
    lotMeta: Object.fromEntries(active.map((l) => [l.code, l])),
    yieldBook,
    mermaBook,
    cargaBook,
    sheet,
    pnl: buildLotPnl(sheet, sales, batches, lots),
  };
}

export function sessionsOn(sessions: FarmState["sessions"], fecha: string) {
  return sessions.filter((s) => s.fecha === fecha);
}

export function lotLabel(code: LotCode | string, lots?: FarmLot[]) {
  const L = (lots?.length ? lots : DEFAULT_LOTS).find((l) => l.code === code);
  return L ? `${L.code} ${L.nombre}` : code;
}

const CATS: CostLine["categoria"][] = [
  "fertilizacion",
  "arvenses",
  "renovacion",
  "indirecto",
  "otro",
];

export type CostSheetLine = {
  id: string;
  label: string;
  formula: string;
  value: number;
  hint?: string;
};

export type LotCostRow = {
  code: LotCode;
  ha: number;
  kg: number;
  cosecha: number;
  otrosDir: number;
  otrosPr: number;
  total: number;
  porKg: number;
  porCarga: number;
  share: number;
};

export type CostSheet = {
  mo: number;
  alim: number;
  cosecha: number;
  otros: number;
  otrosDir: number;
  otrosPr: number;
  otrosByCat: Record<CostLine["categoria"], number>;
  total: number;
  kg: number;
  cpsKg: number;
  cpsFuente: "bodega" | "estimado";
  cargas: number;
  arrobas: number;
  ha: number;
  jornadas: number;
  horas: number;
  factor: number;
  unit: {
    moKg: number;
    alimKg: number;
    cosechaKg: number;
    totalKg: number;
    cosechaCps: number;
    totalCps: number;
    totalCarga: number;
    totalArroba: number;
    totalHa: number;
    alimJornada: number;
    moHora: number;
  };
  byLot: LotCostRow[];
  lines: CostSheetLine[];
};

function buildCostSheet(input: {
  sessions: FarmState["sessions"];
  costs: CostLine[];
  kg: number;
  pay: number;
  alim: number;
  hrs: number;
  otherCosts: number;
  costoCosecha: number;
  costoTotal: number;
  cpsKg: number;
  cpsFuente: "bodega" | "estimado";
  cargas: number;
  factor: number;
  lots: FarmLot[];
  ha: number;
}): CostSheet {
  const jornadas = input.sessions.reduce(
    (a, s) => a + s.trabajadores.filter((w) => w.nombre.trim()).length,
    0,
  );
  const otrosByCat = Object.fromEntries(CATS.map((c) => [c, 0])) as Record<
    CostLine["categoria"],
    number
  >;
  const codes = harvestLots(input.lots).map((l) => l.code);
  const otrosDir: Record<string, number> = {};
  for (const c of codes) otrosDir[c] = 0;
  let otrosPr = 0;
  for (const c of input.costs) {
    otrosByCat[c.categoria] += c.monto;
    const lot = c.lote ? rollupCode(input.lots, c.lote) : "";
    if (lot && codes.includes(lot)) {
      otrosDir[lot] = (otrosDir[lot] || 0) + c.monto;
    } else {
      otrosPr += c.monto;
    }
  }
  const kgLots = codes.reduce((a, code) => {
    const kg = input.sessions
      .filter((s) => rollupCode(input.lots, s.lote) === code)
      .reduce((x, s) => x + s.totKg, 0);
    return a + kg;
  }, 0);
  const haFarm = input.ha || AREA_FINCA_HA;
  const byLot: LotCostRow[] = harvestLots(input.lots).map((L) => {
    const code = L.code;
    const ss = input.sessions.filter((s) => rollupCode(input.lots, s.lote) === code);
    const kg = ss.reduce((a, s) => a + s.totKg, 0);
    const cosecha = ss.reduce((a, s) => a + s.totCost, 0);
    const share =
      kgLots > 0 ? kg / kgLots : haFarm ? L.areaHa / haFarm : 0;
    const pr = otrosPr * share;
    const dir = otrosDir[code] || 0;
    const total = cosecha + dir + pr;
    const cpsEst = input.factor > 0 ? kg / input.factor : 0;
    const cargas = cpsEst / CARGA_KG;
    return {
      code,
      ha: L.areaHa,
      kg,
      cosecha,
      otrosDir: dir,
      otrosPr: pr,
      total,
      porKg: kg ? total / kg : 0,
      porCarga: cargas ? total / cargas : 0,
      share,
    };
  });
  const div = (n: number, d: number) => (d > 0 ? n / d : 0);
  const unit = {
    moKg: div(input.pay, input.kg),
    alimKg: div(input.alim, input.kg),
    cosechaKg: div(input.costoCosecha, input.kg),
    totalKg: div(input.costoTotal, input.kg),
    cosechaCps: div(input.costoCosecha, input.cpsKg),
    totalCps: div(input.costoTotal, input.cpsKg),
    totalCarga: div(input.costoTotal, input.cargas),
    totalArroba: div(input.costoTotal, input.cpsKg / ARROBA_KG),
    totalHa: div(input.costoTotal, haFarm),
    alimJornada: div(input.alim, jornadas),
    moHora: div(input.pay, input.hrs),
  };
  const lines: CostSheetLine[] = [
    {
      id: "mo",
      label: "Mano de obra",
      formula: "Σ pago recolector  ·  por kg: redondeo(kg × $/kg)  ·  jornal: tarifa fija",
      value: input.pay,
      hint: "Devengado. No es caja hasta liquidar.",
    },
    {
      id: "alim",
      label: "Alimentación",
      formula: "alim/persona × n recolectores de la sesión",
      value: input.alim,
      hint: "Gasto a quien cocina. No entra en el neto del trabajador.",
    },
    {
      id: "cosecha",
      label: "Costo de cosecha",
      formula: "M.O. + alimentación",
      value: input.costoCosecha,
    },
    {
      id: "otros",
      label: "Gastos de finca",
      formula: "Σ fertilización + arvenses + renovación + indirectos + otros",
      value: input.otherCosts,
      hint: "Asignados al lote si se indicó; si no, se prorratean por kg.",
    },
    {
      id: "total",
      label: "Costo total",
      formula: "Cosecha + gastos de finca",
      value: input.costoTotal,
    },
    {
      id: "cps",
      label: `Kg CPS (${input.cpsFuente})`,
      formula:
        input.cpsFuente === "bodega"
          ? "Σ kg pergamino pesado en bodega"
          : "Σ (kg cereza ÷ factor de la sesión)",
      value: input.cpsKg,
    },
    {
      id: "carga",
      label: "$ / carga FNC",
      formula: `costo total ÷ (kg CPS ÷ ${CARGA_KG})`,
      value: unit.totalCarga,
    },
  ];
  return {
    mo: input.pay,
    alim: input.alim,
    cosecha: input.costoCosecha,
    otros: input.otherCosts,
    otrosDir: codes.reduce((a, c) => a + (otrosDir[c] || 0), 0),
    otrosPr,
    otrosByCat,
    total: input.costoTotal,
    kg: input.kg,
    cpsKg: input.cpsKg,
    cpsFuente: input.cpsFuente,
    cargas: input.cargas,
    arrobas: input.cpsKg / ARROBA_KG,
    ha: haFarm,
    jornadas,
    horas: input.hrs,
    factor: input.factor,
    unit,
    byLot,
    lines,
  };
}

export type LotPnl = {
  code: LotCode;
  kg: number;
  costo: number;
  ingDir: number;
  ingPr: number;
  ing: number;
  margen: number;
  margenPct: number | null;
  margenKg: number;
  margenCarga: number;
  share: number;
};

function saleLot(
  s: Sale,
  batches: ProcessBatch[],
): LotCode | "" {
  if (s.batchId) {
    const b = batches.find((x) => x.id === s.batchId);
    if (b?.lote) return b.lote;
  }
  return s.lote || "";
}

function buildLotPnl(
  sheet: CostSheet,
  sales: Sale[],
  batches: ProcessBatch[],
  lots: FarmLot[],
): LotPnl[] {
  const codes = harvestLots(lots).map((l) => l.code);
  const ingDir: Record<string, number> = {};
  for (const c of codes) ingDir[c] = 0;
  let ingPr = 0;
  for (const s of sales) {
    const lot = saleLot(s, batches);
    const key = lot ? rollupCode(lots, lot) : "";
    if (key && codes.includes(key)) {
      ingDir[key] += s.total;
    } else {
      ingPr += s.total;
    }
  }
  return sheet.byLot.map((r) => {
    const dir = ingDir[r.code] || 0;
    const pr = ingPr * r.share;
    const ing = dir + pr;
    const margen = ing - r.total;
    const cargas = r.porCarga > 0 && r.total > 0 ? r.total / r.porCarga : 0;
    return {
      code: r.code,
      kg: r.kg,
      costo: r.total,
      ingDir: dir,
      ingPr: pr,
      ing,
      margen,
      margenPct: ing > 0 ? (margen / ing) * 100 : null,
      margenKg: r.kg ? margen / r.kg : 0,
      margenCarga: cargas ? margen / cargas : 0,
      share: r.share,
    };
  });
}

