import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, ChevronRight, Leaf, Sprout, FlaskConical, Shovel } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Kpi } from "@/components/kpi";
import { Table, Td, Th } from "@/components/ui/table";
import { fmtDate, fmtKg, fmtMoney, fmtNum } from "@/lib/format";
import { lotByCode, rollupCode, type LotStatus } from "@/lib/lots";
import { farmStats } from "@/lib/stats";
import { useFarm } from "@/lib/store";
import type { HarvestSession } from "@/lib/types";
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
        <ComingFace
          title="Labores"
          body="Aquí verá podas, plateos, desyerbes y otras labores del lote — con fecha, responsable y costo. Aún no hay registro; la cara queda lista para cuando el libro lo soporte."
        />
      ) : null}
      {cara === "abono" ? (
        <ComingFace
          title="Nutrición"
          body="Nutrición: fertilizaciones y enmiendas por lote: producto, dosis, fecha y costo. Sin datos inventados — cuando exista el modelo, esta cara lo mostrará."
        />
      ) : null}
      {cara === "cultivo" ? (
        <ComingFace
          title="Cultivo"
          body="Variedad, densidad, edad de soca y estado agronómico del lote. Por ahora use la ficha del mapa; el detalle vivo llega en una próxima entrega."
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
              Abre el formulario con este lote ya elegido. El beneficio sigue
              disponible desde la sesión guardada.
            </CardHint>
          </div>
          {canHarvest ? (
            <Button asChild>
              <Link to="/cosecha" search={{ lote: code, ses: undefined }}>
                Registrar cosecha
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
            <Link to="/beneficio">Ir a beneficio</Link>
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
                        search={{ ses: s.id, lote: undefined }}
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
