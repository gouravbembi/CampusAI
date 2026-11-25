import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import type { Mailer } from "./mail.js";
import {
  audit,
  authenticate,
  clearSessionCookie,
  digest,
  emailAddress,
  expires,
  hashPassword,
  hours,
  HttpError,
  id,
  loginPassword,
  newToken,
  passwordInput,
  revokeSessions,
  sessionAge,
  setSessionCookie,
  tokenInput,
  verifyPassword,
} from "./security.js";

export interface IdentityOptions {
  database: PrismaClient;
  webOrigin: string;
  secure: boolean;
  mailer: Mailer;
}

export function authRoutes({ database, webOrigin, secure, mailer }: IdentityOptions) {
  const router = Router();
  const dummyHash = hashPassword(newToken());
  const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 25,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "rate_limited" },
  });
  const mailLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 8,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "rate_limited" },
  });
  const loginBody = z.object({ email: emailAddress, password: loginPassword }).strict();
  const invalidCredentials = () => new HttpError(401, "invalid_credentials");
  const invalidToken = () => new HttpError(400, "invalid_or_expired_token");

  async function openSession(
    transaction: Prisma.TransactionClient,
    userId: string,
    credentialVersion: number,
  ) {
    const raw = newToken();
    await transaction.session.create({
      data: { userId, tokenDigest: digest(raw), credentialVersion, expiresAt: expires(sessionAge) },
    });
    return raw;
  }

  function deliver(to: string, subject: string, path: string, raw: string) {
    void mailer
      .send({ to, subject, text: `${subject}\n\n${webOrigin}${path}#token=${raw}` })
      .catch(() => console.error("Account email delivery failed"));
  }

  router.post("/login", authLimit, async (req, res) => {
    const body = loginBody.parse(req.body);
    const user = await database.user.findUnique({ where: { email: body.email } });
    const valid = await verifyPassword(user?.passwordHash ?? (await dummyHash), body.password);
    if (!user || user.status !== "ACTIVE" || !valid) {
      await audit(database, "LOGIN_FAILED", user?.id);
      throw invalidCredentials();
    }
    const previous = await authenticate(database, req, secure).catch((error: unknown) => {
      if (error instanceof HttpError && error.status === 401) return null;
      throw error;
    });
    const raw = await database.$transaction(async (tx) => {
      const current = await tx.user.findFirst({
        where: { id: user.id, status: "ACTIVE", credentialVersion: user.credentialVersion },
      });
      if (!current) throw invalidCredentials();
      if (previous)
        await tx.session.update({ where: { id: previous.id }, data: { revokedAt: new Date() } });
      const token = await openSession(tx, user.id, user.credentialVersion);
      await audit(tx, "LOGIN", user.id);
      return token;
    });
    setSessionCookie(res, raw, secure);
    res.sendStatus(204);
  });

  router.post("/invitations/accept", authLimit, async (req, res) => {
    const { token, password } = z
      .object({ token: tokenInput, password: loginPassword })
      .strict()
      .parse(req.body);
    const tokenDigest = digest(token);
    const invitation = await database.invitation.findUnique({ where: { tokenDigest } });
    if (
      !invitation ||
      invitation.revokedAt ||
      invitation.acceptedAt ||
      invitation.expiresAt <= new Date()
    )
      throw invalidToken();
    const existing = await database.user.findUnique({ where: { email: invitation.email } });
    const passwordHash = existing ? undefined : await hashPassword(passwordInput.parse(password));
    if (
      existing &&
      (existing.status !== "ACTIVE" || !(await verifyPassword(existing.passwordHash, password)))
    ) {
      throw invalidCredentials();
    }
    await database.$transaction(async (tx) => {
      const now = new Date();
      const claimed = await tx.invitation.updateMany({
        where: { id: invitation.id, revokedAt: null, acceptedAt: null, expiresAt: { gt: now } },
        data: { acceptedAt: now },
      });
      if (!claimed.count) throw invalidToken();
      const user = existing
        ? await tx.user.update({
            where: {
              id: existing.id,
              credentialVersion: existing.credentialVersion,
              status: "ACTIVE",
            },
            data: { emailVerifiedAt: existing.emailVerifiedAt ?? now },
          })
        : await tx.user.create({
            data: { email: invitation.email, passwordHash: passwordHash!, emailVerifiedAt: now },
          });
      const membership = await tx.membership.create({
        data: { userId: user.id, institutionId: invitation.institutionId, role: invitation.role },
      });
      if (invitation.role === "RECRUITER" && invitation.employerId) {
        await tx.recruiterAssignment.create({
          data: {
            membershipId: membership.id,
            employerId: invitation.employerId,
            institutionId: invitation.institutionId,
          },
        });
      }
      await audit(tx, "INVITATION_ACCEPTED", user.id, invitation.institutionId, membership.id);
    });
    res.sendStatus(204);
  });

  router.get("/me", async (req, res) => {
    const session = await authenticate(database, req, secure);
    const memberships = session.user.emailVerifiedAt
      ? await database.membership.findMany({
          where: { userId: session.userId, status: "ACTIVE" },
          select: {
            id: true,
            institutionId: true,
            role: true,
            institution: { select: { name: true, slug: true } },
          },
          orderBy: { createdAt: "asc" },
        })
      : [];
    res.json({
      email: session.user.email,
      emailVerified: Boolean(session.user.emailVerifiedAt),
      memberships,
    });
  });

  router.get("/sessions", async (req, res) => {
    const session = await authenticate(database, req, secure);
    const sessions = await database.session.findMany({
      where: {
        userId: session.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        credentialVersion: session.credentialVersion,
      },
      select: { id: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(sessions.map((entry) => ({ ...entry, current: entry.id === session.id })));
  });

  async function revoke(req: Request, res: Response, logout: boolean) {
    const session = await authenticate(database, req, secure);
    const target = logout ? session.id : id.parse(req.params.sessionId);
    await database.$transaction(async (tx) => {
      const result = await tx.session.updateMany({
        where: { id: target, userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (!result.count) throw new HttpError(404, "not_found");
      await audit(tx, logout ? "LOGOUT" : "SESSION_REVOKED", session.userId, undefined, target);
    });
    if (target === session.id) clearSessionCookie(res, secure);
    res.sendStatus(204);
  }

  router.post("/logout", (req, res) => revoke(req, res, true));
  router.delete("/sessions/:sessionId", (req, res) => revoke(req, res, false));

  router.post("/password/reset/request", mailLimit, async (req, res) => {
    const { email } = z.object({ email: emailAddress }).strict().parse(req.body);
    const user = await database.user.findUnique({ where: { email } });
    if (user?.status === "ACTIVE" && user.emailVerifiedAt) {
      const raw = newToken();
      await database.passwordResetToken.create({
        data: {
          userId: user.id,
          credentialVersion: user.credentialVersion,
          tokenDigest: digest(raw),
          expiresAt: expires(hours(0.5)),
        },
      });
      deliver(user.email, "Reset your CampusAI password", "/reset-password", raw);
    }
    res.sendStatus(202);
  });

  async function replacePassword(
    tx: Prisma.TransactionClient,
    userId: string,
    credentialVersion: number,
    passwordHash: string,
    action: string,
  ) {
    const updated = await tx.user.updateMany({
      where: { id: userId, credentialVersion, status: "ACTIVE" },
      data: { passwordHash, credentialVersion: { increment: 1 } },
    });
    if (!updated.count) throw invalidToken();
    await revokeSessions(tx, userId);
    await audit(tx, action, userId);
  }

  router.post("/password/reset/confirm", authLimit, async (req, res) => {
    const { token, password } = z
      .object({ token: tokenInput, password: passwordInput })
      .strict()
      .parse(req.body);
    const candidate = await database.passwordResetToken.findUnique({
      where: { tokenDigest: digest(token) },
    });
    if (!candidate || candidate.consumedAt || candidate.expiresAt <= new Date())
      throw invalidToken();
    const passwordHash = await hashPassword(password);
    await database.$transaction(async (tx) => {
      const result = await tx.passwordResetToken.updateMany({
        where: { id: candidate.id, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (!result.count) throw invalidToken();
      await replacePassword(
        tx,
        candidate.userId,
        candidate.credentialVersion,
        passwordHash,
        "PASSWORD_RESET",
      );
    });
    clearSessionCookie(res, secure);
    res.sendStatus(204);
  });

  router.post("/password/change", authLimit, async (req, res) => {
    const session = await authenticate(database, req, secure);
    const { currentPassword, password } = z
      .object({ currentPassword: loginPassword, password: passwordInput })
      .strict()
      .parse(req.body);
    if (!(await verifyPassword(session.user.passwordHash, currentPassword)))
      throw invalidCredentials();
    const passwordHash = await hashPassword(password);
    await database.$transaction((tx) =>
      replacePassword(
        tx,
        session.userId,
        session.credentialVersion,
        passwordHash,
        "PASSWORD_CHANGED",
      ),
    );
    clearSessionCookie(res, secure);
    res.sendStatus(204);
  });

  router.post("/email/verification/request", mailLimit, async (req, res) => {
    const session = await authenticate(database, req, secure);
    if (!session.user.emailVerifiedAt) {
      const raw = newToken();
      await database.emailVerificationToken.create({
        data: {
          userId: session.userId,
          credentialVersion: session.credentialVersion,
          tokenDigest: digest(raw),
          expiresAt: expires(hours(1)),
        },
      });
      deliver(session.user.email, "Verify your CampusAI email", "/verify-email", raw);
    }
    res.sendStatus(202);
  });

  router.post("/email/verification/confirm", authLimit, async (req, res) => {
    const { token } = z.object({ token: tokenInput }).strict().parse(req.body);
    await database.$transaction(async (tx) => {
      const candidate = await tx.emailVerificationToken.findUnique({
        where: { tokenDigest: digest(token) },
      });
      if (!candidate) throw invalidToken();
      const result = await tx.emailVerificationToken.updateMany({
        where: { id: candidate.id, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (!result.count) throw invalidToken();
      const updated = await tx.user.updateMany({
        where: {
          id: candidate.userId,
          credentialVersion: candidate.credentialVersion,
          status: "ACTIVE",
          emailVerifiedAt: null,
        },
        data: { emailVerifiedAt: new Date() },
      });
      if (!updated.count) throw invalidToken();
      await audit(tx, "EMAIL_VERIFIED", candidate.userId);
    });
    res.sendStatus(204);
  });

  return router;
}
