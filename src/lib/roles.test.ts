import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canBootstrapAdmin,
  canExport,
  canManageTeam,
  canRead,
  canRestore,
  canWrite,
  type FarmRole,
} from "./roles.ts";

const ALL: FarmRole[] = ["admin", "operador", "consulta", "pendiente"];

describe("canWrite", () => {
  it("allows admin and operador only", () => {
    assert.equal(canWrite("admin"), true);
    assert.equal(canWrite("operador"), true);
    assert.equal(canWrite("consulta"), false);
    assert.equal(canWrite("pendiente"), false);
  });
});

describe("canRead", () => {
  it("allows every known role including pendiente", () => {
    for (const role of ALL) assert.equal(canRead(role), true);
  });
});

describe("canManageTeam / canRestore", () => {
  it("are admin-only", () => {
    for (const role of ALL) {
      assert.equal(canManageTeam(role), role === "admin");
      assert.equal(canRestore(role), role === "admin");
    }
  });
});

describe("canExport", () => {
  it("allows admin and operador", () => {
    assert.equal(canExport("admin"), true);
    assert.equal(canExport("operador"), true);
    assert.equal(canExport("consulta"), false);
    assert.equal(canExport("pendiente"), false);
  });
});

describe("canBootstrapAdmin", () => {
  it("is true when the roster is empty", () => {
    assert.equal(canBootstrapAdmin([]), true);
  });

  it("is true when members exist but none is admin (orphan)", () => {
    assert.equal(
      canBootstrapAdmin([
        { role: "pendiente" },
        { role: "operador" },
        { role: "consulta" },
      ]),
      true,
    );
  });

  it("is false as soon as any admin exists", () => {
    assert.equal(canBootstrapAdmin([{ role: "admin" }]), false);
    assert.equal(
      canBootstrapAdmin([{ role: "pendiente" }, { role: "admin" }]),
      false,
    );
  });
});
