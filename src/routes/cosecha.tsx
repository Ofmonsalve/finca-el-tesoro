import { createFileRoute } from "@tanstack/react-router";
import { HarvestForm } from "@/components/harvest-form";
import { WriteGate } from "@/components/write-gate";

export const Route = createFileRoute("/cosecha")({
  validateSearch: (s: Record<string, unknown>) => ({
    ses: typeof s.ses === "string" ? s.ses : undefined,
  }),
  component: Page,
});

function Page() {
  const { ses } = Route.useSearch();
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
          Operación
        </p>
        <h1 className="font-display text-4xl tracking-tight">
          {ses ? "Editar sesión" : "Registro de cosecha"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Nombre y kilogramos primero. Horas y pago se calculan solos. Al
          guardar, el lote entra a tolva.
        </p>
      </header>
      <WriteGate>
        <HarvestForm editId={ses} />
      </WriteGate>
    </div>
  );
}