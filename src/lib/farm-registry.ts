/**
 * Multi-farm registry (client): list of farms + activeFarmId.
 * Each farm's productive book lives under ft-book-v2-${farmId} (see farm-book-init).
 * No "oficina" metaphor — just fincas the owner can create, rename, and switch.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { FARM_ID } from "./roles";

export const FARMS_REGISTRY_KEY = "ft-farms-v1";

export type FarmMeta = {
  id: string;
  name: string;
  createdAt: string;
};

export type FarmRegistryState = {
  farms: FarmMeta[];
  activeFarmId: string;
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
  createFarm: (name: string) => { ok: boolean; error?: string; farm?: FarmMeta };
  renameFarm: (
    farmId: string,
    name: string,
  ) => { ok: boolean; error?: string };
  setActiveFarmId: (farmId: string) => { ok: boolean; error?: string };
  farmName: (farmId: string) => string;
};

/** Default single farm for first install / migration. */
export function defaultFarmRegistry(): {
  farms: FarmMeta[];
  activeFarmId: string;
} {
  return {
    farms: [
      {
        id: FARM_ID,
        name: "El Tesoro",
        createdAt: "2020-01-01T00:00:00.000Z",
      },
    ],
    activeFarmId: FARM_ID,
  };
}

/** Slug for farm ids: "La Esperanza" → "finca-la-esperanza". */
export function slugifyFarmName(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const core = base || "nueva";
  return core.startsWith("finca-") ? core : `finca-${core}`;
}

/** Unique farm id among existing ids. */
export function makeFarmId(name: string, existingIds: readonly string[]): string {
  const taken = new Set(existingIds);
  let id = slugifyFarmName(name);
  if (!taken.has(id)) return id;
  let n = 2;
  while (taken.has(`${id}-${n}`)) n += 1;
  return `${id}-${n}`;
}

export function displayFarmName(
  farmId: string,
  farms?: readonly FarmMeta[],
): string {
  const fromList = farms?.find((f) => f.id === farmId)?.name;
  if (fromList) return fromList;
  if (farmId === FARM_ID || farmId === "finca-el-tesoro") return "El Tesoro";
  return farmId.replace(/^finca-/, "").replace(/-/g, " ") || "Finca";
}

const defaults = defaultFarmRegistry();

export const useFarmRegistry = create<FarmRegistryState>()(
  persist(
    (set, get) => ({
      farms: defaults.farms,
      activeFarmId: defaults.activeFarmId,
      hydrated: false,
      setHydrated: (v) => set({ hydrated: v }),
      createFarm: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return { ok: false, error: "Indique el nombre de la finca." };
        if (trimmed.length > 60) {
          return { ok: false, error: "Nombre demasiado largo." };
        }
        const id = makeFarmId(
          trimmed,
          get().farms.map((f) => f.id),
        );
        const farm: FarmMeta = {
          id,
          name: trimmed,
          createdAt: new Date().toISOString(),
        };
        set({
          farms: [...get().farms, farm],
          activeFarmId: id,
        });
        return { ok: true, farm };
      },
      renameFarm: (farmId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return { ok: false, error: "Indique el nombre de la finca." };
        if (trimmed.length > 60) {
          return { ok: false, error: "Nombre demasiado largo." };
        }
        const farms = get().farms;
        if (!farms.some((f) => f.id === farmId)) {
          return { ok: false, error: "No existe esa finca." };
        }
        set({
          farms: farms.map((f) =>
            f.id === farmId ? { ...f, name: trimmed } : f,
          ),
        });
        return { ok: true };
      },
      setActiveFarmId: (farmId) => {
        const id = farmId.trim();
        if (!get().farms.some((f) => f.id === id)) {
          return { ok: false, error: "No existe esa finca." };
        }
        set({ activeFarmId: id });
        return { ok: true };
      },
      farmName: (farmId) => displayFarmName(farmId, get().farms),
    }),
    {
      name: FARMS_REGISTRY_KEY,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        farms: s.farms,
        activeFarmId: s.activeFarmId,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<{
          farms: FarmMeta[];
          activeFarmId: string;
        }>;
        const farms =
          Array.isArray(p.farms) && p.farms.length > 0
            ? p.farms.filter(
                (f) =>
                  f &&
                  typeof f.id === "string" &&
                  f.id.trim() &&
                  typeof f.name === "string" &&
                  f.name.trim(),
              )
            : current.farms;
        const activeFarmId =
          typeof p.activeFarmId === "string" &&
          farms.some((f) => f.id === p.activeFarmId)
            ? p.activeFarmId
            : farms[0]?.id ?? current.activeFarmId;
        return { ...current, farms, activeFarmId };
      },
    },
  ),
);
