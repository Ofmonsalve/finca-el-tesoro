import { createFileRoute } from "@tanstack/react-router";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { fmtDate, fmtMoney } from "@/lib/format";
import { useFarm } from "@/lib/store";

export const Route = createFileRoute("/contabilidad")({ component: Page });

function Page() {
  const journals = useFarm((s) => s.journals);
  const accounts = new Map<
    string,
    { nombre: string; debe: number; haber: number }
  >();
  journals.forEach((j) => {
    j.lineas.forEach((l) => {
      const cur = accounts.get(l.cuenta) || {
        nombre: l.nombre,
        debe: 0,
        haber: 0,
      };
      cur.debe += l.debe;
      cur.haber += l.haber;
      accounts.set(l.cuenta, cur);
    });
  });
  const trial = [...accounts.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  const totD = trial.reduce((a, [, v]) => a + v.debe, 0);
  const totH = trial.reduce((a, [, v]) => a + v.haber, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
          Libro
        </p>
        <h1 className="font-display text-4xl tracking-tight">Contabilidad</h1>
        <p className="mt-2 text-sm text-muted">
          Partida doble generada desde cosecha, pagos, ventas y gastos. No hay
          asientos huérfanos: cada origen vive en el mismo almacén.
        </p>
      </header>
      <Card>
        <CardTitle>Balance de prueba</CardTitle>
        <CardHint>
          Debe {fmtMoney(totD)} · Haber {fmtMoney(totH)} · diferencia{" "}
          {fmtMoney(totD - totH)}
        </CardHint>
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Cuenta</Th>
                <Th>Nombre</Th>
                <Th className="text-right">Debe</Th>
                <Th className="text-right">Haber</Th>
                <Th className="text-right">Saldo</Th>
              </tr>
            </thead>
            <tbody>
              {trial.map(([c, v]) => (
                <tr key={c}>
                  <Td className="font-mono text-xs">{c}</Td>
                  <Td>{v.nombre}</Td>
                  <Td className="text-right tabular">{fmtMoney(v.debe)}</Td>
                  <Td className="text-right tabular">{fmtMoney(v.haber)}</Td>
                  <Td className="text-right tabular">
                    {fmtMoney(v.debe - v.haber)}
                  </Td>
                </tr>
              ))}
              {!trial.length ? (
                <tr>
                  <Td colSpan={5} className="text-muted">
                    Vacío hasta la primera sesión de cosecha o venta.
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </div>
      </Card>
      <Card>
        <CardTitle>Libro diario</CardTitle>
        <div className="mt-4 space-y-5">
          {journals.map((j) => (
            <div key={j.id} className="border-b border-border pb-4 last:border-0">
              <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span>
                  <span className="text-muted">{fmtDate(j.fecha)}</span>
                  <span className="mx-2 text-subtle">·</span>
                  <span className="capitalize">{j.origen}</span>
                </span>
                <span className="text-muted">{j.glosa}</span>
              </div>
              <Table>
                <thead>
                  <tr>
                    <Th>Cuenta</Th>
                    <Th>Nombre</Th>
                    <Th className="text-right">Debe</Th>
                    <Th className="text-right">Haber</Th>
                  </tr>
                </thead>
                <tbody>
                  {j.lineas.map((l, i) => (
                    <tr key={i}>
                      <Td className="font-mono text-xs">{l.cuenta}</Td>
                      <Td>{l.nombre}</Td>
                      <Td className="text-right tabular">
                        {l.debe ? fmtMoney(l.debe) : ""}
                      </Td>
                      <Td className="text-right tabular">
                        {l.haber ? fmtMoney(l.haber) : ""}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ))}
          {!journals.length ? (
            <p className="text-sm text-muted">Sin asientos.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
