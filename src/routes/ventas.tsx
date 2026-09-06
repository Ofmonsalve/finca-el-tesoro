import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Kpi } from "@/components/kpi";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { DecimalInput, MoneyInput, Select } from "@/components/ui/fields";
import { Table, Td, Th } from "@/components/ui/table";
import { fmtDate, fmtKg, fmtMoney, fmtNum, n, todayISO } from "@/lib/format";
import { LOT_CODES, type LotCode } from "@/lib/lots";
import { PAY_METHODS, nextPendingStage, type PayMethodId } from "@/lib/process";
import { farmStats } from "@/lib/stats";
import { useFarm } from "@/lib/store";
import { uid } from "@/lib/utils";
import { WriteGate } from "@/components/write-gate";

export const Route = createFileRoute("/ventas")({ component: Page });

function Page() {
  const farm = useFarm();
  const S = farmStats(farm);
  const saveSale = useFarm((s) => s.saveSale);
  const [fecha, setFecha] = useState(todayISO());
  const [cliente, setCliente] = useState("Federación Nacional de Cafeteros");
  const [tipo, setTipo] = useState<"pergamino" | "cereza">("pergamino");
  const [kg, setKg] = useState("");
  const [precio, setPrecio] = useState("");
  const [cobrado, setCobrado] = useState("");
  const [lote, setLote] = useState<LotCode | "">("");
  const [metodo, setMetodo] = useState<PayMethodId>("efectivo");
  const [batchId, setBatchId] = useState("");

  const [err, setErr] = useState<string | null>(null);

  const ready = farm.batches.filter((b) => {
    const next = nextPendingStage(b.events.map((e) => e.stage));
    return !b.saleId && (next?.id === "despacho" || next?.id === "venta" || b.events.some((e) => e.stage === "bodega"));
  });

  const total = n(kg) * n(precio);
  const cobradoN =
    metodo === "credito" ? 0 : cobrado === "" ? total : n(cobrado);

  function add() {
    setErr(null);
    if (n(kg) <= 0 || n(precio) <= 0) {
      setErr("Indique kilogramos y precio.");
      return;
    }
    const b = farm.batches.find((x) => x.id === batchId);
    const r = saveSale({
      id: uid("ven"),
      fecha,
      cliente: cliente.trim() || "FNC",
      tipo,
      kg: n(kg),
      precioKg: n(precio),
      total,
      cobrado: cobradoN,
      metodo,
      lote: lote || b?.lote || "",
      batchId,
      obs: "",
    });
    if (!r.ok) {
      setErr(r.error ?? "No se pudo registrar la venta.");
      return;
    }
    setKg("");
    setPrecio("");
    setCobrado("");
    setBatchId("");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
          Comercial
        </p>
        <h1 className="font-display text-4xl tracking-tight">Ventas</h1>
        <p className="mt-2 text-sm text-muted">
          Cierre el ciclo: despacho + recaudo. El método de pago define la
          cuenta (caja, bancos, cheques o cartera).
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Ingresos" value={fmtMoney(S.ing)} />
        <Kpi label="Cobrado" value={fmtMoney(S.cobrado)} />
        <Kpi label="Cartera" value={fmtMoney(S.cartera)} />
        <Kpi
          label="Balance CPS"
          value={fmtKg(S.cps - S.kgCpsVendido)}
          hint="Producido − vendido"
        />
      </div>
      <WriteGate>
      <Card>
        <CardTitle>Registrar venta</CardTitle>
        <CardHint>
          Asiento automático según método. Vincule un lote de beneficio en
          bodega o despacho para cerrar la trazabilidad.
        </CardHint>
        {err ? (
          <p className="mt-3 rounded-md bg-danger/15 px-3 py-2 text-sm text-danger">
            {err}
          </p>
        ) : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Fecha" hint="dd/mm/aaaa">
            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </Field>
          <Field label="Cliente" hint="texto">
            <Input value={cliente} onChange={(e) => setCliente(e.target.value)} />
          </Field>
          <Field label="Producto" hint="lista">
            <Select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "pergamino" | "cereza")}
            >
              <option value="pergamino">Pergamino</option>
              <option value="cereza">Cereza</option>
            </Select>
          </Field>
          <Field label="Lote de beneficio" hint="trazabilidad">
            <Select value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">Sin vincular</option>
              {ready.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} · {fmtNum(b.kgActual, 1)} kg
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Kg" hint="número">
            <DecimalInput value={kg} onValue={setKg} decimals={1} />
          </Field>
          <Field label="Precio / kg" hint="COP · contable">
            <MoneyInput value={precio} onValue={setPrecio} />
          </Field>
          <Field label="Método de pago" hint="lista">
            <Select
              value={metodo}
              onChange={(e) => setMetodo(e.target.value as PayMethodId)}
            >
              {PAY_METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cobrado" hint="COP · vacío = total">
            <MoneyInput
              value={metodo === "credito" ? "0" : cobrado}
              onValue={setCobrado}
            />
          </Field>
          <Field label="Lote de finca" hint="opcional">
            <Select
              value={lote}
              onChange={(e) => setLote(e.target.value as LotCode | "")}
            >
              <option value="">Sin asignar</option>
              {LOT_CODES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="mt-3 text-sm text-muted">
          Total documento: <b className="text-fg">{fmtMoney(total)}</b>
          {" · "}
          Recaudo: <b className="text-fg">{fmtMoney(cobradoN)}</b>
          {" · "}
          Cartera: <b className="text-fg">{fmtMoney(Math.max(0, total - cobradoN))}</b>
        </p>
        <Button className="mt-3" onClick={add}>
          Guardar venta
        </Button>
      </Card>
      </WriteGate>
      <Card>
        <CardTitle>Libro de ventas</CardTitle>
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Cliente</Th>
                <Th>Tipo</Th>
                <Th>Pago</Th>
                <Th className="text-right">Kg</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Cobrado</Th>
              </tr>
            </thead>
            <tbody>
              {farm.sales.map((v) => (
                <tr key={v.id}>
                  <Td>{fmtDate(v.fecha)}</Td>
                  <Td>{v.cliente}</Td>
                  <Td className="capitalize">{v.tipo}</Td>
                  <Td>
                    {PAY_METHODS.find((m) => m.id === v.metodo)?.label ??
                      v.metodo}
                  </Td>
                  <Td className="text-right tabular">{fmtNum(v.kg, 1)}</Td>
                  <Td className="text-right tabular">{fmtMoney(v.total)}</Td>
                  <Td className="text-right tabular">{fmtMoney(v.cobrado)}</Td>
                </tr>
              ))}
              {!farm.sales.length ? (
                <tr>
                  <Td colSpan={7} className="text-muted">
                    Sin ventas. El pergamino en bodega espera despacho.
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
