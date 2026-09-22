import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, ChevronRight, Leaf, Sprout, FlaskConical, Shovel } from "lucide-react";
import { WriteGate } from "@/components/write-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { DecimalInput, MoneyInput, Select } from "@/components/ui/fields";
import { Kpi } from "@/components/kpi";
import { Table, Td, Th } from "@/components/ui/table";
import { fmtDate, fmtKg, fmtMoney, fmtNum, n, todayISO } from "@/lib/format";
import { lotByCode, rollupCode, type LotStatus } from "@/lib/lots";
import {
  CULTIVO_ESTADOS,
  LABOR_TIPOS,
  NUTRITION_ESTADOS,
  NUTRITION_UNIDADES,
  NUTRITION_VIAS,
  cultivoEstadoLabel,
  cultivoForLot,
  hasCultivoDesign,
  laborTipoLabel,
  laboresForLot,
  nutritionEstadoLabel,
  nutritionViaLabel,
  nutritionForLot,
} from "@/lib/lot-ops";
import { farmStats } from "@/lib/stats";
import { useFarm } from "@/lib/store";
import type {
  CultivoEstado,
  HarvestSession,
  LaborTipo,
  LotCultivo,
  LotLabor,
  LotNutrition,
  NutritionEstado,
  NutritionUnidad,
  NutritionVia,
} from "@/lib/types";
import { uid } from "@/lib/utils";
import { cn } from "@/lib/utils";

const FACES = [
  { id: "cosecha", label: "Cosecha", icon: Leaf },
  { id: "labores", label: "Labores", icon: Shovel },
  { id: "abono", label: "Nutrición", icon: FlaskConical },
  { id: "cultivo", label: "Cultivo", icon: Sprout },
] as const;

type FaceId = (typeof FACES)[number]["id"];

export const Route = createFileRoute("/lotes/$code")({
  validateSearch: (s: Record<string, unknown>) => {
    const cara = typeof s.cara === "string" ? s.cara : "cosecha";
    const ok = FACES.some((f) => f.id === cara);
    return { cara: (ok ? cara : "cosecha") as FaceId };
  },
  component: LotRoomPage,
});

function tone(s: LotStatus): "ok" | "warn" | "muted" {
  if (s === "activo") return "ok";
  if (s === "unificado") return "warn";
  return "muted";
}

function LotRoomPage() {
  const { code } = Route.useParams();
  const { cara } = Route.useSearch();
  const farm = useFarm();
  const lot = lotByCode(farm.lots, code);
  const S = farmStats(farm);

  const lotSessions = useMemo(() => {
    return (farm.sessions ?? [])
      .filter((s) => s.lote === code || rollupCode(farm.lots, s.lote) === code)
      .slice()
      .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  }, [farm.sessions, farm.lots, code]);

  const lotLabores = useMemo(
    () => laboresForLot(farm.labores, code, { farmId: farm.farmId }),
    [farm.labores, code, farm.farmId],
  );
  const lotNutrition = useMemo(
    () => nutritionForLot(farm.nutrition, code, { farmId: farm.farmId }),
    [farm.nutrition, code, farm.farmId],
  );
  const lotCultivo = useMemo(
    () => cultivoForLot(farm.cultivos, code, { farmId: farm.farmId }),
    [farm.cultivos, code, farm.farmId],
  );

  const kpi = S.byLot[code] ?? { kg: 0, cost: 0, hrs: 0, n: 0 };

  if (!lot) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          to="/lotes"
          className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-fg"
        >
          <ArrowLeft className="size-4" />
          Volver a lotes
        </Link>
        <Card>
          <CardTitle>Lote no encontrado</CardTitle>
          <CardHint>
            No hay un lote con código <span className="font-mono">{code}</span> en
            este libro. Vuelva al mapa y elija uno existente.
          </CardHint>
          <div className="mt-4">
            <Button asChild>
              <Link to="/lotes">Ir al mapa de lotes</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/lotes"
          className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-fg"
        >
          <ArrowLeft className="size-4" />
          Lotes
        </Link>
        <Badge tone={tone(lot.status)}>{lot.status}</Badge>
      </div>

      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
          {lot.code}
        </p>
        <h1 className="mt-1 font-display text-4xl tracking-tight md:text-5xl">
          {lot.nombre}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {fmtNum(lot.areaHa, 2)} ha
          {lot.variedad ? ` · ${lot.variedad}` : ""}
          {lot.rol ? ` · ${lot.rol}` : ""}
        </p>
        {lot.estado ? (
          <p className="mt-1 text-xs text-subtle">{lot.estado}</p>
        ) : null}
      </header>

      <nav
        aria-label="Caras del lote"
        className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1"
      >
        {FACES.map((f) => {
          const active = cara === f.id;
          const Icon = f.icon;
          return (
            <Link
              key={f.id}
              to="/lotes/$code"
              params={{ code }}
              search={{ cara: f.id }}
              className={cn(
                "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm transition-colors",
                active
                  ? "bg-elevated text-fg shadow-sm"
                  : "text-muted hover:text-fg",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="whitespace-nowrap">{f.label}</span>
            </Link>
          );
        })}
      </nav>

      {cara === "cosecha" ? (
        <CosechaFace
          code={lot.code}
          kpi={kpi}
          sessions={lotSessions}
          canHarvest={lot.status === "activo"}
        />
      ) : null}
      {cara === "labores" ? (
        <LaboresFace
          code={lot.code}
          lotName={lot.nombre}
          farmId={farm.farmId}
          items={lotLabores}
        />
      ) : null}
      {cara === "abono" ? (
        <NutritionFace
          code={lot.code}
          lotName={lot.nombre}
          farmId={farm.farmId}
          items={lotNutrition}
        />
      ) : null}
      {cara === "cultivo" ? (
        <CultivoFace
          code={lot.code}
          lotName={lot.nombre}
          farmId={farm.farmId}
          lotVariedad={lot.variedad}
          design={lotCultivo}
        />
      ) : null}
    </div>
  );
}

function CosechaFace({
  code,
  kpi,
  sessions,
  canHarvest,
}: {
  code: string;
  kpi: { kg: number; cost: number; hrs: number; n: number };
  sessions: HarvestSession[];
  canHarvest: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Kg cereza" value={fmtKg(kpi.kg)} />
        <Kpi label="Sesiones" value={String(kpi.n)} />
        <Kpi label="Horas" value={fmtNum(kpi.hrs, 1)} />
        <Kpi label="Costo M.O." value={fmtMoney(kpi.cost)} />
      </div>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>Registrar cosecha</CardTitle>
            <CardHint>
              Abre el formulario con este lote ya elegido (kg cereza). Luego
              Grano / beneficio lleva el café a pergamino.
            </CardHint>
          </div>
          {canHarvest ? (
            <Button asChild>
              <Link
                to="/cosecha"
                search={{ lote: code, ses: undefined, nuevo: undefined }}
              >
                Registrar cereza
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <p className="text-sm text-muted">
              Solo lotes activos se cosechan.
            </p>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/beneficio" search={{ batch: undefined }}>
              Grano / beneficio
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/historial">Ver historial completo</Link>
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-6 py-5 md:px-7">
          <CardTitle>Sesiones recientes</CardTitle>
          <CardHint>Datos reales del libro para este lote.</CardHint>
        </div>
        {!sessions.length ? (
          <div className="px-6 py-10 text-center md:px-7">
            <p className="font-display text-2xl text-fg">Sin cosecha aún</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Cuando registre una sesión en este lote, aparecerá aquí con kg,
              costo y enlace a editar.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Código</Th>
                  <Th className="text-right">Kg</Th>
                  <Th className="text-right">Costo</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 12).map((s) => (
                  <tr key={s.id}>
                    <Td className="tabular">{fmtDate(s.fecha)}</Td>
                    <Td className="font-mono text-xs">{s.code}</Td>
                    <Td className="text-right tabular">{fmtKg(s.totKg)}</Td>
                    <Td className="text-right tabular">{fmtMoney(s.totCost)}</Td>
                    <Td className="text-right">
                      <Link
                        to="/cosecha"
                        search={{ ses: s.id, lote: undefined, nuevo: undefined }}
                        className="text-sm text-accent hover:underline"
                      >
                        Editar
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

function LaboresFace({
  code,
  lotName,
  farmId,
  items,
}: {
  code: string;
  lotName: string;
  farmId: string;
  items: LotLabor[];
}) {
  const saveLabor = useFarm((s) => s.saveLabor);
  const settings = useFarm((s) => s.settings);
  const [fecha, setFecha] = useState(todayISO());
  const [tipo, setTipo] = useState<LaborTipo>("plateo");
  const [notas, setNotas] = useState("");
  const [responsable, setResponsable] = useState(settings.responsable || "");
  const [jornal, setJornal] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!fecha) {
      setErr("Indique la fecha.");
      return;
    }
    if (!responsable.trim()) {
      setErr("Indique quién hizo o supervisó la labor.");
      return;
    }
    const j = n(jornal);
    if (j < 0) {
      setErr("El jornal no puede ser negativo.");
      return;
    }
    setErr(null);
    const row: LotLabor = {
      id: uid("lab"),
      farmId,
      fecha,
      lote: code,
      tipo,
      notas: notas.trim(),
      responsable: responsable.trim(),
    };
    if (j > 0) row.jornal = j;
    saveLabor(row);
    setNotas("");
    setJornal("");
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.18em] text-subtle">
          Labores de campo
        </p>
        <h2 className="mt-1 font-display text-3xl tracking-tight">{lotName}</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Plateo, poda, deschupone, broca, sombra u otra labor de campo. No es
          fertilización — eso vive en Nutrición. Sin kg de cosecha aquí.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label="Registros" value={String(items.length)} />
        <Kpi
          label="Última"
          value={items[0] ? fmtDate(items[0].fecha) : "—"}
        />
        <Kpi
          label="Con jornal"
          value={String(items.filter((x) => (x.jornal ?? 0) > 0).length)}
          hint="→ talento si hay monto"
        />
      </div>

      <Card>
        <CardTitle>Registrar labor</CardTitle>
        <CardHint>
          Fecha, tipo de campo y quién. El jornal es opcional: si lo anota, queda
          etiquetado para talento/gente; si no, no entra a Pulso.
        </CardHint>
        <WriteGate>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fecha">
                <Input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                />
              </Field>
              <Field label="Tipo de labor">
                <Select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as LaborTipo)}
                >
                  {LABOR_TIPOS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Quién">
              <Input
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
                placeholder="Nombre de quien hizo o supervisó"
                autoComplete="name"
                required
              />
            </Field>
            <Field label="Jornal / M.O." hint="opcional · talento">
              <MoneyInput value={jornal} onValue={setJornal} />
            </Field>
            <Field label="Notas" hint="opcional">
              <Textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Qué se hizo, condiciones, observaciones…"
                rows={3}
              />
            </Field>
            {err ? (
              <p className="text-sm text-danger" role="alert">
                {err}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit">Guardar labor</Button>
              {savedFlash ? (
                <span className="text-sm text-accent">Guardado</span>
              ) : null}
            </div>
          </form>
        </WriteGate>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-6 py-5 md:px-7">
          <CardTitle>Labores de {lotName}</CardTitle>
          <CardHint>Orden por fecha · solo este lote · farm+lote etiquetados.</CardHint>
        </div>
        {!items.length ? (
          <div className="px-6 py-10 text-center md:px-7">
            <p className="font-display text-2xl text-fg">Sin labores aún</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Cuando registre plateo, poda u otra labor de campo, aparecerá aquí
              con fecha y quién. Vacío honesto — sin datos inventados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Tipo</Th>
                  <Th>Quién</Th>
                  <Th className="text-right">Jornal</Th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 20).map((row) => (
                  <tr key={row.id}>
                    <Td className="tabular whitespace-nowrap">
                      {fmtDate(row.fecha)}
                    </Td>
                    <Td>
                      <Badge tone="muted">{laborTipoLabel(row.tipo)}</Badge>
                    </Td>
                    <Td className="text-sm">
                      {row.responsable || (
                        <span className="text-subtle">—</span>
                      )}
                      {row.notas ? (
                        <div className="mt-0.5 max-w-[12rem] truncate text-xs text-subtle">
                          {row.notas}
                        </div>
                      ) : null}
                    </Td>
                    <Td className="text-right tabular text-sm">
                      {(row.jornal ?? 0) > 0 ? fmtMoney(row.jornal!) : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

function NutritionFace({
  code,
  lotName,
  farmId,
  items,
}: {
  code: string;
  lotName: string;
  farmId: string;
  items: LotNutrition[];
}) {
  const saveNutrition = useFarm((s) => s.saveNutrition);
  const [fecha, setFecha] = useState(todayISO());
  const [via, setVia] = useState<NutritionVia>("suelo");
  const [producto, setProducto] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [unidad, setUnidad] = useState<NutritionUnidad>("kg");
  const [estado, setEstado] = useState<NutritionEstado>("hecha");
  const [notas, setNotas] = useState("");
  const [costo, setCosto] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const hechas = items.filter((x) => x.estado === "hecha").length;
  const plan = items.filter((x) => x.estado === "planificada").length;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!fecha) {
      setErr("Indique la fecha.");
      return;
    }
    if (!producto.trim()) {
      setErr("Indique el producto aplicado.");
      return;
    }
    const qty = n(cantidad);
    if (qty <= 0) {
      setErr("Indique cantidad mayor a cero (kg o bultos).");
      return;
    }
    const c = n(costo);
    if (c < 0) {
      setErr("El costo no puede ser negativo.");
      return;
    }
    setErr(null);
    const row: LotNutrition = {
      id: uid("nut"),
      farmId,
      fecha,
      lote: code,
      via,
      producto: producto.trim(),
      cantidad: qty,
      unidad,
      estado,
      notas: notas.trim(),
    };
    if (c > 0) row.costoProducto = c;
    saveNutrition(row);
    setProducto("");
    setCantidad("");
    setNotas("");
    setCosto("");
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.18em] text-subtle">
          Nutrición · suelo / foliar
        </p>
        <h2 className="mt-1 font-display text-3xl tracking-tight">{lotName}</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Solo aplicaciones al suelo o foliar: producto, cantidad y fecha. El
          análisis de suelos es contexto (notas), no un modelo Cenicafé. Sin kg
          de cosecha aquí.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label="Registros" value={String(items.length)} />
        <Kpi label="Hechas" value={String(hechas)} />
        <Kpi label="Planificadas" value={String(plan)} />
      </div>

      <Card>
        <CardTitle>Registrar aplicación</CardTitle>
        <CardHint>
          Producto + kg/bultos + fecha. Costo del producto opcional: si lo anota,
          queda para dinero saliente / $/kg; si no, no entra a Pulso.
        </CardHint>
        <WriteGate>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Fecha">
                <Input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                />
              </Field>
              <Field label="Vía">
                <Select
                  value={via}
                  onChange={(e) => setVia(e.target.value as NutritionVia)}
                >
                  {NUTRITION_VIAS.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Producto">
              <Input
                value={producto}
                onChange={(e) => setProducto(e.target.value)}
                placeholder="Ej. 15-15-15, cal dolomita, urea…"
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Cantidad">
                <DecimalInput
                  value={cantidad}
                  onValue={setCantidad}
                  decimals={1}
                  placeholder="0"
                />
              </Field>
              <Field label="Unidad">
                <Select
                  value={unidad}
                  onChange={(e) =>
                    setUnidad(e.target.value as NutritionUnidad)
                  }
                >
                  {NUTRITION_UNIDADES.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Estado">
                <Select
                  value={estado}
                  onChange={(e) =>
                    setEstado(e.target.value as NutritionEstado)
                  }
                >
                  {NUTRITION_ESTADOS.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Costo producto" hint="opcional · dinero saliente">
              <MoneyInput value={costo} onValue={setCosto} />
            </Field>
            <Field
              label="Notas / análisis"
              hint="contexto · no es consejo científico"
            >
              <Textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Análisis de suelos, dosis por planta, clima…"
                rows={3}
              />
            </Field>
            {err ? (
              <p className="text-sm text-danger" role="alert">
                {err}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit">Guardar aplicación</Button>
              {savedFlash ? (
                <span className="text-sm text-accent">Guardado</span>
              ) : null}
            </div>
          </form>
        </WriteGate>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-6 py-5 md:px-7">
          <CardTitle>Nutrición de {lotName}</CardTitle>
          <CardHint>
            Orden por fecha · suelo/foliar · sin recomendaciones inventadas.
          </CardHint>
        </div>
        {!items.length ? (
          <div className="px-6 py-10 text-center md:px-7">
            <p className="font-display text-2xl text-fg">Sin aplicaciones aún</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Registre una aplicación al suelo o foliar. Preferimos vacío
              honesto a cifras o consejos inventados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Fecha</Th>
                  <Th>Producto</Th>
                  <Th className="text-right">Cant.</Th>
                  <Th>Estado</Th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 20).map((row) => (
                  <tr key={row.id}>
                    <Td className="tabular whitespace-nowrap">
                      {fmtDate(row.fecha)}
                    </Td>
                    <Td>
                      <div className="text-sm">{row.producto}</div>
                      <div className="mt-0.5 text-xs text-subtle">
                        {nutritionViaLabel(row.via)}
                        {row.notas ? ` · ${row.notas}` : ""}
                      </div>
                    </Td>
                    <Td className="text-right tabular text-sm">
                      {fmtNum(row.cantidad, 1)} {row.unidad}
                      {(row.costoProducto ?? 0) > 0 ? (
                        <div className="text-xs text-subtle">
                          {fmtMoney(row.costoProducto!)}
                        </div>
                      ) : null}
                    </Td>
                    <Td>
                      <Badge
                        tone={row.estado === "hecha" ? "ok" : "warn"}
                      >
                        {nutritionEstadoLabel(row.estado)}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}


function CultivoFace({
  code,
  lotName,
  farmId,
  lotVariedad,
  design,
}: {
  code: string;
  lotName: string;
  farmId: string;
  lotVariedad: string;
  design: LotCultivo | null;
}) {
  const saveCultivo = useFarm((s) => s.saveCultivo);
  const [variedad, setVariedad] = useState(
    design?.variedad || lotVariedad || "",
  );
  const [mezcla, setMezcla] = useState(Boolean(design?.mezcla));
  const [variedadNota, setVariedadNota] = useState(design?.variedadNota || "");
  const [anioSiembra, setAnioSiembra] = useState(
    design?.anioSiembra != null ? String(design.anioSiembra) : "",
  );
  const [edadApprox, setEdadApprox] = useState(design?.edadApprox || "");
  const [densidad, setDensidad] = useState(design?.densidad || "");
  const [plantasApprox, setPlantasApprox] = useState(
    design?.plantasApprox != null ? String(design.plantasApprox) : "",
  );
  const [estado, setEstado] = useState<CultivoEstado>(
    design?.estado ?? "produccion",
  );
  const [sombra, setSombra] = useState(
    design?.sombra == null ? "omit" : design.sombra ? "si" : "no",
  );
  const [sombraTipo, setSombraTipo] = useState(design?.sombraTipo || "");
  const [err, setErr] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!variedad.trim()) {
      setErr("Indique la variedad (o anote si es mezcla).");
      return;
    }
    const yearRaw = anioSiembra.trim();
    let year: number | undefined;
    if (yearRaw) {
      const y = Number(yearRaw);
      if (!Number.isFinite(y) || y < 1900 || y > 2100) {
        setErr("Año de siembra inválido.");
        return;
      }
      year = Math.round(y);
    }
    const plantasRaw = plantasApprox.trim();
    let plantas: number | undefined;
    if (plantasRaw) {
      const p = n(plantasRaw);
      if (p < 0) {
        setErr("El conteo de plantas no puede ser negativo.");
        return;
      }
      if (p > 0) plantas = Math.round(p);
    }
    if (!densidad.trim() && plantas == null) {
      setErr("Indique densidad (plantas/ha o marco) o un conteo de plantas.");
      return;
    }
    setErr(null);
    const row: LotCultivo = {
      id: design?.id ?? uid("cul"),
      farmId,
      lote: code,
      title: lotName,
      variedad: variedad.trim(),
      estado,
      updatedAt: new Date().toISOString(),
    };
    if (mezcla) {
      row.mezcla = true;
      if (variedadNota.trim()) row.variedadNota = variedadNota.trim();
    }
    if (year != null) row.anioSiembra = year;
    if (edadApprox.trim()) row.edadApprox = edadApprox.trim();
    if (densidad.trim()) row.densidad = densidad.trim();
    if (plantas != null) row.plantasApprox = plantas;
    if (sombra === "si") {
      row.sombra = true;
      if (sombraTipo.trim()) row.sombraTipo = sombraTipo.trim();
    } else if (sombra === "no") {
      row.sombra = false;
    }
    saveCultivo(row);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  }

  const filled = hasCultivoDesign(design);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.18em] text-subtle">
          Cultivo · diseño del lote
        </p>
        <h2 className="mt-1 font-display text-3xl tracking-tight">{lotName}</h2>
        <p className="mt-2 max-w-prose text-sm text-muted">
          Una sola ficha limpia: variedad, año/edad, densidad o conteo, estado
          (levante · producción · zoca/renovación) y sombra opcional. Sin
          labores, sin nutrición, sin kg de cosecha — y sin dinero a Pulso.
        </p>
      </header>

      <Card>
        <CardTitle>{lotName}</CardTitle>
        <CardHint>
          Título = nombre del lote. El mapa planta por planta es el próximo salto;
          aquí solo un conteo simple si lo tiene.
        </CardHint>

        {filled && design ? (
          <div className="mt-5 rounded-xl border border-border bg-elevated/50 px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                tone={
                  design.estado === "produccion"
                    ? "ok"
                    : design.estado === "levante"
                      ? "warn"
                      : "muted"
                }
              >
                {cultivoEstadoLabel(design.estado)}
              </Badge>
              {design.sombra === true ? (
                <Badge tone="muted">
                  Sombra{design.sombraTipo ? ` · ${design.sombraTipo}` : ""}
                </Badge>
              ) : design.sombra === false ? (
                <Badge tone="muted">Sin sombra</Badge>
              ) : null}
              {design.mezcla ? <Badge tone="warn">Mezcla</Badge> : null}
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] uppercase tracking-[0.14em] text-subtle">
                  Variedad
                </dt>
                <dd className="mt-1 text-sm text-fg">
                  {design.variedad}
                  {design.variedadNota ? (
                    <span className="mt-0.5 block text-xs text-muted">
                      {design.variedadNota}
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.14em] text-subtle">
                  Año / edad
                </dt>
                <dd className="mt-1 text-sm text-fg">
                  {design.anioSiembra != null ? design.anioSiembra : "—"}
                  {design.edadApprox ? ` · ${design.edadApprox}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.14em] text-subtle">
                  Densidad
                </dt>
                <dd className="mt-1 text-sm text-fg">
                  {design.densidad?.trim() ? design.densidad : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-[0.14em] text-subtle">
                  Plantas (conteo)
                </dt>
                <dd className="mt-1 text-sm text-fg">
                  {design.plantasApprox != null && design.plantasApprox > 0
                    ? fmtNum(design.plantasApprox, 0)
                    : "—"}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-subtle">
              Sin mapa planta a planta todavía — ese es el próximo salto.
            </p>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-border bg-elevated/40 px-5 py-8 text-center">
            <p className="font-display text-2xl text-fg">Sin diseño aún</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              Capture variedad, año o edad, densidad o conteo, y el estado del
              lote. Vacío honesto — sin cifras inventadas.
            </p>
            <p className="mx-auto mt-3 max-w-sm text-xs text-subtle">
              El mapa planta por planta es el próximo salto.
            </p>
          </div>
        )}

        <WriteGate>
          <form onSubmit={submit} className="mt-6 space-y-4 border-t border-border pt-5">
            <Field label="Variedad">
              <Input
                value={variedad}
                onChange={(e) => setVariedad(e.target.value)}
                placeholder="Ej. Castillo, Caturra…"
                required
              />
            </Field>
            <label className="flex min-h-11 items-center gap-3 text-sm text-fg">
              <input
                type="checkbox"
                className="size-4 rounded border-border"
                checked={mezcla}
                onChange={(e) => setMezcla(e.target.checked)}
              />
              Mezcla de variedades en este lote
            </label>
            {mezcla ? (
              <Field label="Nota de mezcla" hint="opcional">
                <Input
                  value={variedadNota}
                  onChange={(e) => setVariedadNota(e.target.value)}
                  placeholder="Ej. Castillo + Caturra ~60/40"
                />
              </Field>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Año de siembra" hint="aprox.">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={anioSiembra}
                  onChange={(e) => setAnioSiembra(e.target.value)}
                  placeholder="2021"
                  min={1900}
                  max={2100}
                />
              </Field>
              <Field label="Edad aprox." hint="texto libre">
                <Input
                  value={edadApprox}
                  onChange={(e) => setEdadApprox(e.target.value)}
                  placeholder="Ej. 3 años · soca ~2"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Densidad" hint="plantas/ha o marco">
                <Input
                  value={densidad}
                  onChange={(e) => setDensidad(e.target.value)}
                  placeholder="Ej. 5000 · o 1.5 × 1.5 m"
                />
              </Field>
              <Field label="Conteo de plantas" hint="opcional · simple">
                <DecimalInput
                  value={plantasApprox}
                  onValue={setPlantasApprox}
                  decimals={0}
                  placeholder="0"
                />
              </Field>
            </div>
            <Field label="Estado">
              <Select
                value={estado}
                onChange={(e) => setEstado(e.target.value as CultivoEstado)}
              >
                {CULTIVO_ESTADOS.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sombra" hint="opcional">
                <Select
                  value={sombra}
                  onChange={(e) => setSombra(e.target.value)}
                >
                  <option value="omit">Sin especificar</option>
                  <option value="no">No (pleno sol)</option>
                  <option value="si">Sí</option>
                </Select>
              </Field>
              {sombra === "si" ? (
                <Field label="Tipo de sombra" hint="opcional">
                  <Input
                    value={sombraTipo}
                    onChange={(e) => setSombraTipo(e.target.value)}
                    placeholder="Ej. guamo, plátano…"
                  />
                </Field>
              ) : (
                <div />
              )}
            </div>
            {err ? (
              <p className="text-sm text-danger" role="alert">
                {err}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit">
                {filled ? "Actualizar cultivo" : "Guardar cultivo"}
              </Button>
              {savedFlash ? (
                <span className="text-sm text-accent">Guardado</span>
              ) : null}
            </div>
          </form>
        </WriteGate>
      </Card>
    </div>
  );
}

function ComingFace({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <p className="text-[11px] uppercase tracking-[0.18em] text-subtle">
        Próximamente
      </p>
      <CardTitle className="mt-2">{title}</CardTitle>
      <CardHint className="mt-3 max-w-prose">{body}</CardHint>
      <div className="mt-8 rounded-xl border border-dashed border-border bg-elevated/40 px-5 py-10 text-center">
        <p className="text-sm text-muted">Sin datos todavía — y está bien.</p>
        <p className="mt-1 text-xs text-subtle">
          Preferimos vacío honesto a cifras inventadas.
        </p>
      </div>
    </Card>
  );
}
