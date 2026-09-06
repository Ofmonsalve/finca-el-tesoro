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
};

function parseBook(raw: string): FarmBookPayload | null {
  try {
    const p = JSON.parse(raw) as FarmBookPayload;
    if (!p || typeof p !== "object") return null;
    return p;
  } catch {
    return null;
  }
}

export const loadFarmBook = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await assertFarmAccess(context.userId, "read");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    let rows = await sql<{ payload: string }>`
      select payload from farm_books where user_id = ${FARM_ID} limit 1
    `;
    if (!rows[0]) {
      const mine = await sql<{ payload: string }>`
        select payload from farm_books where user_id = ${context.userId} limit 1
      `;
      if (mine[0]) {
        await sql`
          insert into farm_books (user_id, payload, updated_at)
          values (${FARM_ID}, ${mine[0].payload}, now())
          on conflict (user_id) do nothing
        `;
        rows = mine;
      }
    }
    const raw = rows[0]?.payload;
    return raw ? parseBook(raw) : null;
  });

export const saveFarmBook = createServerFn({ method: "POST" })
  .validator((data: FarmBookPayload) => data)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    await assertFarmAccess(context.userId, "write");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const payload = JSON.stringify(data);
    await sql`
      insert into farm_books (user_id, payload, updated_at)
      values (${FARM_ID}, ${payload}, now())
      on conflict (user_id) do update
        set payload = excluded.payload,
            updated_at = now()
    `;
    return { ok: true as const };
  });
