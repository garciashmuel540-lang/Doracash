import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { requestGemini } from "./gemini-request.server.ts";

test("recovers from a temporary 503 and preserves the request deadline", async () => {
  const signal = AbortSignal.timeout(2000);
  const responses = [new Response("", { status: 503 }), Response.json({ ok: true })];
  const fetchMock = mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    assert.equal(init.signal, signal);
    return responses.shift()!;
  });
  try {
    const result = await requestGemini("https://example.test", { signal });
    assert.equal(result.status, 200);
    assert.equal(fetchMock.mock.callCount(), 2);
  } finally {
    fetchMock.mock.restore();
  }
});

test("does not retry invalid credentials, quota responses, or successful requests", async () => {
  for (const status of [200, 400, 401, 403, 429]) {
    const fetchMock = mock.method(globalThis, "fetch", async () => new Response("", { status }));
    try {
      assert.equal((await requestGemini("https://example.test", {})).status, status);
      assert.equal(fetchMock.mock.callCount(), 1);
    } finally {
      fetchMock.mock.restore();
    }
  }
});

test("an outage is retried at most once", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => new Response("", { status: 503 }));
  try {
    assert.equal((await requestGemini("https://example.test", {})).status, 503);
    assert.equal(fetchMock.mock.callCount(), 2);
  } finally {
    fetchMock.mock.restore();
  }
});

test("does not send a second request after cancellation", async () => {
  const abort = new AbortController();
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    abort.abort();
    return new Response("", { status: 503 });
  });
  try {
    await assert.rejects(requestGemini("https://example.test", { signal: abort.signal }), {
      name: "AbortError",
    });
    assert.equal(fetchMock.mock.callCount(), 1);
  } finally {
    fetchMock.mock.restore();
  }
});
