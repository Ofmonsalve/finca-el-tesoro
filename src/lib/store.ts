import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { uid } from "./utils";
import { n } from "./format";
import { nextLotCode, type FarmLot, type LotCode } from "./lots";
import {
  createEmptyFarmBook,
  createActiveFarmPersistStorage,
  cloneDemoLots,
  lotsFromImport,
  mergeLotsFromPersist,
  shouldOfferDemoLots,
  setActivePersistFarmId,
  readFarmBookFromStorage,
  writeFarmBookToStorage,
  type PersistedFarmBookSlice,
} from "./farm-book-init";
import { FARM_ID } from "./roles";
import { PAY_METHODS, nextPendingStage, type StageId } from "./process";
import type {
  CostLine,
  HarvestSession,
  HarvestType,
  JournalEntry,
  Liquidation,
  FarmPerson,
  LotCultivo,
  LotLabor,
  LotNutrition,
  LotPlant,
  PayModel,
  ProcessBatch,
  ProcessEvent,
  Sale,
  Settings,
  WorkerRow,
} from "./types";
import {
  plantsForLot,
  plantStandCount,
  upsertById,
  upsertCultivoForLot,
} from "./lot-ops";
import { upsertPersona } from "./talento";
import {
  computeSessionWorkers,
  computeWorker as computeWorkerPayroll,
  jornalClaimedOnDate,
  sessionDay,
} from "./payroll";
import { resolveStageKgOut } from "./beneficio-weigh";
import { withFarmTag } from "./cosecha-hub";

export {
  aggregateWorkerEarnings,
  computeWorkerPago,
  jornalClaimedOnDate,
  qualifiesForJornal,
  totalPayCapped,
  workerKey,
} from "./payroll";

/** Persist name is a stable label; real keys are ft-book-v2-${farmId}. */
const SK = "ft-book-active";
const emptyBook = createEmptyFarmBook(FARM_ID);
setActivePersistFarmId(FARM_ID);

export type FarmState = {
  hydrated: boolean;
  /** Active farm identity (single farm for now; storage is keyed by this). */
  farmId: string;
  settings: Settings;
  sessions: HarvestSession[];
  batches: ProcessBatch[];
  liquidations: Liquidation[];
  sales: Sale[];
  costs: CostLine[];
  journals: JournalEntry[];
  lots: FarmLot[];
  labores: LotLabor[];
  nutrition: LotNutrition[];
  cultivos: LotCultivo[];
  personas: FarmPerson[];
  plantas: LotPlant[];
  setHydrated: (v: boolean) => void;
  updateSettings: (p: Partial<Settings>) => void;
  saveLot: (lot: FarmLot) => { ok: boolean; error?: string };
  removeLot: (code: string) => { ok: boolean; error?: string };
  setLotStatus: (code: string, status: FarmLot["status"]) => { ok: boolean; error?: string };
  unifyLots: (codes: string[], nombre: string) => { ok: boolean; error?: string; code?: string };
  dissolveUnion: (code: string) => { ok: boolean; error?: string };
  saveSession: (s: HarvestSession) => void;
  deleteSession: (id: string) => string | null;
  undoStage: (batchId: string) => void;
  completeStage: (
    batchId: string,
    payload: {
      stage: StageId;
      skipped: boolean;
      /** Raw kg text from the form; empty must not fall back on weigh stages. */
      kgOutRaw: string;
      notas: string;
      responsable: string;
      estimated?: boolean;
    },
  ) => { ok: boolean; error?: string; warning?: string };
  saveLiquidation: (l: Liquidation) => void;
  saveSale: (s: Sale) => { ok: boolean; error?: string };
  saveCost: (c: CostLine) => void;
  saveLabor: (l: LotLabor) => void;
  saveNutrition: (n: LotNutrition) => void;
  saveCultivo: (c: LotCultivo) => void;
  savePersona: (p: FarmPerson) => void;
  savePlant: (p: LotPlant) => void;
  savePlantsBatch: (rows: LotPlant[]) => void;
  saveJournal: (j: JournalEntry) => void;
  importBook: (data: unknown) => { ok: boolean; error?: string };
  exportBook: () => Record<string, unknown>;
  wipeHarvest: () => void;
  /** Explicit opt-in: load El Tesoro demo lots (only if catalog empty, unless force). */
  loadDemoLots: (opts?: { force?: boolean }) => { ok: boolean; error?: string };
  /**
   * Switch active farm book: flush current blob, load target (empty if new).
   * Does not inject demo lots.
   */
  switchFarm: (
    farmId: string,
    opts?: { flush?: boolean },
  ) => { ok: boolean; error?: string };
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

function newBatchFromSession(s: HarvestSession, farmId: string): ProcessBatch {
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
  return withFarmTag(
    {
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
      farmId: s.farmId,
    },
    farmId || s.farmId || "",
  );
}

export const useFarm = create<FarmState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      farmId: emptyBook.farmId,
      settings: { ...emptyBook.settings },
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
      personas: [],
      plantas: [],
      setHydrated: (v) => set({ hydrated: v }),
      updateSettings: (p) => set({ settings: { ...get().settings, ...p } }),
      saveLot: (lot) => {
        const lots = get().lots;
        const code = lot.code.trim().toUpperCase();
        if (!code || !lot.nombre.trim()) {
          return { ok: false, error: "Indique código y nombre." };
        }
        const row: FarmLot = {
          ...lot,
          id: lot.id || code,
          code,
          nombre: lot.nombre.trim(),
          bloques: lot.bloques.map((b) => b.trim()).filter(Boolean),
          areaHa: n(lot.areaHa),
        };
        if (!row.bloques.length) row.bloques = ["General"];
        const i = lots.findIndex((l) => l.code === code || l.id === row.id);
        set({
          lots: i >= 0 ? lots.map((l, k) => (k === i ? { ...l, ...row } : l)) : [...lots, row],
        });
        return { ok: true };
      },
      removeLot: (code) => {
        const used = get().sessions.some((s) => s.lote === code);
        if (used) {
          return { ok: false, error: "Tiene cosecha. Desactívelo, no lo borre." };
        }
        const lots = get().lots.filter((l) => l.code !== code);
        if (lots.length === get().lots.length) {
          return { ok: false, error: "No existe ese lote." };
        }
        set({ lots });
        return { ok: true };
      },
      setLotStatus: (code, status) => {
        const lots = get().lots;
        const L = lots.find((l) => l.code === code);
        if (!L) return { ok: false, error: "No existe ese lote." };
        if (L.status === "unificado" && status === "activo") {
          return { ok: false, error: "Disuelva la unificación primero." };
        }
        set({
          lots: lots.map((l) =>
            l.code === code ? { ...l, status, unifiedInto: status === "activo" ? null : l.unifiedInto } : l,
          ),
        });
        return { ok: true };
      },
      unifyLots: (codes, nombre) => {
        const lots = get().lots;
        const pick = [...new Set(codes)].filter(Boolean);
        if (pick.length < 2) return { ok: false, error: "Unifique al menos dos lotes activos." };
        const src = pick.map((c) => lots.find((l) => l.code === c)).filter(Boolean) as FarmLot[];
        if (src.length !== pick.length) return { ok: false, error: "Hay un código que no existe." };
        if (src.some((l) => l.status !== "activo")) {
          return { ok: false, error: "Solo se unifican lotes activos." };
        }
        const name = nombre.trim();
        if (!name) return { ok: false, error: "Indique el nombre de la unidad." };
        const code = nextLotCode(lots, name);
        const maxP = Math.max(...lots.map((l) => l.harvestPriority), 0);
        const nuevo: FarmLot = {
          id: code,
          code,
          nombre: name,
          rol: "Unidad unificada",
          accion: "Operar como un solo lote",
          estado: `Une ${src.map((l) => l.code).join(", ")}`,
          areaHa: src.reduce((a, l) => a + l.areaHa, 0),
          bloques: src.flatMap((l) => l.bloques.map((b) => `${l.code}-${b}`)),
          harvestPriority: maxP + 1,
          status: "activo",
          unifiedInto: null,
          variedad: src.map((l) => l.variedad).filter(Boolean)[0] || "Caturra / Castillo",
        };
        set({
          lots: [
            ...lots.map((l) =>
              pick.includes(l.code)
                ? { ...l, status: "unificado" as const, unifiedInto: code }
                : l,
            ),
            nuevo,
          ],
        });
        return { ok: true, code };
      },
      dissolveUnion: (code) => {
        const lots = get().lots;
        const parent = lots.find((l) => l.code === code);
        if (!parent) return { ok: false, error: "No existe esa unidad." };
        const children = lots.filter((l) => l.unifiedInto === code);
        if (!children.length) return { ok: false, error: "No tiene lotes unidos." };
        set({
          lots: lots.map((l) => {
            if (l.unifiedInto === code) {
              return { ...l, status: "activo" as const, unifiedInto: null };
            }
            if (l.code === code) {
              return { ...l, status: "inactivo" as const };
            }
            return l;
          }),
        });
        return { ok: true };
      },
      saveSession: (s) => {
        const farmId = get().farmId;
        const tagged = withFarmTag(s, farmId);
        const prev = get().sessions;
        const i = prev.findIndex((x) => x.id === tagged.id);
        const sessions =
          i >= 0
            ? prev.map((x, k) => (k === i ? tagged : x))
            : [tagged, ...prev];
        const journals = get()
          .journals.filter((j) => !(j.origen === "cosecha" && j.origenId === tagged.id))
          .concat(journalFromHarvest(tagged));
        const bi = get().batches.findIndex((b) => b.sessionId === tagged.id);
        let batches = get().batches;
        if (bi >= 0) {
          batches = batches.map((b, k) => {
            if (k !== bi) return b;
            const weighed = b.events.length > 0;
            return withFarmTag(
              {
                ...b,
                kgCereza: tagged.totKg,
                code: tagged.code,
                fecha: tagged.fecha,
                lote: tagged.lote,
                factor: tagged.factor,
                kgActual: weighed ? b.kgActual : tagged.totKg,
              },
              farmId,
            );
          });
        } else {
          batches = [newBatchFromSession(tagged, farmId), ...batches];
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
        const batch = get().batches.find((b) => b.id === batchId);
        if (!batch) return { ok: false, error: "Lote de beneficio no encontrado." };

        const resolved = resolveStageKgOut({
          stage: payload.stage,
          skipped: payload.skipped,
          kgOutRaw: payload.kgOutRaw,
          kgCereza: batch.kgCereza,
          kgActual: batch.kgActual,
          factor: batch.factor,
          estimated: payload.estimated,
        });
        if (!resolved.ok) {
          return { ok: false, error: resolved.message };
        }

        let notas = payload.notas;
        if (resolved.estimated) {
          const tag = "estimado=plan";
          notas = notas ? `${notas} · ${tag}` : tag;
        }
        if (resolved.deviationWarn && resolved.message) {
          const tag = `alerta-desviación ${resolved.deviationPct}%`;
          notas = notas ? `${notas} · ${tag}` : tag;
        }

        const batches = get().batches.map((b) => {
          if (b.id !== batchId) return b;
          const ev: ProcessEvent = {
            id: uid("ev"),
            stage: payload.stage,
            skipped: payload.skipped,
            at: new Date().toISOString(),
            kgIn: b.kgActual,
            kgOut: resolved.kgOut,
            notas,
            responsable: payload.responsable,
            estimated: resolved.estimated || undefined,
          };
          return {
            ...b,
            events: [...b.events, ev],
            kgActual: ev.kgOut,
          };
        });
        set({ batches });
        return {
          ok: true,
          warning: resolved.deviationWarn ? resolved.message : undefined,
        };
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
      saveLabor: (l) => {
        set({ labores: upsertById(get().labores, l) });
      },
      saveNutrition: (row) => {
        set({ nutrition: upsertById(get().nutrition, row) });
      },
      saveCultivo: (row) => {
        set({ cultivos: upsertCultivoForLot(get().cultivos, row) });
      },
      savePersona: (row) => {
        set({ personas: upsertPersona(get().personas ?? [], row) });
      },
      savePlant: (row) => {
        const plantas = upsertById(get().plantas ?? [], row);
        const next: Partial<FarmState> = { plantas };
        const design = (get().cultivos ?? []).find(
          (c) => c.farmId === row.farmId && c.lote === row.lote,
        );
        if (design) {
          const stand = plantsForLot(plantas, row.lote, { farmId: row.farmId });
          const count = plantStandCount(stand);
          next.cultivos = upsertCultivoForLot(get().cultivos, {
            ...design,
            plantasApprox: count,
            updatedAt: new Date().toISOString(),
          });
        }
        set(next);
      },
      savePlantsBatch: (rows) => {
        if (!rows.length) return;
        let plantas = get().plantas ?? [];
        for (const row of rows) {
          plantas = upsertById(plantas, row);
        }
        const next: Partial<FarmState> = { plantas };
        const sample = rows[0];
        const design = (get().cultivos ?? []).find(
          (c) => c.farmId === sample.farmId && c.lote === sample.lote,
        );
        if (design) {
          const stand = plantsForLot(plantas, sample.lote, {
            farmId: sample.farmId,
          });
          const count = plantStandCount(stand);
          next.cultivos = upsertCultivoForLot(get().cultivos, {
            ...design,
            plantasApprox: count,
            updatedAt: new Date().toISOString(),
          });
        }
        set(next);
      },
      saveJournal: (j) => set({ journals: [j, ...get().journals] }),
      exportBook: () => ({
        v: 1,
        farmId: get().farmId,
        exportedAt: new Date().toISOString(),
        settings: get().settings,
        sessions: get().sessions,
        batches: get().batches,
        liquidations: get().liquidations,
        sales: get().sales,
        costs: get().costs,
        journals: get().journals,
        lots: get().lots,
        labores: get().labores,
        nutrition: get().nutrition,
        cultivos: get().cultivos,
        personas: get().personas ?? [],
        plantas: get().plantas ?? [],
      }),
      importBook: (data) => {
        if (!data || typeof data !== "object") {
          return { ok: false, error: "Archivo inválido." };
        }
        const p = data as Partial<FarmState> & { v?: number; farmId?: string };
        if (!Array.isArray(p.sessions)) {
          return { ok: false, error: "El archivo no tiene sesiones de cosecha." };
        }
        set({
          farmId:
            typeof p.farmId === "string" && p.farmId.trim()
              ? p.farmId.trim()
              : get().farmId,
          settings: { ...defaultSettings, ...p.settings },
          sessions: p.sessions ?? [],
          batches: p.batches ?? [],
          liquidations: p.liquidations ?? [],
          sales: p.sales ?? [],
          costs: p.costs ?? [],
          journals: p.journals ?? [],
          lots: lotsFromImport(p.lots, get().lots),
          labores: Array.isArray(p.labores) ? p.labores : [],
          nutrition: Array.isArray(p.nutrition) ? p.nutrition : [],
          cultivos: Array.isArray(p.cultivos) ? p.cultivos : [],
          personas: Array.isArray(p.personas) ? p.personas : [],
          plantas: Array.isArray(p.plantas) ? p.plantas : [],
        });
        return { ok: true };
      },
      wipeHarvest: () =>
        set({
          sessions: [],
          batches: [],
          journals: get().journals.filter((j) => j.origen !== "cosecha"),
        }),
      loadDemoLots: (opts) => {
        const force = Boolean(opts?.force);
        if (!force && !shouldOfferDemoLots(get().lots)) {
          return {
            ok: false,
            error: "Ya hay lotes. Vacíe el catálogo o use force para reemplazar.",
          };
        }
        set({ lots: cloneDemoLots() });
        return { ok: true };
      },
      switchFarm: (farmId, opts) => {
        const id = (farmId || "").trim();
        if (!id) return { ok: false, error: "Finca inválida." };
        const current = get();
        if (id === current.farmId) {
          setActivePersistFarmId(id);
          return { ok: true };
        }

        const shouldFlush = opts?.flush !== false;
        if (shouldFlush) {
          const slice: PersistedFarmBookSlice = {
            farmId: current.farmId,
            settings: current.settings,
            sessions: current.sessions,
            batches: current.batches,
            liquidations: current.liquidations,
            sales: current.sales,
            costs: current.costs,
            journals: current.journals,
            lots: current.lots,
            labores: current.labores,
            nutrition: current.nutrition,
            cultivos: current.cultivos,
            personas: current.personas ?? [],
            plantas: current.plantas ?? [],
          };
          writeFarmBookToStorage(current.farmId, slice);
        }

        setActivePersistFarmId(id);
        const loaded = readFarmBookFromStorage(id);
        if (loaded) {
          set({
            farmId: id,
            settings: { ...defaultSettings, ...loaded.settings },
            sessions: (loaded.sessions as FarmState["sessions"]) ?? [],
            batches: (loaded.batches as FarmState["batches"]) ?? [],
            liquidations:
              (loaded.liquidations as FarmState["liquidations"]) ?? [],
            sales: ((loaded.sales as FarmState["sales"]) ?? []).map((s) => ({
              ...s,
              metodo: s.metodo ?? "efectivo",
              batchId: s.batchId ?? "",
            })),
            costs: (loaded.costs as FarmState["costs"]) ?? [],
            journals: (loaded.journals as FarmState["journals"]) ?? [],
            lots: mergeLotsFromPersist(loaded.lots, []),
            labores: (loaded.labores as FarmState["labores"]) ?? [],
            nutrition: (loaded.nutrition as FarmState["nutrition"]) ?? [],
            cultivos: (loaded.cultivos as FarmState["cultivos"]) ?? [],
            personas: (loaded.personas as FarmState["personas"]) ?? [],
            plantas: (loaded.plantas as FarmState["plantas"]) ?? [],
          });
        } else {
          const empty = createEmptyFarmBook(id);
          set({
            farmId: empty.farmId,
            settings: { ...empty.settings },
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
            personas: [],
            plantas: [],
          });
          writeFarmBookToStorage(id, {
            farmId: id,
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
            cultivos: [],
            personas: [],
            plantas: [],
          });
        }
        return { ok: true };
      },
    }),
    {
      name: SK,
      skipHydration: true,
      storage: createJSONStorage(() => createActiveFarmPersistStorage()),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<FarmState> & { farmId?: string };
        const sessions = p.sessions ?? current.sessions ?? [];
        let batches = p.batches ?? [];
        const resolvedFarmId =
          typeof p.farmId === "string" && p.farmId.trim()
            ? p.farmId.trim()
            : current.farmId || FARM_ID;
        if (!batches.length && sessions.length) {
          batches = sessions.map((s) =>
            withFarmTag(
              {
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
                farmId: s.farmId,
              },
              resolvedFarmId,
            ),
          );
        }
        return {
          ...current,
          farmId: resolvedFarmId,
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
          lots: mergeLotsFromPersist(p.lots, current.lots),
          labores: Array.isArray(p.labores) ? p.labores : current.labores ?? [],
          nutrition: Array.isArray(p.nutrition)
            ? p.nutrition
            : current.nutrition ?? [],
          cultivos: Array.isArray(p.cultivos)
            ? p.cultivos
            : current.cultivos ?? [],
          personas: Array.isArray(p.personas)
            ? p.personas
            : current.personas ?? [],
          plantas: Array.isArray(p.plantas)
            ? p.plantas
            : current.plantas ?? [],
        };
      },
      partialize: (s) => ({
        farmId: s.farmId,
        settings: s.settings,
        sessions: s.sessions,
        batches: s.batches,
        liquidations: s.liquidations,
        sales: s.sales,
        costs: s.costs,
        journals: s.journals,
        lots: s.lots,
        labores: s.labores,
        nutrition: s.nutrition,
        cultivos: s.cultivos,
        personas: s.personas ?? [],
        plantas: s.plantas ?? [],
      }),
    },
  ),
);

export function computeWorker(
  row: Pick<WorkerRow, "nombre" | "hi" | "hf" | "kg"> & { id?: string },
  modelo: PayModel,
  valorKg: number,
  jornal: number,
  alim: number,
  jornalAlreadyEarnedToday = false,
): WorkerRow {
  return computeWorkerPayroll(
    row,
    modelo,
    valorKg,
    jornal,
    alim,
    jornalAlreadyEarnedToday,
  );
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
  trabajadores: Array<Pick<WorkerRow, "nombre" | "hi" | "hf" | "kg"> & { id?: string }>;
  /** Prior sessions used to enforce ≤1 jornal / worker / day (America/Bogota fecha). */
  priorSessions?: HarvestSession[];
}): HarvestSession {
  const day = sessionDay(input.fecha);
  const claimed = jornalClaimedOnDate(
    input.priorSessions ?? [],
    day,
    input.id,
  );
  const trabajadores = computeSessionWorkers(
    input.trabajadores,
    input.modelo,
    input.valorKg,
    input.jornal,
    input.alimUnit,
    claimed,
    day,
  );
  const totKg = trabajadores.reduce((a, w) => a + w.kg, 0);
  const totPay = trabajadores.reduce((a, w) => a + w.pago, 0);
  const totHrs = trabajadores.reduce((a, w) => a + w.horas, 0);
  const totAlim = trabajadores.reduce((a, w) => a + w.alim, 0);
  const code =
    input.code ||
    `${input.lote}-${day.replace(/-/g, "")}-P${input.pasada}-${String(Date.now()).slice(-4)}`;
  return {
    id: input.id || uid("ses"),
    code,
    fecha: day,
    lote: input.lote,
    bloque: input.bloque || "General",
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
