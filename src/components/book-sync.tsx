import { useEffect, useRef } from "react";
import { useFarmAccess } from "@/components/farm-access";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { useBookSyncStatus } from "@/lib/book-sync-status";
import { loadFarmBook, saveFarmBook, type FarmBookPayload } from "@/lib/farm-book";
import { decidePull, interpretSaveResult } from "@/lib/farm-book-sync";
import { canRead, canWrite } from "@/lib/roles";
import { useFarm } from "@/lib/store";

const CONFLICT_KEEP =
  "Conflicto de sincronización: se conservan tus cambios locales. Recarga o exporta un respaldo antes de sobrescribir.";

/** Pulls the farm book once the member can read; pushes only if they can write. */
export function BookSync() {
  const { user, isPending } = useCurrentUserState();
  const { role, ready } = useFarmAccess();
  const hydrated = useFarm((s) => s.hydrated);
  const setStatus = useBookSyncStatus((s) => s.setStatus);
  const pulling = useRef(false);
  const timer = useRef<number | null>(null);
  /** Last version successfully loaded or saved on this client. */
  const baseVersion = useRef<number | null>(null);
  const localDirty = useRef(false);
  const conflictLock = useRef(false);

  useEffect(() => {
    if (isPending || !user || !hydrated || !ready || !canRead(role)) return;
    let alive = true;
    pulling.current = true;
    setStatus("syncing", "Sincronizando libro…");
    void loadFarmBook()
      .then(async (result) => {
        if (!alive) return;
        const remote = result?.book ?? null;
        const remoteVersion = typeof result?.version === "number" ? result.version : 0;
        const local = useFarm.getState().exportBook() as FarmBookPayload;

        const decision = decidePull({
          local,
          remote,
          baseVersion: baseVersion.current,
          localDirty: localDirty.current,
          remoteVersion,
        });

        if (decision.kind === "apply-remote") {
          if (remote && typeof remote === "object") {
            useFarm.getState().importBook(remote);
          }
          baseVersion.current = remoteVersion;
          localDirty.current = false;
          conflictLock.current = false;
          setStatus("synced", null, remoteVersion);
          return;
        }

        if (decision.kind === "keep-local-push") {
          baseVersion.current = remoteVersion;
          conflictLock.current = false;
          if (canWrite(role)) {
            const saved = await saveFarmBook({
              data: { data: local, expectedVersion: remoteVersion },
            });
            if (!alive) return;
            const outcome = interpretSaveResult(saved);
            if (outcome.kind === "ok") {
              baseVersion.current = outcome.version;
              localDirty.current = false;
              setStatus("synced", null, outcome.version);
              return;
            }
            if (outcome.kind === "conflict") {
              conflictLock.current = true;
              setStatus("conflict", CONFLICT_KEEP, outcome.version);
              return;
            }
            setStatus("error", outcome.message, remoteVersion);
            return;
          }
          setStatus("synced", null, remoteVersion);
          return;
        }

        // conflict — never overwrite local
        conflictLock.current = true;
        setStatus("conflict", decision.reason || CONFLICT_KEEP, remoteVersion);
      })
      .catch(() => {
        if (alive) setStatus("error", "No se pudo leer el libro del servidor.");
      })
      .finally(() => {
        pulling.current = false;
      });
    return () => {
      alive = false;
    };
  }, [user?.id, isPending, hydrated, ready, role, setStatus]);

  useEffect(() => {
    if (isPending || !user || !canWrite(role)) return;
    const unsub = useFarm.subscribe(() => {
      if (pulling.current) return;
      localDirty.current = true;
      if (conflictLock.current) {
        setStatus("conflict", CONFLICT_KEEP, baseVersion.current);
        return;
      }
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const book = useFarm.getState().exportBook() as FarmBookPayload;
        const expected = baseVersion.current ?? 0;
        setStatus("syncing", "Guardando…", expected);
        void saveFarmBook({ data: { data: book, expectedVersion: expected } })
          .then((saved) => {
            const outcome = interpretSaveResult(saved);
            if (outcome.kind === "ok") {
              baseVersion.current = outcome.version;
              localDirty.current = false;
              conflictLock.current = false;
              setStatus("synced", null, outcome.version);
              return;
            }
            if (outcome.kind === "conflict") {
              conflictLock.current = true;
              // Keep local pending changes — do not import remote.
              setStatus("conflict", CONFLICT_KEEP, outcome.version);
              return;
            }
            setStatus("error", outcome.message, expected);
          })
          .catch(() => {
            setStatus("error", "No se pudo guardar el libro en el servidor.", expected);
          });
      }, 900);
    });
    return () => {
      unsub();
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [user?.id, isPending, role, setStatus]);

  return null;
}
