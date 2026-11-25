import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";
import { createApp } from "./app.js";

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

const database = new PrismaClient({
  adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 3000 }),
});
const server = createApp({
  webOrigin,
  checkDatabase: async () => {
    await database.$queryRaw`SELECT 1`;
  },
}).listen(port, "0.0.0.0", () => console.info(`CampusAI API listening on port ${port}`));

function shutdown() {
  server.close(() => {
    void database.$disconnect().catch(() => {
      process.exitCode = 1;
    });
  });
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
