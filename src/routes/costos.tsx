import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { CostDonut } from "@/components/charts/farm-charts";
import { Kpi } from "@/components/kpi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/fields";
import { Table, Td, Th } from "@/components/ui/table";
import { fmtDate, fmtKg, fmtMoney, fmtNum, fmtPct, n, todayISO } from "@/lib/format";
import { LOTS, LOT_CODES, type LotCode } from "@/lib/lots";
import { farmStats } from "@/lib/stats";
import { useFarm } from "@/lib/store";
import type { CostLine } from "@/lib/types";
import { uid } from "@/lib/utils";
import { WriteGate } from "@/components/write-gate";

export const Route = createFileRoute("/costos")({ component: Page });

const CATS: { id: CostLine["categoria"]; label: string }[] = [
  { id: "fertilizacion", label: "Fertilización" },
  { id: "arvenses", label: "Arvenses" },
  { id: "renovacion", label: "Renovación" },
  { id: "indirecto", label: "Indirectos" },
  { id: "otro", label: "Otro" },
];

function Page() {
  const farm = useFarm();
  const S = farmStats(farm);
  const sheet = S.sheet;
  const saveCost = useFarm((s) => s.saveCost);
  const [fecha, setFecha] = useState(todayISO());
  const [lote, setLote] = useState<LotCode | "">("");
  const [categoria, setCategoria] =
    useState<CostLine["categoria"]>("fertilizacion");
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function add() {
    const m = n(monto);
    if (!concepto.trim() || m <= 0) {
      setErr("Indique concepto y un monto mayor a cero.");
      return;
    }
    setErr(null);
    saveCost({
      id: uid("cos"),
      fecha,
      lote,
      categoria,
      concepto: concepto.trim(),
      monto: m,
    });
    setConcepto("");
    setMonto("");
  }

  const U = sheet.unit;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
          Ficha de costo
        </p>
        <h1 className="font-display text-4xl tracking-tight">Costos</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          El peso no se teclea dos veces: nace en cosecha o en un gasto, se
          consolida, se asigna al lote y se expresa por kg, por carga y frente
          a la venta.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Costo cosecha" value={fmtMoney(sheet.cosecha)} hint="M.O. + alim." />
        <Kpi label="Gastos de finca" value={fmtMoney(sheet.otros)} />
        <Kpi label="Costo total" value={fmtMoney(sheet.total)} />
        <Kpi
          label="$ / carga"
          value={sheet.cargas ? fmtMoney(U.totalCarga) : "—"}
          hint={`125 kg CPS · ${sheet.cpsFuente}`}
        />
      </div>

      <CostFlow S={S} />

      <Card>
        <CardTitle>Cálculo</CardTitle>
        <CardHint>
          Identidades. Los valores se recalculan desde el libro, no se teclean.
        </CardHint>
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Concepto</Th>
                <Th>Fórmula</Th>
                <Th className="text-right">Valor</Th>
              </tr>
            </thead>
            <tbody>
              {sheet.lines.map((ln) => (
                <tr key={ln.id}>
                  <Td>
                    <div>{ln.label}</div>
                    {ln.hint ? (
                      <div className="text-xs text-muted">{ln.hint}</div>
                    ) : null}
                  </Td>
                  <Td className="font-mono text-xs text-muted">{ln.formula}</Td>
                  <Td className="text-right tabular">
                    {ln.id === "cps"
                      ? fmtKg(ln.value)
                      : fmtMoney(ln.value)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardTitle>Unitarios</CardTitle>
        <CardHint>
          Cosecha = M.O. + alimentación. Total = cosecha + gastos de finca.
          CPS {sheet.cpsFuente}: {fmtKg(sheet.cpsKg)} · factor{" "}
          {fmtNum(sheet.factor, 2)}:1 · {fmtNum(sheet.jornadas, 0)} jornadas ·{" "}
          {fmtNum(sheet.horas, 1)} h.
        </CardHint>
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Base</Th>
                <Th className="text-right">M.O.</Th>
                <Th className="text-right">Alim.</Th>
                <Th className="text-right">Cosecha</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td>/ kg cereza</Td>
                <Td className="text-right tabular">{sheet.kg ? fmtMoney(U.moKg) : "—"}</Td>
                <Td className="text-right tabular">{sheet.kg ? fmtMoney(U.alimKg) : "—"}</Td>
                <Td className="text-right tabular">{sheet.kg ? fmtMoney(U.cosechaKg) : "—"}</Td>
                <Td className="text-right tabular">{sheet.kg ? fmtMoney(U.totalKg) : "—"}</Td>
              </tr>
              <tr>
                <Td>/ kg CPS</Td>
                <Td className="text-right tabular text-muted">—</Td>
                <Td className="text-right tabular text-muted">—</Td>
                <Td className="text-right tabular">{sheet.cpsKg ? fmtMoney(U.cosechaCps) : "—"}</Td>
                <Td className="text-right tabular">{sheet.cpsKg ? fmtMoney(U.totalCps) : "—"}</Td>
              </tr>
              <tr>
                <Td>/ carga (125 kg)</Td>
                <Td className="text-right tabular">{sheet.cargas ? fmtMoney(S.cargaBook.moPorCarga) : "—"}</Td>
                <Td className="text-right tabular">{sheet.cargas ? fmtMoney(S.cargaBook.alimPorCarga) : "—"}</Td>
                <Td className="text-right tabular">{sheet.cargas ? fmtMoney(S.cargaBook.cosechaPorCarga) : "—"}</Td>
                <Td className="text-right tabular">{sheet.cargas ? fmtMoney(U.totalCarga) : "—"}</Td>
              </tr>
              <tr>
                <Td>/ arroba (12,5 kg)</Td>
                <Td colSpan={3} />
                <Td className="text-right tabular">{sheet.cpsKg ? fmtMoney(U.totalArroba) : "—"}</Td>
              </tr>
              <tr>
                <Td>/ ha (0,87)</Td>
                <Td colSpan={3} />
                <Td className="text-right tabular">{fmtMoney(U.totalHa)}</Td>
              </tr>
              <tr>
                <Td>/ jornada (persona-día)</Td>
                <Td colSpan={2} className="text-right tabular text-muted">
                  alim {sheet.jornadas ? fmtMoney(U.alimJornada) : "—"}
                </Td>
                <Td className="text-right tabular text-muted">
                  M.O./h {sheet.horas ? fmtMoney(U.moHora) : "—"}
                </Td>
                <Td />
              </tr>
            </tbody>
          </Table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Composición</CardTitle>
          <CostDonut
            data={[
              { name: "Mano de obra", value: sheet.mo },
              { name: "Alimentación", value: sheet.alim },
              { name: "Gastos finca", value: sheet.otros },
            ]}
          />
          <dl className="mt-4 space-y-1 text-sm">
            {CATS.map((c) => (
              <div key={c.id} className="flex justify-between">
                <dt className="text-muted">{c.label}</dt>
                <dd className="tabular">{fmtMoney(sheet.otrosByCat[c.id])}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <WriteGate>
        <Card>
          <CardTitle>Nuevo gasto</CardTitle>
          <CardHint>
            Si no asigna lote, el monto se prorratea por kilogramos de cereza.
          </CardHint>
          {err ? (
            <p className="mt-3 rounded-md bg-danger/15 px-3 py-2 text-sm text-danger">
              {err}
            </p>
          ) : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Fecha">
              <Input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </Field>
            <Field label="Lote">
              <select
                className="h-11 w-full rounded-md border border-border bg-elevated px-3 text-sm"
                value={lote}
                onChange={(e) => setLote(e.target.value as LotCode | "")}
              >
                <option value="">Finca (prorrateo)</option>
                {LOT_CODES.filter((c) => c !== "FT-FINCA").map((c) => (
                  <option key={c} value={c}>
                    {c} {LOTS[c].nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Categoría">
              <select
                className="h-11 w-full rounded-md border border-border bg-elevated px-3 text-sm"
                value={categoria}
                onChange={(e) =>
                  setCategoria(e.target.value as CostLine["categoria"])
                }
              >
                {CATS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Monto COP" hint="contable">
              <MoneyInput value={monto} onValue={setMonto} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Concepto">
                <Input
                  value={concepto}
                  onChange={(e) => setConcepto(e.target.value)}
                />
              </Field>
            </div>
          </div>
          <Button className="mt-4" onClick={add}>
            Guardar gasto
          </Button>
        </Card>
        </WriteGate>
      </div>

      <Card>
        <CardTitle>Costo por lote</CardTitle>
        <CardHint>
          Cosecha del lote + gastos asignados + prorrateo de gastos de finca
          según participación en kg.
        </CardHint>
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Lote</Th>
                <Th className="text-right">Kg</Th>
                <Th className="text-right">Part. %</Th>
                <Th className="text-right">Cosecha</Th>
                <Th className="text-right">Directo</Th>
                <Th className="text-right">Prorrateo</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">$/kg</Th>
                <Th className="text-right">$/carga</Th>
                <Th className="text-right">Ingreso</Th>
                <Th className="text-right">Margen</Th>
              </tr>
            </thead>
            <tbody>
              {sheet.byLot.map((r) => {
                const p = S.pnl.find((x) => x.code === r.code);
                return (
                <tr key={r.code}>
                  <Td>
                    {r.code}{" "}
                    <span className="text-muted">{LOTS[r.code].nombre}</span>
                  </Td>
                  <Td className="text-right tabular">{fmtNum(r.kg, 1)}</Td>
                  <Td className="text-right tabular">{fmtPct(r.share * 100)}</Td>
                  <Td className="text-right tabular">{fmtMoney(r.cosecha)}</Td>
                  <Td className="text-right tabular">{fmtMoney(r.otrosDir)}</Td>
                  <Td className="text-right tabular">{fmtMoney(r.otrosPr)}</Td>
                  <Td className="text-right tabular">{fmtMoney(r.total)}</Td>
                  <Td className="text-right tabular">
                    {r.kg ? fmtMoney(r.porKg) : "—"}
                  </Td>
                  <Td className="text-right tabular">
                    {r.kg ? fmtMoney(r.porCarga) : "—"}
                  </Td>
                  <Td className="text-right tabular">
                    {p ? fmtMoney(p.ing) : "—"}
                  </Td>
                  <Td
                    className={`text-right tabular ${p && p.margen < 0 ? "text-danger" : ""}`}
                  >
                    {p ? fmtMoney(p.margen) : "—"}
                  </Td>
                </tr>
              );
              })}
            </tbody>
          </Table>
        </div>
      </Card>

      {S.cargaBook.vanosKg ? (
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Merma comercial (vanos)</CardTitle>
            <Badge tone="warn">flotación</Badge>
          </div>
          <CardHint>
            kg vanos × (1 ÷ F) × ($ / kg CPS). Pulpa y agua no se costean: son
            conversión.
          </CardHint>
          <p className="mt-3 text-sm">
            {fmtNum(S.cargaBook.vanosKg, 1)} kg vanos · CPS perdido{" "}
            {fmtKg(S.cargaBook.vanosCpsPerdido)} · costo{" "}
            <b>{fmtMoney(S.cargaBook.costoVanos)}</b>
          </p>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Libro de gastos</CardTitle>
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Categoría</Th>
                <Th>Lote</Th>
                <Th>Concepto</Th>
                <Th className="text-right">Monto</Th>
              </tr>
            </thead>
            <tbody>
              {farm.costs.map((c) => (
                <tr key={c.id}>
                  <Td>{fmtDate(c.fecha)}</Td>
                  <Td>{CATS.find((x) => x.id === c.categoria)?.label ?? c.categoria}</Td>
                  <Td className="text-muted">{c.lote || "Finca"}</Td>
                  <Td>{c.concepto}</Td>
                  <Td className="text-right tabular">{fmtMoney(c.monto)}</Td>
                </tr>
              ))}
              {!farm.costs.length ? (
                <tr>
                  <Td colSpan={5} className="text-muted">
                    Sin gastos adicionales. La cosecha ya está en la ficha.
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

function CostFlow({ S }: { S: ReturnType<typeof farmStats> }) {
  const sh = S.sheet;
  const C = S.cargaBook;
  const steps = [
    {
      n: "01",
      title: "Origen",
      hint: "Tres puertas. Ningún peso entra dos veces.",
      rows: [
        {
          k: "M.O. recolector",
          f: "por kg: kg × tarifa  ·  jornal: tarifa del día",
          v: sh.mo,
          note: "Se le paga a él en Pagos. Aquí solo se devenga.",
        },
        {
          k: "Alimentación",
          f: "tarifa cocina × personas con kg > 0",
          v: sh.alim,
          note: "Costo de finca. No va en el desprendible.",
        },
        {
          k: "Gastos de finca",
          f: "fertilización + arvenses + renovación + indirectos + otro",
          v: sh.otros,
          note: sh.otrosDir
            ? `Directo a lote ${fmtMoney(sh.otrosDir)} · prorrateo ${fmtMoney(sh.otrosPr)}`
            : "Sin lote → se prorratean por kg de cereza.",
        },
      ],
    },
    {
      n: "02",
      title: "Consolida",
      hint: "Dos capas. El panel ejecutivo usa solo la primera.",
      rows: [
        {
          k: "Costo de cosecha",
          f: "M.O. + alimentación",
          v: sh.cosecha,
        },
        {
          k: "Costo total",
          f: "cosecha + gastos de finca",
          v: sh.total,
        },
      ],
    },
    {
      n: "03",
      title: "Asigna al lote",
      hint: "Cosecha ya nació en el lote. Los gastos sin lote se reparte por participación en kg.",
      rows: sh.byLot
        .filter((r) => r.total > 0)
        .map((r) => ({
          k: `${r.code} ${LOTS[r.code].nombre}`,
          f: `cosecha ${fmtMoney(r.cosecha)} + directo ${fmtMoney(r.otrosDir)} + ${(r.share * 100).toFixed(1)} % × prorrateo`,
          v: r.total,
        })),
    },
    {
      n: "04",
      title: "Convierte a pergamino",
      hint: "La masa cambia; el dinero no. Pulpa y agua no se costean.",
      rows: [
        {
          k: "Kg cereza",
          f: "Σ kg de sesiones",
          v: sh.kg,
          money: false,
        },
        {
          k: `Kg CPS (${sh.cpsFuente})`,
          f:
            sh.cpsFuente === "bodega"
              ? "peso en bodega"
              : `cereza ÷ factor ${sh.factor.toFixed(2)}`,
          v: sh.cpsKg,
          money: false,
        },
        {
          k: "Cargas FNC",
          f: "kg CPS ÷ 125",
          v: sh.cargas,
          money: false,
        },
        ...(C.vanosKg
          ? [
              {
                k: "Costo vanos",
                f: "kg vanos × (1 ÷ F) × ($ / kg CPS)",
                v: C.costoVanos,
              },
            ]
          : []),
      ],
    },
    {
      n: "05",
      title: "Unitarios",
      hint: "Mismo total, distintas bases. Compare pergamino con precio FNC, no cereza con pergamino.",
      rows: [
        { k: "$ / kg cereza (total)", f: "costo total ÷ kg cereza", v: sh.unit.totalKg },
        { k: "$ / kg CPS", f: "costo total ÷ kg CPS", v: sh.unit.totalCps },
        { k: "$ / carga", f: "costo total ÷ (kg CPS ÷ 125)", v: sh.unit.totalCarga },
        { k: "$ / arroba", f: "costo total ÷ (kg CPS ÷ 12,5)", v: sh.unit.totalArroba },
      ],
    },
    {
      n: "06",
      title: "Cierra",
      hint: "Venta vs costo. Liquidación saca la M.O. de cuentas por pagar a caja.",
      rows: [
        { k: "Ingresos", f: "Σ kg vendidos × precio", v: S.ing },
        { k: "Margen", f: "ingresos − costo total", v: S.margen },
        { k: "M.O. pendiente", f: "devengado − liquidado", v: S.pendMO },
      ],
    },
  ];

  return (
    <Card>
      <CardTitle>Flujo de costos</CardTitle>
      <CardHint>
        De la pesa del recolector hasta la carga de 125 kg. Cada flecha es una
        identidad, no un asiento extra.
      </CardHint>
      <ol className="mt-6 space-y-0">
        {steps.map((st, i) => (
          <li key={st.n}>
            <div className="flex gap-4">
              <div className="flex w-10 shrink-0 flex-col items-center">
                <span className="flex size-10 items-center justify-center rounded-full border border-accent/40 font-mono text-xs text-accent">
                  {st.n}
                </span>
                {i < steps.length - 1 ? (
                  <span className="mt-1 text-subtle">
                    <ArrowDown className="size-4" />
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 flex-1 pb-8">
                <div className="font-medium">{st.title}</div>
                <p className="mt-0.5 text-xs text-muted">{st.hint}</p>
                {st.rows.length ? (
                  <ul className="mt-3 divide-y divide-border/70 rounded-xl border border-border">
                    {st.rows.map((r) => (
                      <li
                        key={r.k}
                        className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {st.n === "03" ? (
                              <ArrowRight className="size-3 shrink-0 text-subtle" />
                            ) : null}
                            {r.k}
                          </div>
                          <div className="font-mono text-[11px] text-muted">
                            {r.f}
                          </div>
                          {"note" in r && r.note ? (
                            <div className="text-[11px] text-subtle">{r.note}</div>
                          ) : null}
                        </div>
                        <div className="tabular text-fg">
                          {"money" in r && r.money === false
                            ? r.k.includes("Cargas")
                              ? fmtNum(r.v, 2)
                              : fmtKg(r.v)
                            : fmtMoney(r.v)}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted">
                    Sin kg de cosecha no hay a quién asignar.
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
