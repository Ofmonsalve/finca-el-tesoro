import { useState } from "react";
import { useFarmAccess } from "@/components/farm-access";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { canManageTeam } from "@/lib/roles";
import { claimAdmin } from "@/lib/team";

/**
 * Shows bootstrap UI only when the server says no admin exists.
 * Does not offer free self-promotion once an admin is in place.
 */
export function ClaimAdminButton({ className }: { className?: string }) {
  const user = useCurrentUser();
  const { role, ready, refresh, canBootstrapAdmin: bootstrapOk } = useFarmAccess();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!ready || canManageTeam(role)) return null;

  if (!bootstrapOk) {
    return (
      <div className={className}>
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
          Su cuenta está pendiente de aprobación. Un administrador debe
          asignarle un rol en Equipo; no puede reclamarse el acceso solo.
        </p>
      </div>
    );
  }

  async function claim() {
    setErr(null);
    setBusy(true);
    try {
      await claimAdmin({
        data: {
          email: user?.primaryEmail ?? "",
          name: user?.displayName ?? "",
        },
      });
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo registrar el administrador.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <p className="mb-2 text-sm text-muted">
        No hay administrador en esta finca. Solo el primer miembro puede
        registrarse como tal (arranque del equipo).
      </p>
      <Button onClick={() => void claim()} disabled={busy} className="w-full">
        {busy ? "Un momento…" : "Registrar como primer administrador"}
      </Button>
      {err ? <p className="mt-2 text-xs text-danger">{err}</p> : null}
    </div>
  );
}
