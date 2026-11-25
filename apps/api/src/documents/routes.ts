import { randomUUID } from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { z } from "zod";
import type { Prisma } from "../generated/prisma/client.js";
import type { IdentityOptions } from "../identity/routes.js";
import { audit, HttpError, id } from "../identity/security.js";
import { scopedAccess } from "../records/scope.js";
import { inspectResume, maxResumeBytes } from "./format.js";
import { purgeDeletedResume, removeOrphan, type Storage } from "./storage.js";

const metadata = {
  id: true,
  filename: true,
  contentType: true,
  size: true,
  status: true,
  createdAt: true,
} satisfies Prisma.ResumeVersionSelect;

export function documentRoutes(options: IdentityOptions, storage: Storage) {
  const { database } = options;
  const router = Router({ mergeParams: true });
  const access = scopedAccess(options);
  const uploads = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "rate_limited" },
  });
  const parse = multer({
    storage: multer.memoryStorage(),
    limits: { files: 1, fileSize: maxResumeBytes, fields: 0, parts: 2 },
  }).single("resume");

  router.use(async (req, res, next) => {
    const { institutionId, actorId, membershipId } = await access(req, ["STUDENT"]);
    const student = await database.studentProfile.findUnique({
      where: { membershipId_institutionId: { membershipId, institutionId } },
      select: { id: true },
    });
    if (!student) throw new HttpError(409, "profile_required");
    res.locals.owner = { institutionId, actorId, studentId: student.id };
    next();
  });

  function owner(locals: Record<string, unknown>) {
    return locals.owner as { institutionId: string; actorId: string; studentId: string };
  }

  router.get("/", async (_req, res) => {
    const { studentId, institutionId } = owner(res.locals);
    res.json(
      await database.resumeVersion.findMany({
        where: { studentId, institutionId, status: { not: "DELETED" } },
        select: metadata,
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  router.post("/", uploads, parse, async (req, res) => {
    const { studentId, institutionId, actorId } = owner(res.locals);
    const details = await inspectResume(req.file);
    const file = req.file!;
    const storageKey = `resume/${randomUUID()}`;
    await database.documentCleanup.create({ data: { storageKey } });
    try {
      await storage.put(storageKey, file.buffer, details.contentType).catch(() => {
        throw new HttpError(503, "storage_unavailable");
      });
      const record = await database.$transaction(
        async (tx) => {
          const student = await tx.studentProfile.findFirst({
            where: {
              id: studentId,
              institutionId,
              membership: {
                role: "STUDENT",
                status: "ACTIVE",
                user: { id: actorId, status: "ACTIVE" },
              },
            },
          });
          if (!student) throw new HttpError(403, "forbidden");
          if (
            (await tx.resumeVersion.count({ where: { studentId, status: { not: "DELETED" } } })) >=
            20
          ) {
            throw new HttpError(409, "resume_limit_reached");
          }
          const resume = await tx.resumeVersion.create({
            data: { ...details, institutionId, studentId, storageKey, size: file.size },
            select: metadata,
          });
          await tx.documentCleanup.delete({ where: { storageKey } });
          await audit(tx, "RESUME_UPLOADED", actorId, institutionId, resume.id);
          return resume;
        },
        { isolationLevel: "Serializable" },
      );
      res.status(201).json(record);
    } catch (error) {
      await removeOrphan(database, storage, storageKey).catch(() =>
        console.error("Document cleanup deferred"),
      );
      throw error;
    }
  });

  router.get("/:resumeId/download", async (req, res) => {
    const { institutionId, studentId, actorId } = owner(res.locals);
    const resumeId = id.parse(req.params.resumeId);
    const resume = await database.resumeVersion.findFirst({
      where: { id: resumeId, institutionId, studentId, status: { not: "DELETED" } },
    });
    if (!resume) throw new HttpError(404, "not_found");
    const body = await storage.get(resume.storageKey).catch(() => {
      throw new HttpError(503, "storage_unavailable");
    });
    if (body.length !== resume.size) throw new HttpError(503, "storage_unavailable");
    await audit(database, "RESUME_DOWNLOADED", actorId, institutionId, resume.id);
    res.attachment(resume.filename).type(resume.contentType).send(body);
  });

  router.patch("/:resumeId", async (req, res) => {
    const { institutionId, studentId, actorId } = owner(res.locals);
    const resumeId = id.parse(req.params.resumeId);
    const { status } = z
      .object({ status: z.enum(["ACTIVE", "ARCHIVED"]) })
      .strict()
      .parse(req.body);
    await database.$transaction(
      async (tx) => {
        const resume = await tx.resumeVersion.findFirst({
          where: { id: resumeId, institutionId, studentId, status: { not: "DELETED" } },
        });
        if (!resume) throw new HttpError(404, "not_found");
        if (resume.status === status) return;
        if (status === "ACTIVE") {
          await tx.resumeVersion.updateMany({
            where: { institutionId, studentId, status: "ACTIVE" },
            data: { status: "ARCHIVED" },
          });
        }
        await tx.resumeVersion.update({ where: { id: resume.id }, data: { status } });
        await audit(
          tx,
          status === "ACTIVE" ? "RESUME_ACTIVATED" : "RESUME_ARCHIVED",
          actorId,
          institutionId,
          resume.id,
        );
      },
      { isolationLevel: "Serializable" },
    );
    res.sendStatus(204);
  });

  router.delete("/:resumeId", async (req, res) => {
    const { institutionId, studentId, actorId } = owner(res.locals);
    const resumeId = id.parse(req.params.resumeId);
    const key = await database.$transaction(
      async (tx) => {
        const resume = await tx.resumeVersion.findFirst({
          where: { id: resumeId, institutionId, studentId },
        });
        if (!resume) throw new HttpError(404, "not_found");
        if (resume.status !== "DELETED") {
          await tx.resumeVersion.update({
            where: { id: resume.id },
            data: { status: "DELETED", deletedAt: new Date() },
          });
          await audit(tx, "RESUME_DELETED", actorId, institutionId, resume.id);
        }
        return resume.objectDeletedAt ? null : resume.storageKey;
      },
      { isolationLevel: "Serializable" },
    );
    if (key) {
      try {
        await purgeDeletedResume(database, storage, key);
      } catch {
        res.sendStatus(202);
        return;
      }
    }
    res.sendStatus(204);
  });
  return router;
}
