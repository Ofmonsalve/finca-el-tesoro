import type { ReactNode } from "react";
import { useFarmAccess } from "@/components/farm-access";
import { canWrite } from "@/lib/roles";

export function WriteGate({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { role, ready } = useFarmAccess();
  if (!ready) return null;
  if (canWrite(role)) return <>{children}</>;
  return (
    <>
      {fallback ?? (
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted">
          Solo lectura. El administrador o un operador registran en campo.
        </p>
      )}
    </>
  );
}
