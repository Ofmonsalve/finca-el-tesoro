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
 * Holding Pulso — glance de las 6 métricas (orden contrato):
 * Entra → Sale → Cosecha → Vendible → Costo/kg → Talento; luego alertas.
 * Toda cifra lleva etiqueta de finca (o «todas las fincas»).
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

  const sessions = useFarm((s) => s.sessions);
  const lots = useFarm((s) => s.lots);
  const sales = useFarm((s) => s.sales);
  const costs = useFarm((s) => s.costs);
  const batches = useFarm((s) => s.batches);
  const summary = useMemo(
    () => buildConsolidado(farms),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [farms, sessions, lots, sales, costs, batches, activeFarmId],
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
  const scope = "todas las fincas";
  const hasIn = summary.totalMoneyIn > 0;
  const hasOut = summary.totalMoneyOut > 0;
  const hasCosecha = summary.totalKgCereza > 0;
  const hasVendible = summary.totalKgVendible > 0;
  const hasTalento = summary.totalTalentoPay > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
            Pulso
          </p>
          <h1 className="font-display text-4xl tracking-tight">Sus fincas</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">
            Primero Pulso (todas), luego una finca, luego un lote. Cada cifra
            lleva el nombre de su finca. Los kg se marcan cereza o pergamino —
            nunca se mezclan.
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
          <CardHint>
            Arranca vacía: sin lotes demo hasta que usted los pida.
          </CardHint>
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

      {/* Orden contrato: Entra → Sale → Cosecha → Vendible → Costo/kg → Talento */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi
          label={`Entra · ${scope}`}
          value={hasIn ? fmtMoney(summary.totalMoneyIn) : "—"}
          hint={hasIn ? "Ventas · suma por finca abajo" : "Sin ventas en el libro"}
        />
        <Kpi
          label={`Sale · ${scope}`}
          value={hasOut ? fmtMoney(summary.totalMoneyOut) : "—"}
          hint={
            hasOut
              ? "Cosecha + gastos · suma por finca abajo"
              : "Sin salidas en el libro"
          }
        />
        <Kpi
          label={`Cosecha · kg cereza · ${scope}`}
          value={hasCosecha ? fmtNum(summary.totalKgCereza, 1) : "—"}
          hint={
            hasCosecha
              ? `kg cereza · ${summary.farmCount} finca(s)`
              : "Aún no hay cosecha"
          }
        />
        <Kpi
          label={`Vendible · kg pergamino · ${scope}`}
          value={hasVendible ? fmtNum(summary.totalKgVendible, 1) : "—"}
          hint={
            hasVendible
              ? "kg pergamino en bodega, sin vender"
              : "Sin pergamino listo"
          }
        />
        <Kpi
          label={`Costo / kg cereza · ${scope}`}
          value={summary.costoKg != null ? fmtMoney(summary.costoKg) : "—"}
          hint={
            summary.costoKg != null
              ? "Suma costo ÷ suma kg cereza (misma unidad)"
              : "Se calcula con kg cereza"
          }
        />
        <Kpi
          label={`Talento · gente · ${scope}`}
          value={hasTalento ? fmtMoney(summary.totalTalentoPay) : "—"}
          hint={
            hasTalento
              ? `Jornales / pagos · pend. ${fmtMoney(summary.totalPendMO)}`
              : "Aún no hay pagos a gente"
          }
        />
      </div>

      {!hasCosecha && !hasIn && !hasOut ? (
        <Card>
          <CardTitle>Libro en calma</CardTitle>
          <CardHint>
            Cuando registre cosecha, ventas o gastos, aquí late el consolidado.
            Nada inventado.
          </CardHint>
        </Card>
      ) : null}

      <section
        id="fincas"
        className="space-y-3 scroll-mt-24"
        aria-label="Territorios"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl tracking-tight">Territorios</h2>
          <p className="text-xs text-muted">
            {fmtNum(summary.totalHa, 2)} ha · {scope}
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
                    <div className="min-w-0 flex-1">
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
                        {f.lotCount} lote(s) · {fmtNum(f.ha, 2)} ha · {f.name}
                      </p>
                      {/* 6 métricas por finca, etiqueta = nombre */}
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted sm:grid-cols-3">
                        <div>
                          <dt className="uppercase tracking-wide">Entra · {f.name}</dt>
                          <dd className="tabular text-fg">
                            {f.moneyIn > 0 ? fmtMoney(f.moneyIn) : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="uppercase tracking-wide">Sale · {f.name}</dt>
                          <dd className="tabular text-fg">
                            {f.moneyOut > 0 ? fmtMoney(f.moneyOut) : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="uppercase tracking-wide">
                            Cosecha · kg cereza · {f.name}
                          </dt>
                          <dd className="tabular text-fg">
                            {f.kgCereza > 0 ? fmtNum(f.kgCereza, 1) : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="uppercase tracking-wide">
                            Vendible · kg pergamino · {f.name}
                          </dt>
                          <dd className="tabular text-fg">
                            {f.kgVendible > 0 ? fmtNum(f.kgVendible, 1) : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="uppercase tracking-wide">
                            Costo / kg cereza · {f.name}
                          </dt>
                          <dd className="tabular text-fg">
                            {f.costoKg != null ? fmtMoney(f.costoKg) : "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="uppercase tracking-wide">
                            Talento · gente · {f.name}
                          </dt>
                          <dd className="tabular text-fg">
                            {f.talentoPay > 0 ? fmtMoney(f.talentoPay) : "—"}
                          </dd>
                        </div>
                      </dl>
                      {f.alerts.length ? (
                        <ul className="mt-2 space-y-0.5">
                          {f.alerts.map((a) => (
                            <li key={a} className="text-xs text-amber-200/90">
                              {a} · {f.name}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm text-accent">
                    Entrar
                    <ChevronRight className="size-4" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <Card>
        <CardTitle>Cómo se navega</CardTitle>
        <CardHint>
          Pulso → Finca → Lote. Menú: Pulso · Territorios · Cosecha · Talento ·
          Inteligencia. Beneficio vive en Cosecha / Hoy de la finca, no en el
          menú de arriba.
        </CardHint>
      </Card>
    </div>
  );
}
