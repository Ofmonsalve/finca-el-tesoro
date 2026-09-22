import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Ban, Check, ChevronRight, Factory, Undo2 } from "lucide-react";
import { StageBars } from "@/components/charts/farm-charts";
import { Kpi } from "@/components/kpi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/fields";
import { fmtDate, fmtKg, fmtNum, fmtPct, fmtRatio } from "@/lib/format";
import { lotNombre } from "@/lib/lots";
import {
  PROCESS_STAGES,
  nextPendingStage,
  type StageId,
} from "@/lib/process";
import { farmStats } from "@/lib/stats";
import { useFarm } from "@/lib/store";
import type { ProcessBatch } from "@/lib/types";
import { cn } from "@/lib/utils";
import { batchYield, expectedAt } from "@/lib/yield";
import {
  resolveStageKgOut,
  stageRequiresExplicitKg,
} from "@/lib/beneficio-weigh";
import {
  GRANO_TIMELINE,
  UNIT_CEREZA,
  UNIT_PERGAMINO,
  batchesForFarm,
  cosechaHubSummary,
} from "@/lib/cosecha-hub";
import { displayFarmName, useFarmRegistry } from "@/lib/farm-registry";
import { useFarmAccess } from "@/components/farm-access";
import { canWrite } from "@/lib/roles";

export const Route = createFileRoute("/beneficio")({
  validateSearch: (s: Record<string, unknown>) => ({
    batch: typeof s.batch === "string" ? s.batch : undefined,
  }),
  component: Page,
});

function Page() {
  const { batch: batchQ } = Route.useSearch();
  const farm = useFarm();
  const farms = useFarmRegistry((s) => s.farms);
  const farmName = displayFarmName(farm.farmId, farms);
  const batches = batchesForFarm(farm.batches, farm.farmId);
  const settings = useFarm((s) => s.settings);
  const completeStage = useFarm((s) => s.completeStage);
  const undoStage = useFarm((s) => s.undoStage);
  const S = farmStats(useFarm());
  const hub = useMemo(
    () => cosechaHubSummary(farm.farmId, farmName, farm.sessions, farm.batches),
    [farm.farmId, farmName, farm.sessions, farm.batches],
  );
  const [sel, setSel] = useState<string | null>(batchQ ?? batches[0]?.id ?? null);
  useEffect(() => {
    if (batchQ) setSel(batchQ);
  }, [batchQ]);
  const batch = batches.find((b) => b.id === sel) ?? batches[0] ?? null;

  const byStage = PROCESS_STAGES.map((st) => ({
    name: st.label,
    n: batches.filter((b) => {
      const next = nextPendingStage(b.events.map((e) => e.stage));
      return next?.id === st.id;
    }).length,
  }));

  const kgCerezaFlujo = batches.reduce(
    (a, b) => a + (b.saleId ? 0 : b.kgCereza),
    0,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
            Cosecha · Grano · {farmName}
          </p>
          <h1 className="font-display text-4xl tracking-tight">{farmName}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            Beneficio húmedo y/o seco: cereza → tolva → … →{" "}
            <b className="text-fg">pergamino</b> → vendible (pergamino o
            almendra/verde). Cada paso con kg + unidad; nunca se suman{" "}
            {UNIT_CEREZA} con {UNIT_PERGAMINO}. El rendimiento es un factor.
            Pesaje P0 en etapas con merma.
          </p>
          <div className="mt-3">
            <Link
              to="/cosecha"
              search={{ ses: undefined, lote: undefined, nuevo: undefined }}
              className="text-sm text-accent hover:underline"
            >
              ← Volver a {farmName}
            </Link>
          </div>
        </div>
      </header>

      <ol className="flex flex-wrap gap-2 rounded-xl border border-border bg-elevated/40 p-3 text-xs">
        {GRANO_TIMELINE.map((step, i) => (
          <li key={step.id} className="flex items-center gap-2 text-muted">
            {i > 0 ? <span aria-hidden className="text-subtle">→</span> : null}
            <span>
              <span className="font-medium text-fg">{step.label}</span>
              <span className="ml-1 text-subtle">({step.hint})</span>
            </span>
          </li>
        ))}
      </ol>

      <nav
        aria-label="Dentro de Cosecha"
        className="flex flex-wrap gap-2 rounded-xl border border-border bg-elevated/40 p-2"
      >
        <Link
          to="/cosecha"
          search={{ ses: undefined, lote: undefined, nuevo: undefined }}
          className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm text-muted hover:bg-surface hover:text-fg"
        >
          Cereza
        </Link>
        <span className="inline-flex min-h-10 items-center rounded-lg bg-surface px-3 text-sm font-medium text-fg">
          Grano / beneficio
        </span>
      </nav>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label={`${UNIT_CEREZA} en flujo · ${farmName}`}
          value={kgCerezaFlujo > 0 ? fmtNum(kgCerezaFlujo, 1) : "—"}
          hint="Entrada (no sumar con pergamino)"
        />
        <Kpi
          label={`${UNIT_PERGAMINO} vendible · ${farmName}`}
          value={hub.kgVendible > 0 ? fmtNum(hub.kgVendible, 1) : "—"}
          hint="Bodega sin venta"
        />
        <Kpi
          label={`Factor cereza→pergamino · ${farmName}`}
          value={
            hub.ratioCerezaPergamino != null
              ? fmtRatio(hub.ratioCerezaPergamino)
              : "—"
          }
          hint="Rendimiento (no es kg)"
        />
        <Kpi
          label="Lotes abiertos"
          value={String(hub.batchOpenCount)}
          hint={`${hub.batchBodegaCount} en bodega`}
        />
      </div>

      <Card>
        <CardTitle>Dónde está el café</CardTitle>
        <CardHint>Lotes cuyo siguiente paso es cada etapa.</CardHint>
        <StageBars data={byStage} />
      </Card>

      {!batches.length ? (
        <Card>
          <div className="flex items-start gap-3">
            <Factory className="mt-1 size-5 text-accent" />
            <div>
              <CardTitle>Sin lotes de Grano / beneficio</CardTitle>
              <CardHint>
                Al guardar una sesión de cereza en Cosecha se crea el lote y
                entra a tolva. Registre el día y vuelva aquí al pergamino.
              </CardHint>
              <Button className="mt-4" asChild>
                <Link
                  to="/cosecha"
                  search={{ nuevo: "1", ses: undefined, lote: undefined }}
                >
                  Registrar cereza
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <Card className="h-fit p-3">
            <div className="px-2 pb-2 text-[11px] uppercase tracking-wider text-subtle">
              Lotes
            </div>
            <ul className="space-y-1">
              {batches.map((b) => {
                const next = nextPendingStage(b.events.map((e) => e.stage));
                const active = (batch?.id ?? "") === b.id;
                return (
                  <li key={b.id}>
                    <button
                      type="button"
                      onClick={() => setSel(b.id)}
                      className={cn(
                        "flex w-full min-h-11 items-center justify-between rounded-xl px-3 text-left text-sm",
                        active ? "bg-elevated text-fg" : "text-muted hover:text-fg",
                      )}
                    >
                      <span>
                        <span className="block font-medium text-fg">{b.code}</span>
                        <span className="text-xs">
                          {lotNombre(farm.lots, b.lote)} · {fmtKg(b.kgActual)}
                        </span>
                      </span>
                      <Badge tone={b.saleId ? "ok" : next ? "accent" : "ok"}>
                        {b.saleId ? "Vendido" : next?.label ?? "Cerrado"}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
          {batch ? (
            <BatchBoard
              batch={batch}
              responsable={settings.responsable}
              onAdvance={(stage, skipped, kgOutRaw, notas, responsable, estimated) =>
                completeStage(batch.id, {
                  stage,
                  skipped,
                  kgOutRaw,
                  notas,
                  responsable,
                  estimated,
                })
              }
              onUndo={() => undoStage(batch.id)}
            />
          ) : null}
        </div>
      )}

      <Card>
        <CardTitle>Merma por etapa</CardTitle>
        <CardHint>
          Esperada vs pesada. Vanos son pérdida de producto; pulpa y agua son
          conversión.
        </CardHint>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-subtle">
                <th className="pb-2">Etapa</th>
                <th className="pb-2">Naturaleza</th>
                <th className="pb-2 text-right">Kg in</th>
                <th className="pb-2 text-right">Merma kg</th>
                <th className="pb-2 text-right">Merma %</th>
                <th className="pb-2 text-right">Esp. %</th>
                <th className="pb-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {S.mermaBook.map((m) => (
                <tr key={m.stage} className="border-t border-border/60">
                  <td className="py-2">{m.label}</td>
                  <td className="text-muted">{m.nature}</td>
                  <td className="text-right tabular">{fmtNum(m.kgIn, 1)}</td>
                  <td className="text-right tabular">{fmtNum(m.mermaKg, 1)}</td>
                  <td className="text-right tabular">{fmtPct(m.mermaPct)}</td>
                  <td className="text-right tabular text-muted">
                    {fmtPct(m.expectedPct)}
                  </td>
                  <td>
                    <Badge
                      tone={
                        m.status === "alta"
                          ? "warn"
                          : m.status === "ok"
                            ? "ok"
                            : "muted"
                      }
                    >
                      {m.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function BatchBoard({
  batch,
  responsable,
  onAdvance,
  onUndo,
}: {
  batch: ProcessBatch;
  responsable: string;
  onAdvance: (
    stage: StageId,
    skipped: boolean,
    kgOutRaw: string,
    notas: string,
    responsable: string,
    estimated?: boolean,
  ) => { ok: boolean; error?: string; warning?: string };
  onUndo: () => void;
}) {
  const y = batchYield(batch);
  const lots = useFarm((s) => s.lots);
  const { role } = useFarmAccess();
  const writable = canWrite(role);
  const done = batch.events.map((e) => e.stage);
  const next = nextPendingStage(done);
  const weighRequired = next ? stageRequiresExplicitKg(next.id) : false;
  const [kgOut, setKgOut] = useState(() =>
    next && stageRequiresExplicitKg(next.id) ? "" : String(batch.kgActual),
  );
  const [notas, setNotas] = useState("");
  const [resp, setResp] = useState(responsable);
  const [estimated, setEstimated] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formWarn, setFormWarn] = useState<string | null>(null);
  useEffect(() => {
    const nNext = nextPendingStage(batch.events.map((e) => e.stage));
    const req = nNext ? stageRequiresExplicitKg(nNext.id) : false;
    setKgOut(req ? "" : String(batch.kgActual));
    setNotas("");
    setEstimated(false);
    setFormError(null);
    setFormWarn(null);
  }, [batch.id, batch.kgActual, batch.events]);
  const evBy = useMemo(() => {
    const m = new Map(batch.events.map((e) => [e.stage, e]));
    return m;
  }, [batch.events]);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>
            {lotNombre(lots, batch.lote) || batch.lote}
          </CardTitle>
          <CardHint>
            {batch.code} · {fmtDate(batch.fecha)} · {UNIT_CEREZA}{" "}
            {fmtKg(batch.kgCereza)} · ahora {fmtKg(batch.kgActual)}
            {done.includes("bodega") ? ` · ${UNIT_PERGAMINO}` : ""}
          </CardHint>
        </div>
        {writable && (next?.id === "venta" || batch.saleId) ? (
          <Button asChild variant="accent">
            <Link to="/ventas">Registrar venta</Link>
          </Button>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-border px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-subtle">
            CPS est.
          </div>
          <div className="font-display text-lg tabular">{fmtKg(y.cpsEst)}</div>
          <div className="text-xs text-muted">{fmtRatio(y.factorPlan)}</div>
        </div>
        <div className="rounded-xl border border-border px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-subtle">
            R % plan
          </div>
          <div className="font-display text-lg tabular">{fmtPct(y.rPctEst)}</div>
          <div className="text-xs text-muted">100 ÷ F</div>
        </div>
        <div className="rounded-xl border border-border px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-subtle">
            Factor cereza→pergamino
          </div>
          <div className="font-display text-lg tabular">
            {y.factorReal != null ? fmtRatio(y.factorReal) : "—"}
          </div>
          <div className="text-xs text-muted">
            {y.kgBodega != null ? fmtKg(y.kgBodega) : "Pese en bodega"}
          </div>
        </div>
        <div className="rounded-xl border border-border px-3 py-2">
          <div className="text-[10px] uppercase tracking-wider text-subtle">
            Δ vs plan
          </div>
          <div className="font-display text-lg tabular">
            {y.deltaKg != null
              ? `${y.deltaKg >= 0 ? "+" : ""}${fmtNum(y.deltaKg, 2)} kg`
              : "—"}
          </div>
          <div className="text-xs text-muted">{y.band.label}</div>
        </div>
      </div>

      <ol className="mt-6 space-y-2">
        {PROCESS_STAGES.map((st, i) => {
          const ev = evBy.get(st.id);
          const isNext = next?.id === st.id;
          return (
            <li
              key={st.id}
              className={cn(
                "rounded-xl border px-4 py-3",
                ev
                  ? ev.skipped
                    ? "border-border/60 bg-bg/40"
                    : "border-ok/30 bg-ok/5"
                  : isNext
                    ? "border-accent/40 bg-accent/5"
                    : "border-border/50",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-subtle">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-medium">{st.label}</span>
                {ev?.skipped ? (
                  <Badge>Omitida</Badge>
                ) : ev ? (
                  <>
                    <Badge tone="ok">Hecha</Badge>
                    {ev.estimated ? <Badge tone="warn">Estimado</Badge> : null}
                  </>
                ) : isNext ? (
                  <Badge tone="accent">En curso</Badge>
                ) : (
                  <Badge>Pendiente</Badge>
                )}
                {st.skippable ? (
                  <span className="text-xs text-subtle">omisible</span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted">{st.hint}</p>
              {ev ? (
                <p className="mt-2 text-xs text-muted">
                  {fmtDate(ev.at.slice(0, 10))} · {fmtKg(ev.kgOut)}
                  {ev.kgIn > 0
                    ? ` · retiene ${fmtPct((ev.kgOut / ev.kgIn) * 100)}`
                    : ""}
                  {` · esperado ${fmtKg(expectedAt(batch.kgCereza, st.id, batch.factor))}`}
                  {ev.notas ? ` · ${ev.notas}` : ""}
                </p>
              ) : isNext ? (
                <p className="mt-2 text-xs text-muted">
                  Esperado en esta etapa:{" "}
                  {fmtKg(expectedAt(batch.kgCereza, st.id, batch.factor))}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      {writable && next && next.id !== "venta" ? (
        <div className="mt-6 rounded-xl border border-border bg-elevated/50 p-4">
          <div className="flex items-center gap-2 text-sm">
            <ChevronRight className="size-4 text-accent" />
            Siguiente: <b>{next.label}</b>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field
              label={
                next.id === "bodega" ||
                next.id === "secado" ||
                next.id === "despacho"
                  ? `Kg de salida (${UNIT_PERGAMINO})`
                  : `Kg de salida (${UNIT_CEREZA} en proceso)`
              }
              hint={
                weighRequired
                  ? `obligatorio · esperado ${fmtKg(expectedAt(batch.kgCereza, next.id, batch.factor))}`
                  : `esperado ${fmtKg(expectedAt(batch.kgCereza, next.id, batch.factor))}`
              }
            >
              <DecimalInput
                value={kgOut}
                onValue={(v) => {
                  setKgOut(v);
                  setEstimated(false);
                  setFormError(null);
                }}
                decimals={1}
                placeholder={weighRequired ? "Pese e indique kg" : "0,0"}
                disabled={estimated}
              />
            </Field>
            <Field label="Responsable" hint="texto">
              <input
                className="flex h-11 w-full rounded-lg border border-border bg-elevated px-3 text-sm"
                value={resp}
                onChange={(e) => setResp(e.target.value)}
              />
            </Field>
            {weighRequired ? (
              <label className="flex items-start gap-2 text-sm text-muted sm:col-span-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={estimated}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setEstimated(on);
                    setFormError(null);
                    if (on) {
                      const exp = expectedAt(batch.kgCereza, next.id, batch.factor);
                      setKgOut(String(Math.round(exp * 10) / 10));
                    } else {
                      setKgOut("");
                    }
                  }}
                />
                <span>
                  Usar kg estimado del plan (sin báscula). Quedará marcado como{" "}
                  <b className="text-fg">estimado</b>, no como pesaje real.
                </span>
              </label>
            ) : null}
            <div className="sm:col-span-2">
              <Field label="Notas de la etapa" hint="texto">
                <Textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Horas, humedad, novedades…"
                />
              </Field>
            </div>
          </div>
          {formError ? (
            <p className="mt-3 text-sm text-warn" role="alert">
              {formError}
            </p>
          ) : null}
          {formWarn ? (
            <p className="mt-3 text-sm text-accent" role="status">
              {formWarn}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setFormError(null);
                setFormWarn(null);
                const preview = resolveStageKgOut({
                  stage: next.id,
                  skipped: false,
                  kgOutRaw: kgOut,
                  kgCereza: batch.kgCereza,
                  kgActual: batch.kgActual,
                  factor: batch.factor,
                  estimated,
                });
                if (!preview.ok) {
                  setFormError(preview.message);
                  return;
                }
                const res = onAdvance(
                  next.id,
                  false,
                  kgOut,
                  notas,
                  resp,
                  estimated,
                );
                if (!res.ok) {
                  setFormError(res.error ?? "No se pudo registrar la etapa.");
                  return;
                }
                if (res.warning) setFormWarn(res.warning);
                else if (preview.deviationWarn && preview.message) {
                  setFormWarn(preview.message);
                }
                setNotas("");
                setEstimated(false);
                // next stage reset happens via events effect
              }}
            >
              <Check className="size-4" /> Registrar etapa
            </Button>
            {next.skippable ? (
              <Button
                variant="outline"
                onClick={() => {
                  setFormError(null);
                  setFormWarn(null);
                  const res = onAdvance(
                    next.id,
                    true,
                    "",
                    notas || "Omitida",
                    resp,
                    false,
                  );
                  if (!res.ok) {
                    setFormError(res.error ?? "No se pudo omitir la etapa.");
                    return;
                  }
                  setNotas("");
                  setEstimated(false);
                }}
              >
                <Ban className="size-4" /> Omitir y seguir
              </Button>
            ) : null}
            {batch.events.length &&
            batch.events[batch.events.length - 1].stage !== "venta" ? (
              <Button variant="ghost" onClick={onUndo}>
                <Undo2 className="size-4" /> Deshacer última
              </Button>
            ) : null}
          </div>
        </div>
      ) : batch.saleId ? (
        <p className="mt-4 text-sm text-ok">Ciclo cerrado: venta registrada.</p>
      ) : next?.id === "venta" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">
            Pergamino despachado. Complete el ingreso en Ventas.
          </p>
          {writable && batch.events.length ? (
            <Button variant="ghost" onClick={onUndo}>
              <Undo2 className="size-4" /> Deshacer última
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
