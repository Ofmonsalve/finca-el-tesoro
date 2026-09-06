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
  refresh: () => void;
};

const Ctx = createContext<Access | null>(null);

export function FarmAccessProvider({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const [role, setRole] = useState<FarmRole>("pendiente");
  const [members, setMembers] = useState<FarmMember[]>([]);
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setReady(false);
    void ensureMembership({
      data: {
        email: user.primaryEmail ?? "",
        name: user.displayName ?? "",
      },
    })
      .then((r) => {
        if (!alive) return;
        setRole(r.role);
        setMembers(r.members);
      })
      .catch(() => {
        if (!alive) return;
        setRole("pendiente");
        setMembers([]);
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [user?.id, tick]);

  return (
    <Ctx.Provider
      value={{
        role,
        members,
        ready,
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
      refresh: () => {},
    };
  }
  return v;
}

export function useCanRead() {
  return canRead(useFarmAccess().role);
}
