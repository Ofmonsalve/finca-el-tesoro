import { stageMeta, type StageId } from "./process";
import { STAGE_LOSS, expectedAt } from "./yield";

/** ±% vs expectedAt: more than this → strong warn / flag (still allow). */
export const KG_OUT_TOLERANCE_PCT = 15;

/**
 * Non-skippable stages where silent kgActual fallback hides missing weigh-in.
 * despulpado / lavado / secado have expected merma; bodega is the closing CPS weigh.
 */
export function stageRequiresExplicitKg(stage: StageId): boolean {
  const meta = stageMeta(stage);
  if (meta.skippable) return false;
  if (stage === "bodega") return true;
  return STAGE_LOSS[stage].ofInputPct > 0;
}

export type StageKgOutInput = {
  stage: StageId;
  /** Explicit skip path (user chose Omitir) — never confuse with missing weigh. */
  skipped: boolean;
  /** Raw field text; empty/whitespace = no weigh entered. */
  kgOutRaw: string;
  kgCereza: number;
  /** Current batch mass; used only for skip or non-weigh stages. */
  kgActual: number;
  factor?: number;
  /** User opted to use expectedAt as plan estimate (not a real scale reading). */
  estimated?: boolean;
  tolerancePct?: number;
};

export type StageKgOutResult =
  | {
      ok: true;
      blocked: false;
      kgOut: number;
      expectedKg: number;
      estimated: boolean;
      /** True when |kgOut − expected| exceeds tolerance (flag, do not block). */
      deviationWarn: boolean;
      deviationPct: number;
      message?: string;
    }
  | {
      ok: false;
      blocked: true;
      kgOut: null;
      expectedKg: number;
      estimated: boolean;
      deviationWarn: false;
      deviationPct: number;
      message: string;
    };

function parseRaw(raw: string): { empty: boolean; value: number } {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return { empty: true, value: 0 };
  // Local parse avoids coupling UI format helpers; mirrors es-CO loosely.
  let s = trimmed.replace(/\s/g, "");
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const value = Number.parseFloat(s);
  if (!Number.isFinite(value)) return { empty: true, value: 0 };
  return { empty: false, value };
}

export function deviationPct(actual: number, expected: number): number {
  if (expected <= 0) return actual === 0 ? 0 : 100;
  return (Math.abs(actual - expected) / expected) * 100;
}

/**
 * Resolve kgOut for a process stage advance.
 * - Skip: kgOut = kgActual (mass intact), never "missing weigh".
 * - Weigh-required: explicit kgOut or estimated=expectedAt; never fall back to kgActual.
 * - Other stages: empty → kgActual (no expected merma / optional weigh).
 */
export function resolveStageKgOut(input: StageKgOutInput): StageKgOutResult {
  const factor = input.factor && input.factor > 0 ? input.factor : 6;
  const expectedKg = expectedAt(input.kgCereza, input.stage, factor);
  const tol = input.tolerancePct ?? KG_OUT_TOLERANCE_PCT;
  const estimated = Boolean(input.estimated);

  if (input.skipped) {
    return {
      ok: true,
      blocked: false,
      kgOut: input.kgActual,
      expectedKg,
      estimated: false,
      deviationWarn: false,
      deviationPct: 0,
      message: undefined,
    };
  }

  const requires = stageRequiresExplicitKg(input.stage);
  const parsed = parseRaw(input.kgOutRaw);

  if (requires) {
    if (estimated) {
      const kgOut = Math.round(expectedKg * 10) / 10;
      return {
        ok: true,
        blocked: false,
        kgOut,
        expectedKg,
        estimated: true,
        deviationWarn: false,
        deviationPct: 0,
        message: "Kg de salida marcado como estimado (plan).",
      };
    }
    if (parsed.empty) {
      return {
        ok: false,
        blocked: true,
        kgOut: null,
        expectedKg,
        estimated: false,
        deviationWarn: false,
        deviationPct: 0,
        message:
          "Indique el kg de salida pesado, o marque «usar estimado» si aún no hay báscula.",
      };
    }
    if (parsed.value <= 0) {
      return {
        ok: false,
        blocked: true,
        kgOut: null,
        expectedKg,
        estimated: false,
        deviationWarn: false,
        deviationPct: 0,
        message: "El kg de salida debe ser mayor que cero en esta etapa.",
      };
    }
    const dev = deviationPct(parsed.value, expectedKg);
    const warn = expectedKg > 0 && dev > tol;
    return {
      ok: true,
      blocked: false,
      kgOut: parsed.value,
      expectedKg,
      estimated: false,
      deviationWarn: warn,
      deviationPct: Math.round(dev * 10) / 10,
      message: warn
        ? `Kg lejos del esperado (${expectedKg.toFixed(1)} kg, Δ ${dev.toFixed(0)} %). Revise báscula o factor.`
        : undefined,
    };
  }

  // Non–weigh-required: empty may copy current mass (no silent merma hide).
  const kgOut = parsed.empty ? input.kgActual : parsed.value;
  if (!parsed.empty && parsed.value < 0) {
    return {
      ok: false,
      blocked: true,
      kgOut: null,
      expectedKg,
      estimated: false,
      deviationWarn: false,
      deviationPct: 0,
      message: "El kg de salida no puede ser negativo.",
    };
  }
  const dev = deviationPct(kgOut, expectedKg);
  const warn = expectedKg > 0 && !parsed.empty && dev > tol;
  return {
    ok: true,
    blocked: false,
    kgOut,
    expectedKg,
    estimated: false,
    deviationWarn: warn,
    deviationPct: Math.round(dev * 10) / 10,
    message: warn
      ? `Kg lejos del esperado (${expectedKg.toFixed(1)} kg).`
      : undefined,
  };
}
