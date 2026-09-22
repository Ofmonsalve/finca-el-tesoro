/**
 * Pure helpers for Talento (gente de la finca — not HR / app permissions).
 * Registry is farm-scoped; harvest pay links by name via workerKey.
 * P0 payroll (≤1 jornal/day) stays in payroll.ts — this module only reads it.
 *
 * Contract:
 * - List columns: name, work role, farm, period jornales/pay
 * - Holding: rows tagged by farm; inside farm: that farm only
 * - No app permissions, predio/títulos, ID/contracts, harvest kg, nutrición costs
 * - Pulso/Inteligencia gente rolls up only with farm tag
 */
import { workerKey, aggregateWorkerEarnings } from "./payroll";
import { upsertById } from "./lot-ops";
import type {
  FarmPerson,
  HarvestSession,
  Liquidation,
  PersonRole,
} from "./types";

export const PERSON_ROLES: { id: PersonRole; label: string }[] = [
  { id: "recolector", label: "Recolector" },
  { id: "mayordomo", label: "Mayordomo" },
  { id: "jornalero", label: "Jornalero" },
  { id: "beneficio", label: "Beneficio" },
  { id: "otro", label: "Otro" },
];

export function personRoleLabel(rol: PersonRole): string {
  return PERSON_ROLES.find((r) => r.id === rol)?.label ?? rol;
}

export function isPersonRole(v: unknown): v is PersonRole {
  return PERSON_ROLES.some((r) => r.id === v);
}

/** People for one farm. Active first, then name A→Z. */
export function personasForFarm(
  items: FarmPerson[] | undefined | null,
  farmId: string,
  opts?: { includeInactive?: boolean },
): FarmPerson[] {
  if (!Array.isArray(items) || !farmId) return [];
  const includeInactive = opts?.includeInactive !== false;
  return items
    .filter(
      (p) =>
        p &&
        p.farmId === farmId &&
        (includeInactive || p.activo !== false),
    )
    .slice()
    .sort((a, b) => {
      if (a.activo !== b.activo) return a.activo ? -1 : 1;
      return a.nombre.localeCompare(b.nombre, "es");
    });
}

/**
 * Holding view: people across farms, still tagged farmId.
 * Never drops farm tag; caller must display farm name per row.
 */
export function personasHolding(
  items: FarmPerson[] | undefined | null,
  farmIds: string[],
): FarmPerson[] {
  if (!Array.isArray(items) || !farmIds.length) return [];
  const allow = new Set(farmIds.filter(Boolean));
  return items
    .filter((p) => p && allow.has(p.farmId))
    .slice()
    .sort((a, b) => {
      const f = a.farmId.localeCompare(b.farmId);
      if (f !== 0) return f;
      if (a.activo !== b.activo) return a.activo ? -1 : 1;
      return a.nombre.localeCompare(b.nombre, "es");
    });
}

export function upsertPersona(
  list: FarmPerson[],
  row: FarmPerson,
): FarmPerson[] {
  // Refuse rows without farm tag — they must not roll into Pulso/Inteligencia.
  if (!row.farmId?.trim()) return list;
  return upsertById(list, { ...row, farmId: row.farmId.trim() });
}

export type PersonaPeriodRow = {
  person: FarmPerson | null;
  /** Display name (registry or harvest). */
  nombre: string;
  key: string;
  farmId: string;
  rol: PersonRole | null;
  earned: number;
  paid: number;
  pend: number;
  /** Distinct calendar days with a qualifying jornal (informational). */
  jornalDays: number;
  sessionIds: string[];
  linked: boolean;
  activo: boolean;
};

/**
 * Period summary for one farm: harvest earnings (P0 day-cap) joined to registry by name.
 * Does not change payroll math — only reads aggregateWorkerEarnings.
 * Omits harvest kg and nutrición costs (not this face).
 */
export function talentoPeriodSummary(
  personas: FarmPerson[] | undefined | null,
  sessions: HarvestSession[] | undefined | null,
  liquidations: Liquidation[] | undefined | null,
  farmId: string,
): {
  rows: PersonaPeriodRow[];
  totalEarned: number;
  totalPaid: number;
  totalPend: number;
  activeCount: number;
} {
  if (!farmId) {
    return {
      rows: [],
      totalEarned: 0,
      totalPaid: 0,
      totalPend: 0,
      activeCount: 0,
    };
  }

  const farmPeople = personasForFarm(personas, farmId, {
    includeInactive: true,
  });
  const byKey = new Map<string, FarmPerson>();
  for (const p of farmPeople) {
    const k = workerKey(p.nombre);
    if (k) byKey.set(k, p);
  }

  const earnings = aggregateWorkerEarnings(
    Array.isArray(sessions) ? sessions : [],
  );
  const paidMap = new Map<string, number>();
  for (const l of Array.isArray(liquidations) ? liquidations : []) {
    const k = workerKey(l.trabajador);
    if (!k) continue;
    paidMap.set(k, (paidMap.get(k) || 0) + l.monto);
  }

  const jornalDaysByKey = new Map<string, Set<string>>();
  for (const s of Array.isArray(sessions) ? sessions : []) {
    if (s.modelo !== "jornal") continue;
    const day = String(s.fecha ?? "").slice(0, 10);
    for (const w of s.trabajadores) {
      const k = workerKey(w.nombre);
      if (!k) continue;
      if (!(w.kg > 0 || w.horas > 0)) continue;
      let set = jornalDaysByKey.get(k);
      if (!set) {
        set = new Set();
        jornalDaysByKey.set(k, set);
      }
      set.add(day);
    }
  }

  const seen = new Set<string>();
  const rows: PersonaPeriodRow[] = [];

  for (const e of earnings) {
    const key = workerKey(e.nombre);
    if (!key) continue;
    seen.add(key);
    const person = byKey.get(key) ?? null;
    const paid = paidMap.get(key) || 0;
    rows.push({
      person,
      nombre: person?.nombre ?? e.nombre,
      key,
      farmId,
      rol: person?.rol ?? null,
      earned: e.earned,
      paid,
      pend: e.earned - paid,
      jornalDays: jornalDaysByKey.get(key)?.size ?? 0,
      sessionIds: e.sessionIds,
      linked: Boolean(person),
      activo: person?.activo ?? true,
    });
  }

  for (const p of farmPeople) {
    const key = workerKey(p.nombre);
    if (!key || seen.has(key)) continue;
    const paid = paidMap.get(key) || 0;
    rows.push({
      person: p,
      nombre: p.nombre,
      key,
      farmId,
      rol: p.rol,
      earned: 0,
      paid,
      pend: 0 - paid,
      jornalDays: 0,
      sessionIds: [],
      linked: true,
      activo: p.activo,
    });
  }

  rows.sort(
    (a, b) => b.pend - a.pend || a.nombre.localeCompare(b.nombre, "es"),
  );

  const activeCount = farmPeople.filter((p) => p.activo).length;
  const totalEarned = rows.reduce((a, r) => a + r.earned, 0);
  const totalPaid = rows.reduce((a, r) => a + r.paid, 0);
  return {
    rows,
    totalEarned,
    totalPaid,
    totalPend: totalEarned - totalPaid,
    activeCount,
  };
}

/**
 * Holding period rows: one farm at a time, tagged. Skip books without farmId.
 */
export function talentoHoldingSummary(
  books: Array<{
    farmId: string;
    farmName: string;
    personas: FarmPerson[] | undefined | null;
    sessions: HarvestSession[] | undefined | null;
    liquidations: Liquidation[] | undefined | null;
  }>,
): Array<PersonaPeriodRow & { farmName: string }> {
  const out: Array<PersonaPeriodRow & { farmName: string }> = [];
  for (const b of books) {
    if (!b.farmId?.trim()) continue;
    const { rows } = talentoPeriodSummary(
      b.personas,
      b.sessions,
      b.liquidations,
      b.farmId,
    );
    for (const r of rows) {
      out.push({ ...r, farmName: b.farmName });
    }
  }
  return out;
}

export function normalizePersonaNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ");
}

export function validatePersonaInput(input: {
  nombre: string;
  rol: unknown;
  telefono?: string;
  farmId: string;
}):
  | {
      ok: true;
      nombre: string;
      rol: PersonRole;
      telefono: string;
      farmId: string;
    }
  | { ok: false; error: string } {
  const farmId = String(input.farmId ?? "").trim();
  if (!farmId) {
    return { ok: false, error: "Falta la finca (etiqueta farmId)." };
  }
  const nombre = normalizePersonaNombre(input.nombre);
  if (!nombre) return { ok: false, error: "Indique el nombre." };
  if (!isPersonRole(input.rol)) {
    return {
      ok: false,
      error: "Elija un rol de campo (recolector, mayordomo, jornalero…).",
    };
  }
  const telefono = String(input.telefono ?? "").trim();
  return { ok: true, nombre, rol: input.rol, telefono, farmId };
}
