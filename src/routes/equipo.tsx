import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ClaimAdminButton } from "@/components/claim-admin";
import { useFarmAccess } from "@/components/farm-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHint, CardTitle } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import {
  ROLES,
  canManageTeam,
  roleLabel,
  type FarmRole,
} from "@/lib/roles";
import { setMemberRole } from "@/lib/team";

export const Route = createFileRoute("/equipo")({ component: Page });

function Page() {
  const { role, members, refresh } = useFarmAccess();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function setRole(userId: string, next: FarmRole) {
    setErr(null);
    setBusy(userId);
    try {
      await setMemberRole({ data: { userId, role: next } });
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo cambiar el rol.");
    } finally {
      setBusy(null);
    }
  }

  if (!canManageTeam(role)) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
          Gobierno
        </p>
        <h1 className="font-display text-4xl tracking-tight">Equipo</h1>
        <p className="text-sm text-muted">
          Esta es su finca. Asuma la administración para registrar y asignar
          roles.
        </p>
        <ClaimAdminButton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent">
          Gobierno
        </p>
        <h1 className="font-display text-4xl tracking-tight">Equipo</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Usted es el administrador. Asigne operador o consulta a quien
          invite. No se pide autorización para el dueño.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        {ROLES.filter((r) => r.id !== "pendiente").map((r) => (
          <Card key={r.id}>
            <CardTitle>{r.label}</CardTitle>
            <CardHint>{r.hint}</CardHint>
          </Card>
        ))}
      </div>

      {err ? <p className="text-sm text-danger">{err}</p> : null}

      <Card>
        <CardTitle>Miembros</CardTitle>
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Persona</Th>
                <Th>Correo</Th>
                <Th>Rol</Th>
                <Th>Asignar</Th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.userId}>
                  <Td>{m.name || "—"}</Td>
                  <Td className="text-muted">{m.email || "—"}</Td>
                  <Td>
                    <Badge
                      tone={
                        m.role === "admin"
                          ? "ok"
                          : m.role === "pendiente"
                            ? "warn"
                            : "muted"
                      }
                    >
                      {roleLabel(m.role)}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {ROLES.filter((r) => r.id !== "pendiente").map((r) => (
                        <Button
                          key={r.id}
                          size="sm"
                          variant={m.role === r.id ? "accent" : "outline"}
                          disabled={busy === m.userId}
                          onClick={() => setRole(m.userId, r.id)}
                        >
                          {r.label}
                        </Button>
                      ))}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
