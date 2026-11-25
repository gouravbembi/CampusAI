import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";
import { createApp } from "./app.js";
import { createMailer } from "./identity/mail.js";
import { createStorage } from "./documents/storage.js";

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
const origin = new URL(webOrigin);
if (!["http:", "https:"].includes(origin.protocol) || origin.origin !== webOrigin) {
  throw new Error("WEB_ORIGIN must be an HTTP(S) origin without a path or trailing slash");
}

const secure = process.env.NODE_ENV === "production";
if (secure && origin.protocol !== "https:") throw new Error("Production WEB_ORIGIN requires HTTPS");
const database = new PrismaClient({
  adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 3000 }),
});
const server = createApp({
  webOrigin,
  api: { database, secure, mailer: createMailer(process.env), storage: createStorage(process.env) },
  checkDatabase: async () => {
    await database.$queryRaw`SELECT 1`;
  },
}).listen(port, "0.0.0.0");
server.once("listening", () => console.info(`CampusAI API listening on port ${port}`));
server.once("error", () => {
  console.error("CampusAI API could not listen on the configured port");
  process.exitCode = 1;
});

function shutdown() {
  server.close(() => {
    void database.$disconnect().catch(() => {
      process.exitCode = 1;
    });
  });
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
