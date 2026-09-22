/**
 * Talento — gente de la finca (not HR / app permissions).
 * List: nombre, rol de campo, finca, jornales/pago del período.
 * Persist personas in farm book by farmId. Link to /liquidacion for pagos.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { Users } from "lucide-react";
import { WriteGate } from "@/components/write-gate";
import { useFarmAccess } from "@/components/farm-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/fields";
import { Kpi } from "@/components/kpi";
import { Table, Td, Th } from "@/components/ui/table";
import { fmtMoney, todayISO } from "@/lib/format";
import { canWrite } from "@/lib/roles";
import { displayFarmName, useFarmRegistry } from "@/lib/farm-registry";
import { useFarm } from "@/lib/store";
import type { FarmPerson, PersonRole } from "@/lib/types";
import { uid } from "@/lib/utils";
import {
  PERSON_ROLES,
  personRoleLabel,
  personasForFarm,
  talentoPeriodSummary,
  validatePersonaInput,
} from "@/lib/talento";

export const Route = createFileRoute("/talento")({ component: TalentoPage });

type Draft = {
  id: string | null;
  nombre: string;
  rol: PersonRole;
  telefono: string;
  activo: boolean;
};

const emptyDraft = (): Draft => ({
  id: null,
  nombre: "",
  rol: "recolector",
  telefono: "",
  activo: true,
});

function TalentoPage() {
  const farmId = useFarm((s) => s.farmId);
  const personas = useFarm((s) => s.personas);
  const sessions = useFarm((s) => s.sessions);
  const liquidations = useFarm((s) => s.liquidations);
  const savePersona = useFarm((s) => s.savePersona);
  const farms = useFarmRegistry((s) => s.farms);
  const farmName = displayFarmName(farmId, farms);
  const { role } = useFarmAccess();
  const writable = canWrite(role);

  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(true);

  const list = useMemo(
    () =>
      personasForFarm(personas, farmId, { includeInactive: showInactive }),
    [personas, farmId, showInactive],
  );

  const summary = useMemo(
    () => talentoPeriodSummary(personas, sessions, liquidations, farmId),
    [personas, sessions, liquidations, farmId],
  );

  const payByKey = useMemo(() => {
    const m = new Map<string, (typeof summary.rows)[0]>();
    for (const r of summary.rows) m.set(r.key, r);
    return m;
  }, [summary.rows]);

  function edit(p: FarmPerson) {
    setDraft({
      id: p.id,
      nombre: p.nombre,
      rol: p.rol,
      telefono: p.telefono ?? "",
      activo: p.activo,
    });
    setErr(null);
    setFlash(null);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setFlash(null);
    const v = validatePersonaInput({
      nombre: draft.nombre,
      rol: draft.rol,
      telefono: draft.telefono,
      farmId,
    });
    if (!v.ok) {
      setErr(v.error);
      return;
    }
    const row: FarmPerson = {
      id: draft.id || uid("per"),
      farmId: v.farmId,
      nombre: v.nombre,
      rol: v.rol,
      ...(v.telefono ? { telefono: v.telefono } : {}),
      activo: draft.activo,
      updatedAt: todayISO(),
    };
    savePersona(row);
    setDraft(emptyDraft());
    setFlash(draft.id ? "Persona actualizada." : "Persona agregada.");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
          Gente · jornales
        </p>
        <h1 className="font-display text-4xl tracking-tight">Talento</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Gente de la finca {farmName}: quién trabaja, su rol de campo y lo
          ganado en el período. Los pagos se cierran en liquidación — aquí no
          hay permisos de app ni títulos.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={`Activos · ${farmName}`} value={String(summary.activeCount)} />
        <Kpi
          label="Devengado período"
          value={summary.totalEarned > 0 ? fmtMoney(summary.totalEarned) : "—"}
        />
        <Kpi
          label="Pagado"
          value={summary.totalPaid > 0 ? fmtMoney(summary.totalPaid) : "—"}
        />
        <Kpi
          label="Pendiente"
          value={
            summary.totalPend !== 0 ? fmtMoney(summary.totalPend) : "—"
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="accent" size="sm">
          <Link to="/liquidacion">Ir a pagos / liquidación</Link>
        </Button>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="size-4 rounded border-border"
          />
          Mostrar inactivos
        </label>
      </div>

      {list.length === 0 ? (
        <Card>
          <div className="rounded-xl border border-dashed border-border bg-elevated/40 px-5 py-12 text-center">
            <Users className="mx-auto size-8 text-subtle" />
            <p className="mt-4 font-display text-2xl tracking-tight">
              Aún no hay gente en esta finca
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              Registre recolectores, mayordomos, jornaleros o beneficio. Preferimos
              vacío honesto a una lista inventada. Los jornales salen de la
              cosecha (máx. 1 jornal por persona y día).
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <CardTitle>Gente · {farmName}</CardTitle>
          <CardHint className="mt-1">
            Solo esta finca. Nombre · rol de campo · jornales / pago del período.
          </CardHint>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Nombre</Th>
                  <Th>Rol</Th>
                  <Th>Finca</Th>
                  <Th>Jornales</Th>
                  <Th>Pago período</Th>
                  <Th>Estado</Th>
                  {writable ? <Th>Editar</Th> : null}
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const key = p.nombre.trim().toLowerCase();
                  const pay = payByKey.get(key);
                  return (
                    <tr key={p.id} className={p.activo ? "" : "opacity-60"}>
                      <Td>{p.nombre}</Td>
                      <Td>{personRoleLabel(p.rol)}</Td>
                      <Td className="text-muted">{farmName}</Td>
                      <Td>
                        {pay && pay.jornalDays > 0
                          ? String(pay.jornalDays)
                          : "—"}
                      </Td>
                      <Td>
                        {pay && pay.earned > 0 ? fmtMoney(pay.earned) : "—"}
                      </Td>
                      <Td>
                        <Badge tone={p.activo ? "ok" : "muted"}>
                          {p.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </Td>
                      {writable ? (
                        <Td>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => edit(p)}
                          >
                            Editar
                          </Button>
                        </Td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        </Card>
      )}

      {/* Harvest names not yet in registry — soft hint, no kg */}
      {summary.rows.some((r) => !r.linked && r.earned > 0) ? (
        <Card>
          <CardTitle>En cosecha, sin ficha</CardTitle>
          <CardHint className="mt-1">
            Aparecieron en sesiones de cosecha. Agréguelos al registro para
            unir nombre y rol — sin inventar datos.
          </CardHint>
          <ul className="mt-3 space-y-2 text-sm">
            {summary.rows
              .filter((r) => !r.linked && r.earned > 0)
              .map((r) => (
                <li
                  key={r.key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-elevated/50 px-3 py-2"
                >
                  <span>
                    {r.nombre}{" "}
                    <span className="text-muted">
                      · {fmtMoney(r.earned)}
                      {r.jornalDays > 0
                        ? ` · ${r.jornalDays} día(s) jornal`
                        : ""}
                    </span>
                  </span>
                  {writable ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setDraft({
                          id: null,
                          nombre: r.nombre,
                          rol: "recolector",
                          telefono: "",
                          activo: true,
                        })
                      }
                    >
                      Agregar al registro
                    </Button>
                  ) : null}
                </li>
              ))}
          </ul>
        </Card>
      ) : null}

      <WriteGate>
        <Card>
          <CardTitle>
            {draft.id ? "Editar persona" : "Agregar persona"}
          </CardTitle>
          <CardHint className="mt-1">
            Rol de trabajo en la finca — no es permiso de la aplicación.
          </CardHint>
          {err ? (
            <p className="mt-3 rounded-md bg-danger/15 px-3 py-2 text-sm text-danger">
              {err}
            </p>
          ) : null}
          {flash ? (
            <p className="mt-3 text-sm text-accent">{flash}</p>
          ) : null}
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={onSubmit}
          >
            <Field label="Nombre">
              <Input
                value={draft.nombre}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, nombre: e.target.value }))
                }
                placeholder="Ej. Carlos Pérez"
                autoComplete="name"
              />
            </Field>
            <Field label="Rol de campo">
              <Select
                value={draft.rol}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    rol: e.target.value as PersonRole,
                  }))
                }
              >
                {PERSON_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Teléfono" hint="opcional · no sale en la lista">
              <Input
                value={draft.telefono}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, telefono: e.target.value }))
                }
                placeholder="300…"
                inputMode="tel"
              />
            </Field>
            <Field label="Estado">
              <Select
                value={draft.activo ? "activo" : "inactivo"}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    activo: e.target.value === "activo",
                  }))
                }
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </Select>
            </Field>
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit">
                {draft.id ? "Guardar cambios" : "Agregar"}
              </Button>
              {draft.id ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDraft(emptyDraft());
                    setErr(null);
                    setFlash(null);
                  }}
                >
                  Cancelar
                </Button>
              ) : null}
              <p className="text-xs text-muted">
                Se guarda en el libro de {farmName} (farmId).
              </p>
            </div>
          </form>
        </Card>
      </WriteGate>
    </div>
  );
}
