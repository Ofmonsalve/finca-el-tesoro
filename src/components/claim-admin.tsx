import { useState } from "react";
import { useFarmAccess } from "@/components/farm-access";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { canManageTeam } from "@/lib/roles";
import { claimAdmin } from "@/lib/team";

export function ClaimAdminButton({ className }: { className?: string }) {
  const user = useCurrentUser();
  const { role, ready, refresh } = useFarmAccess();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!ready || canManageTeam(role)) return null;

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
      setErr(e instanceof Error ? e.message : "No se pudo asumir.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <Button onClick={() => void claim()} disabled={busy} className="w-full">
        {busy ? "Un momento…" : "Soy el administrador"}
      </Button>
      {err ? <p className="mt-2 text-xs text-danger">{err}</p> : null}
    </div>
  );
}
