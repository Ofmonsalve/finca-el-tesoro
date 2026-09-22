import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Kpi } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { rollupFarmBook } from "@/lib/farm-consolidado";
import { displayFarmName, useFarmRegistry } from "@/lib/farm-registry";
import { fmtKg, fmtMoney, fmtNum, todayISO } from "@/lib/format";
import { areaActiva, harvestLots } from "@/lib/lots";
import { sessionsOn } from "@/lib/stats";
import { useFarm } from "@/lib/store";

export const Route = createFileRoute("/estado")({ component: EstadoPage });

/**
 * Finca · Pulso — glance de las 6 métricas (orden contrato):
 * Entra → Sale → Cosecha → Vendible → Costo/kg → Talento; luego alertas.
 * Predio / titularidad solo aquí (nivel finca), siempre con nombre de finca.
 */
function EstadoPage() {
  const farm = useFarm();
  const farms = useFarmRegistry((s) => s.farms);
  const name = displayFarmName(farm.farmId, farms);

  const rollup = useMemo(
    () =>
      rollupFarmBook(farm.farmId, name, {
        farmId: farm.farmId,
        settings: farm.settings,
        sessions: farm.sessions,
        batches: farm.batches,
        liquidations: farm.liquidations,
        sales: farm.sales,
        costs: farm.costs,
        journals: farm.journals,
        lots: farm.lots,
      }),
    [
      farm.farmId,
      farm.settings,
      farm.sessions,
      farm.batches,
      farm.liquidations,
      farm.sales,
      farm.costs,
      farm.journals,
      farm.lots,
      name,
    ],
  );

  const ha = areaActiva(farm.lots);
  const active = harvestLots(farm.lots);
  const today = sessionsOn(farm.sessions, todayISO());
  const kgHoy = today.reduce((a, s) => a + s.totKg, 0);

  const hasIn = rollup.moneyIn > 0;
  const hasOut = rollup.moneyOut > 0;
  const hasCosecha = rollup.kgCereza > 0;
  const hasVendible = rollup.kgVendible > 0;
  const hasTalento = rollup.talentoPay > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
            Finca · Pulso
          </p>
          <h1 className="font-display text-4xl tracking-tight">{name}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Solo esta finca. Cada cifra lleva su nombre. Los kg se marcan cereza
            o pergamino.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/cosecha" search={{ ses: undefined, lote: undefined, nuevo: undefined }}>
              Registrar cosecha
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/beneficio" search={{ batch: undefined }}>
              Grano / beneficio
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/lotes">Ver lotes</Link>
          </Button>
        </div>
      </header>

      {/* Predio solo en Pulso de finca */}
      <Card>
        <CardTitle>Predio · {name}</CardTitle>
        <CardHint>
          Resumen simple del predio. Sin inventar lo que el libro no tiene.
        </CardHint>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">
              Nombre · {name}
            </dt>
            <dd className="mt-1 font-medium">{rollup.predio.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">
              Área · {name}
            </dt>
            <dd className="mt-1 font-medium tabular">
              {ha > 0 ? `${fmtNum(ha, 2)} ha` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">
              Lotes · {name}
            </dt>
            <dd className="mt-1 font-medium tabular">
              {active.length} activos · {rollup.lotCount} en libro
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">
              Responsable · {name}
            </dt>
            <dd className="mt-1 font-medium">
              {rollup.predio.responsable || "—"}
            </dd>
          </div>
        </dl>
      </Card>

      {/* Orden: Entra → Sale → Cosecha → Vendible → Costo/kg → Talento */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi
          label={`Entra · ${name}`}
          value={hasIn ? fmtMoney(rollup.moneyIn) : "—"}
          hint={hasIn ? "Ventas de esta finca" : "Sin ventas registradas"}
        />
        <Kpi
          label={`Sale · ${name}`}
          value={hasOut ? fmtMoney(rollup.moneyOut) : "—"}
          hint={
            hasOut
              ? "Cosecha + gastos de esta finca"
              : "Sin salidas registradas"
          }
        />
        <Kpi
          label={`Cosecha · kg cereza · ${name}`}
          value={hasCosecha ? fmtNum(rollup.kgCereza, 1) : "—"}
          hint={
            hasCosecha
              ? `Hoy ${fmtKg(kgHoy)} · ${today.length} sesión(es)`
              : "Aún no hay cosecha"
          }
        />
        <Kpi
          label={`Vendible · kg pergamino · ${name}`}
          value={hasVendible ? fmtNum(rollup.kgVendible, 1) : "—"}
          hint={
            hasVendible
              ? "kg pergamino en bodega, sin vender"
              : "Sin pergamino listo"
          }
        />
        <Kpi
          label={`Costo / kg cereza · ${name}`}
          value={rollup.costoKg != null ? fmtMoney(rollup.costoKg) : "—"}
          hint={
            rollup.costoKg != null
              ? "Costo cosecha ÷ kg cereza"
              : "Se calcula con kg cereza"
          }
        />
        <Kpi
          label={`Talento · gente · ${name}`}
          value={hasTalento ? fmtMoney(rollup.talentoPay) : "—"}
          hint={
            hasTalento
              ? `Jornales / pagos · pend. ${fmtMoney(rollup.pendMO)}`
              : "Aún no hay pagos a gente"
          }
        />
      </div>

      {!hasCosecha && !hasIn && !hasOut ? (
        <Card>
          <CardTitle>Esta finca está en calma · {name}</CardTitle>
          <CardHint>
            Registre una cosecha o una venta y el pulso cobrará vida. No
            inventamos números.
          </CardHint>
        </Card>
      ) : null}

      {rollup.alerts.length ? (
        <Card>
          <CardTitle>Alertas · {name}</CardTitle>
          <ul className="mt-3 space-y-1">
            {rollup.alerts.map((a) => (
              <li key={a} className="text-sm text-amber-200/90">
                {a} · {name}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Beneficio · {name}</CardTitle>
        <CardHint>
          No aparece en el menú de arriba. Entre por «Beneficio / pergamino» o
          al guardar una cosecha.
        </CardHint>
      </Card>
    </div>
  );
}
