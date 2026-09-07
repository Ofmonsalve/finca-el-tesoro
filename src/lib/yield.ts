import type { ProcessBatch, HarvestSession } from "./types";
import { PROCESS_STAGES, type StageId } from "./process";
import { harvestLots, rollupCode, DEFAULT_LOTS, type FarmLot, type LotCode } from "./lots";

/** 1 carga FNC de pergamino seco. */
export const CARGA_KG = 125;
/** 1 arroba = 12,5 kg. 10 arrobas = 1 carga. */
export const ARROBA_KG = 12.5;
/** Factor de campo por defecto (kg cereza / kg CPS). */
export const FACTOR_PLAN = 6;
/** Humedad objetivo del pergamino en bodega. */
export const HUMEDAD_OBJETIVO = 0.11;
/** Factor de trilla típico: kg CPS para obtener 70 kg de excelso. */
export const FACTOR_TRILLA = 88;
export const EXCELSO_BASE_KG = 70;
export const AREA_FINCA_HA = 0.87;

/**
 * Masa esperada como fracción de la cereza de entrada, por etapa.
 * Despulpado ~48 % pulpa; secado lleva a ~1/6 (factor 6).
 */
export const STAGE_LOSS: Record<
  StageId,
  {
    ofInputPct: number;
    nature: string;
    tipo: "nula" | "comercial" | "proceso";
    hint: string;
  }
> = {
  tolva: {
    ofInputPct: 0,
    nature: "Recepción",
    tipo: "nula",
    hint: "No debe haber merma. Si baja, hay derrame o error de pesaje.",
  },
  flotacion: {
    ofInputPct: 4,
    nature: "Vanos / pintón",
    tipo: "comercial",
    hint: "Café que no llega a pergamino. > 8 % alerta de madurez.",
  },
  fermentacion_aire: {
    ofInputPct: 0,
    nature: "Sin pérdida de masa",
    tipo: "nula",
    hint: "Etapa omissible. La masa se mantiene.",
  },
  despulpado: {
    ofInputPct: 46,
    nature: "Pulpa",
    tipo: "proceso",
    hint: "Pérdida esperada (~45–50 % de la cereza que entra).",
  },
  fermentacion_tanque: {
    ofInputPct: 4,
    nature: "Mucílago",
    tipo: "proceso",
    hint: "Omissible: si se salta, la merma se ve en el lavado.",
  },
  lavado: {
    ofInputPct: 4,
    nature: "Mucílago residual",
    tipo: "proceso",
    hint: "Retiro de mucílago. Merma baja y estable.",
  },
  secado: {
    ofInputPct: 65,
    nature: "Agua",
    tipo: "proceso",
    hint: "De ~50 % humedad a 10–12 %. Es el salto al factor 6:1.",
  },
  bodega: {
    ofInputPct: 0,
    nature: "Peso de cierre",
    tipo: "nula",
    hint: "Debe igualar el secado. Diferencia = merma de manejo.",
  },
  despacho: {
    ofInputPct: 0,
    nature: "Manejo",
    tipo: "nula",
    hint: "Pérdida solo por derrame o humedad mal cerrada.",
  },
  venta: {
    ofInputPct: 0,
    nature: "Documento",
    tipo: "nula",
    hint: "No hay merma física; cuadra kg vendidos vs despacho.",
  },
};

export type StageMerma = {
  stage: StageId;
  label: string;
  nature: string;
  tipo: "nula" | "comercial" | "proceso";
  nDone: number;
  nSkipped: number;
  kgIn: number;
  kgOut: number;
  mermaKg: number;
  mermaPct: number;
  expectedPct: number;
  expectedKg: number;
  deltaKg: number;
  status: "pendiente" | "omitida" | "ok" | "alta" | "baja";
  hint: string;
};

export function stageMermaBook(batches: ProcessBatch[]): StageMerma[] {
  return PROCESS_STAGES.map((st) => {
    const meta = STAGE_LOSS[st.id];
    const evs = batches.flatMap((b) => b.events.filter((e) => e.stage === st.id));
    const done = evs.filter((e) => !e.skipped);
    const skipped = evs.filter((e) => e.skipped);
    const kgIn = done.reduce((a, e) => a + e.kgIn, 0);
    const kgOut = done.reduce((a, e) => a + e.kgOut, 0);
    const mermaKg = kgIn - kgOut;
    const mermaPct = kgIn > 0 ? (mermaKg / kgIn) * 100 : 0;
    const expectedPct = meta.ofInputPct;
    const expectedKg = kgIn * (expectedPct / 100);
    const deltaKg = mermaKg - expectedKg;
    let status: StageMerma["status"] = "pendiente";
    if (!evs.length) status = "pendiente";
    else if (!done.length && skipped.length) status = "omitida";
    else if (meta.tipo === "nula") status = mermaPct > 1.5 ? "alta" : "ok";
    else if (expectedPct <= 0) status = mermaPct > 1.5 ? "alta" : "ok";
    else if (mermaPct > expectedPct * 1.35) status = "alta";
    else if (mermaPct < expectedPct * 0.55 && meta.tipo === "proceso")
      status = "baja";
    else status = "ok";
    return {
      stage: st.id,
      label: st.label,
      nature: meta.nature,
      tipo: meta.tipo,
      nDone: done.length,
      nSkipped: skipped.length,
      kgIn,
      kgOut,
      mermaKg,
      mermaPct,
      expectedPct,
      expectedKg,
      deltaKg,
      status,
      hint: meta.hint,
    };
  });
}

export type CargaCost = {
  cargasEst: number;
  cargasReal: number | null;
  denomCargas: number;
  denomKg: number;
  cosechaPorCarga: number;
  moPorCarga: number;
  alimPorCarga: number;
  otrosPorCarga: number;
  totalPorCarga: number;
  totalPorKgCps: number;
  totalPorArroba: number;
  cosechaPorKgCps: number;
  ingresoPorCarga: number;
  margenPorCarga: number;
  vanosKg: number;
  vanosCpsPerdido: number;
  costoVanos: number;
  mermaComercialKg: number;
};

export function cargaCost(input: {
  costoCosecha: number;
  pay: number;
  alim: number;
  otherCosts: number;
  costoTotal: number;
  kgCpsEst: number;
  kgCpsReal: number | null;
  ing: number;
  vanosKg: number;
  factor: number;
}): CargaCost {
  const denomKg =
    input.kgCpsReal != null && input.kgCpsReal > 0
      ? input.kgCpsReal
      : input.kgCpsEst;
  const cargasEst = cargas(input.kgCpsEst);
  const cargasReal =
    input.kgCpsReal != null ? cargas(input.kgCpsReal) : null;
  const denomCargas = cargas(denomKg);
  const per = (v: number) => (denomCargas > 0 ? v / denomCargas : 0);
  const factor = input.factor > 0 ? input.factor : FACTOR_PLAN;
  const vanosCpsPerdido = cpsEst(input.vanosKg, factor);
  const unitCps = denomKg > 0 ? input.costoTotal / denomKg : 0;
  return {
    cargasEst,
    cargasReal,
    denomCargas,
    denomKg,
    cosechaPorCarga: per(input.costoCosecha),
    moPorCarga: per(input.pay),
    alimPorCarga: per(input.alim),
    otrosPorCarga: per(input.otherCosts),
    totalPorCarga: per(input.costoTotal),
    totalPorKgCps: denomKg > 0 ? input.costoTotal / denomKg : 0,
    totalPorArroba: denomKg > 0 ? input.costoTotal / arrobas(denomKg) : 0,
    cosechaPorKgCps: denomKg > 0 ? input.costoCosecha / denomKg : 0,
    ingresoPorCarga: per(input.ing),
    margenPorCarga: per(input.ing - input.costoTotal),
    vanosKg: input.vanosKg,
    vanosCpsPerdido,
    costoVanos: vanosCpsPerdido * unitCps,
    mermaComercialKg: input.vanosKg,
  };
}

export const STAGE_RETAIN: Record<StageId, number> = {
  tolva: 1,
  flotacion: 0.96,
  fermentacion_aire: 0.96,
  despulpado: 0.52,
  fermentacion_tanque: 0.5,
  lavado: 0.48,
  secado: 1 / FACTOR_PLAN,
  bodega: 1 / FACTOR_PLAN,
  despacho: 1 / FACTOR_PLAN,
  venta: 1 / FACTOR_PLAN,
};

export type FactorBand = {
  max: number;
  label: string;
  tone: "ok" | "accent" | "warn" | "muted";
  hint: string;
};

export const FACTOR_BANDS: FactorBand[] = [
  {
    max: 5.2,
    label: "Excelente",
    tone: "ok",
    hint: "Cereza madura, pocos vanos, secado al 11 %",
  },
  {
    max: 5.6,
    label: "Muy bueno",
    tone: "ok",
    hint: "Por encima del promedio de Santander",
  },
  {
    max: 6.0,
    label: "Estándar",
    tone: "accent",
    hint: "Convenio de campo / FNC · 16,7 %",
  },
  {
    max: 6.5,
    label: "Regular",
    tone: "warn",
    hint: "Vanos, pintón o humedad residual",
  },
  {
    max: 99,
    label: "Deficiente",
    tone: "muted",
    hint: "Revisar madurez, flotación y secado",
  },
];

export function cpsEst(kgCereza: number, factor = FACTOR_PLAN) {
  const f = factor > 0 ? factor : FACTOR_PLAN;
  return kgCereza / f;
}

export function yieldPct(kgCereza: number, kgCps: number) {
  if (kgCereza <= 0) return 0;
  return (kgCps / kgCereza) * 100;
}

export function yieldPctFromFactor(factor: number) {
  return factor > 0 ? 100 / factor : 0;
}

export function factorFromMass(kgCereza: number, kgCps: number) {
  if (kgCps <= 0) return 0;
  return kgCereza / kgCps;
}

export function classifyFactor(factor: number): FactorBand {
  if (!factor || factor <= 0) return FACTOR_BANDS[2];
  return FACTOR_BANDS.find((b) => factor <= b.max) ?? FACTOR_BANDS[4];
}

export function cargas(kgCps: number) {
  return kgCps / CARGA_KG;
}

export function arrobas(kgCps: number) {
  return kgCps / ARROBA_KG;
}

/** Proyección de almendra excelso: 70 kg por cada 88 kg de CPS. */
export function excelsoEst(kgCps: number, factorTrilla = FACTOR_TRILLA) {
  return kgCps * (EXCELSO_BASE_KG / factorTrilla);
}

export function expectedAt(kgCereza: number, stage: StageId, factor = FACTOR_PLAN) {
  if (stage === "secado" || stage === "bodega" || stage === "despacho" || stage === "venta") {
    return cpsEst(kgCereza, factor);
  }
  return kgCereza * STAGE_RETAIN[stage];
}

export type BatchYield = {
  code: string;
  lote: LotCode;
  kgCereza: number;
  factorPlan: number;
  cpsEst: number;
  kgBodega: number | null;
  kgActual: number;
  lastStage: StageId | null;
  factorReal: number | null;
  rPctEst: number;
  rPctReal: number | null;
  deltaKg: number | null;
  deltaPct: number | null;
  mermaPct: number;
  cargasEst: number;
  band: FactorBand;
  stages: {
    stage: StageId;
    skipped: boolean;
    kgIn: number;
    kgOut: number;
    retainPct: number;
    expectedKg: number;
  }[];
};

export function batchYield(b: ProcessBatch): BatchYield {
  const factorPlan = b.factor > 0 ? b.factor : FACTOR_PLAN;
  const est = cpsEst(b.kgCereza, factorPlan);
  const bodega = b.events.find((e) => e.stage === "bodega" && !e.skipped);
  const kgBodega = bodega ? bodega.kgOut : null;
  const last = b.events.length ? b.events[b.events.length - 1] : null;
  const factorReal = kgBodega != null ? factorFromMass(b.kgCereza, kgBodega) : null;
  const rPctEst = yieldPctFromFactor(factorPlan);
  const rPctReal = kgBodega != null ? yieldPct(b.kgCereza, kgBodega) : null;
  const deltaKg = kgBodega != null ? kgBodega - est : null;
  const deltaPct =
    kgBodega != null && est > 0 ? ((kgBodega - est) / est) * 100 : null;
  const mermaPct = yieldPct(b.kgCereza, b.kgCereza - b.kgActual);
  const stages = b.events.map((e) => ({
    stage: e.stage,
    skipped: e.skipped,
    kgIn: e.kgIn,
    kgOut: e.kgOut,
    retainPct: e.kgIn > 0 ? (e.kgOut / e.kgIn) * 100 : 100,
    expectedKg: expectedAt(b.kgCereza, e.stage, factorPlan),
  }));
  return {
    code: b.code,
    lote: b.lote,
    kgCereza: b.kgCereza,
    factorPlan,
    cpsEst: est,
    kgBodega,
    kgActual: b.kgActual,
    lastStage: last?.stage ?? null,
    factorReal,
    rPctEst,
    rPctReal,
    deltaKg,
    deltaPct,
    mermaPct,
    cargasEst: cargas(est),
    band: classifyFactor(factorReal ?? factorPlan),
    stages,
  };
}

export type LotYield = {
  lote: LotCode;
  ha: number;
  kgCereza: number;
  cpsEst: number;
  cpsReal: number | null;
  factorPlanW: number;
  factorReal: number | null;
  rPct: number;
  kgHa: number;
  cpsHa: number;
  cargasHa: number;
  band: FactorBand;
};

export function farmYield(
  sessions: HarvestSession[],
  batches: ProcessBatch[],
  areaHa = AREA_FINCA_HA,
  lots: FarmLot[] = DEFAULT_LOTS,
) {
  const kgCereza = sessions.reduce((a, s) => a + s.totKg, 0);
  const cpsEstTot = sessions.reduce(
    (a, s) => a + cpsEst(s.totKg, s.factor || FACTOR_PLAN),
    0,
  );
  const factorPlanW = kgCereza > 0 ? kgCereza / (cpsEstTot || 1) : FACTOR_PLAN;
  const measured = batches
    .map(batchYield)
    .filter((x) => x.kgBodega != null) as (BatchYield & { kgBodega: number })[];
  const kgCerezaMedido = measured.reduce((a, x) => a + x.kgCereza, 0);
  const cpsReal = measured.length
    ? measured.reduce((a, x) => a + x.kgBodega, 0)
    : null;
  const factorReal =
    cpsReal != null && kgCerezaMedido > 0
      ? kgCerezaMedido / cpsReal
      : null;
  const rPct = yieldPctFromFactor(factorReal ?? factorPlanW);
  const byLot: LotYield[] = harvestLots(lots).map((L) => {
    const code = L.code;
    const ss = sessions.filter((s) => rollupCode(lots, s.lote) === code);
    const kg = ss.reduce((a, s) => a + s.totKg, 0);
    const est = ss.reduce((a, s) => a + cpsEst(s.totKg, s.factor || FACTOR_PLAN), 0);
    const bb = batches.filter((b) => rollupCode(lots, b.lote) === code).map(batchYield);
    const realParts = bb.filter((x) => x.kgBodega != null) as (BatchYield & {
      kgBodega: number;
    })[];
    const real = realParts.length
      ? realParts.reduce((a, x) => a + x.kgBodega, 0)
      : null;
    const kgMed = realParts.reduce((a, x) => a + x.kgCereza, 0);
    const fPlan = kg > 0 && est > 0 ? kg / est : FACTOR_PLAN;
    const fReal = real != null && kgMed > 0 ? kgMed / real : null;
    const ha = L.areaHa;
    const cpsUse = real ?? est;
    return {
      lote: code,
      ha,
      kgCereza: kg,
      cpsEst: est,
      cpsReal: real,
      factorPlanW: fPlan,
      factorReal: fReal,
      rPct: yieldPctFromFactor(fReal ?? fPlan),
      kgHa: ha ? kg / ha : 0,
      cpsHa: ha ? cpsUse / ha : 0,
      cargasHa: ha ? cargas(cpsUse) / ha : 0,
      band: classifyFactor(fReal ?? fPlan),
    };
  });
  return {
    kgCereza,
    cpsEst: cpsEstTot,
    cpsReal,
    factorPlanW,
    factorReal,
    rPct,
    rPctEst: yieldPctFromFactor(factorPlanW),
    rPctReal: factorReal != null ? yieldPctFromFactor(factorReal) : null,
    cargasEst: cargas(cpsEstTot),
    arrobasEst: arrobas(cpsEstTot),
    excelsoEst: excelsoEst(cpsEstTot),
    kgHa: areaHa ? kgCereza / areaHa : 0,
    cpsHa: areaHa ? cpsEstTot / areaHa : 0,
    cargasHa: areaHa ? cargas(cpsEstTot) / areaHa : 0,
    band: classifyFactor(factorReal ?? factorPlanW),
    byLot,
    batches: batches.map(batchYield),
    nMeasured: measured.length,
  };
}

export const FORMULAS = [
  {
    id: "factor",
    name: "Factor de conversión",
    latex: "F = kg cereza ÷ kg pergamino seco",
    detail:
      "Cuántos kilogramos de cereza se necesitan para un kilogramo de café pergamino seco (CPS) al 10–12 % de humedad. Menor factor = mejor rendimiento.",
  },
  {
    id: "rendimiento",
    name: "Rendimiento de beneficio",
    latex: "R % = (kg CPS ÷ kg cereza) × 100 = 100 ÷ F",
    detail:
      "Con factor 6, R = 16,67 %. Con factor 5,5, R = 18,18 %. Es el indicador que mueve el ingreso por kilo recolectado.",
  },
  {
    id: "estimado",
    name: "Pergamino estimado (campo)",
    latex: "kg CPS est. = kg cereza ÷ F plan",
    detail:
      "Se usa el factor de la sesión (por defecto 6:1) hasta que el lote llega a bodega y se pesa el CPS real.",
  },
  {
    id: "real",
    name: "Factor real (bodega)",
    latex: "F real = kg cereza ÷ kg bodega    Δ = F real − F plan",
    detail:
      "Cuando el beneficio registra pergamino en bodega, el factor deja de ser supuesto y pasa a medido. Δ negativo es ganancia de masa.",
  },
  {
    id: "agricola",
    name: "Rendimiento agrícola",
    latex: "kg/ha = kg cereza ÷ ha    cargas/ha = (kg CPS ÷ 125) ÷ ha",
    detail:
      "1 carga FNC = 125 kg de pergamino = 10 arrobas. Compara lotes de distinta área (Centro 0,28 ha vs Superior 0,07 ha).",
  },
  {
    id: "excelso",
    name: "Proyección a excelso (trilla)",
    latex: "kg excelso ≈ kg CPS × (70 ÷ 88)",
    detail:
      "La finca vende pergamino a la Federación. Esta línea estima almendra si se trillara con factor de trilla 88 (70 kg excelso por 88 kg CPS).",
  },
  {
    id: "merma",
    name: "Merma de etapa",
    latex: "Merma % = (1 − kg salida ÷ kg entrada) × 100",
    detail:
      "Flotación (vanos), despulpado (pulpa) y secado (agua) concentran la pérdida. Omitir una etapa no cambia la masa: kg salida = kg entrada.",
  },
  {
    id: "merma-costo",
    name: "Costo de merma comercial",
    latex: "kg vanos × (1 ÷ F) × ($ / kg CPS)",
    detail:
      "Solo la flotación destruye producto. Pulpa y agua son conversión, no pérdida económica. Δ merma vs plan en vanos se valora a costo de la carga.",
  },
  {
    id: "carga",
    name: "Costo por carga FNC",
    latex: "$ / carga = costo total ÷ (kg CPS ÷ 125)",
    detail:
      "La Federación liquida en cargas de 125 kg de pergamino. También: $ / arroba = costo × 12,5 ÷ kg CPS. Se usa CPS real de bodega; si aún no hay, el estimado.",
  },
] as const;
