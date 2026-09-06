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
import { fmtDate, fmtKg, fmtNum, fmtPct, fmtRatio, n } from "@/lib/format";
import { LOTS } from "@/lib/lots";
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

export const Route = createFileRoute("/beneficio")({
  validateSearch: (s: Record<string, unknown>) => ({
    batch: typeof s.batch === "string" ? s.batch : undefined,
  }),
  component: Page,
});

function Page() {
  const { batch: batchQ } = Route.useSearch();
  const batches = useFarm((s) => s.batches);
  const settings = useFarm((s) => s.settings);
  const completeStage = useFarm((s) => s.completeStage);
  const undoStage = useFarm((s) => s.undoStage);
  const S = farmStats(useFarm());
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

  const inBodega = batches.filter((b) => {
    const done = b.events.map((e) => e.stage);
    return done.includes("bodega") && !done.includes("venta");
  }).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
          Postcosecha
        </p>
        <h1 className="font-display text-4xl tracking-tight">
          Trazabilidad del grano
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Cosecha entra a <b className="text-fg">tolva</b>. Luego: flotación
          (omisible), fermentación al aire (omisible), despulpado, fermentación
          en tanque (omisible), lavado, secado, bodega, despacho y venta.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Lotes en proceso" value={String(S.inProcess)} hint="Sin venta" />
        <Kpi label="En bodega" value={String(inBodega)} hint="Listos para despacho" />
        <Kpi
          label="Kg cereza en flujo"
          value={fmtNum(
            batches.reduce((a, b) => a + (b.saleId ? 0 : b.kgCereza), 0),
            1,
          )}
        />
        <Kpi
          label="Vanos (flotación)"
          value={S.mermaBook.find((m) => m.stage === "flotacion")?.kgIn
            ? fmtKg(S.mermaBook.find((m) => m.stage === "flotacion")!.mermaKg)
            : "—"}
          hint="Merma comercial"
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
              <CardTitle>Sin lotes de beneficio</CardTitle>
              <CardHint>
                Al guardar una sesión de cosecha se crea el lote y entra a
                tolva. Vaya a Cosecha, registre el día y vuelva aquí.
              </CardHint>
              <Button className="mt-4" asChild>
                <Link to="/cosecha" search={{ ses: undefined }}>
                  Ir a cosecha
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
                          {LOTS[b.lote]?.nombre} · {fmtKg(b.kgActual)}
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
              onAdvance={(stage, skipped, kgOut, notas, responsable) =>
                completeStage(batch.id, {
                  stage,
                  skipped,
                  kgOut,
                  notas,
                  responsable,
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
    kgOut: number,
    notas: string,
    responsable: string,
  ) => void;
  onUndo: () => void;
}) {
  const y = batchYield(batch);
  const done = batch.events.map((e) => e.stage);
  const next = nextPendingStage(done);
  const [kgOut, setKgOut] = useState(String(batch.kgActual));
  const [notas, setNotas] = useState("");
  const [resp, setResp] = useState(responsable);
  useEffect(() => {
    setKgOut(String(batch.kgActual));
    setNotas("");
  }, [batch.id, batch.kgActual]);
  const evBy = useMemo(() => {
    const m = new Map(batch.events.map((e) => [e.stage, e]));
    return m;
  }, [batch.events]);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>{batch.code}</CardTitle>
          <CardHint>
            {fmtDate(batch.fecha)} · {batch.lote} {LOTS[batch.lote]?.nombre} ·
            entrada {fmtKg(batch.kgCereza)} · ahora {fmtKg(batch.kgActual)}
          </CardHint>
        </div>
        {next?.id === "venta" || batch.saleId ? (
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
            Factor real
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
                  <Badge tone="ok">Hecha</Badge>
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

      {next && next.id !== "venta" ? (
        <div className="mt-6 rounded-xl border border-border bg-elevated/50 p-4">
          <div className="flex items-center gap-2 text-sm">
            <ChevronRight className="size-4 text-accent" />
            Siguiente: <b>{next.label}</b>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field
              label="Kg de salida"
              hint={`esperado ${fmtKg(expectedAt(batch.kgCereza, next.id, batch.factor))}`}
            >
              <DecimalInput
                value={kgOut}
                onValue={setKgOut}
                decimals={1}
                placeholder="0,0"
              />
            </Field>
            <Field label="Responsable" hint="texto">
              <input
                className="flex h-11 w-full rounded-lg border border-border bg-elevated px-3 text-sm"
                value={resp}
                onChange={(e) => setResp(e.target.value)}
              />
            </Field>
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
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => {
                onAdvance(next.id, false, n(kgOut) || batch.kgActual, notas, resp);
                setNotas("");
                setKgOut(String(n(kgOut) || batch.kgActual));
              }}
            >
              <Check className="size-4" /> Registrar etapa
            </Button>
            {next.skippable ? (
              <Button
                variant="outline"
                onClick={() => {
                  onAdvance(next.id, true, batch.kgActual, notas || "Omitida", resp);
                  setNotas("");
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
          {batch.events.length ? (
            <Button variant="ghost" onClick={onUndo}>
              <Undo2 className="size-4" /> Deshacer última
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
