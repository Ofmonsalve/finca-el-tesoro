import { createFileRoute } from "@tanstack/react-router";
import { Kpi } from "@/components/kpi";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { fmtKg, fmtMoney, fmtNum, fmtPct } from "@/lib/format";
import { LOTS } from "@/lib/lots";
import { farmStats } from "@/lib/stats";
import { useFarm } from "@/lib/store";

export const Route = createFileRoute("/finanzas")({ component: Page });

function Page() {
  const S = farmStats(useFarm());
  const C = S.cargaBook;
  const precioCps = S.kgCpsVendido > 0 ? S.ing / S.kgCpsVendido : 0;
  const beCargas =
    precioCps > 0 ? S.costoTotal / (precioCps * 125) : 0;
  const ranked = [...S.pnl].filter((r) => r.kg > 0 || r.ing > 0).sort(
    (a, b) => b.margen - a.margen,
  );
  const leader = ranked[0];

  const scenarios = [0.85, 1, 1.15].map((f) => {
    const ing = S.ing
      ? S.ing * f
      : C.denomKg * 18000 * f;
    const margen = ing - S.costoTotal;
    return { f, ing, margen };
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
          Dirección
        </p>
        <h1 className="font-display text-4xl tracking-tight">Finanzas</h1>
        <p className="mt-2 text-sm text-muted">
          Margen, punto de equilibrio y sensibilidad. Todo se recalcula desde
          cosecha, gastos y ventas — sin hojas paralelas.
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Ingresos" value={fmtMoney(S.ing)} />
        <Kpi label="Costo total" value={fmtMoney(S.costoTotal)} />
        <Kpi label="Margen" value={fmtMoney(S.margen)} />
        <Kpi
          label="Lote líder"
          value={leader ? leader.code : "—"}
          hint={leader ? fmtMoney(leader.margen) : "Sin kg ni ventas"}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Costo por carga y equilibrio</CardTitle>
          <CardHint>
            1 carga = 125 kg de pergamino. El equilibrio usa precio de venta de
            CPS, no de cereza.
          </CardHint>
          <dl className="mt-4 space-y-2 text-sm">
            <Row
              k="Costo / kg cereza (cosecha)"
              v={S.kg ? fmtMoney(S.unitCereza) : "—"}
            />
            <Row
              k="Costo / kg CPS"
              v={C.denomKg ? fmtMoney(C.totalPorKgCps) : "—"}
            />
            <Row
              k="Costo / carga"
              v={C.denomCargas ? fmtMoney(C.totalPorCarga) : "—"}
            />
            <Row
              k="Costo / arroba"
              v={C.denomKg ? fmtMoney(C.totalPorArroba) : "—"}
            />
            <Row
              k="Precio medio CPS vendido"
              v={precioCps ? fmtMoney(precioCps) : "Sin ventas de pergamino"}
            />
            <Row
              k="Equilibrio (cargas)"
              v={
                beCargas
                  ? fmtNum(beCargas, 2)
                  : "Requiere precio CPS > costo CPS"
              }
            />
            <Row k="CPS estimado" v={S.kg ? fmtKg(S.cps) : "—"} />
          </dl>
        </Card>
        <Card>
          <CardTitle>Sensibilidad de ingresos</CardTitle>
          <CardHint>
            −15 % / base / +15 %. Sin ventas, referencia $ 18.000 / kg
            pergamino sobre el CPS estimado.
          </CardHint>
          <div className="mt-4">
            <Table>
              <thead>
                <tr>
                  <Th>Escenario</Th>
                  <Th className="text-right">Ingresos</Th>
                  <Th className="text-right">Margen</Th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((sc) => (
                  <tr key={sc.f}>
                    <Td>{fmtNum((sc.f - 1) * 100, 0)} %</Td>
                    <Td className="text-right tabular">{fmtMoney(sc.ing)}</Td>
                    <Td className="text-right tabular">
                      {fmtMoney(sc.margen)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Margen por lote</CardTitle>
        <CardHint>
          Margen = ingreso del lote − costo asignado. Venta ligada a un lote
          de beneficio (o al código de lote) es directa; el resto se prorratea
          por kg de cereza, igual que los gastos de finca.
        </CardHint>
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Lote</Th>
                <Th className="text-right">Kg</Th>
                <Th className="text-right">Costo</Th>
                <Th className="text-right">Ingreso dir.</Th>
                <Th className="text-right">Ingreso pror.</Th>
                <Th className="text-right">Ingreso</Th>
                <Th className="text-right">Margen</Th>
                <Th className="text-right">Margen %</Th>
                <Th className="text-right">$/kg</Th>
                <Th className="text-right">$/carga</Th>
              </tr>
            </thead>
            <tbody>
              {S.pnl.map((r) => (
                <tr key={r.code}>
                  <Td>
                    {r.code}{" "}
                    <span className="text-muted">{LOTS[r.code].nombre}</span>
                  </Td>
                  <Td className="text-right tabular">{fmtNum(r.kg, 1)}</Td>
                  <Td className="text-right tabular">{fmtMoney(r.costo)}</Td>
                  <Td className="text-right tabular">{fmtMoney(r.ingDir)}</Td>
                  <Td className="text-right tabular">{fmtMoney(r.ingPr)}</Td>
                  <Td className="text-right tabular">{fmtMoney(r.ing)}</Td>
                  <Td
                    className={`text-right tabular ${r.margen < 0 ? "text-danger" : ""}`}
                  >
                    {fmtMoney(r.margen)}
                  </Td>
                  <Td className="text-right tabular">
                    {r.margenPct != null ? fmtPct(r.margenPct) : "—"}
                  </Td>
                  <Td className="text-right tabular">
                    {r.kg ? fmtMoney(r.margenKg) : "—"}
                  </Td>
                  <Td className="text-right tabular">
                    {r.kg ? fmtMoney(r.margenCarga) : "—"}
                  </Td>
                </tr>
              ))}
              <tr>
                <Td>Finca</Td>
                <Td className="text-right tabular">{fmtNum(S.kg, 1)}</Td>
                <Td className="text-right tabular">{fmtMoney(S.costoTotal)}</Td>
                <Td className="text-right tabular">
                  {fmtMoney(S.pnl.reduce((a, r) => a + r.ingDir, 0))}
                </Td>
                <Td className="text-right tabular">
                  {fmtMoney(S.pnl.reduce((a, r) => a + r.ingPr, 0))}
                </Td>
                <Td className="text-right tabular">{fmtMoney(S.ing)}</Td>
                <Td
                  className={`text-right tabular ${S.margen < 0 ? "text-danger" : ""}`}
                >
                  {fmtMoney(S.margen)}
                </Td>
                <Td className="text-right tabular">
                  {S.ing ? fmtPct((S.margen / S.ing) * 100) : "—"}
                </Td>
                <Td className="text-right tabular">
                  {S.kg ? fmtMoney(S.margen / S.kg) : "—"}
                </Td>
                <Td className="text-right tabular">
                  {S.cargaBook.denomCargas
                    ? fmtMoney(S.margen / S.cargaBook.denomCargas)
                    : "—"}
                </Td>
              </tr>
            </tbody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardTitle>Notas de lectura</CardTitle>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>
            El costo de cosecha incluye jornal o kg y alimentación, nunca
            duplicados.
          </li>
          <li>
            La cartera es venta menos cobrado. El margen usa costo total
            (cosecha + gastos).
          </li>
          <li>
            Valor de finca y cap-rate se tratan en la tesis de inversión; este
            módulo cubre operación del año de cosecha.
          </li>
        </ul>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-2">
      <dt className="text-muted">{k}</dt>
      <dd className="tabular text-fg">{v}</dd>
    </div>
  );
}
