import "dotenv/config";
import { CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { setTimeout as delay } from "node:timers/promises";

async function initialize() {
  const { NODE_ENV, S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY } = process.env;
  if (NODE_ENV === "production" || !S3_BUCKET || !S3_ENDPOINT || !S3_ACCESS_KEY || !S3_SECRET_KEY) {
    throw new Error("Configure the local storage adapter first");
  }
  if (!["localhost", "127.0.0.1", "storage"].includes(new URL(S3_ENDPOINT).hostname)) {
    throw new Error("This command is for local storage only");
  }
  const client = new S3Client({
    endpoint: S3_ENDPOINT,
    region: "us-east-1",
    forcePathStyle: true,
    maxAttempts: 1,
    credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
  });
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      try {
        await client.send(new HeadBucketCommand({ Bucket: S3_BUCKET }), {
          abortSignal: AbortSignal.timeout(3000),
        });
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !("$metadata" in error) ||
          (error.$metadata as { httpStatusCode?: number }).httpStatusCode !== 404
        )
          throw error;
        await client.send(new CreateBucketCommand({ Bucket: S3_BUCKET }), {
          abortSignal: AbortSignal.timeout(3000),
        });
      }
      console.info("Private development bucket available");
      return;
    } catch {
      await delay(1000);
    }
  }
  throw new Error("Local storage did not become ready");
}

void initialize().catch(() => {
  console.error("Unable to initialize the development storage bucket");
  process.exitCode = 1;
});
