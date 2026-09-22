/**
 * Pure sync / conflict helpers for farm_books optimistic concurrency.
 * Keep side-effect free so node:test can cover the P0 LWW fix without DB.
 */

export type FarmBookLike = {
  exportedAt?: string;
  sessions?: unknown[];
};

export type PullDecision =
  | { kind: "apply-remote" }
  | { kind: "keep-local-push" }
  | { kind: "conflict"; reason: string };

export type SaveClientResult =
  | { kind: "ok"; version: number }
  | { kind: "conflict"; version: number }
  | { kind: "error"; message: string };

export function localHasData(book: FarmBookLike | null | undefined): boolean {
  return Array.isArray(book?.sessions) && book!.sessions!.length > 0;
}

function parseExportedAt(book: FarmBookLike | null | undefined): number {
  const raw = book?.exportedAt;
  if (!raw || typeof raw !== "string") return NaN;
  return Date.parse(raw);
}

/**
 * Initial / pull decision when both localStorage and server may have a book.
 * Never silently discard a local book that looks newer than remote.
 */
export function decidePull(opts: {
  local: FarmBookLike | null | undefined;
  remote: FarmBookLike | null | undefined;
  /** Last version successfully synced on this client; null = unknown / first run. */
  baseVersion: number | null;
  /** True when the local store changed since the last successful sync. */
  localDirty: boolean;
  remoteVersion: number;
}): PullDecision {
  const { local, remote, baseVersion, localDirty, remoteVersion } = opts;
  const hasLocal = localHasData(local);
  const hasRemote = remote != null && typeof remote === "object";

  if (!hasRemote) {
    return hasLocal ? { kind: "keep-local-push" } : { kind: "apply-remote" };
  }

  if (!hasLocal) {
    return { kind: "apply-remote" };
  }

  // Known base: remote moved ahead while we have unsynced edits → conflict.
  if (baseVersion != null && localDirty && remoteVersion !== baseVersion) {
    return {
      kind: "conflict",
      reason: "El servidor tiene una versión distinta y hay cambios locales sin sincronizar.",
    };
  }

  // Known base, remote unchanged: keep local (will push) or apply if clean.
  if (baseVersion != null && remoteVersion === baseVersion) {
    return localDirty ? { kind: "keep-local-push" } : { kind: "apply-remote" };
  }

  // First sync / unknown base: compare exportedAt so a newer local is not wiped.
  const localAt = parseExportedAt(local);
  const remoteAt = parseExportedAt(remote);
  if (Number.isFinite(localAt) && Number.isFinite(remoteAt)) {
    if (localAt > remoteAt) {
      return {
        kind: "conflict",
        reason: "Hay cambios locales más recientes que el libro del servidor.",
      };
    }
    if (localAt < remoteAt) {
      // Remote newer — only safe to apply if we have no dirty flag.
      if (localDirty) {
        return {
          kind: "conflict",
          reason: "El servidor avanzó y también hay cambios locales pendientes.",
        };
      }
      return { kind: "apply-remote" };
    }
    // Same timestamp: prefer remote as canonical if clean, else keep local.
    return localDirty ? { kind: "keep-local-push" } : { kind: "apply-remote" };
  }

  // Missing/invalid timestamps with both sides populated → surface conflict.
  if (localDirty || baseVersion == null) {
    return {
      kind: "conflict",
      reason: "No se pudo comparar versiones del libro; se conservan los cambios locales.",
    };
  }
  return { kind: "apply-remote" };
}

/**
 * Map a saveFarmBook server response into a client-side outcome.
 * On conflict the caller must keep local data and surface status — never import.
 */
export function interpretSaveResult(result: {
  ok: boolean;
  version?: number;
  conflict?: boolean;
  error?: string;
}): SaveClientResult {
  if (result.ok && typeof result.version === "number") {
    return { kind: "ok", version: result.version };
  }
  if (result.conflict && typeof result.version === "number") {
    return { kind: "conflict", version: result.version };
  }
  return {
    kind: "error",
    message: result.error ?? "Error al guardar el libro de finca.",
  };
}
