import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Kpi } from "@/components/kpi";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { buildConsolidado, rollupFarmBook } from "@/lib/farm-consolidado";
import { displayFarmName, useFarmRegistry } from "@/lib/farm-registry";
import { fmtKg, fmtMoney, fmtNum, fmtPct } from "@/lib/format";
import { lotNombre } from "@/lib/lots";
import { farmStats } from "@/lib/stats";
import { useFarm } from "@/lib/store";

export const Route = createFileRoute("/finanzas")({ component: Page });

/**
 * Inteligencia — detalle de las mismas 6 métricas de Pulso (orden contrato):
 * Entra → Sale → Cosecha → Vendible → Costo/kg → Talento; luego alertas.
 * Toda cifra con nombre de finca. Sin promedios entre unidades distintas.
 */
function Page() {
  const farm = useFarm();
  const farms = useFarmRegistry((s) => s.farms);
  const name = displayFarmName(farm.farmId, farms);
  const S = farmStats(farm);
  const C = S.cargaBook;

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

  const consolidado = useMemo(
    () => buildConsolidado(farms),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [farms, farm.sessions, farm.sales, farm.costs, farm.batches, farm.liquidations],
  );

  const precioCps = S.kgCpsVendido > 0 ? S.ing / S.kgCpsVendido : 0;
  const beCargas = precioCps > 0 ? S.costoTotal / (precioCps * 125) : 0;
  const ranked = [...S.pnl]
    .filter((r) => r.kg > 0 || r.ing > 0)
    .sort((a, b) => b.margen - a.margen);
  const leader = ranked[0];

  const scenarios = [0.85, 1, 1.15].map((f) => {
    const ing = S.ing ? S.ing * f : C.denomKg * 18000 * f;
    return { f, ing, margen: ing - S.costoTotal };
  });

  const hasIn = rollup.moneyIn > 0;
  const hasOut = rollup.moneyOut > 0;
  const hasCosecha = rollup.kgCereza > 0;
  const hasVendible = rollup.kgVendible > 0;
  const hasTalento = rollup.talentoPay > 0;
  const multi = farms.length > 1;
  const scopeAll = "todas las fincas";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
          Inteligencia
        </p>
        <h1 className="font-display text-4xl tracking-tight">Inteligencia</h1>
        <p className="mt-2 text-sm text-muted">
          Detalle de las mismas seis cifras de Pulso. Primero el dinero que
          entra y sale; kg siempre marcados cereza o pergamino; cada número con
          el nombre de su finca.
        </p>
      </header>

      {/* 6 métricas — orden contrato */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi
          label={`Entra · ${name}`}
          value={hasIn ? fmtMoney(rollup.moneyIn) : "—"}
          hint={hasIn ? "Ventas" : "Sin ventas aún"}
        />
        <Kpi
          label={`Sale · ${name}`}
          value={hasOut ? fmtMoney(rollup.moneyOut) : "—"}
          hint={hasOut ? "Cosecha + gastos" : "Sin salidas aún"}
        />
        <Kpi
          label={`Cosecha · kg cereza · ${name}`}
          value={hasCosecha ? fmtNum(rollup.kgCereza, 1) : "—"}
          hint="Período en el libro"
        />
        <Kpi
          label={`Vendible · kg pergamino · ${name}`}
          value={hasVendible ? fmtNum(rollup.kgVendible, 1) : "—"}
          hint="Bodega, sin vender"
        />
        <Kpi
          label={`Costo / kg cereza · ${name}`}
          value={rollup.costoKg != null ? fmtMoney(rollup.costoKg) : "—"}
          hint={
            rollup.costoKg != null
              ? "Costo cosecha ÷ kg cereza"
              : "Requiere kg cereza"
          }
        />
        <Kpi
          label={`Talento · gente · ${name}`}
          value={hasTalento ? fmtMoney(rollup.talentoPay) : "—"}
          hint={
            hasTalento
              ? `Jornales / pagos · pend. ${fmtMoney(rollup.pendMO)}`
              : "Sin pagos a gente"
          }
        />
      </div>

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

      {!hasIn && !hasOut && !hasCosecha ? (
        <Card>
          <CardTitle>Sin movimiento aún · {name}</CardTitle>
          <CardHint>
            Preferimos el vacío honesto a un promedio falso. Cuando haya ventas
            o cosecha, Inteligencia mostrará el detalle.
          </CardHint>
        </Card>
      ) : null}

      {multi ? (
        <Card>
          <CardTitle>Las seis cifras · por finca</CardTitle>
          <CardHint>
            Cada fila lleva el nombre de su finca. No promediamos costo/kg entre
            fincas: solo sumamos kg cereza con kg cereza y plata con plata.
          </CardHint>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Finca</Th>
                  <Th className="text-right">Entra</Th>
                  <Th className="text-right">Sale</Th>
                  <Th className="text-right">Kg cereza</Th>
                  <Th className="text-right">Kg pergamino</Th>
                  <Th className="text-right">Costo/kg cereza</Th>
                  <Th className="text-right">Talento</Th>
                </tr>
              </thead>
              <tbody>
                {consolidado.farms.map((f) => (
                  <tr key={f.farmId}>
                    <Td>{f.name}</Td>
                    <Td className="text-right tabular">
                      {f.moneyIn > 0 ? fmtMoney(f.moneyIn) : "—"}
                    </Td>
                    <Td className="text-right tabular">
                      {f.moneyOut > 0 ? fmtMoney(f.moneyOut) : "—"}
                    </Td>
                    <Td className="text-right tabular">
                      {f.kgCereza > 0 ? fmtNum(f.kgCereza, 1) : "—"}
                    </Td>
                    <Td className="text-right tabular">
                      {f.kgVendible > 0 ? fmtNum(f.kgVendible, 1) : "—"}
                    </Td>
                    <Td className="text-right tabular">
                      {f.costoKg != null ? fmtMoney(f.costoKg) : "—"}
                    </Td>
                    <Td className="text-right tabular">
                      {f.talentoPay > 0 ? fmtMoney(f.talentoPay) : "—"}
                    </Td>
                  </tr>
                ))}
                <tr>
                  <Td>Suma · {scopeAll}</Td>
                  <Td className="text-right tabular">
                    {consolidado.totalMoneyIn > 0
                      ? fmtMoney(consolidado.totalMoneyIn)
                      : "—"}
                  </Td>
                  <Td className="text-right tabular">
                    {consolidado.totalMoneyOut > 0
                      ? fmtMoney(consolidado.totalMoneyOut)
                      : "—"}
                  </Td>
                  <Td className="text-right tabular">
                    {consolidado.totalKgCereza > 0
                      ? fmtNum(consolidado.totalKgCereza, 1)
                      : "—"}
                  </Td>
                  <Td className="text-right tabular">
                    {consolidado.totalKgVendible > 0
                      ? fmtNum(consolidado.totalKgVendible, 1)
                      : "—"}
                  </Td>
                  <Td className="text-right tabular">
                    {consolidado.costoKg != null
                      ? fmtMoney(consolidado.costoKg)
                      : "—"}
                  </Td>
                  <Td className="text-right tabular">
                    {consolidado.totalTalentoPay > 0
                      ? fmtMoney(consolidado.totalTalentoPay)
                      : "—"}
                  </Td>
                </tr>
              </tbody>
            </Table>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={`Ingresos (libro) · ${name}`} value={fmtMoney(S.ing)} />
        <Kpi
          label={`Costo total (libro) · ${name}`}
          value={fmtMoney(S.costoTotal)}
        />
        <Kpi label={`Margen (libro) · ${name}`} value={fmtMoney(S.margen)} />
        <Kpi
          label={`Lote líder · ${name}`}
          value={leader ? leader.code : "—"}
          hint={leader ? fmtMoney(leader.margen) : "Sin kg ni ventas"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Costo por carga y equilibrio · {name}</CardTitle>
          <CardHint>
            1 carga = 125 kg de pergamino. El equilibrio usa precio CPS, no
            cereza.
          </CardHint>
          <dl className="mt-4 space-y-2 text-sm">
            <Row
              k={`Costo / kg cereza (cosecha) · ${name}`}
              v={S.kg ? fmtMoney(S.unitCereza) : "—"}
            />
            <Row
              k={`Costo / kg CPS · ${name}`}
              v={C.denomKg ? fmtMoney(C.totalPorKgCps) : "—"}
            />
            <Row
              k={`Costo / carga · ${name}`}
              v={C.denomCargas ? fmtMoney(C.totalPorCarga) : "—"}
            />
            <Row
              k={`Costo / arroba · ${name}`}
              v={C.denomKg ? fmtMoney(C.totalPorArroba) : "—"}
            />
            <Row
              k={`Precio medio CPS vendido · ${name}`}
              v={precioCps ? fmtMoney(precioCps) : "Sin ventas de pergamino"}
            />
            <Row
              k={`Equilibrio (cargas) · ${name}`}
              v={
                beCargas
                  ? fmtNum(beCargas, 2)
                  : "Requiere precio CPS > costo CPS"
              }
            />
            <Row
              k={`CPS estimado · ${name}`}
              v={S.kg ? fmtKg(S.cps) : "—"}
            />
          </dl>
        </Card>
        <Card>
          <CardTitle>Sensibilidad de ingresos · {name}</CardTitle>
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
        <CardTitle>Margen por lote · {name}</CardTitle>
        <CardHint>
          Margen = ingreso del lote − costo asignado. Sin mezclar cereza con
          pergamino.
        </CardHint>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <Th>Lote</Th>
                <Th className="text-right">Kg cereza</Th>
                <Th className="text-right">Costo</Th>
                <Th className="text-right">Ingreso dir.</Th>
                <Th className="text-right">Ingreso pror.</Th>
                <Th className="text-right">Ingreso</Th>
                <Th className="text-right">Margen</Th>
                <Th className="text-right">Margen %</Th>
                <Th className="text-right">$/kg cereza</Th>
                <Th className="text-right">$/carga</Th>
              </tr>
            </thead>
            <tbody>
              {S.pnl.map((r) => (
                <tr key={r.code}>
                  <Td>
                    {r.code}{" "}
                    <span className="text-muted">
                      {lotNombre(farm.lots, r.code)}
                    </span>
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
                <Td>Finca · {name}</Td>
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
        <CardTitle>Notas de lectura · {name}</CardTitle>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          <li>
            El costo de cosecha incluye jornal o kg y alimentación, nunca
            duplicados.
          </li>
          <li>
            No se promedian costo/kg entre fincas ni se mezclan cereza con
            pergamino.
          </li>
          <li>
            Talento habla de gente, jornales y roles — la pestaña del menú
            sigue llamándose Talento.
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
