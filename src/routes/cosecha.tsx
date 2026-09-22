/**
 * Cosecha hub (farm-level) — locked contract:
 * Cereza → beneficio → pergamino → vendible (almendra/verde opcional).
 * Grano nests under Cosecha (no 6th top nav). Title = farm NAME.
 * Never sum kg cereza with kg pergamino; yield is a ratio.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ChevronRight, Factory, Leaf } from "lucide-react";
import { HarvestForm } from "@/components/harvest-form";
import { WriteGate } from "@/components/write-gate";
import { Kpi } from "@/components/kpi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import {
  GRANO_TIMELINE,
  UNIT_CEREZA,
  UNIT_PERGAMINO,
  cosechaHubSummary,
} from "@/lib/cosecha-hub";
import { displayFarmName, useFarmRegistry } from "@/lib/farm-registry";
import { fmtDate, fmtKg, fmtMoney, fmtNum, fmtRatio } from "@/lib/format";
import { lotNombre } from "@/lib/lots";
import { useFarm } from "@/lib/store";

export const Route = createFileRoute("/cosecha")({
  validateSearch: (s: Record<string, unknown>) => ({
    ses: typeof s.ses === "string" ? s.ses : undefined,
    lote: typeof s.lote === "string" ? s.lote : undefined,
    nuevo: s.nuevo === true || s.nuevo === "1" || s.nuevo === 1 ? "1" : undefined,
  }),
  component: Page,
});

function Page() {
  const { ses, lote, nuevo } = Route.useSearch();
  const showForm = Boolean(ses || lote || nuevo);

  const farmId = useFarm((s) => s.farmId);
  const sessions = useFarm((s) => s.sessions);
  const batches = useFarm((s) => s.batches);
  const lots = useFarm((s) => s.lots);
  const farms = useFarmRegistry((s) => s.farms);
  const farmName = displayFarmName(farmId, farms);

  const hub = useMemo(
    () => cosechaHubSummary(farmId, farmName, sessions, batches),
    [farmId, farmName, sessions, batches],
  );

  if (showForm) {
    const lotTitle = lote ? lotNombre(lots, lote) || lote : null;
    return (
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
            Cosecha · Cereza · {farmName}
          </p>
          <h1 className="font-display text-4xl tracking-tight">
            {ses
              ? lotTitle || farmName
              : lotTitle
                ? lotTitle
                : farmName}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            {ses ? "Editar sesión · " : "Registrar · "}
            <b className="text-fg">{UNIT_CEREZA}</b> etiquetados. No se suman con
            pergamino. Al guardar, el lote entra a Grano / beneficio (húmedo y/o
            seco → pergamino).
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
        </header>
        <WriteGate>
          <HarvestForm editId={ses} initialLote={lote} />
        </WriteGate>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
            Cosecha · {farmName}
          </p>
          <h1 className="font-display text-4xl tracking-tight">{farmName}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Línea: cereza → beneficio (húmedo y/o seco) → pergamino → vendible
            (pergamino o almendra/verde). Cada kg lleva su unidad; el rendimiento
            cereza→pergamino es un <b className="text-fg">factor</b>, no otro
            total de kg.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link
              to="/cosecha"
              search={{ nuevo: "1", ses: undefined, lote: undefined }}
            >
              <Leaf className="size-4" />
              Registrar cereza
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/beneficio" search={{ batch: undefined }}>
              <Factory className="size-4" />
              Grano / beneficio
            </Link>
          </Button>
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
        <span className="inline-flex min-h-10 items-center rounded-lg bg-surface px-3 text-sm font-medium text-fg">
          Cereza
        </span>
        <Link
          to="/beneficio"
          search={{ batch: undefined }}
          className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm text-muted hover:bg-surface hover:text-fg"
        >
          Grano / beneficio
        </Link>
        <Link
          to="/historial"
          className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm text-muted hover:bg-surface hover:text-fg"
        >
          Historial
        </Link>
      </nav>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label={`${UNIT_CEREZA} · ${farmName}`}
          value={hub.kgCereza > 0 ? fmtNum(hub.kgCereza, 1) : "—"}
          hint="Cosecha del período (misma unidad)"
        />
        <Kpi
          label={`${UNIT_PERGAMINO} vendible · ${farmName}`}
          value={hub.kgVendible > 0 ? fmtNum(hub.kgVendible, 1) : "—"}
          hint="Pergamino en bodega, sin venta"
        />
        <Kpi
          label={`Factor cereza→pergamino · ${farmName}`}
          value={
            hub.ratioCerezaPergamino != null
              ? fmtRatio(hub.ratioCerezaPergamino)
              : "—"
          }
          hint="Rendimiento (no es un total de kg)"
        />
        <Kpi
          label="Lotes en beneficio"
          value={String(hub.batchOpenCount)}
          hint={
            hub.batchBodegaCount
              ? `${hub.batchBodegaCount} en pergamino/bodega`
              : "Sin venta aún"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Cereza por lote · {farmName}</CardTitle>
              <CardHint>
                Solo {UNIT_CEREZA}. Abra el lote o edite la sesión.
              </CardHint>
            </div>
            <Button asChild size="sm">
              <Link
                to="/cosecha"
                search={{ nuevo: "1", ses: undefined, lote: undefined }}
              >
                Nueva sesión
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
          {!hub.sessions.length ? (
            <p className="mt-6 text-sm text-muted">
              Aún no hay cereza registrada en {farmName}. Empiece por un lote
              activo.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>Fecha</Th>
                    <Th>Lote</Th>
                    <Th className="text-right">{UNIT_CEREZA}</Th>
                    <Th className="text-right">Costo</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {hub.sessions.slice(0, 12).map((s) => (
                    <tr key={s.id}>
                      <Td className="tabular">{fmtDate(s.fecha)}</Td>
                      <Td>
                        <Link
                          to="/lotes/$code"
                          params={{ code: s.lote }}
                          className="text-accent hover:underline"
                        >
                          {lotNombre(lots, s.lote) || s.lote}
                        </Link>
                      </Td>
                      <Td className="text-right tabular">{fmtKg(s.totKg)}</Td>
                      <Td className="text-right tabular">
                        {fmtMoney(s.totCost)}
                      </Td>
                      <Td className="text-right">
                        <Link
                          to="/cosecha"
                          search={{
                            ses: s.id,
                            lote: undefined,
                            nuevo: undefined,
                          }}
                          className="text-sm text-accent hover:underline"
                        >
                          Editar
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Grano / beneficio · {farmName}</CardTitle>
              <CardHint>
                Beneficio húmedo y/o seco → {UNIT_PERGAMINO}. Pesaje P0 en
                etapas con merma. Factor cereza→pergamino aparte.
              </CardHint>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/beneficio" search={{ batch: undefined }}>
                Abrir beneficio
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          </div>
          {!hub.batches.length ? (
            <p className="mt-6 text-sm text-muted">
              Sin lotes de beneficio en {farmName}. Al guardar una cosecha, el
              grano entra a tolva.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {hub.batches.slice(0, 10).map(({ batch, nextLabel, phase }) => {
                const name = lotNombre(lots, batch.lote) || batch.lote;
                return (
                  <li key={batch.id}>
                    <Link
                      to="/beneficio"
                      search={{ batch: batch.id }}
                      className="flex min-h-11 items-center justify-between rounded-xl border border-border/60 px-3 text-sm hover:bg-elevated/60"
                    >
                      <span>
                        <span className="block font-medium text-fg">{name}</span>
                        <span className="text-xs text-muted">
                          {batch.code} · {UNIT_CEREZA} {fmtNum(batch.kgCereza, 1)}{" "}
                          · ahora {fmtNum(batch.kgActual, 1)} kg
                          {phase === "pergamino" ? ` · ${UNIT_PERGAMINO}` : ""}
                        </span>
                      </span>
                      <Badge
                        tone={
                          batch.saleId
                            ? "ok"
                            : phase === "pergamino"
                              ? "ok"
                              : "accent"
                        }
                      >
                        {nextLabel}
                      </Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
