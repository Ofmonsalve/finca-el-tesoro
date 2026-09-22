import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { FARM_ID } from "./roles";
import { assertFarmAccess } from "./team";

type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

export type FarmBookPayload = {
  v: number;
  exportedAt: string;
  settings: { [key: string]: Json };
  sessions: Json[];
  batches: Json[];
  liquidations: Json[];
  sales: Json[];
  costs: Json[];
  journals: Json[];
  lots?: Json[];
  labores?: Json[];
  nutrition?: Json[];
  cultivos?: Json[];
};

export type LoadFarmBookResult = {
  book: FarmBookPayload | null;
  version: number;
};

export type SaveFarmBookResult =
  | { ok: true; version: number }
  | { ok: false; conflict: true; version: number; book: FarmBookPayload | null }
  | { ok: false; conflict?: false; error: string };

function parseBook(raw: string): FarmBookPayload | null {
  try {
    const p = JSON.parse(raw) as FarmBookPayload;
    if (!p || typeof p !== "object") return null;
    return p;
  } catch {
    return null;
  }
}

function asVersion(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export const loadFarmBook = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<LoadFarmBookResult> => {
    await assertFarmAccess(context.userId, "read");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    let rows = await sql<{ payload: string; version: unknown }>`
      select payload, version from farm_books where user_id = ${FARM_ID} limit 1
    `;
    if (!rows[0]) {
      const mine = await sql<{ payload: string; version: unknown }>`
        select payload, version from farm_books where user_id = ${context.userId} limit 1
      `;
      if (mine[0]) {
        const migratedVersion = asVersion(mine[0].version) || 1;
        await sql`
          insert into farm_books (user_id, payload, updated_at, version)
          values (${FARM_ID}, ${mine[0].payload}, now(), ${migratedVersion})
          on conflict (user_id) do nothing
        `;
        rows = mine;
      }
    }
    const row = rows[0];
    if (!row) return { book: null, version: 0 };
    return { book: parseBook(row.payload), version: asVersion(row.version) || 1 };
  });

export const saveFarmBook = createServerFn({ method: "POST" })
  .validator((input: { data: FarmBookPayload; expectedVersion: number }) => input)
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<SaveFarmBookResult> => {
    await assertFarmAccess(context.userId, "write");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const payload = JSON.stringify(data.data);
    const expectedVersion = asVersion(data.expectedVersion);

    // Insert when absent; on conflict only update if the caller's version matches
    // (Postgres ON CONFLICT DO UPDATE … WHERE → no row returned when stale).
    const updated = await sql<{ version: unknown }>`
      insert into farm_books (user_id, payload, updated_at, version)
      values (${FARM_ID}, ${payload}, now(), 1)
      on conflict (user_id) do update
        set payload = excluded.payload,
            updated_at = now(),
            version = farm_books.version + 1
      where farm_books.version = ${expectedVersion}
      returning version
    `;

    if (updated[0]) {
      return { ok: true, version: asVersion(updated[0].version) || 1 };
    }

    const current = await sql<{ payload: string; version: unknown }>`
      select payload, version from farm_books where user_id = ${FARM_ID} limit 1
    `;
    if (current[0]) {
      return {
        ok: false,
        conflict: true,
        version: asVersion(current[0].version) || 1,
        book: parseBook(current[0].payload),
      };
    }

    // Expected a first write (version 0) but lost a race — treat as conflict/retry signal.
    if (expectedVersion === 0) {
      return { ok: false, error: "No se pudo crear el libro de finca; reintente." };
    }
    return {
      ok: false,
      conflict: true,
      version: 0,
      book: null,
    };
  });
