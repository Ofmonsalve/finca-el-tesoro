import { create } from "zustand";
import { persist } from "zustand/middleware";
import { hoursBetween, uid } from "./utils";
import { n } from "./format";
import { LOTS, type LotCode } from "./lots";
import { PAY_METHODS, nextPendingStage, type StageId } from "./process";
import type {
  CostLine,
  HarvestSession,
  HarvestType,
  JournalEntry,
  Liquidation,
  PayModel,
  ProcessBatch,
  ProcessEvent,
  Sale,
  Settings,
  WorkerRow,
} from "./types";

const SK = "ft-tesoro-v1";

export type FarmState = {
  hydrated: boolean;
  settings: Settings;
  sessions: HarvestSession[];
  batches: ProcessBatch[];
  liquidations: Liquidation[];
  sales: Sale[];
  costs: CostLine[];
  journals: JournalEntry[];
  setHydrated: (v: boolean) => void;
  updateSettings: (p: Partial<Settings>) => void;
  saveSession: (s: HarvestSession) => void;
  deleteSession: (id: string) => string | null;
  undoStage: (batchId: string) => void;
  completeStage: (
    batchId: string,
    payload: {
      stage: StageId;
      skipped: boolean;
      kgOut: number;
      notas: string;
      responsable: string;
    },
  ) => void;
  saveLiquidation: (l: Liquidation) => void;
  saveSale: (s: Sale) => { ok: boolean; error?: string };
  saveCost: (c: CostLine) => void;
  saveJournal: (j: JournalEntry) => void;
  importBook: (data: unknown) => { ok: boolean; error?: string };
  exportBook: () => Record<string, unknown>;
  wipeHarvest: () => void;
};

const defaultSettings: Settings = {
  valorKg: 1200,
  jornal: 60000,
  alim: 8000,
  factor: 6,
  responsable: "",
};

function journalFromHarvest(s: HarvestSession): JournalEntry {
  return {
    id: uid("as"),
    fecha: s.fecha,
    origen: "cosecha",
    origenId: s.id,
    glosa: `Cosecha ${s.code} · ${s.lote} · ${s.totKg.toFixed(1)} kg cereza`,
    lineas: [
      { cuenta: "5105", nombre: "Mano de obra cosecha", debe: s.totPay, haber: 0 },
      { cuenta: "5195", nombre: "Alimentación recolectores", debe: s.totAlim, haber: 0 },
      { cuenta: "2505", nombre: "Cuentas por pagar trabajadores", debe: 0, haber: s.totPay },
      { cuenta: "2205", nombre: "Cuentas por pagar alimentación", debe: 0, haber: s.totAlim },
    ].filter((l) => l.debe + l.haber > 0),
  };
}

function journalFromLiq(l: Liquidation): JournalEntry {
  return {
    id: uid("as"),
    fecha: l.fecha,
    origen: "liquidacion",
    origenId: l.id,
    glosa: `Pago ${l.tipo} · ${l.trabajador}`,
    lineas: [
      { cuenta: "2505", nombre: "Cuentas por pagar trabajadores", debe: l.monto, haber: 0 },
      { cuenta: "1105", nombre: "Caja", debe: 0, haber: l.monto },
    ],
  };
}

function journalFromSale(s: Sale): JournalEntry {
  const method = PAY_METHODS.find((m) => m.id === s.metodo) ?? PAY_METHODS[0];
  const cobrado = s.cobrado;
  const cartera = Math.max(0, s.total - s.cobrado);
  const lineas = [
    cobrado > 0
      ? { cuenta: method.cuenta, nombre: method.nombre, debe: cobrado, haber: 0 }
      : null,
    cartera > 0
      ? { cuenta: "1305", nombre: "Clientes", debe: cartera, haber: 0 }
      : null,
    { cuenta: "4135", nombre: "Ingresos café", debe: 0, haber: s.total },
  ].filter(Boolean) as JournalEntry["lineas"];
  return {
    id: uid("as"),
    fecha: s.fecha,
    origen: "venta",
    origenId: s.id,
    glosa: `Venta ${s.tipo} ${s.kg} kg · ${s.cliente} · ${method.label}`,
    lineas,
  };
}

function journalFromCost(c: CostLine): JournalEntry {
  return {
    id: uid("as"),
    fecha: c.fecha,
    origen: "costo",
    origenId: c.id,
    glosa: c.concepto,
    lineas: [
      { cuenta: "5140", nombre: `Gasto ${c.categoria}`, debe: c.monto, haber: 0 },
      { cuenta: "1105", nombre: "Caja", debe: 0, haber: c.monto },
    ],
  };
}

function newBatchFromSession(s: HarvestSession): ProcessBatch {
  const ev: ProcessEvent = {
    id: uid("ev"),
    stage: "tolva",
    skipped: false,
    at: new Date().toISOString(),
    kgIn: s.totKg,
    kgOut: s.totKg,
    notas: "Recepción al guardar la cosecha",
    responsable: s.responsable,
  };
  return {
    id: uid("lot"),
    sessionId: s.id,
    code: s.code,
    fecha: s.fecha,
    lote: s.lote,
    kgCereza: s.totKg,
    kgActual: s.totKg,
    factor: s.factor,
    events: [ev],
    saleId: null,
  };
}

export const useFarm = create<FarmState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      settings: defaultSettings,
      sessions: [],
      batches: [],
      liquidations: [],
      sales: [],
      costs: [],
      journals: [],
      setHydrated: (v) => set({ hydrated: v }),
      updateSettings: (p) => set({ settings: { ...get().settings, ...p } }),
      saveSession: (s) => {
        const prev = get().sessions;
        const i = prev.findIndex((x) => x.id === s.id);
        const sessions = i >= 0 ? prev.map((x, k) => (k === i ? s : x)) : [s, ...prev];
        const journals = get()
          .journals.filter((j) => !(j.origen === "cosecha" && j.origenId === s.id))
          .concat(journalFromHarvest(s));
        const bi = get().batches.findIndex((b) => b.sessionId === s.id);
        let batches = get().batches;
        if (bi >= 0) {
          batches = batches.map((b, k) => {
            if (k !== bi) return b;
            const weighed = b.events.length > 0;
            return {
              ...b,
              kgCereza: s.totKg,
              code: s.code,
              fecha: s.fecha,
              lote: s.lote,
              factor: s.factor,
              kgActual: weighed ? b.kgActual : s.totKg,
            };
          });
        } else {
          batches = [newBatchFromSession(s), ...batches];
        }
        set({ sessions, journals, batches });
      },
      deleteSession: (id) => {
        const batch = get().batches.find((b) => b.sessionId === id);
        if (batch && batch.events.length > 0) {
          return "El lote ya tiene etapas de beneficio pesadas. Edite la sesión; no se borra.";
        }
        set({
          sessions: get().sessions.filter((s) => s.id !== id),
          journals: get().journals.filter((j) => !(j.origen === "cosecha" && j.origenId === id)),
          batches: get().batches.filter((b) => b.sessionId !== id),
        });
        return null;
      },
      completeStage: (batchId, payload) => {
        const batches = get().batches.map((b) => {
          if (b.id !== batchId) return b;
          const ev: ProcessEvent = {
            id: uid("ev"),
            stage: payload.stage,
            skipped: payload.skipped,
            at: new Date().toISOString(),
            kgIn: b.kgActual,
            kgOut: payload.skipped ? b.kgActual : payload.kgOut,
            notas: payload.notas,
            responsable: payload.responsable,
          };
          return {
            ...b,
            events: [...b.events, ev],
            kgActual: ev.kgOut,
          };
        });
        set({ batches });
      },
      undoStage: (batchId) => {
        set({
          batches: get().batches.map((b) => {
            if (b.id !== batchId || !b.events.length) return b;
            const last = b.events[b.events.length - 1];
            if (last.stage === "venta") return b;
            const events = b.events.slice(0, -1);
            return {
              ...b,
              events,
              kgActual: last.kgIn,
              saleId: last.stage === "despacho" ? null : b.saleId,
            };
          }),
        });
      },
      saveLiquidation: (l) => {
        set({
          liquidations: [l, ...get().liquidations],
          journals: [...get().journals, journalFromLiq(l)],
        });
      },
      saveSale: (s) => {
        let batches = get().batches;
        if (s.batchId) {
          const b = batches.find((x) => x.id === s.batchId);
          if (!b) return { ok: false, error: "Lote de beneficio no encontrado." };
          if (s.kg > b.kgActual + 0.05) {
            return {
              ok: false,
              error: `Solo hay ${b.kgActual.toFixed(1)} kg en el lote. No se puede vender ${s.kg.toFixed(1)} kg.`,
            };
          }
          const pending = nextPendingStage(b.events.map((e) => e.stage));
          const full = s.kg >= b.kgActual - 0.05;
          batches = batches.map((x) => {
            if (x.id !== s.batchId) return x;
            const extra: ProcessEvent[] = [];
            const done = new Set(x.events.map((e) => e.stage));
            if (full) {
              for (const st of ["despacho", "venta"] as StageId[]) {
                if (!done.has(st)) {
                  extra.push({
                    id: uid("ev"),
                    stage: st,
                    skipped: false,
                    at: new Date().toISOString(),
                    kgIn: x.kgActual,
                    kgOut: st === "venta" ? s.kg : x.kgActual,
                    notas: st === "venta" ? `Venta ${s.cliente}` : "Despacho a venta",
                    responsable: "",
                  });
                }
              }
            }
            return {
              ...x,
              events: [...x.events, ...extra],
              saleId: full ? s.id : x.saleId,
              kgActual: Math.max(0, Math.round((x.kgActual - s.kg) * 10) / 10),
            };
          });
          void pending;
        }
        set({
          sales: [s, ...get().sales],
          journals: [...get().journals, journalFromSale(s)],
          batches,
        });
        return { ok: true };
      },
      saveCost: (c) => {
        set({
          costs: [c, ...get().costs],
          journals: [...get().journals, journalFromCost(c)],
        });
      },
      saveJournal: (j) => set({ journals: [j, ...get().journals] }),
      exportBook: () => ({
        v: 1,
        exportedAt: new Date().toISOString(),
        settings: get().settings,
        sessions: get().sessions,
        batches: get().batches,
        liquidations: get().liquidations,
        sales: get().sales,
        costs: get().costs,
        journals: get().journals,
      }),
      importBook: (data) => {
        if (!data || typeof data !== "object") {
          return { ok: false, error: "Archivo inválido." };
        }
        const p = data as Partial<FarmState> & { v?: number };
        if (!Array.isArray(p.sessions)) {
          return { ok: false, error: "El archivo no tiene sesiones de cosecha." };
        }
        set({
          settings: { ...defaultSettings, ...p.settings },
          sessions: p.sessions ?? [],
          batches: p.batches ?? [],
          liquidations: p.liquidations ?? [],
          sales: p.sales ?? [],
          costs: p.costs ?? [],
          journals: p.journals ?? [],
        });
        return { ok: true };
      },
      wipeHarvest: () =>
        set({
          sessions: [],
          batches: [],
          journals: get().journals.filter((j) => j.origen !== "cosecha"),
        }),
    }),
    {
      name: SK,
      skipHydration: true,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<FarmState>;
        const sessions = p.sessions ?? current.sessions ?? [];
        let batches = p.batches ?? [];
        if (!batches.length && sessions.length) {
          batches = sessions.map((s) => ({
            id: `lot-${s.id}`,
            sessionId: s.id,
            code: s.code,
            fecha: s.fecha,
            lote: s.lote,
            kgCereza: s.totKg,
            kgActual: s.totKg,
            factor: s.factor,
            events: [],
            saleId: null as string | null,
          }));
        }
        return {
          ...current,
          settings: { ...defaultSettings, ...p.settings },
          sessions,
          batches,
          liquidations: p.liquidations ?? [],
          costs: p.costs ?? [],
          journals: p.journals ?? [],
          sales: (p.sales ?? []).map((s) => ({
            ...s,
            metodo: s.metodo ?? "efectivo",
            batchId: s.batchId ?? "",
          })),
        };
      },
      partialize: (s) => ({
        settings: s.settings,
        sessions: s.sessions,
        batches: s.batches,
        liquidations: s.liquidations,
        sales: s.sales,
        costs: s.costs,
        journals: s.journals,
      }),
    },
  ),
);

export function computeWorker(
  row: Pick<WorkerRow, "nombre" | "hi" | "hf" | "kg">,
  modelo: PayModel,
  valorKg: number,
  jornal: number,
  alim: number,
): WorkerRow {
  const horas = hoursBetween(row.hi, row.hf);
  const kg = n(row.kg);
  const tarifa = n(valorKg);
  const pago =
    modelo === "jornal" ? (kg > 0 || horas > 0 ? n(jornal) : 0) : Math.round(kg * tarifa);
  return {
    id: uid("w"),
    nombre: row.nombre.trim(),
    hi: row.hi,
    hf: row.hf,
    kg,
    horas,
    pago,
    alim: kg > 0 ? n(alim) : 0,
  };
}

export function buildSession(input: {
  id?: string;
  code?: string;
  fecha: string;
  lote: LotCode;
  bloque: string;
  tipo: HarvestType;
  pasada: number;
  modelo: PayModel;
  valorKg: number;
  jornal: number;
  alimUnit: number;
  factor: number;
  responsable: string;
  obs: string;
  trabajadores: WorkerRow[];
}): HarvestSession {
  const trabajadores = input.trabajadores.map((w) =>
    computeWorker(w, input.modelo, input.valorKg, input.jornal, input.alimUnit),
  );
  const totKg = trabajadores.reduce((a, w) => a + w.kg, 0);
  const totPay = trabajadores.reduce((a, w) => a + w.pago, 0);
  const totHrs = trabajadores.reduce((a, w) => a + w.horas, 0);
  const totAlim = trabajadores.reduce((a, w) => a + w.alim, 0);
  const code =
    input.code ||
    `${input.lote}-${input.fecha.replace(/-/g, "")}-P${input.pasada}-${String(Date.now()).slice(-4)}`;
  return {
    id: input.id || uid("ses"),
    code,
    fecha: input.fecha,
    lote: input.lote,
    bloque: input.bloque || LOTS[input.lote].bloques[0],
    tipo: input.tipo,
    pasada: input.pasada,
    modelo: input.modelo,
    valorKg: n(input.valorKg),
    jornal: n(input.jornal),
    alimUnit: n(input.alimUnit),
    factor: n(input.factor) || 6,
    responsable: input.responsable.trim(),
    obs: input.obs.trim(),
    trabajadores,
    totKg,
    totPay,
    totHrs,
    totAlim,
    totCost: totPay + totAlim,
  };
}
