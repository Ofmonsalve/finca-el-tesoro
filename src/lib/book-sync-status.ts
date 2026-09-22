import { create } from "zustand";

export type BookSyncStatusKind = "idle" | "syncing" | "synced" | "conflict" | "error";

export type BookSyncStatusState = {
  status: BookSyncStatusKind;
  detail: string | null;
  version: number | null;
  setStatus: (
    status: BookSyncStatusKind,
    detail?: string | null,
    version?: number | null,
  ) => void;
};

/** UI-facing sync status for farm book optimistic concurrency. */
export const useBookSyncStatus = create<BookSyncStatusState>((set) => ({
  status: "idle",
  detail: null,
  version: null,
  setStatus: (status, detail = null, version) =>
    set((s) => ({
      status,
      detail,
      version: version === undefined ? s.version : version,
    })),
}));
