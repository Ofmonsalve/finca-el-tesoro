import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy path — Talento lives at /talento (gente de finca, not app team). */
export const Route = createFileRoute("/equipo")({
  beforeLoad: () => {
    throw redirect({ to: "/talento" });
  },
});
