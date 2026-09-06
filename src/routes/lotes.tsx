import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { fmtMoney, fmtNum } from "@/lib/format";
import { HARVEST_LOTS, LOTS } from "@/lib/lots";
import { farmStats } from "@/lib/stats";
import { useFarm } from "@/lib/store";

export const Route = createFileRoute("/lotes")({ component: Page });

function Page() {
  const S = farmStats(useFarm());
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
          Territorio
        </p>
        <h1 className="font-display text-4xl tracking-tight">Lotes</h1>
        <p className="mt-2 text-sm text-muted">
          Seis unidades sobre 0,87 ha. El mapa de campo y las cifras de
          cosecha viven en el mismo modelo.
        </p>
      </header>
      <Card className="overflow-hidden p-0">
        <img
          src="/finca-lotes.jpeg"
          alt="Mapa de lotes Finca El Tesoro"
          className="max-h-[420px] w-full object-cover object-center"
        />
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {HARVEST_LOTS.map((c) => {
          const L = LOTS[c];
          const o = S.byLot[c];
          return (
            <Card key={c}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-subtle">
                    {c}
                  </div>
                  <CardTitle>{L.nombre}</CardTitle>
                </div>
                <Badge tone="accent">{L.rol}</Badge>
              </div>
              <CardHint>{L.estado}</CardHint>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-subtle">Área</dt>
                  <dd className="tabular">{fmtNum(L.areaHa, 2)} ha</dd>
                </div>
                <div>
                  <dt className="text-subtle">Kg cereza</dt>
                  <dd className="tabular">{fmtNum(o.kg, 1)}</dd>
                </div>
                <div>
                  <dt className="text-subtle">Costo</dt>
                  <dd className="tabular">{fmtMoney(o.cost)}</dd>
                </div>
                <div>
                  <dt className="text-subtle">Acción</dt>
                  <dd>{L.accion}</dd>
                </div>
              </dl>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardTitle>Ranking de cosecha</CardTitle>
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Lote</Th>
                <Th className="text-right">Kg</Th>
                <Th className="text-right">Participación</Th>
              </tr>
            </thead>
            <tbody>
              {[...HARVEST_LOTS]
                .sort((a, b) => (S.byLot[b].kg || 0) - (S.byLot[a].kg || 0))
                .map((c, i) => (
                  <tr key={c}>
                    <Td className="tabular text-muted">{i + 1}</Td>
                    <Td>
                      {c} {LOTS[c].nombre}
                    </Td>
                    <Td className="text-right tabular">
                      {fmtNum(S.byLot[c].kg, 1)}
                    </Td>
                    <Td className="text-right tabular">
                      {S.kg
                        ? `${fmtNum((S.byLot[c].kg / S.kg) * 100, 1)} %`
                        : "—"}
                    </Td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
