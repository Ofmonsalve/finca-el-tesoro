import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/fields";
import { Table, Td, Th } from "@/components/ui/table";
import { fmtDate, fmtMoney, n, todayISO } from "@/lib/format";
import { farmStats } from "@/lib/stats";
import { useFarm } from "@/lib/store";
import { uid } from "@/lib/utils";
import { Kpi } from "@/components/kpi";

export const Route = createFileRoute("/liquidacion")({ component: Page });

type Slip = {
  id: string;
  fecha: string;
  trabajador: string;
  tipo: "semana" | "anticipo";
  monto: number;
  earned: number;
  paidBefore: number;
  pendAfter: number;
  alim: number;
};

function Page() {
  const farm = useFarm();
  const S = farmStats(farm);
  const saveLiquidation = useFarm((s) => s.saveLiquidation);
  const [trabajador, setTrabajador] = useState("");
  const [monto, setMonto] = useState("");
  const [tipo, setTipo] = useState<"semana" | "anticipo">("semana");
  const [obs, setObs] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [slip, setSlip] = useState<Slip | null>(null);

  const earned = useMemo(() => {
    const m = new Map<
      string,
      { nombre: string; earned: number; alim: number; sessionIds: string[] }
    >();
    farm.sessions.forEach((s) => {
      s.trabajadores.forEach((w) => {
        const k = w.nombre.toLowerCase();
        const cur = m.get(k) || {
          nombre: w.nombre,
          earned: 0,
          alim: 0,
          sessionIds: [],
        };
        cur.earned += w.pago;
        cur.alim += w.alim;
        if (!cur.sessionIds.includes(s.id)) cur.sessionIds.push(s.id);
        m.set(k, cur);
      });
    });
    const paid = new Map<string, number>();
    farm.liquidations.forEach((l) => {
      const k = l.trabajador.toLowerCase();
      paid.set(k, (paid.get(k) || 0) + l.monto);
    });
    return [...m.values()]
      .map((w) => ({
        ...w,
        paid: paid.get(w.nombre.toLowerCase()) || 0,
        pend: w.earned - (paid.get(w.nombre.toLowerCase()) || 0),
      }))
      .sort((a, b) => b.pend - a.pend);
  }, [farm.sessions, farm.liquidations]);

  function selectWorker(name: string, pend: number) {
    setTrabajador(name);
    setMonto(String(Math.max(0, Math.round(pend))));
    setErr(null);
    setSlip(null);
  }

  function pay() {
    setErr(null);
    const name = trabajador.trim();
    const amt = n(monto);
    if (!name) {
      setErr("Indique el trabajador.");
      return;
    }
    if (amt <= 0) {
      setErr("Indique el monto a pagar.");
      return;
    }
    const row = earned.find((w) => w.nombre.toLowerCase() === name.toLowerCase());
    const pend = row?.pend ?? 0;
    if (tipo === "semana" && amt > pend + 1) {
      setErr(
        `El pendiente es ${fmtMoney(pend)}. Para pagar de más use Anticipo.`,
      );
      return;
    }
    const id = uid("liq");
    saveLiquidation({
      id,
      fecha: todayISO(),
      trabajador: row?.nombre ?? name,
      periodo: tipo,
      monto: amt,
      tipo,
      obs,
      sessionIds: row?.sessionIds ?? [],
    });
    setSlip({
      id,
      fecha: todayISO(),
      trabajador: row?.nombre ?? name,
      tipo,
      monto: amt,
      earned: row?.earned ?? 0,
      paidBefore: row?.paid ?? 0,
      pendAfter: (row?.pend ?? 0) - amt,
      alim: row?.alim ?? 0,
    });
    setMonto("");
    setObs("");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="no-print">
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
          Nómina de campo
        </p>
        <h1 className="font-display text-4xl tracking-tight">Pagos</h1>
        <p className="mt-2 text-sm text-muted">
          Lo ganado nace de las sesiones. Alimentación es gasto a quien cocina,
          no forma parte del neto del recolector.
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 no-print">
        <Kpi label="Devengado M.O." value={fmtMoney(S.pay)} />
        <Kpi label="Pagado" value={fmtMoney(S.paid)} />
        <Kpi label="Pendiente" value={fmtMoney(S.pendMO)} />
      </div>
      <Card className="no-print">
        <CardTitle>Registrar pago</CardTitle>
        {err ? (
          <p className="mt-3 rounded-md bg-danger/15 px-3 py-2 text-sm text-danger">
            {err}
          </p>
        ) : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Trabajador">
            <Input
              list="wlist"
              value={trabajador}
              onChange={(e) => setTrabajador(e.target.value)}
            />
            <datalist id="wlist">
              {earned.map((w) => (
                <option key={w.nombre} value={w.nombre} />
              ))}
            </datalist>
          </Field>
          <Field label="Monto COP" hint="contable">
            <MoneyInput value={monto} onValue={setMonto} />
          </Field>
          <Field label="Tipo">
            <select
              className="h-11 w-full rounded-md border border-border bg-elevated px-3 text-sm"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "semana" | "anticipo")}
            >
              <option value="semana">Cierre de semana</option>
              <option value="anticipo">Anticipo / retiro</option>
            </select>
          </Field>
          <Field label="Nota">
            <Input value={obs} onChange={(e) => setObs(e.target.value)} />
          </Field>
        </div>
        <Button className="mt-4" onClick={pay}>
          Registrar y emitir desprendible
        </Button>
      </Card>

      {slip ? <Payslip slip={slip} /> : null}

      <Card className="no-print">
        <CardTitle>Saldos por recolector</CardTitle>
        <CardHint>
          Toque una fila para pagar el pendiente. Alimentación no se le paga al
          recolector.
        </CardHint>
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Nombre</Th>
                <Th className="text-right">Devengado</Th>
                <Th className="text-right">Pagado</Th>
                <Th className="text-right">Pendiente</Th>
                <Th className="text-right">Alim. (cocina)</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {earned.map((w) => (
                <tr key={w.nombre}>
                  <Td>{w.nombre}</Td>
                  <Td className="text-right tabular">{fmtMoney(w.earned)}</Td>
                  <Td className="text-right tabular">{fmtMoney(w.paid)}</Td>
                  <Td className="text-right tabular">{fmtMoney(w.pend)}</Td>
                  <Td className="text-right tabular text-muted">
                    {fmtMoney(w.alim)}
                  </Td>
                  <Td>
                    {w.pend > 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => selectWorker(w.nombre, w.pend)}
                      >
                        Pagar
                      </Button>
                    ) : null}
                  </Td>
                </tr>
              ))}
              {!earned.length ? (
                <tr>
                  <Td colSpan={6} className="text-muted">
                    Sin recolectores. Primero registre cosecha.
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>
      <Card className="no-print">
        <CardTitle>Pagos emitidos</CardTitle>
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Fecha</Th>
                <Th>Trabajador</Th>
                <Th>Tipo</Th>
                <Th className="text-right">Monto</Th>
              </tr>
            </thead>
            <tbody>
              {farm.liquidations.map((l) => (
                <tr key={l.id}>
                  <Td>{fmtDate(l.fecha)}</Td>
                  <Td>{l.trabajador}</Td>
                  <Td className="capitalize text-muted">{l.tipo}</Td>
                  <Td className="text-right tabular">{fmtMoney(l.monto)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function Payslip({ slip }: { slip: Slip }) {
  return (
    <Card className="payslip">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
            Finca El Tesoro
          </p>
          <CardTitle>Desprendible de pago</CardTitle>
          <CardHint>
            {slip.id} · {fmtDate(slip.fecha)} ·{" "}
            {slip.tipo === "semana" ? "Cierre de semana" : "Anticipo / retiro"}
          </CardHint>
        </div>
        <Button
          variant="outline"
          className="no-print"
          onClick={() => window.print()}
        >
          Imprimir
        </Button>
      </div>
      <p className="mt-4 font-display text-2xl">{slip.trabajador}</p>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <Row k="Devengado (M.O.)" v={fmtMoney(slip.earned)} />
        <Row k="Pagos anteriores" v={fmtMoney(slip.paidBefore)} />
        <Row k="Este pago" v={fmtMoney(slip.monto)} />
        <Row k="Saldo después" v={fmtMoney(slip.pendAfter)} />
        <Row k="Alimentación (no incluida)" v={fmtMoney(slip.alim)} />
      </dl>
      <div className="mt-8 grid grid-cols-2 gap-8 text-xs text-muted">
        <div className="border-t border-border pt-2">Firma trabajador</div>
        <div className="border-t border-border pt-2">Firma finca</div>
      </div>
    </Card>
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
