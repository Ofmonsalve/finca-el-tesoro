import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { harvestLots, lotByCode, type LotCode } from "@/lib/lots";
import { buildSession, useFarm } from "@/lib/store";
import { fmtKg, fmtMoney, fmtNum, fmtPct, fmtRatio, n, todayISO } from "@/lib/format";
import { hoursBetween, uid } from "@/lib/utils";
import type { HarvestType, PayModel, WorkerRow } from "@/lib/types";
import { Button } from "./ui/button";
import { Field, Input, Textarea } from "./ui/input";
import { DecimalInput, MoneyInput, Select } from "./ui/fields";
import { Card, CardHint, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { farmStats, sessionsOn } from "@/lib/stats";
import { Table, Td, Th } from "./ui/table";
import { cn } from "@/lib/utils";
import { classifyFactor, cpsEst, yieldPctFromFactor, cargas } from "@/lib/yield";
import { PROCESS_STAGES, nextPendingStage } from "@/lib/process";

type DraftW = {
  key: string;
  nombre: string;
  hi: string;
  hf: string;
  kg: string;
};

const emptyW = (): DraftW => ({
  key: uid("d"),
  nombre: "",
  hi: "06:30",
  hf: "14:30",
  kg: "",
});

export function HarvestForm({ editId }: { editId?: string }) {
  const settings = useFarm((s) => s.settings);
  const sessions = useFarm((s) => s.sessions);
  const batches = useFarm((s) => s.batches);
  const lotsCat = useFarm((s) => s.lots);
  const saveSession = useFarm((s) => s.saveSession);
  const updateSettings = useFarm((s) => s.updateSettings);
  const farm = useFarm();

  const [editingId, setEditingId] = useState<string | undefined>(editId);
  const [editCode, setEditCode] = useState<string | undefined>();

  const [fecha, setFecha] = useState(todayISO());
  const [lote, setLote] = useState<LotCode>(harvestLots(undefined)[0]?.code ?? "FT-CEN");
  const [bloque, setBloque] = useState("General");
  const [tipo, setTipo] = useState<HarvestType>("Principal");
  const [pasada, setPasada] = useState(1);
  const [modelo, setModelo] = useState<PayModel>("por_kg");
  const [valorKg, setValorKg] = useState(String(settings.valorKg));
  const [jornal, setJornal] = useState(String(settings.jornal));
  const [alim, setAlim] = useState(String(settings.alim));
  const [factor, setFactor] = useState(String(settings.factor));
  const [responsable, setResponsable] = useState(settings.responsable);
  const [obs, setObs] = useState("");
  const [workers, setWorkers] = useState<DraftW[]>([emptyW(), emptyW()]);
  const [lastBatch, setLastBatch] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const activeLots = harvestLots(lotsCat);
  const currentLot = lotByCode(lotsCat, lote);

  useEffect(() => {
    if (!editId) return;
    const s = sessions.find((x) => x.id === editId);
    if (!s) return;
    setEditingId(s.id);
    setEditCode(s.code);
    setFecha(s.fecha);
    setLote(s.lote);
    setBloque(s.bloque);
    setTipo(s.tipo);
    setPasada(s.pasada);
    setModelo(s.modelo);
    setValorKg(String(s.valorKg));
    setJornal(String(s.jornal));
    setAlim(String(s.alimUnit));
    setFactor(String(s.factor));
    setResponsable(s.responsable);
    setObs(s.obs);
    setWorkers(
      s.trabajadores.map((w) => ({
        key: w.id,
        nombre: w.nombre,
        hi: w.hi,
        hf: w.hf,
        kg: String(w.kg).replace(".", ","),
      })),
    );
  }, [editId, sessions]);

  const roster = useMemo(() => {
    const names = new Set<string>();
    sessions.forEach((s) =>
      s.trabajadores.forEach((w) => {
        if (w.nombre.trim()) names.add(w.nombre.trim());
      }),
    );
    return [...names].sort((a, b) => a.localeCompare(b, "es"));
  }, [sessions]);

  const live = useMemo(() => {
    const vKg = n(valorKg);
    const vJ = n(jornal);
    const vA = n(alim);
    const rows: WorkerRow[] = workers
      .filter((w) => w.nombre.trim())
      .map((w) => {
        const kg = n(w.kg);
        const horas = hoursBetween(w.hi, w.hf);
        const pago =
          modelo === "jornal"
            ? kg > 0 || horas > 0
              ? vJ
              : 0
            : Math.round(kg * vKg);
        return {
          id: w.key,
          nombre: w.nombre.trim(),
          hi: w.hi,
          hf: w.hf,
          kg,
          horas,
          pago,
          alim: kg > 0 ? vA : 0,
        };
      });
    const totKg = rows.reduce((a, r) => a + r.kg, 0);
    const totPay = rows.reduce((a, r) => a + r.pago, 0);
    const totHrs = rows.reduce((a, r) => a + r.horas, 0);
    const totAlim = rows.reduce((a, r) => a + r.alim, 0);
    return { rows, totKg, totPay, totHrs, totAlim, totCost: totPay + totAlim, vKg };
  }, [workers, valorKg, jornal, alim, modelo]);

  const today = sessionsOn(sessions, fecha);
  const lotsToday = new Set(today.map((s) => s.lote));
  const stats = farmStats(farm);

  function setLot(code: LotCode) {
    setLote(code);
    setBloque(lotByCode(lotsCat, code)?.bloques[0] ?? "General");
  }

  function save(nextLot?: boolean) {
    setMsg(null);
    if (!fecha) {
      setMsg({ ok: false, text: "Indique la fecha." });
      return;
    }
    if (!live.rows.length) {
      setMsg({ ok: false, text: "Ingrese al menos un recolector con nombre." });
      return;
    }
    if (live.totKg <= 0) {
      setMsg({ ok: false, text: "Registre kilogramos recolectados." });
      return;
    }
    const session = buildSession({
      id: editingId,
      code: editCode,
      fecha,
      lote,
      bloque,
      tipo,
      pasada,
      modelo,
      valorKg: n(valorKg),
      jornal: n(jornal),
      alimUnit: n(alim),
      factor: n(factor) || 6,
      responsable,
      obs,
      trabajadores: live.rows,
    });
    saveSession(session);
    const batchId =
      useFarm.getState().batches.find((b) => b.sessionId === session.id)?.id ??
      null;
    setLastBatch(batchId);
    updateSettings({
      valorKg: n(valorKg),
      jornal: n(jornal),
      alim: n(alim),
      factor: n(factor) || 6,
      responsable,
    });
    setMsg({
      ok: true,
      text: editingId
        ? `Sesión ${session.code} actualizada · ${fmtKg(session.totKg)} · a pagar ${fmtMoney(session.totPay)}.`
        : `Guardado ${session.code}: ${fmtKg(session.totKg)} · a pagar a recolectores ${fmtMoney(session.totPay)} · alimentación (cocina) ${fmtMoney(session.totAlim)}. El café quedó en tolva.`,
    });
    if (!editingId) {
      setObs("");
      setWorkers([emptyW(), emptyW()]);
    }
    if (nextLot) {
      setEditingId(undefined);
      setEditCode(undefined);
      const order = activeLots.map((l) => l.code);
      const ix = order.indexOf(
        lote === "FT-FINCA" ? "FT-CEN" : lote,
      );
      const nxt = order[(Math.max(ix, 0) + 1) % order.length];
      setLot(nxt);
      setWorkers([emptyW(), emptyW()]);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-accent">
              Jornada de campo
            </div>
            <CardTitle className="mt-1">
              {tipo} · Pasada {pasada}
            </CardTitle>
            <CardHint>
              {currentLot?.nombre ?? lote} · {fecha.split("-").reverse().join("/")} ·
              tarifas en COP
            </CardHint>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setFecha(todayISO());
              setTipo("Principal");
              setPasada(1);
              setMsg({
                ok: true,
                text: "Jornada lista: principal, pasada 1, fecha de hoy.",
              });
            }}
          >
            Preparar jornada
          </Button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Mini
            k="Kg hoy"
            v={fmtNum(
              today.reduce((a, s) => a + s.totKg, 0),
              1,
            )}
          />
          <Mini k="Sesiones hoy" v={String(today.length)} />
          <Mini
            k="Costo hoy"
            v={fmtMoney(today.reduce((a, s) => a + s.totCost, 0))}
          />
          <Mini k="Lotes con dato" v={`${lotsToday.size} / 6`} />
        </div>
      </Card>

      <Card>
        <CardTitle>Sesión</CardTitle>
        {msg ? (
          <p
            className={cn(
              "mt-3 rounded-md px-3 py-2 text-sm",
              msg.ok ? "bg-ok/15 text-ok" : "bg-danger/15 text-danger",
            )}
          >
            {msg.text}
          </p>
        ) : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Fecha" hint="dd/mm/aaaa">
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </Field>
          <Field label="Tipo de pase" hint="lista">
            <Select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as HarvestType)}
            >
              <option value="Principal">Principal</option>
              <option value="Secundaria">Secundaria / entrecosecha</option>
            </Select>
          </Field>
          <Field label="Nº pasada" hint="entero">
            <Input
              type="number"
              min={1}
              inputMode="numeric"
              value={pasada}
              onChange={(e) => setPasada(Number(e.target.value) || 1)}
            />
          </Field>
          <Field label="Modelo de pago" hint="lista">
            <Select
              value={modelo}
              onChange={(e) => setModelo(e.target.value as PayModel)}
            >
              <option value="por_kg">Por kilogramo</option>
              <option value="jornal">Jornal fijo</option>
            </Select>
          </Field>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-subtle">
            Lote
          </div>
          <div className="flex flex-wrap gap-2">
            {activeLots.map((L) => (
              <button
                key={L.code}
                type="button"
                onClick={() => setLot(L.code)}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-xs font-medium",
                  lote === L.code
                    ? "border-accent bg-accent/15 text-accent"
                    : lotsToday.has(L.code)
                      ? "border-ok/40 text-ok"
                      : "border-border text-muted hover:text-fg",
                )}
              >
                {L.code}
                {lotsToday.has(L.code) ? " · ok" : ""}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">{currentLot?.estado}</p>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Bloque" hint="lista">
            <Select
              value={bloque}
              onChange={(e) => setBloque(e.target.value)}
            >
              {(currentLot?.bloques ?? ["General"]).map((b) => (
                <option key={b}>{b}</option>
              ))}
            </Select>
          </Field>
          <Field label="Valor / kg" hint="COP · lo que se le paga al recolector">
            <MoneyInput value={valorKg} onValue={setValorKg} />
          </Field>
          <Field label="Jornal" hint="COP · solo si el modelo es jornal fijo">
            <MoneyInput value={jornal} onValue={setJornal} />
          </Field>
          <Field
            label="Alimentación / persona"
            hint="COP · costo de cocina, no se suma al pago"
          >
            <MoneyInput value={alim} onValue={setAlim} />
          </Field>
          <Field
            label="Factor cereza : pergamino"
            hint={`R ${fmtPct(yieldPctFromFactor(n(factor) || 6))} · ${classifyFactor(n(factor) || 6).label}`}
          >
            <DecimalInput value={factor} onValue={setFactor} decimals={1} />
          </Field>
          <Field label="Responsable" hint="texto">
            <Input
              type="text"
              autoComplete="name"
              value={responsable}
              onChange={(e) => setResponsable(e.target.value)}
              placeholder="Quien registra"
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Observaciones" hint="texto">
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Clima, madurez, calidad, novedades"
            />
          </Field>
        </div>
        {msg?.ok ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link
                to="/beneficio"
                search={lastBatch ? { batch: lastBatch } : { batch: undefined }}
              >
                Seguir el grano (tolva → … → venta)
              </Link>
            </Button>
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>
              {editingId ? "Editando recolectores" : "Recolectores"}
            </CardTitle>
            <CardHint>
              En el lote: nombre y kg. Pago = kg × tarifa. La alimentación no
              se le paga a él.
            </CardHint>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWorkers((w) => [...w, emptyW()])}
            >
              <Plus className="size-4" /> Añadir
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setWorkers((w) => [...w, emptyW(), emptyW(), emptyW()])
              }
            >
              + 3
            </Button>
          </div>
        </div>
        <div className="mt-4 space-y-3 md:hidden">
          {workers.map((w, i) => {
            const hrs = hoursBetween(w.hi, w.hf);
            const kg = n(w.kg);
            const pago =
              modelo === "jornal" ? n(jornal) : Math.round(kg * n(valorKg));
            return (
              <div
                key={w.key}
                className="rounded-xl border border-border bg-elevated/50 p-3"
              >
                <Field label="Nombre">
                  <Input
                    type="text"
                    list="roster"
                    autoComplete="name"
                    value={w.nombre}
                    placeholder="Nombre completo"
                    onChange={(e) =>
                      setWorkers((arr) =>
                        arr.map((x, k) =>
                          k === i ? { ...x, nombre: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </Field>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Kg">
                    <DecimalInput
                      value={w.kg}
                      onValue={(v) =>
                        setWorkers((arr) =>
                          arr.map((x, k) => (k === i ? { ...x, kg: v } : x)),
                        )
                      }
                      decimals={1}
                      placeholder="0,0"
                    />
                  </Field>
                  <div className="flex flex-col justify-end pb-1 text-sm">
                    <div className="text-muted">{fmtNum(hrs, 2)} h</div>
                    <div className="tabular text-fg">{fmtMoney(pago)}</div>
                    <div className="text-[11px] text-muted">
                      {modelo === "jornal"
                        ? "jornal fijo"
                        : `${fmtNum(kg, 1)} × ${fmtMoney(n(valorKg))}`}
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Inicio">
                    <Input
                      type="time"
                      value={w.hi}
                      onChange={(e) =>
                        setWorkers((arr) =>
                          arr.map((x, k) =>
                            k === i ? { ...x, hi: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Fin">
                    <Input
                      type="time"
                      value={w.hf}
                      onChange={(e) =>
                        setWorkers((arr) =>
                          arr.map((x, k) =>
                            k === i ? { ...x, hf: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() =>
                    setWorkers((arr) => arr.filter((_, k) => k !== i))
                  }
                >
                  <Trash2 className="size-4" /> Quitar
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-4 hidden md:block">
          <Table>
            <thead>
              <tr>
                <Th>Nombre</Th>
                <Th>Inicio</Th>
                <Th>Fin</Th>
                <Th className="text-right">Horas</Th>
                <Th className="text-right">Kg</Th>
                <Th className="text-right">Kg/h</Th>
                <Th className="text-right">Pago (a él)</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {workers.map((w, i) => {
                const hrs = hoursBetween(w.hi, w.hf);
                const kg = n(w.kg);
                const pago =
                  modelo === "jornal" ? n(jornal) : Math.round(kg * n(valorKg));
                return (
                  <tr key={w.key}>
                    <Td>
                      <Input
                        type="text"
                        list="roster"
                        autoComplete="name"
                        value={w.nombre}
                        placeholder="Nombre completo"
                        onChange={(e) =>
                          setWorkers((arr) =>
                            arr.map((x, k) =>
                              k === i ? { ...x, nombre: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </Td>
                    <Td>
                      <Input
                        type="time"
                        value={w.hi}
                        onChange={(e) =>
                          setWorkers((arr) =>
                            arr.map((x, k) =>
                              k === i ? { ...x, hi: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </Td>
                    <Td>
                      <Input
                        type="time"
                        value={w.hf}
                        onChange={(e) =>
                          setWorkers((arr) =>
                            arr.map((x, k) =>
                              k === i ? { ...x, hf: e.target.value } : x,
                            ),
                          )
                        }
                      />
                    </Td>
                    <Td className="text-right tabular text-muted">
                      {fmtNum(hrs, 2)}
                    </Td>
                    <Td>
                      <DecimalInput
                        value={w.kg}
                        onValue={(v) =>
                          setWorkers((arr) =>
                            arr.map((x, k) => (k === i ? { ...x, kg: v } : x)),
                          )
                        }
                        decimals={1}
                        placeholder="0,0"
                      />
                    </Td>
                    <Td className="text-right tabular text-muted">
                      {hrs ? fmtNum(kg / hrs, 2) : "—"}
                    </Td>
                    <Td className="text-right tabular">
                      <div>{fmtMoney(pago)}</div>
                      <div className="text-[11px] text-muted">
                        {modelo === "jornal"
                          ? "jornal"
                          : `${fmtNum(kg, 1)} × ${fmtMoney(n(valorKg))}`}
                      </div>
                    </Td>
                    <Td>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Quitar"
                        onClick={() =>
                          setWorkers((arr) => arr.filter((_, k) => k !== i))
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
        <datalist id="roster">
          {roster.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <div className="sticky bottom-3 mt-5 rounded-xl border border-border bg-elevated/95 p-4 backdrop-blur">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
            <span>
              <b className="text-fg tabular">{live.rows.length}</b> recolectores
            </span>
            <span>
              <b className="text-fg tabular">{fmtKg(live.totKg)}</b>
            </span>
            <span>
              A pagarles{" "}
              <b className="text-fg">{fmtMoney(live.totPay)}</b>
            </span>
            <span>
              Alim. cocina{" "}
              <b className="text-fg">{fmtMoney(live.totAlim)}</b>
              <span className="text-subtle"> (no al trabajador)</span>
            </span>
            <span>
              Costo finca{" "}
              <b className="text-fg">{fmtMoney(live.totCost)}</b>
            </span>
            <span>
              M.O. / kg{" "}
              <b className="text-fg">
                {live.totKg ? fmtMoney(live.totPay / live.totKg) : "—"}
              </b>
            </span>
            <span>
              Pergamino{" "}
              <b className="text-fg">
                {live.totKg
                  ? fmtKg(cpsEst(live.totKg, n(factor) || 6))
                  : "—"}
              </b>
            </span>
            <span>
              F <b className="text-fg">{fmtRatio(n(factor) || 6)}</b>
            </span>
            <span>
              R{" "}
              <b className="text-fg">
                {fmtPct(yieldPctFromFactor(n(factor) || 6))}
              </b>
            </span>
            <span>
              Cargas{" "}
              <b className="text-fg">
                {live.totKg
                  ? fmtNum(cargas(cpsEst(live.totKg, n(factor) || 6)), 2)
                  : "—"}
              </b>
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => save(false)}>
              {editingId ? "Guardar cambios" : "Guardar sesión"}
            </Button>
            <Button variant="accent" onClick={() => save(true)}>
              Guardar y siguiente lote
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Ciclo del grano</CardTitle>
        <CardHint>
          Al guardar, el café entra a tolva. De ahí pasa a flotación (omisible),
          despulpado, lavado, secado, bodega, despacho y venta.
        </CardHint>
        {batches.filter((b) => today.some((s) => s.id === b.sessionId)).length ? (
          <ul className="mt-4 space-y-3">
            {batches
              .filter((b) => today.some((s) => s.id === b.sessionId))
              .map((b) => {
                const next = nextPendingStage(b.events.map((e) => e.stage));
                return (
                  <li key={b.id} className="rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">{b.code}</div>
                        <div className="text-xs text-muted">
                          {fmtKg(b.kgCereza)} · ahora {fmtKg(b.kgActual)} ·{" "}
                          {next ? `siguiente: ${next.label}` : "ciclo cerrado"}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/beneficio" search={{ batch: b.id }}>
                          Abrir lote
                        </Link>
                      </Button>
                    </div>
                    <ol className="mt-3 flex flex-wrap gap-1">
                      {PROCESS_STAGES.map((st) => {
                        const ev = b.events.find((e) => e.stage === st.id);
                        return (
                          <li
                            key={st.id}
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide",
                              ev
                                ? ev.skipped
                                  ? "border-border text-muted"
                                  : "border-ok/40 text-ok"
                                : next?.id === st.id
                                  ? "border-accent text-accent"
                                  : "border-border/50 text-subtle",
                            )}
                          >
                            {st.label}
                          </li>
                        );
                      })}
                    </ol>
                  </li>
                );
              })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Todavía no hay café de hoy en beneficio. Guarde la sesión y el lote
            aparece aquí, ya en tolva.
          </p>
        )}
      </Card>

      <Card>
        <CardTitle>Avance de hoy por lote</CardTitle>
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Lote</Th>
                <Th className="text-right">Sesiones</Th>
                <Th className="text-right">Kg</Th>
                <Th className="text-right">Costo</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {activeLots.map((L) => {
                const rows = today.filter((s) => s.lote === L.code);
                const kg = rows.reduce((a, s) => a + s.totKg, 0);
                const cost = rows.reduce((a, s) => a + s.totCost, 0);
                return (
                  <tr key={L.code}>
                    <Td>
                      <span className="font-medium">{L.code}</span>
                      <span className="ml-2 text-muted">{L.nombre}</span>
                    </Td>
                    <Td className="text-right tabular">{rows.length}</Td>
                    <Td className="text-right tabular">{fmtNum(kg, 1)}</Td>
                    <Td className="text-right tabular">
                      {rows.length ? fmtMoney(cost) : "—"}
                    </Td>
                    <Td>
                      {rows.length ? (
                        <Badge tone="ok">Registrado</Badge>
                      ) : (
                        <Badge>Pendiente</Badge>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
        <p className="mt-3 text-xs text-subtle">
          Acumulado finca: {fmtKg(stats.kg)} · {fmtMoney(stats.costoCosecha)}
        </p>
      </Card>
    </div>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-elevated px-3 py-3">
      <div className="text-[10px] uppercase tracking-wider text-subtle">{k}</div>
      <div className="mt-0.5 font-display text-xl tabular">{v}</div>
    </div>
  );
}
