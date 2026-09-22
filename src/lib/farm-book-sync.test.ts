import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decidePull,
  interpretSaveResult,
  localHasData,
} from "./farm-book-sync.ts";

const remote = { exportedAt: "2026-09-22T10:00:00.000Z", sessions: [{ id: "r1" }] };
const localOlder = { exportedAt: "2026-09-22T09:00:00.000Z", sessions: [{ id: "l1" }] };
const localNewer = { exportedAt: "2026-09-22T11:00:00.000Z", sessions: [{ id: "l2" }] };
const localEmpty = { exportedAt: "2026-09-22T11:00:00.000Z", sessions: [] };

describe("localHasData", () => {
  it("detects sessions", () => {
    assert.equal(localHasData(remote), true);
    assert.equal(localHasData(localEmpty), false);
    assert.equal(localHasData(null), false);
  });
});

describe("decidePull", () => {
  it("pushes local when remote is empty", () => {
    assert.deepEqual(
      decidePull({
        local: localNewer,
        remote: null,
        baseVersion: null,
        localDirty: false,
        remoteVersion: 0,
      }),
      { kind: "keep-local-push" },
    );
  });

  it("applies remote when local has no sessions", () => {
    assert.deepEqual(
      decidePull({
        local: localEmpty,
        remote,
        baseVersion: null,
        localDirty: false,
        remoteVersion: 3,
      }),
      { kind: "apply-remote" },
    );
  });

  it("does not wipe a newer local book (conflict)", () => {
    const d = decidePull({
      local: localNewer,
      remote,
      baseVersion: null,
      localDirty: false,
      remoteVersion: 2,
    });
    assert.equal(d.kind, "conflict");
  });

  it("applies newer remote when local is clean", () => {
    assert.deepEqual(
      decidePull({
        local: localOlder,
        remote,
        baseVersion: null,
        localDirty: false,
        remoteVersion: 2,
      }),
      { kind: "apply-remote" },
    );
  });

  it("conflicts when remote advanced and local is dirty", () => {
    const d = decidePull({
      local: localOlder,
      remote,
      baseVersion: 1,
      localDirty: true,
      remoteVersion: 2,
    });
    assert.equal(d.kind, "conflict");
  });

  it("keeps local for push when base matches and dirty", () => {
    assert.deepEqual(
      decidePull({
        local: localNewer,
        remote,
        baseVersion: 4,
        localDirty: true,
        remoteVersion: 4,
      }),
      { kind: "keep-local-push" },
    );
  });

  it("applies remote when base matches and clean", () => {
    assert.deepEqual(
      decidePull({
        local: localNewer,
        remote,
        baseVersion: 4,
        localDirty: false,
        remoteVersion: 4,
      }),
      { kind: "apply-remote" },
    );
  });
});

describe("interpretSaveResult", () => {
  it("maps ok / conflict / error", () => {
    assert.deepEqual(interpretSaveResult({ ok: true, version: 5 }), {
      kind: "ok",
      version: 5,
    });
    assert.deepEqual(
      interpretSaveResult({ ok: false, conflict: true, version: 7 }),
      { kind: "conflict", version: 7 },
    );
    assert.deepEqual(interpretSaveResult({ ok: false, error: "boom" }), {
      kind: "error",
      message: "boom",
    });
  });
});
