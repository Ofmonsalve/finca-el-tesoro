import { createFileRoute, Link } from "@tanstack/react-router";
import { CostDonut, KgAreaChart, LotBarChart } from "@/components/charts/farm-charts";
import { Kpi } from "@/components/kpi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { fmtKg, fmtMoney, fmtNum, fmtPct, todayISO } from "@/lib/format";
import { HARVEST_LOTS, LOTS } from "@/lib/lots";
import { farmStats, sessionsOn } from "@/lib/stats";
import { useFarm } from "@/lib/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const farm = useFarm();
  const S = farmStats(farm);
  const today = sessionsOn(farm.sessions, todayISO());
  const lotBars = HARVEST_LOTS.map((c) => ({
    lote: c.replace("FT-", ""),
    kg: S.byLot[c]?.kg || 0,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
            Panel ejecutivo
          </p>
          <h1 className="font-display text-4xl tracking-tight">
            Finca El Tesoro
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Santander · 1.900 m s.n.m. · 0,87 ha arábica. Un solo libro:
            cosecha → beneficio → venta → asiento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/cosecha" search={{ ses: undefined }}>
              Registrar cosecha
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/beneficio" search={{ batch: undefined }}>
              Trazabilidad
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Kg cereza" value={fmtNum(S.kg, 1)} hint="Acumulado" />
        <Kpi
          label="Costo cosecha"
          value={fmtMoney(S.costoCosecha)}
          hint="M.O. + alimentación"
        />
        <Kpi
          label="Costo / kg cereza"
          value={S.kg ? fmtMoney(S.unitCereza) : "—"}
          hint="Solo cosecha"
        />
        <Kpi
          label="M.O. pendiente"
          value={fmtMoney(S.pendMO)}
          hint="Por liquidar"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="CPS estimado"
          value={S.kg ? fmtKg(S.yieldBook.cpsEst) : "—"}
          hint={`Factor ${S.yieldBook.factorPlanW.toFixed(2)}:1`}
        />
        <Kpi
          label="Rendimiento"
          value={S.kg ? fmtPct(S.yieldBook.rPct) : "—"}
          hint={S.yieldBook.band.label}
        />
        <Kpi
          label="Cargas est."
          value={S.kg ? fmtNum(S.yieldBook.cargasEst, 2) : "—"}
          hint="125 kg CPS / carga"
        />
        <Kpi
          label="$ / carga CPS"
          value={S.cargaBook.denomCargas ? fmtMoney(S.cargaBook.totalPorCarga) : "—"}
          hint="Costo total / 125 kg"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>Producción por día</CardTitle>
          <CardHint>Kg de cereza registrados</CardHint>
          <div className="mt-4">
            <KgAreaChart data={S.byDay} />
          </div>
        </Card>
        <Card>
          <CardTitle>Composición de costo</CardTitle>
          <CardHint>Cosecha vs otros gastos</CardHint>
          <CostDonut
            data={[
              { name: "Mano de obra", value: S.pay },
              { name: "Alimentación", value: S.alim },
              { name: "Otros", value: S.otherCosts },
            ]}
          />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Kg por lote</CardTitle>
          <LotBarChart data={lotBars} />
        </Card>
        <Card>
          <CardTitle>Hoy · {todayISO().split("-").reverse().join("/")}</CardTitle>
          <CardHint>
            {today.length
              ? `${today.length} sesión(es) · ${fmtKg(today.reduce((a, s) => a + s.totKg, 0))}`
              : "Aún no hay registro de hoy. Empiece por Cosecha."}
          </CardHint>
          <ul className="mt-4 space-y-2">
            {HARVEST_LOTS.map((c) => {
              const n = today.filter((s) => s.lote === c).length;
              return (
                <li
                  key={c}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    <span className="font-medium">{c}</span>
                    <span className="ml-2 text-muted">{LOTS[c].nombre}</span>
                  </span>
                  {n ? (
                    <Badge tone="ok">Listo</Badge>
                  ) : (
                    <Badge>Pendiente</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <Card>
        <CardTitle>Lotes · estado operativo</CardTitle>
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Lote</Th>
                <Th>Rol</Th>
                <Th className="text-right">Área ha</Th>
                <Th className="text-right">Kg</Th>
                <Th className="text-right">$/kg</Th>
                <Th>Acción</Th>
              </tr>
            </thead>
            <tbody>
              {HARVEST_LOTS.map((c) => {
                const o = S.byLot[c];
                const L = LOTS[c];
                return (
                  <tr key={c}>
                    <Td>
                      <b>{c}</b> {L.nombre}
                    </Td>
                    <Td className="text-muted">{L.rol}</Td>
                    <Td className="text-right tabular">{fmtNum(L.areaHa, 2)}</Td>
                    <Td className="text-right tabular">{fmtNum(o?.kg || 0, 1)}</Td>
                    <Td className="text-right tabular">
                      {o?.kg ? fmtMoney(o.cost / o.kg) : "—"}
                    </Td>
                    <Td className="text-muted">{L.accion}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
