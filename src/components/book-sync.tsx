import { useEffect, useRef } from "react";
import { useFarmAccess } from "@/components/farm-access";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { loadFarmBook, saveFarmBook } from "@/lib/farm-book";
import { canRead, canWrite } from "@/lib/roles";
import { useFarm } from "@/lib/store";

/** Pulls the farm book once the member can read; pushes only if they can write. */
export function BookSync() {
  const { user, isPending } = useCurrentUserState();
  const { role, ready } = useFarmAccess();
  const hydrated = useFarm((s) => s.hydrated);
  const pulling = useRef(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (isPending || !user || !hydrated || !ready || !canRead(role)) return;
    let alive = true;
    pulling.current = true;
    void loadFarmBook()
      .then((remote) => {
        if (!alive) return;
        const local = useFarm.getState().exportBook() as import("@/lib/farm-book").FarmBookPayload;
        const localKg = Array.isArray(local.sessions) && local.sessions.length;
        if (remote && typeof remote === "object") {
          useFarm.getState().importBook(remote);
        } else if (localKg && canWrite(role)) {
          return saveFarmBook({ data: local });
        }
      })
      .catch(() => {})
      .finally(() => {
        pulling.current = false;
      });
    return () => {
      alive = false;
    };
  }, [user?.id, isPending, hydrated, ready, role]);

  useEffect(() => {
    if (isPending || !user || !canWrite(role)) return;
    const unsub = useFarm.subscribe(() => {
      if (pulling.current) return;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const book = useFarm.getState().exportBook() as import("@/lib/farm-book").FarmBookPayload;
        void saveFarmBook({ data: book }).catch(() => {});
      }, 900);
    });
    return () => {
      unsub();
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [user?.id, isPending, role]);

  return null;
}
