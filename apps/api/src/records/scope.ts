import type { Request } from "express";
import type { Role } from "../generated/prisma/client.js";
import type { IdentityOptions } from "../identity/routes.js";
import { authenticate, authorize, id } from "../identity/security.js";

export function scopedAccess({ database, secure }: IdentityOptions) {
  return async (req: Request, roles: readonly Role[]) => {
    const institutionId = id.parse(req.params.institutionId);
    const session = await authenticate(database, req, secure);
    const membership = await authorize(database, session, institutionId, roles);
    return {
      institutionId,
      actorId: session.userId,
      membershipId: membership.id,
      role: membership.role,
    };
  };
}
