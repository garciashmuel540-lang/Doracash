import test from "node:test";
import assert from "node:assert/strict";
import { syncAction } from "./finance-sync.ts";

const empty = { periods: [], goals: [] };
const period = { periods: [{ id: "p" }], goals: [] };
const goal = { periods: [], goals: [{ id: "g" }] };

test("restore records to an empty device even with a stale checkpoint or changed theme", () => {
  for (const base of [null, "local", "remote", "stale"]) {
    for (const saved of [period, goal]) {
      assert.equal(syncAction(empty, saved, "local", "remote", base), "restore");
    }
  }
});

test("an empty cloud snapshot never replaces local records", () => {
  for (const local of [period, goal]) {
    for (const base of [null, "local", "stale"]) {
      assert.equal(syncAction(local, empty, "local", "remote", base), "conflict");
    }
    assert.equal(syncAction(local, empty, "local", "remote", "remote"), "upload");
  }
});

test("preserve ordinary updates, conflicts, and first-time linking", () => {
  assert.equal(syncAction(period, period, "same", "same", null), "synced");
  assert.equal(syncAction(period, period, "old", "new", "old"), "restore");
  assert.equal(syncAction(period, period, "new", "old", "old"), "upload");
  assert.equal(syncAction(period, period, "a", "b", "c"), "conflict");
  assert.equal(syncAction(period, null, "a", null, null), "upload");
  assert.equal(syncAction(empty, null, "a", null, null), "empty");
  assert.equal(syncAction(empty, empty, "a", "b", null), "restore");
});
