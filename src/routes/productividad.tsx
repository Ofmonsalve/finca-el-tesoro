import { createFileRoute } from "@tanstack/react-router";
import { ConversionChart, LotBarChart } from "@/components/charts/farm-charts";
import { Kpi } from "@/components/kpi";
import { Badge } from "@/components/ui/badge";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { fmtKg, fmtMoney, fmtNum, fmtPct, fmtRatio } from "@/lib/format";
import { harvestLots, lotNombre } from "@/lib/lots";
import { farmStats } from "@/lib/stats";
import { useFarm } from "@/lib/store";
import { FORMULAS, STAGE_RETAIN, classifyFactor } from "@/lib/yield";

export const Route = createFileRoute("/productividad")({ component: Page });

function Page() {
  const farm = useFarm();
  const S = farmStats(farm);
  const Y = S.yieldBook;
  const lotData = harvestLots(farm.lots).map((l) => ({
    lote: l.code.replace("FT-", ""),
    kg: S.byLot[l.code]?.kg || 0,
  }));
  const funnel = [
    { name: "Cereza", kg: Y.kgCereza, expected: Y.kgCereza },
    {
      name: "Tras flotación",
      kg: Y.kgCereza * STAGE_RETAIN.flotacion,
      expected: Y.kgCereza * STAGE_RETAIN.flotacion,
    },
    {
      name: "Despulpado",
      kg: Y.kgCereza * STAGE_RETAIN.despulpado,
      expected: Y.kgCereza * STAGE_RETAIN.despulpado,
    },
    {
      name: "Lavado",
      kg: Y.kgCereza * STAGE_RETAIN.lavado,
      expected: Y.kgCereza * STAGE_RETAIN.lavado,
    },
    {
      name: "CPS est.",
      kg: Y.cpsEst,
      expected: Y.cpsEst,
    },
    {
      name: "CPS bodega",
      kg: Y.cpsReal ?? 0,
      expected: Y.cpsEst,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
          Analítica
        </p>
        <h1 className="font-display text-4xl tracking-tight">Productividad</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Dos capas: eficiencia de cosecha (kg/h) y rendimiento de beneficio
          (cereza → pergamino). El segundo mueve el ingreso: un factor de 5,5
          frente a 6,0 es 9 % más de CPS por el mismo kilo recolectado.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Kg / hora" value={S.hrs ? fmtNum(S.kgh, 2) : "—"} />
        <Kpi label="Horas" value={fmtNum(S.hrs, 1)} />
        <Kpi
          label="Kg / recolector"
          value={
            S.workers.length ? fmtNum(S.kg / S.workers.length, 1) : "—"
          }
        />
        <Kpi
          label="Factor plan"
          value={fmtRatio(Y.factorPlanW)}
          hint={`${fmtPct(Y.rPctEst)} de cereza`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="CPS estimado"
          value={Y.kgCereza ? fmtKg(Y.cpsEst) : "—"}
          hint={`${fmtNum(Y.cargasEst, 2)} cargas`}
        />
        <Kpi
          label="CPS real (bodega)"
          value={Y.cpsReal != null ? fmtKg(Y.cpsReal) : "Pendiente"}
          hint={
            Y.factorReal != null
              ? `Factor ${fmtRatio(Y.factorReal)}`
              : "Pese al secar"
          }
        />
        <Kpi
          label="Rendimiento"
          value={fmtPct(Y.rPct)}
          hint={Y.band.label}
        />
        <Kpi
          label="Cargas / ha"
          value={Y.kgCereza ? fmtNum(Y.cargasHa, 2) : "—"}
          hint={`${fmtNum(Y.cpsHa, 0)} kg CPS/ha`}
        />
      </div>

      <Card>
        <CardTitle>Cálculo de rendimiento</CardTitle>
        <CardHint>
          Identidades que usa el sistema. El factor de la sesión estima; el
          peso en bodega confirma.
        </CardHint>
        <ol className="mt-5 space-y-4">
          {FORMULAS.map((f, i) => (
            <li
              key={f.id}
              className="rounded-xl border border-border bg-elevated/40 px-4 py-3"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-xs text-subtle">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-medium">{f.name}</span>
              </div>
              <p className="mt-1 font-mono text-sm text-accent">{f.latex}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {f.detail}
              </p>
            </li>
          ))}
        </ol>
        <div className="mt-5 overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <Th>Factor F</Th>
                <Th className="text-right">R %</Th>
                <Th className="text-right">CPS / 100 kg cereza</Th>
                <Th>Clase</Th>
              </tr>
            </thead>
            <tbody>
              {[5, 5.2, 5.5, 5.8, 6, 6.5, 7].map((f) => {
                const band = classifyFactor(f);
                return (
                  <tr key={f}>
                    <Td className="tabular">{fmtRatio(f)}</Td>
                    <Td className="text-right tabular">
                      {fmtPct(100 / f, 2)}
                    </Td>
                    <Td className="text-right tabular">
                      {fmtNum(100 / f, 2)} kg
                    </Td>
                    <Td>
                      <Badge tone={band.tone}>{band.label}</Badge>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Ejemplo: 92,5 kg de cereza con F = 6 → 15,42 kg CPS (0,12 cargas).
          Si el mismo lote seca 16,8 kg, F real = 5,51 (muy bueno) y hay +1,38
          kg frente al plan.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Cascada de masa</CardTitle>
          <CardHint>
            Esperado por etapa sobre la cereza acumulada. CPS bodega es el
            único punto medido de rendimiento.
          </CardHint>
          <ConversionChart data={funnel} />
        </Card>
        <Card>
          <CardTitle>Equivalencias FNC</CardTitle>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-border px-3 py-3">
              <dt className="text-xs uppercase tracking-wider text-subtle">
                Arrobas est.
              </dt>
              <dd className="mt-1 font-display text-xl tabular">
                {fmtNum(Y.arrobasEst, 2)}
              </dd>
            </div>
            <div className="rounded-xl border border-border px-3 py-3">
              <dt className="text-xs uppercase tracking-wider text-subtle">
                Cargas est.
              </dt>
              <dd className="mt-1 font-display text-xl tabular">
                {fmtNum(Y.cargasEst, 2)}
              </dd>
            </div>
            <div className="rounded-xl border border-border px-3 py-3">
              <dt className="text-xs uppercase tracking-wider text-subtle">
                Excelso est.
              </dt>
              <dd className="mt-1 font-display text-xl tabular">
                {fmtKg(Y.excelsoEst)}
              </dd>
              <p className="mt-1 text-xs text-muted">70/88 de CPS</p>
            </div>
            <div className="rounded-xl border border-border px-3 py-3">
              <dt className="text-xs uppercase tracking-wider text-subtle">
                Kg cereza / ha
              </dt>
              <dd className="mt-1 font-display text-xl tabular">
                {Y.kgCereza ? fmtNum(Y.kgHa, 0) : "—"}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            1 carga = 125 kg CPS = 10 arrobas. Santander en finca tradicional
            suele moverse entre 12 y 20 cargas/ha; el Centro (soca 3 años)
            debe liderar. 5.500 kg cereza de 2024 (lotes incompletos) ≈ 7,3
            cargas a factor 6.
          </p>
        </Card>
      </div>

      <Card>
        <CardTitle>Merma por etapa (pesada)</CardTitle>
        <CardHint>
          Vanos = pérdida comercial. Pulpa y agua = conversión. Estado alta
          si supera 1,35 × lo esperado.
        </CardHint>
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Etapa</Th>
                <Th>Naturaleza</Th>
                <Th className="text-right">Kg in</Th>
                <Th className="text-right">Merma kg</Th>
                <Th className="text-right">Merma %</Th>
                <Th className="text-right">Esp. %</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {S.mermaBook.map((m) => (
                <tr key={m.stage}>
                  <Td>{m.label}</Td>
                  <Td className="text-muted">{m.nature}</Td>
                  <Td className="text-right tabular">{fmtNum(m.kgIn, 1)}</Td>
                  <Td className="text-right tabular">{fmtNum(m.mermaKg, 1)}</Td>
                  <Td className="text-right tabular">{fmtPct(m.mermaPct)}</Td>
                  <Td className="text-right tabular">{fmtPct(m.expectedPct)}</Td>
                  <Td>
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
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <p className="mt-3 text-sm text-muted">
          $ / carga CPS:{" "}
          <b className="text-fg">
            {S.cargaBook.denomCargas
              ? fmtMoney(S.cargaBook.totalPorCarga)
              : "—"}
          </b>
          {S.cargaBook.vanosKg
            ? ` · vanos ${fmtNum(S.cargaBook.vanosKg, 1)} kg · costo ${fmtMoney(S.cargaBook.costoVanos)}`
            : ""}
        </p>
      </Card>

      <Card>
        <CardTitle>Rendimiento por lote</CardTitle>
        <CardHint>
          CPS est. usa el factor de cada sesión. CPS real aparece cuando el
          lote de beneficio llega a bodega.
        </CardHint>
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Lote</Th>
                <Th className="text-right">Ha</Th>
                <Th className="text-right">Cereza</Th>
                <Th className="text-right">CPS est.</Th>
                <Th className="text-right">CPS real</Th>
                <Th className="text-right">F</Th>
                <Th className="text-right">R %</Th>
                <Th className="text-right">Cargas/ha</Th>
                <Th>Clase</Th>
              </tr>
            </thead>
            <tbody>
              {Y.byLot.map((r) => (
                <tr key={r.lote}>
                  <Td>
                    {r.lote} {lotNombre(farm.lots, r.lote)}
                  </Td>
                  <Td className="text-right tabular">{fmtNum(r.ha, 2)}</Td>
                  <Td className="text-right tabular">{fmtNum(r.kgCereza, 1)}</Td>
                  <Td className="text-right tabular">{fmtNum(r.cpsEst, 2)}</Td>
                  <Td className="text-right tabular">
                    {r.cpsReal != null ? fmtNum(r.cpsReal, 2) : "—"}
                  </Td>
                  <Td className="text-right tabular">
                    {fmtRatio(r.factorReal ?? r.factorPlanW)}
                  </Td>
                  <Td className="text-right tabular">{fmtPct(r.rPct)}</Td>
                  <Td className="text-right tabular">
                    {r.kgCereza ? fmtNum(r.cargasHa, 2) : "—"}
                  </Td>
                  <Td>
                    <Badge tone={r.band.tone}>{r.band.label}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardTitle>Lotes de beneficio · factor real</CardTitle>
        <CardHint>
          Δ kg = CPS bodega − CPS estimado. Positivo = más pergamino del
          plan.
        </CardHint>
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Código</Th>
                <Th>Lote</Th>
                <Th className="text-right">Cereza</Th>
                <Th className="text-right">CPS est.</Th>
                <Th className="text-right">Bodega</Th>
                <Th className="text-right">F real</Th>
                <Th className="text-right">Δ kg</Th>
                <Th>Clase</Th>
              </tr>
            </thead>
            <tbody>
              {Y.batches.map((b) => (
                <tr key={b.code}>
                  <Td className="font-mono text-xs">{b.code}</Td>
                  <Td>{b.lote}</Td>
                  <Td className="text-right tabular">{fmtNum(b.kgCereza, 1)}</Td>
                  <Td className="text-right tabular">{fmtNum(b.cpsEst, 2)}</Td>
                  <Td className="text-right tabular">
                    {b.kgBodega != null ? fmtNum(b.kgBodega, 2) : "—"}
                  </Td>
                  <Td className="text-right tabular">
                    {b.factorReal != null ? fmtRatio(b.factorReal) : "—"}
                  </Td>
                  <Td className="text-right tabular">
                    {b.deltaKg != null
                      ? `${b.deltaKg >= 0 ? "+" : ""}${fmtNum(b.deltaKg, 2)}`
                      : "—"}
                  </Td>
                  <Td>
                    <Badge tone={b.band.tone}>{b.band.label}</Badge>
                  </Td>
                </tr>
              ))}
              {!Y.batches.length ? (
                <tr>
                  <Td colSpan={8} className="text-muted">
                    Sin lotes de beneficio. Guarde una sesión de cosecha.
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardTitle>Cosecha por lote (kg/h)</CardTitle>
        <LotBarChart data={lotData} />
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Lote</Th>
                <Th className="text-right">Kg</Th>
                <Th className="text-right">Horas</Th>
                <Th className="text-right">Kg/h</Th>
                <Th className="text-right">Kg/ha</Th>
                <Th className="text-right">$/kg</Th>
              </tr>
            </thead>
            <tbody>
              {harvestLots(farm.lots).map((L) => {
                const o = S.byLot[L.code] ?? { kg: 0, cost: 0, hrs: 0, n: 0 };
                const ha = L.areaHa;
                return (
                  <tr key={L.code}>
                    <Td>
                      {L.code} {L.nombre}
                    </Td>
                    <Td className="text-right tabular">{fmtNum(o.kg, 1)}</Td>
                    <Td className="text-right tabular">{fmtNum(o.hrs, 1)}</Td>
                    <Td className="text-right tabular">
                      {o.hrs ? fmtNum(o.kg / o.hrs, 2) : "—"}
                    </Td>
                    <Td className="text-right tabular">
                      {ha ? fmtNum(o.kg / ha, 0) : "—"}
                    </Td>
                    <Td className="text-right tabular">
                      {o.kg ? fmtMoney(o.cost / o.kg) : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardTitle>Por recolector</CardTitle>
        <CardHint>Ranking de kg en la cosecha registrada.</CardHint>
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Nombre</Th>
                <Th className="text-right">Días</Th>
                <Th className="text-right">Kg</Th>
                <Th className="text-right">Horas</Th>
                <Th className="text-right">Kg/h</Th>
                <Th className="text-right">Pago</Th>
              </tr>
            </thead>
            <tbody>
              {S.workers.map((w) => (
                <tr key={w.nombre}>
                  <Td>{w.nombre}</Td>
                  <Td className="text-right tabular">{w.dias}</Td>
                  <Td className="text-right tabular">{fmtNum(w.kg, 1)}</Td>
                  <Td className="text-right tabular">{fmtNum(w.hrs, 1)}</Td>
                  <Td className="text-right tabular">
                    {w.hrs ? fmtNum(w.kg / w.hrs, 2) : "—"}
                  </Td>
                  <Td className="text-right tabular">{fmtMoney(w.pago)}</Td>
                </tr>
              ))}
              {!S.workers.length ? (
                <tr>
                  <Td colSpan={6} className="text-muted">
                    Sin datos. Registre el pase 1.
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
