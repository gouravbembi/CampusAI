import cors from "cors";
import express from "express";
import helmet from "helmet";

interface AppOptions {
  webOrigin: string;
  checkDatabase: () => Promise<void>;
}

export function createApp({ webOrigin, checkDatabase }: AppOptions) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: webOrigin }));

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

  app.use((_request, response) => {
    response.status(404).json({ error: "not_found" });
  });

  return app;
}
