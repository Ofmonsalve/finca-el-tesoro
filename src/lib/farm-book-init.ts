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
