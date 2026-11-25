import { Router } from "express";
import { z } from "zod";
import type { IdentityOptions } from "../identity/routes.js";
import {
  audit,
  digest,
  emailAddress,
  expires,
  hours,
  HttpError,
  id,
  newToken,
  revokeSessions,
} from "../identity/security.js";
import { scopedAccess } from "./scope.js";

const subordinateRoles = z.enum(["STUDENT", "RECRUITER", "PLACEMENT_OFFICER"]);
const statuses = z.enum(["ACTIVE", "REVOKED"]);

export function administrationRoutes(options: IdentityOptions) {
  const { database, mailer, webOrigin } = options;
  const router = Router({ mergeParams: true });
  const access = scopedAccess(options);

  router.get("/", async (req, res) => {
    const { institutionId } = await access(req, [
      "ADMINISTRATOR",
      "PLACEMENT_OFFICER",
      "STUDENT",
      "RECRUITER",
    ]);
    res.json(await database.institution.findUniqueOrThrow({ where: { id: institutionId } }));
  });

  router.patch("/", async (req, res) => {
    const { institutionId, actorId } = await access(req, ["ADMINISTRATOR"]);
    const { name } = z
      .object({ name: z.string().trim().min(2).max(120) })
      .strict()
      .parse(req.body);
    const institution = await database.$transaction(async (tx) => {
      const result = await tx.institution.update({ where: { id: institutionId }, data: { name } });
      await audit(tx, "INSTITUTION_UPDATED", actorId, institutionId, institutionId);
      return result;
    });
    res.json(institution);
  });

  router.get("/memberships", async (req, res) => {
    const { institutionId } = await access(req, ["ADMINISTRATOR"]);
    const after = id.optional().parse(req.query.after);
    const members = await database.membership.findMany({
      where: { institutionId, ...(after ? { id: { gt: after } } : {}) },
      select: {
        id: true,
        role: true,
        status: true,
        user: { select: { email: true, status: true } },
      },
      orderBy: { id: "asc" },
      take: 51,
    });
    const items = members.slice(0, 50);
    res.json({ items, next: members.length > 50 ? items.at(-1)?.id : null });
  });

  router.post("/invitations", async (req, res) => {
    const { institutionId, actorId, role } = await access(req, [
      "ADMINISTRATOR",
      "PLACEMENT_OFFICER",
    ]);
    const body = z
      .object({ email: emailAddress, role: subordinateRoles, employerId: id.optional() })
      .strict()
      .parse(req.body);
    if (role === "PLACEMENT_OFFICER" && body.role !== "STUDENT")
      throw new HttpError(403, "forbidden");
    if (body.employerId && body.role !== "RECRUITER")
      throw new HttpError(400, "invalid_employer_assignment");
    const raw = newToken();
    const invitation = await database.$transaction(
      async (tx) => {
        const now = new Date();
        if (
          await tx.membership.findFirst({ where: { institutionId, user: { email: body.email } } })
        ) {
          throw new HttpError(409, "membership_exists");
        }
        if (
          body.employerId &&
          !(await tx.employer.findFirst({
            where: { id: body.employerId, institutionId, status: "VERIFIED" },
          }))
        ) {
          throw new HttpError(404, "not_found");
        }
        await tx.invitation.updateMany({
          where: {
            institutionId,
            email: body.email,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { lte: now },
          },
          data: { revokedAt: now },
        });
        const created = await tx.invitation.create({
          data: { ...body, institutionId, tokenDigest: digest(raw), expiresAt: expires(hours(48)) },
          select: { id: true, expiresAt: true },
        });
        await audit(tx, "MEMBERSHIP_INVITED", actorId, institutionId, created.id);
        return created;
      },
      { isolationLevel: "Serializable" },
    );
    try {
      await mailer.send({
        to: body.email,
        subject: "Your CampusAI invitation",
        text: `Accept your CampusAI invitation\n\n${webOrigin}/accept-invitation#token=${raw}`,
      });
    } catch {
      await database.$transaction(async (tx) => {
        await tx.invitation.updateMany({
          where: { id: invitation.id, acceptedAt: null },
          data: { revokedAt: new Date() },
        });
        await audit(tx, "INVITATION_DELIVERY_FAILED", actorId, institutionId, invitation.id);
      });
      throw new HttpError(503, "email_unavailable");
    }
    res.status(201).json(invitation);
  });

  router.get("/invitations", async (req, res) => {
    const { institutionId, role } = await access(req, ["ADMINISTRATOR", "PLACEMENT_OFFICER"]);
    res.json(
      await database.invitation.findMany({
        where: {
          institutionId,
          ...(role === "PLACEMENT_OFFICER" ? { role: "STUDENT" } : {}),
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: { id: true, email: true, role: true, expiresAt: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    );
  });

  router.delete("/invitations/:invitationId", async (req, res) => {
    const { institutionId, actorId, role } = await access(req, [
      "ADMINISTRATOR",
      "PLACEMENT_OFFICER",
    ]);
    const invitationId = id.parse(req.params.invitationId);
    await database.$transaction(async (tx) => {
      const result = await tx.invitation.updateMany({
        where: {
          id: invitationId,
          institutionId,
          ...(role === "PLACEMENT_OFFICER" ? { role: "STUDENT" } : {}),
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      if (!result.count) throw new HttpError(404, "not_found");
      await audit(tx, "INVITATION_REVOKED", actorId, institutionId, invitationId);
    });
    res.sendStatus(204);
  });

  router.patch("/memberships/:membershipId", async (req, res) => {
    const { institutionId, actorId } = await access(req, ["ADMINISTRATOR"]);
    const target = id.parse(req.params.membershipId);
    const changes = z
      .object({
        role: subordinateRoles.optional(),
        status: statuses.optional(),
        accountStatus: statuses.optional(),
      })
      .strict()
      .refine((body) => Boolean(body.role || body.status || body.accountStatus))
      .parse(req.body);

    await database.$transaction(
      async (tx) => {
        const member = await tx.membership.findFirst({ where: { id: target, institutionId } });
        if (!member) throw new HttpError(404, "not_found");
        if (member.role === "ADMINISTRATOR" || member.userId === actorId)
          throw new HttpError(403, "forbidden");
        if (changes.accountStatus) {
          if ((await tx.membership.count({ where: { userId: member.userId } })) !== 1) {
            throw new HttpError(409, "account_has_multiple_institutions");
          }
          await tx.user.update({
            where: { id: member.userId },
            data: { status: changes.accountStatus, credentialVersion: { increment: 1 } },
          });
          await audit(
            tx,
            changes.accountStatus === "REVOKED" ? "ACCOUNT_SUSPENDED" : "ACCOUNT_ACTIVATED",
            actorId,
            institutionId,
            member.userId,
          );
        }
        const roleChanged = changes.role && changes.role !== member.role;
        const statusChanged = changes.status && changes.status !== member.status;
        if (roleChanged || statusChanged) {
          await tx.membership.update({
            where: { id: member.id },
            data: { role: changes.role, status: changes.status },
          });
          if (roleChanged || changes.status === "REVOKED") {
            await tx.recruiterAssignment.updateMany({
              where: { membershipId: member.id },
              data: { status: "REVOKED" },
            });
          }
          if (roleChanged)
            await audit(tx, "MEMBERSHIP_ROLE_CHANGED", actorId, institutionId, member.id);
          if (statusChanged)
            await audit(
              tx,
              changes.status === "REVOKED" ? "MEMBERSHIP_REVOKED" : "MEMBERSHIP_ACTIVATED",
              actorId,
              institutionId,
              member.id,
            );
        }
        if (roleChanged || statusChanged || changes.accountStatus)
          await revokeSessions(tx, member.userId);
      },
      { isolationLevel: "Serializable" },
    );
    res.sendStatus(204);
  });

  router.get("/audit", async (req, res) => {
    const { institutionId } = await access(req, ["ADMINISTRATOR"]);
    res.json(
      await database.auditEvent.findMany({
        where: { institutionId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    );
  });

  return router;
}
