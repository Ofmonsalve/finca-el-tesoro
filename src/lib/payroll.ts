import { hoursBetween, uid } from "./utils";
import { n } from "./format";
import type { HarvestSession, PayModel, WorkerRow } from "./types";

/** Stable worker identity when no workerId exists: trim + lowercase nombre. */
export function workerKey(nombre: string): string {
  return nombre.trim().toLowerCase();
}

/** Session calendar day (YYYY-MM-DD). Stored `fecha` is already America/Bogota local date. */
export function sessionDay(fecha: string): string {
  return String(fecha ?? "").slice(0, 10);
}

export function qualifiesForJornal(kg: number, horas: number): boolean {
  return n(kg) > 0 || horas > 0;
}

/**
 * Regla P0 nómina: como máximo 1 jornal completo por (workerKey, día calendario
 * America/Bogota = campo `fecha` YYYY-MM-DD). La primera sesión del día que
 * califica (kg>0 || horas>0) en modelo jornal cobra `jornalRate`; el resto de
 * sesiones jornal ese mismo día → pago 0. Modelo por_kg no se toca (Σ kg×tarifa).
 */
export function computeWorkerPago(
  modelo: PayModel,
  kg: number,
  horas: number,
  valorKg: number,
  jornalRate: number,
  jornalAlreadyEarnedToday: boolean,
): number {
  if (modelo === "jornal") {
    if (!qualifiesForJornal(kg, horas)) return 0;
    if (jornalAlreadyEarnedToday) return 0;
    return n(jornalRate);
  }
  return Math.round(n(kg) * n(valorKg));
}

export function computeWorker(
  row: Pick<WorkerRow, "nombre" | "hi" | "hf" | "kg"> & { id?: string },
  modelo: PayModel,
  valorKg: number,
  jornal: number,
  alim: number,
  jornalAlreadyEarnedToday = false,
): WorkerRow {
  const horas = hoursBetween(row.hi, row.hf);
  const kg = n(row.kg);
  const pago = computeWorkerPago(
    modelo,
    kg,
    horas,
    valorKg,
    jornal,
    jornalAlreadyEarnedToday,
  );
  return {
    id: row.id || uid("w"),
    nombre: row.nombre.trim(),
    hi: row.hi,
    hf: row.hf,
    kg,
    horas,
    pago,
    alim: kg > 0 ? n(alim) : 0,
  };
}

/** Claim key for the day-cap set: workerKey|YYYY-MM-DD */
export function jornalDayClaimKey(nombreOrKey: string, fecha: string): string {
  const k = nombreOrKey.includes("|")
    ? nombreOrKey
    : `${workerKey(nombreOrKey)}|${sessionDay(fecha)}`;
  return k;
}

/**
 * Walk sessions oldest-first and collect which (worker, day) already claimed a jornal.
 * If excludeSessionId is set, that session is skipped (useful when re-saving/editing).
 */
export function jornalClaimedOnDate(
  sessions: HarvestSession[],
  fecha: string,
  excludeSessionId?: string,
): Set<string> {
  const day = sessionDay(fecha);
  const claimed = new Set<string>();
  const ordered = chronologicalSessions(sessions).filter(
    (s) => sessionDay(s.fecha) === day && s.id !== excludeSessionId,
  );
  for (const s of ordered) {
    if (s.modelo !== "jornal") continue;
    for (const w of s.trabajadores) {
      const key = workerKey(w.nombre);
      if (!key) continue;
      const claim = `${key}|${day}`;
      if (claimed.has(claim)) continue;
      if (qualifiesForJornal(w.kg, w.horas)) claimed.add(claim);
    }
  }
  return claimed;
}

/** Newest-first store → chronological (oldest first) for stable "first wins". */
export function chronologicalSessions(
  sessions: HarvestSession[],
): HarvestSession[] {
  return [...sessions].sort((a, b) => {
    const d = sessionDay(a.fecha).localeCompare(sessionDay(b.fecha));
    if (d !== 0) return d;
    return a.id.localeCompare(b.id);
  });
}

export type WorkerEarning = {
  nombre: string;
  earned: number;
  alim: number;
  sessionIds: string[];
};

/**
 * Aggregate pay across sessions applying the jornal day-cap.
 * por_kg: sum of stored row pagos (kg×rate). jornal: at most 1×session.jornal per day.
 */
export function aggregateWorkerEarnings(
  sessions: HarvestSession[],
): WorkerEarning[] {
  const claimed = new Set<string>();
  const m = new Map<string, WorkerEarning>();

  for (const s of chronologicalSessions(sessions)) {
    const day = sessionDay(s.fecha);
    for (const w of s.trabajadores) {
      const key = workerKey(w.nombre);
      if (!key) continue;
      let pago: number;
      if (s.modelo === "jornal") {
        const claim = `${key}|${day}`;
        if (qualifiesForJornal(w.kg, w.horas) && !claimed.has(claim)) {
          pago = n(s.jornal);
          claimed.add(claim);
        } else {
          pago = 0;
        }
      } else {
        pago = w.pago;
      }
      const cur = m.get(key) || {
        nombre: w.nombre.trim(),
        earned: 0,
        alim: 0,
        sessionIds: [],
      };
      cur.earned += pago;
      cur.alim += w.alim;
      if (!cur.sessionIds.includes(s.id)) cur.sessionIds.push(s.id);
      if (!cur.nombre) cur.nombre = w.nombre.trim();
      m.set(key, cur);
    }
  }
  return [...m.values()];
}

/** Total M.O. with jornal day-cap applied (for KPIs / farmStats). */
export function totalPayCapped(sessions: HarvestSession[]): number {
  return aggregateWorkerEarnings(sessions).reduce((a, w) => a + w.earned, 0);
}

/**
 * Build worker rows for a session, respecting jornal already claimed that day
 * (including earlier rows in the same draft list).
 */
export function computeSessionWorkers(
  rows: Array<Pick<WorkerRow, "nombre" | "hi" | "hf" | "kg"> & { id?: string }>,
  modelo: PayModel,
  valorKg: number,
  jornal: number,
  alim: number,
  alreadyClaimed: Set<string>,
  fecha: string,
): WorkerRow[] {
  const day = sessionDay(fecha);
  const claimed = new Set(alreadyClaimed);
  return rows.map((row) => {
    const key = workerKey(row.nombre);
    const claim = `${key}|${day}`;
    const earned = key ? claimed.has(claim) : false;
    const w = computeWorker(row, modelo, valorKg, jornal, alim, earned);
    if (
      modelo === "jornal" &&
      key &&
      qualifiesForJornal(w.kg, w.horas) &&
      w.pago > 0
    ) {
      claimed.add(claim);
    }
    return w;
  });
}
