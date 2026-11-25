import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { createStorage, purgeDeletedResume, removeOrphan } from "../documents/storage.js";
import { hours } from "../identity/security.js";

async function purge() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const storage = createStorage(process.env);
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const orphanTickets = await database.documentCleanup.findMany({
      where: { createdAt: { lt: new Date(Date.now() - hours(1)) } },
      take: 100,
      orderBy: { createdAt: "asc" },
    });
    const deleted = await database.resumeVersion.findMany({
      where: { status: "DELETED", objectDeletedAt: null },
      select: { storageKey: true },
      take: 100,
      orderBy: { deletedAt: "asc" },
    });
    let failures = 0;
    for (const { storageKey } of orphanTickets) {
      await removeOrphan(database, storage, storageKey).catch(() => {
        failures++;
      });
    }
    for (const { storageKey } of deleted) {
      await purgeDeletedResume(database, storage, storageKey).catch(() => {
        failures++;
      });
    }
    console.info(
      `Processed ${orphanTickets.length + deleted.length} documents, ${failures} will be retried`,
    );
    if (failures) process.exitCode = 1;
  } finally {
    await database.$disconnect();
  }
}

void purge().catch(() => {
  console.error("Document cleanup failed");
  process.exitCode = 1;
});
