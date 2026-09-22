import { createFileRoute, Link } from "@tanstack/react-router";
import { Kpi } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { displayFarmName, useFarmRegistry } from "@/lib/farm-registry";
import { fmtKg, fmtMoney, fmtNum, todayISO } from "@/lib/format";
import { areaActiva, harvestLots } from "@/lib/lots";
import { farmStats, sessionsOn } from "@/lib/stats";
import { useFarm } from "@/lib/store";

export const Route = createFileRoute("/estado")({ component: EstadoPage });

/**
 * Finca · Estado — panorama de la finca activa.
 * Beneficio no es menú de arriba: se entra desde aquí o desde Cosecha.
 */
function EstadoPage() {
  const farm = useFarm();
  const farms = useFarmRegistry((s) => s.farms);
  const name = displayFarmName(farm.farmId, farms);
  const S = farmStats(farm);
  const ha = areaActiva(farm.lots);
  const active = harvestLots(farm.lots);
  const today = sessionsOn(farm.sessions, todayISO());
  const kgHoy = today.reduce((a, s) => a + s.totKg, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
            Finca · Estado
          </p>
          <h1 className="font-display text-4xl tracking-tight">{name}</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Solo esta finca. Los kg se marcan como cereza (cosecha) o pergamino
            (después del beneficio).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/cosecha" search={{ ses: undefined, lote: undefined }}>
              Registrar cosecha
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/beneficio" search={{ batch: undefined }}>
              Beneficio / pergamino
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/lotes">Ver lotes</Link>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label={`Kg cereza · ${name}`}
          value={fmtNum(S.kg, 1)}
          hint="Acumulado · esta finca"
        />
        <Kpi
          label={`Hoy cereza · ${name}`}
          value={fmtKg(kgHoy)}
          hint={`${today.length} sesión(es)`}
        />
        <Kpi
          label={`Costo cosecha · ${name}`}
          value={fmtMoney(S.costoCosecha)}
          hint="M.O. + alimentación"
        />
        <Kpi
          label={`Pagos pendientes · ${name}`}
          value={fmtMoney(S.pendMO)}
          hint="Gente por pagar"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label={`Lotes activos · ${name}`}
          value={String(active.length)}
          hint={`${fmtNum(ha, 2)} ha`}
        />
        <Kpi
          label={`Pergamino est. · ${name}`}
          value={S.kg ? fmtKg(S.yieldBook.cpsEst) : "—"}
          hint="Estimado a pergamino"
        />
        <Kpi
          label={`Rendimiento · ${name}`}
          value={S.kg ? `${fmtNum(S.yieldBook.rPct, 1)} %` : "—"}
          hint="Cereza → pergamino"
        />
        <Kpi
          label={`En beneficio · ${name}`}
          value={String(S.inProcess ?? 0)}
          hint="Lotes de grano en proceso"
        />
      </div>

      <Card>
        <CardTitle>Beneficio</CardTitle>
        <CardHint>
          No aparece en el menú de arriba. Entre por «Beneficio / pergamino» o al
          guardar una cosecha.
        </CardHint>
      </Card>
    </div>
  );
}
