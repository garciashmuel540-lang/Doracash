import { test } from "node:test";
import assert from "node:assert/strict";
import { recentChatHistory, type ChatTurn } from "./chat-history.ts";

test("keeps the last three exchanges and starts with the user", () => {
  const turns: ChatTurn[] = Array.from({ length: 10 }, (_, i) => ({
    role: i % 2 ? "model" : "user",
    text: String(i),
  }));
  assert.deepEqual(
    recentChatHistory(turns).map((t) => t.text),
    ["4", "5", "6", "7", "8", "9"],
  );
  assert.equal(recentChatHistory(turns.slice(0, 9))[0].role, "user");
});

test("limits long replies without mutating the conversation", () => {
  const turns: ChatTurn[] = [
    { role: "user", text: "Mi saldo es C$ 500." },
    { role: "model", text: "a".repeat(3000) },
  ];
  const result = recentChatHistory(turns);
  assert.equal(result[0].text, "Mi saldo es C$ 500.");
  assert.equal(result[1].text.length, 2400);
  assert.equal(turns[1].text.length, 3000);
});

test("does not send an assistant greeting without a user exchange", () => {
  assert.deepEqual(recentChatHistory([{ role: "model", text: "Hola" }]), []);
  assert.deepEqual(recentChatHistory([]), []);
});
