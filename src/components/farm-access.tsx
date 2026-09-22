import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import {
  type FarmMember,
  type FarmRole,
  canRead,
} from "@/lib/roles";
import { ensureMembership } from "@/lib/team";

type Access = {
  role: FarmRole;
  members: FarmMember[];
  ready: boolean;
  /** Server-side: true only when no admin exists (empty/orphan bootstrap). */
  canBootstrapAdmin: boolean;
  refresh: () => void;
};

const Ctx = createContext<Access | null>(null);

export function FarmAccessProvider({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const [role, setRole] = useState<FarmRole>("pendiente");
  const [members, setMembers] = useState<FarmMember[]>([]);
  const [canBootstrap, setCanBootstrap] = useState(false);
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setReady(false);
    // Fail-safe must NOT grant admin (P0). Stay pendiente until server answers.
    const failSafe = window.setTimeout(() => {
      if (!alive) return;
      setRole("pendiente");
      setCanBootstrap(false);
      setReady(true);
    }, 4000);
    void ensureMembership({
      data: {
        email: user.primaryEmail ?? "",
        name: user.displayName ?? "",
      },
    })
      .then((r) => {
        if (!alive) return;
        window.clearTimeout(failSafe);
        setRole(r.role);
        setMembers(r.members);
        setCanBootstrap(Boolean(r.canBootstrapAdmin));
        setReady(true);
      })
      .catch(() => {
        if (!alive) return;
        window.clearTimeout(failSafe);
        setRole("pendiente");
        setMembers([]);
        setCanBootstrap(false);
        setReady(true);
      });
    return () => {
      alive = false;
      window.clearTimeout(failSafe);
    };
  }, [user?.id, tick]);

  return (
    <Ctx.Provider
      value={{
        role,
        members,
        ready,
        canBootstrapAdmin: canBootstrap,
        refresh: () => setTick((n) => n + 1),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useFarmAccess(): Access {
  const v = useContext(Ctx);
  if (!v) {
    return {
      role: "pendiente",
      members: [],
      ready: false,
      canBootstrapAdmin: false,
      refresh: () => {},
    };
  }
  return v;
}

export function useCanRead() {
  return canRead(useFarmAccess().role);
}
