import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { createApp } from "./app.js";

test("serves liveness and reports database readiness without leaking errors", async (context) => {
  let databaseAvailable = false;
  let calls = 0;
  const server = createApp({
    webOrigin: "http://localhost:5173",
    checkDatabase: async () => {
      calls += 1;
      if (!databaseAvailable) throw new Error("private database connection details");
    },
  }).listen(0, "127.0.0.1");
  context.after(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("cache-control"), "no-store");
  assert.deepEqual(await health.json(), { status: "ok", service: "api" });
  assert.equal(calls, 0);

  const unavailable = await fetch(`${base}/ready`);
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), { status: "unavailable", service: "api" });

  databaseAvailable = true;
  const ready = await fetch(`${base}/ready`);
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { status: "ready", service: "api" });
  assert.equal(calls, 2);
});

test("returns a JSON 404 for unknown routes", async (context) => {
  const server = createApp({
    webOrigin: "http://localhost:5173",
    checkDatabase: async () => {},
  }).listen(0, "127.0.0.1");
  context.after(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  await once(server, "listening");
  const result = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/missing`);
  assert.equal(result.status, 404);
  assert.deepEqual(await result.json(), { error: "not_found" });
});
