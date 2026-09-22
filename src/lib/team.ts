import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  type FarmMember,
  type FarmRole,
  FARM_ID,
  canBootstrapAdmin,
  canManageTeam,
  canRead,
  canWrite,
} from "./roles";

const ROLE_SET = new Set<FarmRole>([
  "admin",
  "operador",
  "consulta",
  "pendiente",
]);

async function membersOf(sql: {
  <T>(s: TemplateStringsArray, ...v: unknown[]): Promise<T[]>;
}): Promise<FarmMember[]> {
  const rows = await sql<{
    user_id: string;
    email: string;
    name: string;
    role: string;
  }>`select user_id, email, name, role from farm_members order by created_at asc`;
  return rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    name: r.name,
    role: (ROLE_SET.has(r.role as FarmRole) ? r.role : "pendiente") as FarmRole,
  }));
}

export const ensureMembership = createServerFn({ method: "POST" })
  .validator((data: { email: string; name: string }) => ({
    email: data.email.trim(),
    name: data.name.trim(),
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    let list = await membersOf(sql);
    const mine = list.find((m) => m.userId === context.userId);
    const bootstrap = canBootstrapAdmin(list);

    if (!mine) {
      // Empty-team / no-admin bootstrap → first member is admin.
      // Otherwise new users join as pendiente until an admin assigns a role.
      const next: FarmRole = bootstrap ? "admin" : "pendiente";
      await sql`
        insert into farm_members (user_id, email, name, role)
        values (${context.userId}, ${data.email}, ${data.name || (bootstrap ? "Administrador" : "Miembro")}, ${next})
        on conflict (user_id) do update
          set email = excluded.email,
              name = excluded.name
      `;
      list = await membersOf(sql);
    } else if (data.email || data.name) {
      // Never auto-promote pendiente → admin here. Role changes go through
      // setMemberRole (admin approval) or claimAdmin (bootstrap only).
      await sql`
        update farm_members
           set email = ${data.email || mine.email},
               name = ${data.name || mine.name}
         where user_id = ${context.userId}
      `;
      list = await membersOf(sql);
    }
    const me = list.find((m) => m.userId === context.userId);
    const role: FarmRole = me?.role ?? "pendiente";
    return {
      role,
      farmId: FARM_ID,
      canBootstrapAdmin: canBootstrapAdmin(list),
      members: canManageTeam(role) ? list : list.filter((m) => m.userId === context.userId),
    };
  });

export const listMembers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const list = await membersOf(sql);
    const me = list.find((m) => m.userId === context.userId);
    if (!me || !canManageTeam(me.role)) {
      return {
        role: (me?.role ?? "pendiente") as FarmRole,
        canBootstrapAdmin: canBootstrapAdmin(list),
        members: me ? [me] : [],
      };
    }
    return {
      role: me.role,
      canBootstrapAdmin: false,
      members: list,
    };
  });

export const setMemberRole = createServerFn({ method: "POST" })
  .validator((data: { userId: string; role: FarmRole }) => {
    if (!ROLE_SET.has(data.role)) throw new Error("Rol inválido.");
    return { userId: data.userId.trim(), role: data.role };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const list = await membersOf(sql);
    const me = list.find((m) => m.userId === context.userId);
    if (!me || !canManageTeam(me.role)) throw new Error("Solo el administrador.");
    const admins = list.filter((m) => m.role === "admin");
    if (
      data.role !== "admin" &&
      admins.length === 1 &&
      admins[0].userId === data.userId
    ) {
      throw new Error("Debe quedar al menos un administrador.");
    }
    await sql`
      update farm_members set role = ${data.role} where user_id = ${data.userId}
    `;
    return { ok: true as const };
  });

/**
 * Bootstrap-only admin claim (P0 / F-18).
 * Succeeds only when the farm has zero admins (empty team or orphaned roster).
 * If an admin already exists, callers must use setMemberRole (invite/approval).
 */
export const claimAdmin = createServerFn({ method: "POST" })
  .validator((data: { email: string; name: string }) => ({
    email: data.email.trim(),
    name: data.name.trim(),
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const list = await membersOf(sql);
    if (!canBootstrapAdmin(list)) {
      throw new Error(
        "Ya hay un administrador. Pida que le asignen un rol en Equipo.",
      );
    }
    await sql`
      insert into farm_members (user_id, email, name, role)
      values (${context.userId}, ${data.email}, ${data.name || "Administrador"}, ${"admin"})
      on conflict (user_id) do update
        set role = ${"admin"},
            email = excluded.email,
            name = excluded.name
    `;
    return { ok: true as const, role: "admin" as const };
  });

export async function assertFarmAccess(
  userId: string,
  min: "read" | "write" | "admin",
): Promise<FarmRole> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const list = await membersOf(sql);
  const me = list.find((m) => m.userId === userId);
  const role = me?.role ?? "pendiente";
  if (min === "read" && !canRead(role)) throw new Error("Sin acceso al libro.");
  if (min === "write" && !canWrite(role)) throw new Error("Solo lectura.");
  if (min === "admin" && !canManageTeam(role)) {
    throw new Error("Solo el administrador.");
  }
  return role;
}
