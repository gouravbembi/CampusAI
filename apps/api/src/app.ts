import cors from "cors";
import express from "express";
import helmet from "helmet";
import { createApi, type ApiOptions } from "./api.js";

interface AppOptions {
  webOrigin: string;
  checkDatabase: () => Promise<void>;
  api?: Omit<ApiOptions, "webOrigin">;
}

export function createApp({ webOrigin, checkDatabase, api }: AppOptions) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => callback(null, origin === webOrigin ? webOrigin : false),
      credentials: true,
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-CampusAI-CSRF"],
    }),
  );

  app.get("/health", (_request, response) => {
    response.set("Cache-Control", "no-store").json({ status: "ok", service: "api" });
  });

  app.get("/ready", async (_request, response) => {
    response.set("Cache-Control", "no-store");
    try {
      await checkDatabase();
      response.json({ status: "ready", service: "api" });
    } catch {
      response.status(503).json({ status: "unavailable", service: "api" });
    }
  });

  if (api) app.use("/api/v1", createApi({ ...api, webOrigin }));

  app.use((_request, response) => {
    response.status(404).json({ error: "not_found" });
  });

  return app;
}
