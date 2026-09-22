import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Tractor } from "lucide-react";
import { useMemo, useState } from "react";
import { Kpi } from "@/components/kpi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { buildConsolidado } from "@/lib/farm-consolidado";
import { useFarmRegistry, displayFarmName } from "@/lib/farm-registry";
import { fmtKg, fmtMoney, fmtNum } from "@/lib/format";
import { useFarm } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: ConsolidadoPage });

/**
 * Home for a multi-farm owner: Consolidado first (all fincas), then drill into
 * one finca, then one lote. Not an “executive panel”.
 */
function ConsolidadoPage() {
  const navigate = useNavigate();
  const farms = useFarmRegistry((s) => s.farms);
  const activeFarmId = useFarmRegistry((s) => s.activeFarmId);
  const setActiveFarmId = useFarmRegistry((s) => s.setActiveFarmId);
  const createFarm = useFarmRegistry((s) => s.createFarm);
  const switchFarm = useFarm((s) => s.switchFarm);
  const [newName, setNewName] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Recompute when farm list or active book changes (sessions/lots of active farm).
  const sessions = useFarm((s) => s.sessions);
  const lots = useFarm((s) => s.lots);
  const summary = useMemo(
    () => buildConsolidado(farms),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- active book edits must refresh rollup
    [farms, sessions, lots, activeFarmId],
  );

  function openFarm(id: string) {
    const reg = setActiveFarmId(id);
    if (!reg.ok) {
      setNote(reg.error ?? "No se pudo elegir la finca.");
      return;
    }
    const r = switchFarm(id);
    if (!r.ok) {
      setNote(r.error ?? "No se pudo abrir la finca.");
      return;
    }
    void navigate({ to: "/estado" });
  }

  function onCreate() {
    const r = createFarm(newName);
    if (!r.ok || !r.farm) {
      setNote(r.error ?? "No se pudo crear.");
      return;
    }
    const sw = switchFarm(r.farm.id);
    if (!sw.ok) {
      setNote(sw.error ?? "Finca creada, pero no se abrió.");
      return;
    }
    setNewName("");
    setShowCreate(false);
    setNote(null);
    void navigate({ to: "/estado" });
  }

  const activeName = displayFarmName(activeFarmId, farms);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
            AURA
          </p>
          <h1 className="font-display text-4xl tracking-tight">
            Sus fincas
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Primero AURA (todas las fincas), luego una finca, luego un lote.
            Cada cifra lleva el nombre de su finca. Los kg se marcan como cereza
            o pergamino.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setShowCreate((v) => !v)}>
            Nueva finca
          </Button>
          <Button asChild variant="outline">
            <Link to="/estado">
              Abrir «{activeName}»
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>
      </header>

      {showCreate ? (
        <Card>
          <CardTitle>Nueva finca</CardTitle>
          <CardHint>Arranca vacía: sin lotes demo hasta que usted los pida.</CardHint>
          <div className="mt-4 flex flex-wrap gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ej. La Esperanza"
              className="min-h-11 min-w-[220px] flex-1 rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-accent"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onCreate();
                }
              }}
            />
            <Button type="button" onClick={onCreate}>
              Crear y abrir
            </Button>
          </div>
        </Card>
      ) : null}

      {note ? <p className="text-sm text-accent">{note}</p> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Fincas"
          value={String(summary.farmCount)}
          hint="En este dispositivo"
        />
        <Kpi
          label="Kg cereza · todas"
          value={fmtNum(summary.totalKg, 1)}
          hint="Cereza (no pergamino) · suma AURA"
        />
        <Kpi
          label="Costo cosecha · todas"
          value={fmtMoney(summary.totalCostoCosecha)}
          hint="M.O. + alimentación · por finca abajo"
        />
        <Kpi
          label="Pagos pendientes · todas"
          value={fmtMoney(summary.totalPendMO)}
          hint={
            summary.alertCount
              ? `${summary.alertCount} alerta(s)`
              : "Sin alertas"
          }
        />
      </div>

      <section id="fincas" className="space-y-3 scroll-mt-24" aria-label="Fincas">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl tracking-tight">Fincas</h2>
          <p className="text-xs text-muted">
            {fmtNum(summary.totalHa, 2)} ha en total
          </p>
        </div>
        <ul className="space-y-2">
          {summary.farms.map((f) => {
            const active = f.farmId === activeFarmId;
            return (
              <li key={f.farmId}>
                <button
                  type="button"
                  onClick={() => openFarm(f.farmId)}
                  className={cn(
                    "flex w-full flex-col gap-3 rounded-2xl border px-4 py-4 text-left transition-colors sm:flex-row sm:items-center sm:justify-between",
                    active
                      ? "border-accent/50 bg-accent/5"
                      : "border-border bg-surface hover:bg-elevated/60",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="grid size-11 place-items-center rounded-xl border border-border bg-elevated text-accent">
                      <Tractor className="size-5" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-xl tracking-tight">
                          {f.name}
                        </span>
                        {active ? (
                          <Badge tone="ok">Activa</Badge>
                        ) : (
                          <Badge>Abrir</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {f.lotCount} lote(s) · {fmtNum(f.ha, 2)} ha ·{" "}
                        {fmtKg(f.kg)} cereza · {f.name}
                      </p>
                      {f.alerts.length ? (
                        <ul className="mt-2 space-y-0.5">
                          {f.alerts.map((a) => (
                            <li
                              key={a}
                              className="text-xs text-amber-200/90"
                            >
                              {a}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-xs text-muted">Al día</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted sm:flex-col sm:items-end">
                    <span>
                      Cosecha {fmtMoney(f.costoCosecha)} · {f.name}
                    </span>
                    <span className="inline-flex items-center gap-1 text-accent">
                      Entrar
                      <ChevronRight className="size-4" />
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <Card>
        <CardTitle>Cómo se navega</CardTitle>
        <CardHint>
          AURA → Finca → Lote. Menú: AURA · Fincas · Cosecha · Equipo · Analítica.
          Beneficio vive en Cosecha / Hoy de la finca, no en el menú de arriba.
        </CardHint>
      </Card>
    </div>
  );
}
