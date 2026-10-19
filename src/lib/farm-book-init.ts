/**
 * Farm book initialization (P0 / F-11–F-12):
 * - Fresh installs start empty (no demo lots / harvests).
 * - Demo El Tesoro lots only via explicit loadDemoLots / cloneDemoLots.
 * - Storage keyed by farmId so a future second farm does not share the blob.
 * - Legacy key `ft-tesoro-v1` migrates in place without wiping real data.
 */
import { FARM_ID } from "./roles";
import { DEMO_LOTS, type FarmLot } from "./lots";
import type { Settings } from "./types";

/** Legacy Zustand persist key (pre farmId scoping). */
export const LEGACY_STORAGE_KEY = "ft-tesoro-v1";

/** Persist schema version baked into the storage key. */
export const FARM_BOOK_STORAGE_VERSION = 2;

export type EmptyFarmBook = {
  farmId: string;
  settings: Settings;
  sessions: [];
  batches: [];
  liquidations: [];
  sales: [];
  costs: [];
  journals: [];
  lots: FarmLot[];
  labores: [];
  nutrition: [];
  cultivos: [];
  personas: [];
  plantas: [];
};

export const EMPTY_SETTINGS: Settings = {
  valorKg: 1200,
  jornal: 60000,
  alim: 8000,
  factor: 6,
  responsable: "",
};

/** localStorage key for a farm's book blob. */
export function storageKeyForFarm(
  farmId: string = FARM_ID,
  version: number = FARM_BOOK_STORAGE_VERSION,
): string {
  const id = (farmId || FARM_ID).trim() || FARM_ID;
  return `ft-book-v${version}-${id}`;
}

/** Empty productive book for a farm (structure only — no fake lots/harvests). */
export function createEmptyFarmBook(farmId: string = FARM_ID): EmptyFarmBook {
  return {
    farmId: (farmId || FARM_ID).trim() || FARM_ID,
    settings: { ...EMPTY_SETTINGS },
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
  };
}

/** Deep-ish clone of demo lots for explicit “cargar demo”. */
export function cloneDemoLots(): FarmLot[] {
  return DEMO_LOTS.map((l) => ({
    ...l,
    bloques: [...l.bloques],
  }));
}

/** True when the catalog is empty and the UI may offer demo CTA. */
export function shouldOfferDemoLots(lots: FarmLot[] | undefined | null): boolean {
  return !lots || lots.length === 0;
}

/**
 * Resolve lots for display/ops: never inject demo silently.
 * Empty / missing → [].
 */
export function resolveLots(lots: FarmLot[] | undefined | null): FarmLot[] {
  return Array.isArray(lots) ? lots : [];
}

/**
 * Persist merge helper: prefer persisted lots when the key is present
 * (including explicit []). Only fall back to `current` when the key is absent
 * (legacy partial blobs). Never substitute demo.
 */
export function mergeLotsFromPersist(
  persistedLots: unknown,
  currentLots: FarmLot[],
): FarmLot[] {
  if (Array.isArray(persistedLots)) return persistedLots as FarmLot[];
  return resolveLots(currentLots);
}

/**
 * Import helper: if payload carries `lots` (array, possibly empty), use it;
 * otherwise keep current. Never inject DEMO_LOTS.
 */
export function lotsFromImport(
  payloadLots: unknown,
  currentLots: FarmLot[],
): FarmLot[] {
  if (Array.isArray(payloadLots)) return payloadLots as FarmLot[];
  return resolveLots(currentLots);
}

/**
 * Zustand-compatible storage that migrates legacy `ft-tesoro-v1` → farm-scoped
 * key on first read. Does not delete the legacy key (safe rollback).
 */
export function createFarmPersistStorage(farmId: string = FARM_ID): {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
  removeItem: (name: string) => void;
} {
  const primary = storageKeyForFarm(farmId);

  return {
    getItem: (name: string) => {
      if (typeof localStorage === "undefined") return null;
      const key = name || primary;
      const existing = localStorage.getItem(key);
      if (existing != null) return existing;
      // Migrate legacy single-farm blob once into the scoped key.
      if (key === primary) {
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy != null) {
          try {
            localStorage.setItem(primary, legacy);
          } catch {
            /* quota — still return legacy so rehydrate works this session */
          }
          return legacy;
        }
      }
      return null;
    },
    setItem: (name: string, value: string) => {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(name || primary, value);
    },
    removeItem: (name: string) => {
      if (typeof localStorage === "undefined") return;
      localStorage.removeItem(name || primary);
    },
  };
}

/** Module pointer: which farm blob Zustand persist reads/writes. */
let activePersistFarmId: string = FARM_ID;

export function getActivePersistFarmId(): string {
  return activePersistFarmId;
}

export function setActivePersistFarmId(farmId: string): void {
  const id = (farmId || FARM_ID).trim() || FARM_ID;
  activePersistFarmId = id;
}

/** Shape written under ft-book-v2-${farmId}. */
export type PersistedFarmBookSlice = {
  farmId: string;
  settings: Settings;
  sessions: unknown[];
  batches: unknown[];
  liquidations: unknown[];
  sales: unknown[];
  costs: unknown[];
  journals: unknown[];
  lots: FarmLot[];
  /** Present from Labores/Nutrición/Cultivo slices onward; absent in legacy blobs. */
  labores?: unknown[];
  nutrition?: unknown[];
  cultivos?: unknown[];
  /** Talento · gente de finca (farm-tagged). */
  personas?: unknown[];
  /** Stand de plantas por lote (Cultivo map foundation). */
  plantas?: unknown[];
};

/**
 * Persist storage that always scopes by the active farm id (or farmId inside
 * the payload on write). Legacy ft-tesoro-v1 migrates only for the default farm.
 */
export function createActiveFarmPersistStorage(): {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
  removeItem: (name: string) => void;
} {
  return {
    getItem: (_name: string) => {
      if (typeof localStorage === "undefined") return null;
      const farmId = getActivePersistFarmId();
      return createFarmPersistStorage(farmId).getItem(storageKeyForFarm(farmId));
    },
    setItem: (_name: string, value: string) => {
      if (typeof localStorage === "undefined") return;
      let farmId = getActivePersistFarmId();
      try {
        const parsed = JSON.parse(value) as { state?: { farmId?: string } };
        const fromState = parsed?.state?.farmId;
        if (typeof fromState === "string" && fromState.trim()) {
          farmId = fromState.trim();
        }
      } catch {
        /* keep active */
      }
      localStorage.setItem(storageKeyForFarm(farmId), value);
    },
    removeItem: (_name: string) => {
      if (typeof localStorage === "undefined") return;
      localStorage.removeItem(storageKeyForFarm(getActivePersistFarmId()));
    },
  };
}

/** Read a farm book blob from localStorage (null if absent / invalid). */
export function readFarmBookFromStorage(
  farmId: string,
): PersistedFarmBookSlice | null {
  if (typeof localStorage === "undefined") return null;
  const raw = createFarmPersistStorage(farmId).getItem(storageKeyForFarm(farmId));
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw) as {
      state?: Partial<PersistedFarmBookSlice>;
    };
    const s = parsed?.state;
    if (!s || typeof s !== "object") return null;
    return {
      farmId:
        typeof s.farmId === "string" && s.farmId.trim()
          ? s.farmId.trim()
          : farmId,
      settings: (s.settings as Settings) ?? { ...EMPTY_SETTINGS },
      sessions: Array.isArray(s.sessions) ? s.sessions : [],
      batches: Array.isArray(s.batches) ? s.batches : [],
      liquidations: Array.isArray(s.liquidations) ? s.liquidations : [],
      sales: Array.isArray(s.sales) ? s.sales : [],
      costs: Array.isArray(s.costs) ? s.costs : [],
      journals: Array.isArray(s.journals) ? s.journals : [],
      lots: mergeLotsFromPersist(s.lots, []),
      labores: Array.isArray(s.labores) ? s.labores : [],
      nutrition: Array.isArray(s.nutrition) ? s.nutrition : [],
      cultivos: Array.isArray(s.cultivos) ? s.cultivos : [],
      personas: Array.isArray(s.personas) ? s.personas : [],
      plantas: Array.isArray(s.plantas) ? s.plantas : [],
    };
  } catch {
    return null;
  }
}

/** Write a farm book blob (Zustand persist envelope). */
export function writeFarmBookToStorage(
  farmId: string,
  slice: PersistedFarmBookSlice,
): void {
  if (typeof localStorage === "undefined") return;
  const envelope = JSON.stringify({
    state: { ...slice, farmId },
    version: 0,
  });
  localStorage.setItem(storageKeyForFarm(farmId), envelope);
}
