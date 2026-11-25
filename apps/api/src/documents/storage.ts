import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { PrismaClient } from "../generated/prisma/client.js";
import { maxResumeBytes } from "./format.js";

export function createStorage(env: NodeJS.ProcessEnv) {
  const bucket = env.S3_BUCKET;
  const endpoint = env.S3_ENDPOINT;
  if (!bucket) throw new Error("S3_BUCKET is required");
  if (endpoint && env.NODE_ENV === "production" && new URL(endpoint).protocol !== "https:") {
    throw new Error("Production S3 endpoints require HTTPS");
  }
  if (Boolean(env.S3_ACCESS_KEY) !== Boolean(env.S3_SECRET_KEY))
    throw new Error("Incomplete S3 credentials");
  const client = new S3Client({
    region: env.S3_REGION ?? "us-east-1",
    endpoint,
    forcePathStyle: env.S3_PATH_STYLE === "true",
    credentials:
      env.S3_ACCESS_KEY && env.S3_SECRET_KEY
        ? { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY }
        : undefined,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    maxAttempts: 2,
  });
  return {
    put(storageKey: string, file: Buffer, contentType: string) {
      return client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: storageKey,
          Body: file,
          ContentType: contentType,
        }),
        { abortSignal: AbortSignal.timeout(15000) },
      );
    },
    async get(storageKey: string) {
      const response = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: storageKey }),
        { abortSignal: AbortSignal.timeout(15000) },
      );
      if (!response.Body) throw new Error("Missing storage response body");
      const reader = response.Body.transformToWebStream().getReader();
      const chunks: Buffer[] = [];
      let length = 0;
      try {
        for (;;) {
          const result = await reader.read();
          if (result.done) break;
          length += result.value.byteLength;
          if (length > maxResumeBytes) {
            await reader.cancel();
            throw new Error("Unexpected object size");
          }
          chunks.push(Buffer.from(result.value));
        }
        return Buffer.concat(chunks, length);
      } finally {
        reader.releaseLock();
      }
    },
    async remove(storageKey: string) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey }), {
        abortSignal: AbortSignal.timeout(15000),
      });
    },
  };
}

export type Storage = ReturnType<typeof createStorage>;

export async function removeOrphan(database: PrismaClient, storage: Storage, key: string) {
  // The successful resume transaction removes the cleanup ticket atomically.
  if (!(await database.documentCleanup.findUnique({ where: { storageKey: key } }))) return;
  await storage.remove(key);
  await database.documentCleanup.deleteMany({ where: { storageKey: key } });
}

export async function purgeDeletedResume(database: PrismaClient, storage: Storage, key: string) {
  await storage.remove(key);
  await database.resumeVersion.updateMany({
    where: { storageKey: key, status: "DELETED", objectDeletedAt: null },
    data: { objectDeletedAt: new Date() },
  });
}
