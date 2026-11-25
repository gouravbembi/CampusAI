import { Router } from "express";
import { z } from "zod";
import type { IdentityOptions } from "../identity/routes.js";
import { audit, HttpError, id } from "../identity/security.js";
import { scopedAccess } from "./scope.js";

const fullName = z.string().trim().min(2).max(120);
const profile = z.object({ fullName, title: fullName }).strict();
const employer = z
  .object({
    name: fullName,
    website: z
      .url({ protocol: /^https?$/ })
      .max(250)
      .nullable(),
  })
  .strict();

export function employerRoutes(options: IdentityOptions) {
  const { database } = options;
  const router = Router({ mergeParams: true });
  const access = scopedAccess(options);

  router.get("/recruiters/me", async (req, res) => {
    const { membershipId, institutionId } = await access(req, ["RECRUITER"]);
    const [profile, assignments] = await Promise.all([
      database.recruiterProfile.findUnique({ where: { membershipId } }),
      database.recruiterAssignment.findMany({
        where: { membershipId, institutionId, status: "ACTIVE" },
        include: { employer: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    res.json({
      profile,
      assignments: assignments.map((entry) => ({
        employer: entry.employer,
        eligible: entry.employer.status === "VERIFIED",
      })),
    });
  });

  router.put("/recruiters/me", async (req, res) => {
    const { membershipId, institutionId, actorId } = await access(req, ["RECRUITER"]);
    const fields = profile.parse(req.body);
    await database.$transaction(async (tx) => {
      await tx.recruiterProfile.upsert({
        where: { membershipId },
        create: { membershipId, ...fields },
        update: fields,
      });
      await audit(tx, "RECRUITER_PROFILE_UPDATED", actorId, institutionId, membershipId);
    });
    res.sendStatus(204);
  });

  router.post("/employers", async (req, res) => {
    const { membershipId, institutionId, actorId } = await access(req, ["RECRUITER"]);
    const fields = employer.parse(req.body);
    const created = await database.$transaction(async (tx) => {
      if (!(await tx.recruiterProfile.findUnique({ where: { membershipId } })))
        throw new HttpError(409, "profile_required");
      const organization = await tx.employer.create({ data: { ...fields, institutionId } });
      await tx.recruiterAssignment.create({
        data: { institutionId, membershipId, employerId: organization.id },
      });
      await audit(tx, "EMPLOYER_SUBMITTED", actorId, institutionId, organization.id);
      return organization;
    });
    res.status(201).json(created);
  });

  router.get("/employers/:employerId", async (req, res) => {
    const { membershipId, institutionId } = await access(req, ["RECRUITER"]);
    const employerId = id.parse(req.params.employerId);
    const assignment = await database.recruiterAssignment.findFirst({
      where: {
        membershipId,
        institutionId,
        employerId,
        status: "ACTIVE",
        employer: { status: "VERIFIED" },
      },
      select: { employer: true },
    });
    if (!assignment) throw new HttpError(404, "not_found");
    res.json(assignment.employer);
  });

  router.get("/employers", async (req, res) => {
    const { institutionId } = await access(req, ["PLACEMENT_OFFICER", "ADMINISTRATOR"]);
    const status = z.enum(["PENDING", "VERIFIED", "REJECTED"]).optional().parse(req.query.status);
    const after = id.optional().parse(req.query.after);
    const employers = await database.employer.findMany({
      where: { institutionId, status, ...(after ? { id: { gt: after } } : {}) },
      orderBy: { id: "asc" },
      take: 51,
    });
    const items = employers.slice(0, 50);
    res.json({ items, next: employers.length > 50 ? items.at(-1)?.id : null });
  });

  router.post("/employers/:employerId/review", async (req, res) => {
    const { institutionId, actorId } = await access(req, ["PLACEMENT_OFFICER"]);
    const employerId = id.parse(req.params.employerId);
    const { status, revision } = z
      .object({ status: z.enum(["VERIFIED", "REJECTED"]), revision: z.number().int().positive() })
      .strict()
      .parse(req.body);
    await database.$transaction(async (tx) => {
      const result = await tx.employer.updateMany({
        where: { id: employerId, institutionId, revision, status: "PENDING" },
        data: { status, reviewedAt: new Date() },
      });
      if (!result.count) throw new HttpError(409, "record_unavailable_or_changed");
      await audit(
        tx,
        status === "VERIFIED" ? "EMPLOYER_APPROVED" : "EMPLOYER_REJECTED",
        actorId,
        institutionId,
        employerId,
      );
    });
    res.sendStatus(204);
  });

  router.put("/employers/:employerId/assignments/:membershipId", async (req, res) => {
    const { institutionId, actorId } = await access(req, ["ADMINISTRATOR"]);
    const employerId = id.parse(req.params.employerId);
    const membershipId = id.parse(req.params.membershipId);
    const { status } = z
      .object({ status: z.enum(["ACTIVE", "REVOKED"]) })
      .strict()
      .parse(req.body);
    await database.$transaction(
      async (tx) => {
        const organization = await tx.employer.findFirst({
          where: { id: employerId, institutionId, status: "VERIFIED" },
        });
        const member = await tx.membership.findFirst({
          where: {
            id: membershipId,
            institutionId,
            role: "RECRUITER",
            status: "ACTIVE",
            user: { status: "ACTIVE" },
          },
        });
        if (!organization || !member) throw new HttpError(404, "not_found");
        await tx.recruiterAssignment.upsert({
          where: { membershipId_employerId: { membershipId, employerId } },
          create: { membershipId, employerId, institutionId, status },
          update: { status },
        });
        await audit(
          tx,
          status === "ACTIVE" ? "RECRUITER_ASSIGNED" : "RECRUITER_ASSIGNMENT_REVOKED",
          actorId,
          institutionId,
          membershipId,
        );
      },
      { isolationLevel: "Serializable" },
    );
    res.sendStatus(204);
  });

  return router;
}
