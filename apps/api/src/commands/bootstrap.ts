import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";
import { PrismaClient } from "../generated/prisma/client.js";
import { audit, emailAddress, hashPassword, passwordInput } from "../identity/security.js";

async function bootstrap() {
  const org = z.string().trim().min(2).max(120).parse(process.env.BOOTSTRAP_INSTITUTION_NAME);
  const slug = z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(60)
    .parse(process.env.BOOTSTRAP_INSTITUTION_SLUG);
  const email = emailAddress.parse(process.env.BOOTSTRAP_ADMIN_EMAIL);
  if (process.stdin.isTTY) throw new Error("Pass the bootstrap password via standard input");
  const parts: Buffer[] = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk);
    length += buffer.length;
    if (length > 513) throw new Error("Invalid password length");
    parts.push(buffer);
  }
  const passwordHash = await hashPassword(
    passwordInput.parse(
      Buffer.concat(parts)
        .toString("utf8")
        .replace(/\r?\n$/, ""),
    ),
  );
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await database.$transaction(
      async (tx) => {
        const institution = await tx.institution.upsert({
          where: { slug },
          create: { slug, name: org },
          update: {},
        });
        if (
          await tx.membership.findFirst({
            where: { institutionId: institution.id, role: "ADMINISTRATOR" },
          })
        ) {
          throw new Error("Institution already has an administrator");
        }
        const user = await tx.user.create({
          data: { email, passwordHash, emailVerifiedAt: new Date() },
        });
        const membership = await tx.membership.create({
          data: { institutionId: institution.id, userId: user.id, role: "ADMINISTRATOR" },
        });
        await audit(tx, "ADMINISTRATOR_BOOTSTRAPPED", user.id, institution.id, membership.id);
      },
      { isolationLevel: "Serializable" },
    );
    console.info("Institution administrator created");
  } finally {
    await database.$disconnect();
  }
}

void bootstrap().catch(() => {
  console.error(
    "Bootstrap failed. Check configuration, password strength, and whether the email or administrator already exists.",
  );
  process.exitCode = 1;
});
