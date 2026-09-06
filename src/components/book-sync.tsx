import { useEffect, useRef } from "react";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { loadFarmBook, saveFarmBook } from "@/lib/farm-book";
import { useFarm } from "@/lib/store";

/** Pulls the cloud book once signed in; pushes local changes after a pause. */
export function BookSync() {
  const { user, isPending } = useCurrentUserState();
  const hydrated = useFarm((s) => s.hydrated);
  const pulling = useRef(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (isPending || !user || !hydrated) return;
    let alive = true;
    pulling.current = true;
    void loadFarmBook()
      .then((remote) => {
        if (!alive) return;
        const local = useFarm.getState().exportBook() as import("@/lib/farm-book").FarmBookPayload;
        const localKg = Array.isArray(local.sessions) && local.sessions.length;
        if (remote && typeof remote === "object") {
          useFarm.getState().importBook(remote);
        } else if (localKg) {
          return saveFarmBook({ data: local });
        }
      })
      .catch(() => {
        /* signed out mid-flight or red de la finca */
      })
      .finally(() => {
        pulling.current = false;
      });
    return () => {
      alive = false;
    };
  }, [user?.id, isPending, hydrated]);

  useEffect(() => {
    if (isPending || !user) return;
    const unsub = useFarm.subscribe((state, prev) => {
      if (pulling.current) return;
      if (state.hydrated !== prev.hydrated && state.hydrated) return;
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
  }, [user?.id, isPending]);

  return null;
}
