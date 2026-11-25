import { createHash, randomBytes } from "node:crypto";
import { Algorithm, hash, verify } from "@node-rs/argon2";
import type { Request, Response } from "express";
import { z } from "zod";
import type { Prisma, PrismaClient, Role } from "../generated/prisma/client.js";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

export const id = z.uuid();
export const emailAddress = z.string().trim().toLowerCase().email().max(254);
export const passwordInput = z.string().min(12).max(128);
export const loginPassword = z.string().min(1).max(128);
export const tokenInput = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const hours = (value: number) => value * 60 * 60 * 1000;
export const sessionAge = hours(12);
export const expires = (delay: number) => new Date(Date.now() + delay);

export function newToken() {
  return randomBytes(32).toString("base64url");
}

export function digest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password: string) {
  return hash(password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export const verifyPassword = verify;
const cookieName = (secure: boolean) => (secure ? "__Host-campusai" : "campusai_session");
const cookieOptions = (secure: boolean) => ({
  httpOnly: true,
  secure,
  sameSite: "lax" as const,
  path: "/",
});

export function setSessionCookie(response: Response, token: string, secure: boolean) {
  response.cookie(cookieName(secure), token, { ...cookieOptions(secure), maxAge: sessionAge });
}

export function clearSessionCookie(response: Response, secure: boolean) {
  response.clearCookie(cookieName(secure), cookieOptions(secure));
}

export async function authenticate(database: PrismaClient, request: Request, secure: boolean) {
  const name = cookieName(secure) + "=";
  const cookies =
    request.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .filter((part) => part.startsWith(name)) ?? [];
  const parsed = tokenInput.safeParse(
    cookies.length === 1 ? cookies[0]?.slice(name.length) : undefined,
  );
  if (!parsed.success) throw new HttpError(401, "authentication_required");

  const session = await database.session.findUnique({
    where: { tokenDigest: digest(parsed.data) },
    include: { user: true },
  });
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.user.status !== "ACTIVE" ||
    session.credentialVersion !== session.user.credentialVersion
  ) {
    throw new HttpError(401, "authentication_required");
  }
  return session;
}

export type Authenticated = Awaited<ReturnType<typeof authenticate>>;

export async function authorize(
  database: PrismaClient,
  session: Authenticated,
  institutionId: string,
  roles: readonly Role[],
) {
  if (!session.user.emailVerifiedAt) throw new HttpError(403, "email_verification_required");
  const membership = await database.membership.findUnique({
    where: { userId_institutionId: { userId: session.userId, institutionId } },
  });
  if (!membership || membership.status !== "ACTIVE" || !roles.includes(membership.role)) {
    throw new HttpError(403, "forbidden");
  }
  return membership;
}

export function audit(
  database: Pick<Prisma.TransactionClient, "auditEvent">,
  action: string,
  actorId?: string,
  institutionId?: string,
  targetId?: string,
) {
  return database.auditEvent.create({ data: { action, actorId, institutionId, targetId } });
}

export async function revokeSessions(database: Prisma.TransactionClient, userId: string) {
  await database.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
