import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronRight, Map } from "lucide-react";
import { WriteGate } from "@/components/write-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { DecimalInput } from "@/components/ui/fields";
import { Table, Td, Th } from "@/components/ui/table";
import { Kpi } from "@/components/kpi";
import { fmtKg, fmtMoney, fmtNum, n } from "@/lib/format";
import {
  allLots,
  areaActiva,
  harvestLots,
  nextLotCode,
  type FarmLot,
  type LotStatus,
} from "@/lib/lots";
import { farmStats } from "@/lib/stats";
import { useFarm } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/lotes")({ component: Page });

const empty = (): FarmLot => ({
  id: "",
  code: "",
  nombre: "",
  rol: "Producción",
  accion: "Cosechar",
  estado: "En diseño",
  areaHa: 0,
  bloques: ["General"],
  harvestPriority: 10,
  status: "activo",
  unifiedInto: null,
  variedad: "Caturra / Castillo",
});

function tone(s: LotStatus): "ok" | "warn" | "muted" {
  if (s === "activo") return "ok";
  if (s === "unificado") return "warn";
  return "muted";
}

function Page() {
  const farm = useFarm();
  const lots = allLots(farm.lots);
  const S = farmStats(farm);
  const saveLot = useFarm((s) => s.saveLot);
  const removeLot = useFarm((s) => s.removeLot);
  const setLotStatus = useFarm((s) => s.setLotStatus);
  const unifyLots = useFarm((s) => s.unifyLots);
  const dissolveUnion = useFarm((s) => s.dissolveUnion);
  const loadDemoLots = useFarm((s) => s.loadDemoLots);

  const [draft, setDraft] = useState<FarmLot>(empty());
  const [editing, setEditing] = useState(false);
  const [pick, setPick] = useState<string[]>([]);
  const [unionName, setUnionName] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  const ha = areaActiva(farm.lots);
  const activos = harvestLots(farm.lots);
  const nUni = lots.filter((l) => l.status === "unificado").length;
  const nOff = lots.filter((l) => l.status === "inactivo").length;

  const ranking = useMemo(
    () =>
      activos
        .map((l) => ({ ...l, kg: S.byLot[l.code]?.kg || 0 }))
        .sort((a, b) => b.kg - a.kg),
    [activos, S.byLot],
  );

  function flash(ok: boolean, text: string) {
    setNote(text);
    if (!ok) return;
  }

  function startNew() {
    const code = nextLotCode(lots, "Nuevo");
    setDraft({
      ...empty(),
      code,
      harvestPriority: Math.max(...lots.map((l) => l.harvestPriority), 0) + 1,
    });
    setEditing(true);
    setManageOpen(true);
  }

  function startEdit(l: FarmLot) {
    setDraft({ ...l, bloques: [...l.bloques] });
    setEditing(true);
    setManageOpen(true);
  }

  function save() {
    const r = saveLot({
      ...draft,
      areaHa: n(draft.areaHa),
      bloques: String(draft.bloques)
        .split(/[,\n]/)
        .map((b) => String(b).trim())
        .filter(Boolean),
    });
    flash(r.ok, r.ok ? "Lote guardado." : (r.error ?? "No se pudo guardar."));
    if (r.ok) {
      setEditing(false);
      setDraft(empty());
    }
  }

  function togglePick(code: string) {
    setPick((p) => (p.includes(code) ? p.filter((c) => c !== code) : [...p, code]));
  }

  function doUnify() {
    const r = unifyLots(pick, unionName);
    flash(r.ok, r.ok ? `Unidad ${r.code} creada.` : (r.error ?? "No se unificó."));
    if (r.ok) {
      setPick([]);
      setUnionName("");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-accent">
            Finca
          </p>
          <h1 className="font-display text-4xl tracking-tight md:text-5xl">
            Lotes
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
            El mapa de la finca. Toque un lote para abrirlo: cosecha, labores,
            abono y cultivo en un solo lugar.
          </p>
        </div>
        <WriteGate fallback={null}>
          <Button onClick={startNew}>Crear lote</Button>
        </WriteGate>
      </header>

      {lots.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Área activa" value={`${fmtNum(ha, 2)} ha`} />
          <Kpi label="Activos" value={String(activos.length)} />
          <Kpi label="Unificados" value={String(nUni)} />
          <Kpi label="Inactivos" value={String(nOff)} />
        </div>
      ) : null}

      {note ? <p className="text-sm text-accent">{note}</p> : null}

      {!lots.length && !editing ? (
        <Card>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="grid size-14 place-items-center rounded-2xl border border-border bg-elevated text-accent">
              <Map className="size-6" />
            </div>
            <div className="flex-1">
              <CardTitle>Sin lotes aún</CardTitle>
              <CardHint>
                El libro arranca vacío. Cree el primer lote o cargue la plantilla
                demo de Finca El Tesoro (solo si usted lo pide).
              </CardHint>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <WriteGate fallback={null}>
              <Button onClick={startNew}>Crear primer lote</Button>
            </WriteGate>
            <WriteGate fallback={null}>
              <Button
                variant="outline"
                onClick={() => {
                  const r = loadDemoLots();
                  flash(
                    r.ok,
                    r.ok
                      ? "Plantilla demo El Tesoro cargada."
                      : (r.error ?? "No se cargó la demo."),
                  );
                }}
              >
                Cargar demo El Tesoro
              </Button>
            </WriteGate>
          </div>
        </Card>
      ) : null}

      {lots.length ? (
        <section aria-label="Mapa de lotes" className="space-y-2">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            {lots.map((l, i) => {
              const kg = S.byLot[l.code]?.kg || 0;
              return (
                <Link
                  key={l.code}
                  to="/lotes/$code"
                  params={{ code: l.code }}
                  search={{ cara: "cosecha" }}
                  className={cn(
                    "flex min-h-[72px] items-center gap-4 px-5 py-4 transition-colors hover:bg-elevated/60",
                    i > 0 && "border-t border-border",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-xl tracking-tight text-fg">
                        {l.nombre}
                      </span>
                      <Badge tone={tone(l.status)}>{l.status}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted">
                      <span className="font-mono text-xs tracking-wide">
                        {l.code}
                      </span>
                      <span>{fmtNum(l.areaHa, 2)} ha</span>
                      {kg > 0 ? <span>{fmtKg(kg)}</span> : null}
                    </div>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-subtle" />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {editing ? (
        <Card>
          <CardTitle>{draft.id ? "Editar lote" : "Nuevo lote"}</CardTitle>
          <CardHint>El código es la clave de cosecha, costos y trazabilidad.</CardHint>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Código">
              <Input
                value={draft.code}
                onChange={(e) =>
                  setDraft({ ...draft, code: e.target.value.toUpperCase() })
                }
                disabled={Boolean(draft.id)}
              />
            </Field>
            <Field label="Nombre">
              <Input
                value={draft.nombre}
                onChange={(e) => setDraft({ ...draft, nombre: e.target.value })}
              />
            </Field>
            <Field label="Área ha">
              <DecimalInput
                value={String(draft.areaHa || "")}
                onValue={(v) => setDraft({ ...draft, areaHa: n(v) })}
              />
            </Field>
            <Field label="Variedad">
              <Input
                value={draft.variedad}
                onChange={(e) => setDraft({ ...draft, variedad: e.target.value })}
              />
            </Field>
            <Field label="Rol">
              <Input
                value={draft.rol}
                onChange={(e) => setDraft({ ...draft, rol: e.target.value })}
              />
            </Field>
            <Field label="Prioridad de cosecha">
              <Input
                type="number"
                value={draft.harvestPriority}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    harvestPriority: Number(e.target.value) || 1,
                  })
                }
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Estado agronómico">
                <Input
                  value={draft.estado}
                  onChange={(e) => setDraft({ ...draft, estado: e.target.value })}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Bloques" hint="separados por coma">
                <Input
                  value={draft.bloques.join(", ")}
                  onChange={(e) =>
                    setDraft({ ...draft, bloques: e.target.value.split(",") })
                  }
                />
              </Field>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={save}>Guardar lote</Button>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(false);
                setDraft(empty());
              }}
            >
              Cancelar
            </Button>
          </div>
        </Card>
      ) : null}

      {lots.length ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setManageOpen((v) => !v)}
            className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border bg-surface px-4 text-left text-sm text-muted hover:text-fg"
          >
            <span>Gestión avanzada (unificar, editar, ranking)</span>
            <span className="text-xs uppercase tracking-widest text-subtle">
              {manageOpen ? "Ocultar" : "Mostrar"}
            </span>
          </button>

          {manageOpen ? (
            <div className="space-y-6">
              <WriteGate>
                <Card>
                  <CardTitle>Unificar lotes</CardTitle>
                  <CardHint>
                    Marque dos o más activos. Nacen como una unidad. Los
                    originales quedan unificados: no se cosechan, sí aportan al
                    consolidado.
                  </CardHint>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {activos.map((l) => (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => togglePick(l.code)}
                        className={
                          pick.includes(l.code)
                            ? "min-h-11 rounded-full border border-accent bg-accent/15 px-4 text-sm text-accent"
                            : "min-h-11 rounded-full border border-border px-4 text-sm text-muted hover:text-fg"
                        }
                      >
                        {l.code} {l.nombre}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-end gap-3">
                    <div className="min-w-56 flex-1">
                      <Field label="Nombre de la unidad">
                        <Input
                          value={unionName}
                          onChange={(e) => setUnionName(e.target.value)}
                        />
                      </Field>
                    </div>
                    <Button
                      onClick={doUnify}
                      disabled={pick.length < 2 || !unionName.trim()}
                    >
                      Unificar {pick.length || ""}
                    </Button>
                  </div>
                </Card>
              </WriteGate>

              <Card>
                <CardTitle>Catálogo</CardTitle>
                <CardHint>
                  Activo se cosecha. Inactivo se reserva. Unificado vive en el
                  padre.
                </CardHint>
                <div className="mt-5 overflow-x-auto">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Código</Th>
                        <Th>Nombre</Th>
                        <Th>Estado</Th>
                        <Th className="text-right">Ha</Th>
                        <Th className="text-right">Kg</Th>
                        <Th>Gestión</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {lots.map((l) => {
                        const kg = S.byLot[l.code]?.kg || 0;
                        return (
                          <tr key={l.code}>
                            <Td className="font-mono text-xs">{l.code}</Td>
                            <Td>
                              <Link
                                to="/lotes/$code"
                                params={{ code: l.code }}
                                search={{ cara: "cosecha" }}
                                className="font-medium text-fg hover:underline"
                              >
                                {l.nombre}
                              </Link>
                            </Td>
                            <Td>
                              <Badge tone={tone(l.status)}>{l.status}</Badge>
                            </Td>
                            <Td className="text-right tabular">
                              {fmtNum(l.areaHa, 2)}
                            </Td>
                            <Td className="text-right tabular">{fmtKg(kg)}</Td>
                            <Td>
                              <WriteGate
                                fallback={
                                  <span className="text-xs text-muted">—</span>
                                }
                              >
                                <div className="flex flex-wrap gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => startEdit(l)}
                                  >
                                    Editar
                                  </Button>
                                  {l.status === "activo" ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        setLotStatus(l.code, "inactivo")
                                      }
                                    >
                                      Inactivar
                                    </Button>
                                  ) : null}
                                  {l.status === "inactivo" ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        setLotStatus(l.code, "activo")
                                      }
                                    >
                                      Activar
                                    </Button>
                                  ) : null}
                                  {lots.some((x) => x.unifiedInto === l.code) ? (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => dissolveUnion(l.code)}
                                    >
                                      Disolver
                                    </Button>
                                  ) : null}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      const r = removeLot(l.code);
                                      flash(
                                        r.ok,
                                        r.ok ? "Eliminado." : (r.error ?? ""),
                                      );
                                    }}
                                  >
                                    Quitar
                                  </Button>
                                </div>
                              </WriteGate>
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              </Card>

              <Card>
                <CardTitle>Ranking de cosecha</CardTitle>
                <div className="mt-4 overflow-x-auto">
                  <Table>
                    <thead>
                      <tr>
                        <Th>#</Th>
                        <Th>Lote</Th>
                        <Th className="text-right">Kg</Th>
                        <Th className="text-right">Participación</Th>
                        <Th className="text-right">Costo</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.map((l, i) => (
                        <tr key={l.code}>
                          <Td className="tabular text-muted">{i + 1}</Td>
                          <Td>
                            <Link
                              to="/lotes/$code"
                              params={{ code: l.code }}
                              search={{ cara: "cosecha" }}
                              className="hover:underline"
                            >
                              {l.code} {l.nombre}
                            </Link>
                          </Td>
                          <Td className="text-right tabular">
                            {fmtNum(l.kg, 1)}
                          </Td>
                          <Td className="text-right tabular">
                            {S.kg ? `${fmtNum((l.kg / S.kg) * 100, 1)} %` : "—"}
                          </Td>
                          <Td className="text-right tabular">
                            {fmtMoney(S.byLot[l.code]?.cost || 0)}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              </Card>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
