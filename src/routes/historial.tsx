import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { fmtDate, fmtKg, fmtMoney, fmtNum } from "@/lib/format";
import { LOTS } from "@/lib/lots";
import { useFarm } from "@/lib/store";

export const Route = createFileRoute("/historial")({ component: Page });

function Page() {
  const sessions = useFarm((s) => s.sessions);
  const batches = useFarm((s) => s.batches);
  const deleteSession = useFarm((s) => s.deleteSession);
  const [err, setErr] = useState<string | null>(null);

  function csv() {
    const lines = [
      "fecha,lote,bloque,tipo,pasada,codigo,trabajador,horas,kg,pago,alim",
    ];
    sessions.forEach((s) => {
      s.trabajadores.forEach((w) => {
        lines.push(
          [
            s.fecha,
            s.lote,
            `"${s.bloque.replace(/"/g, '""')}"`,
            s.tipo,
            s.pasada,
            s.code,
            `"${w.nombre.replace(/"/g, '""')}"`,
            w.horas,
            w.kg,
            w.pago,
            w.alim,
          ].join(","),
        );
      });
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "FT_cosecha.csv";
    a.click();
  }

  function remove(id: string, code: string) {
    const batch = batches.find((b) => b.sessionId === id);
    if (batch?.events.length) {
      setErr(
        `${code} ya tiene beneficio registrado. Ábrala en Editar; no se borra.`,
      );
      return;
    }
    if (
      !window.confirm(
        `¿Eliminar la sesión ${code}? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }
    const msg = deleteSession(id);
    setErr(msg);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
            Trazabilidad
          </p>
          <h1 className="font-display text-4xl tracking-tight">Historial</h1>
          <p className="mt-2 text-sm text-muted">
            Cada sesión es un capítulo operativo. Corrija con Editar; no borre
            si ya se pesó en beneficio.
          </p>
        </div>
        <Button variant="outline" onClick={csv} disabled={!sessions.length}>
          Exportar CSV
        </Button>
      </header>
      {err ? (
        <p className="rounded-md bg-warn/15 px-3 py-2 text-sm text-warn">{err}</p>
      ) : null}

      {!sessions.length ? (
        <Card>
          <CardTitle>Sin sesiones</CardTitle>
          <CardHint>
            El historial se llena al guardar en Registro de cosecha.
          </CardHint>
        </Card>
      ) : (
        sessions.map((s) => (
          <Card key={s.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{s.code}</CardTitle>
                  <Badge tone="accent">{s.tipo}</Badge>
                  <Badge>Pasada {s.pasada}</Badge>
                </div>
                <CardHint>
                  {fmtDate(s.fecha)} · {s.lote} {LOTS[s.lote]?.nombre} ·{" "}
                  {s.bloque}
                  {s.responsable ? ` · ${s.responsable}` : ""}
                </CardHint>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/cosecha" search={{ ses: s.id }}>
                    Editar
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(s.id, s.code)}
                >
                  Eliminar
                </Button>
              </div>
            </div>
            <p className="mt-3 text-sm text-muted">
              Cuadrilla recolectó <b className="text-fg">{fmtKg(s.totKg)}</b>{" "}
              de cereza. Mano de obra {fmtMoney(s.totPay)} · alimentación{" "}
              {fmtMoney(s.totAlim)} · total{" "}
              <b className="text-fg">{fmtMoney(s.totCost)}</b> (
              {s.totKg ? fmtMoney(s.totCost / s.totKg) : "—"}/kg). Pergamino
              est. {fmtKg(s.totKg / (s.factor || 6))}.
            </p>
            {s.obs ? (
              <p className="mt-2 text-sm italic text-muted">{s.obs}</p>
            ) : null}
            <div className="mt-4">
              <Table>
                <thead>
                  <tr>
                    <Th>Recolector</Th>
                    <Th>Horario</Th>
                    <Th className="text-right">Horas</Th>
                    <Th className="text-right">Kg</Th>
                    <Th className="text-right">Kg/h</Th>
                    <Th className="text-right">Pago</Th>
                  </tr>
                </thead>
                <tbody>
                  {s.trabajadores.map((w) => (
                    <tr key={w.id}>
                      <Td>{w.nombre}</Td>
                      <Td className="text-muted">
                        {w.hi} – {w.hf}
                      </Td>
                      <Td className="text-right tabular">
                        {fmtNum(w.horas, 2)}
                      </Td>
                      <Td className="text-right tabular">{fmtNum(w.kg, 1)}</Td>
                      <Td className="text-right tabular">
                        {w.horas ? fmtNum(w.kg / w.horas, 2) : "—"}
                      </Td>
                      <Td className="text-right tabular">
                        {fmtMoney(w.pago)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
