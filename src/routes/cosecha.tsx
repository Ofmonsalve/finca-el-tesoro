import { createFileRoute } from "@tanstack/react-router";
import { HarvestForm } from "@/components/harvest-form";
import { WriteGate } from "@/components/write-gate";

export const Route = createFileRoute("/cosecha")({
  validateSearch: (s: Record<string, unknown>) => ({
    ses: typeof s.ses === "string" ? s.ses : undefined,
    lote: typeof s.lote === "string" ? s.lote : undefined,
  }),
  component: Page,
});

function Page() {
  const { ses, lote } = Route.useSearch();
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
          Cosecha
        </p>
        <h1 className="font-display text-4xl tracking-tight">
          {ses ? "Editar sesión" : "Registro de cosecha"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Grano: kilogramos de cereza primero (etiquetados). Horas y pago se
          calculan solos. Al guardar, el lote entra a beneficio / pergamino.
        </p>
      </header>
      <WriteGate>
        <HarvestForm editId={ses} initialLote={lote} />
      </WriteGate>
    </div>
  );
}