import express, { type ErrorRequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { Prisma } from "./generated/prisma/client.js";
import { authRoutes, type IdentityOptions } from "./identity/routes.js";
import { HttpError } from "./identity/security.js";
import { administrationRoutes } from "./records/administration.js";
import { studentRoutes } from "./records/students.js";
import { employerRoutes } from "./records/employers.js";
import { documentRoutes } from "./documents/routes.js";
import type { Storage } from "./documents/storage.js";

export type ApiOptions = IdentityOptions & { storage: Storage };

export function createApi(options: ApiOptions) {
  const router = express.Router();
  router.use((request, response, next) => {
    response.set("Cache-Control", "no-store");
    if (
      request.method !== "GET" &&
      request.method !== "HEAD" &&
      request.method !== "OPTIONS" &&
      (request.get("origin") !== options.webOrigin || request.get("x-campusai-csrf") !== "1")
    ) {
      throw new HttpError(403, "csrf_rejected");
    }
    next();
  });
  router.use(express.json({ limit: "80kb" }));
  router.use("/auth", authRoutes(options));

  const scope = "/institutions/:institutionId";
  router.use(`${scope}/resumes`, documentRoutes(options, options.storage));
  router.use(scope, administrationRoutes(options), studentRoutes(options), employerRoutes(options));

  const errors: ErrorRequestHandler = (error: unknown, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.code });
    } else if (error instanceof ZodError) {
      res.status(400).json({
        error: "invalid_input",
        fields: error.issues.map((issue) => issue.path.join(".")),
      });
    } else if (error instanceof multer.MulterError) {
      res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: "invalid_upload" });
    } else if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2003", "P2034"].includes(error.code)
    ) {
      res.status(409).json({ error: "conflict" });
    } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      res.status(404).json({ error: "not_found" });
    } else if (
      typeof error === "object" &&
      error &&
      "type" in error &&
      error.type === "entity.too.large"
    ) {
      res.status(413).json({ error: "payload_too_large" });
    } else if (
      typeof error === "object" &&
      error &&
      "type" in error &&
      error.type === "entity.parse.failed"
    ) {
      res.status(400).json({ error: "invalid_input" });
    } else {
      console.error("API request failed");
      res.status(500).json({ error: "internal_error" });
    }
  };
  router.use(errors);
  return router;
}
