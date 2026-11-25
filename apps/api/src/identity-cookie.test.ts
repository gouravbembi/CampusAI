import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import express from "express";
import { clearSessionCookie, newToken, setSessionCookie } from "./identity/security.js";

test("production session cookies are host-only and cleared with matching attributes", async (context) => {
  const app = express();
  app.get("/set", (_request, response) => {
    setSessionCookie(response, newToken(), true);
    response.sendStatus(204);
  });
  app.get("/clear", (_request, response) => {
    clearSessionCookie(response, true);
    response.sendStatus(204);
  });
  const server = app.listen(0, "127.0.0.1");
  context.after(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const set = (await fetch(base + "/set")).headers.get("set-cookie") ?? "";
  const clear = (await fetch(base + "/clear")).headers.get("set-cookie") ?? "";
  assert.match(set, /^__Host-campusai=[A-Za-z0-9_-]{43};/);
  assert.match(clear, /^__Host-campusai=;/);
  assert.match(set, /Max-Age=43200/);
  assert.match(clear, /Expires=Thu, 01 Jan 1970/);
  for (const value of [set, clear]) {
    for (const attribute of ["Path=/", "HttpOnly", "Secure", "SameSite=Lax"])
      assert.ok(value.includes(attribute));
    assert.doesNotMatch(value, /;\s*Domain=/i);
  }
});
