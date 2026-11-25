import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { createApp } from "../app.js";
import { createStorage } from "../documents/storage.js";
import { PrismaClient, type Role } from "../generated/prisma/client.js";
import { digest, hashPassword, verifyPassword } from "../identity/security.js";

const origin = "http://localhost:5173";
const password = "Synthetic-integration-01";
const nextPassword = "Synthetic-integration-02";
const fixture = randomUUID().slice(0, 8);

test("Phase 2 workflows with PostgreSQL and private S3", async (context) => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Integration database URL is required");
  const database = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const storage = createStorage(process.env);
  const messages: { to: string; text: string }[] = [];
  const storedKeys: string[] = [];
  const server = createApp({
    webOrigin: origin,
    checkDatabase: async () => {},
    api: {
      database,
      secure: false,
      mailer: {
        async send(message) {
          messages.push(message);
        },
      },
      storage: {
        ...storage,
        async put(key, ...args) {
          const result = await storage.put(key, ...args);
          storedKeys.push(key);
          return result;
        },
      },
    },
  }).listen(0, "127.0.0.1");
  context.after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await database.$disconnect();
  });
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;

  async function call(
    path: string,
    code: number,
    options: {
      method?: string;
      body?: unknown;
      cookie?: string;
      csrf?: boolean;
      origin?: string;
    } = {},
  ) {
    const headers = new Headers({ Origin: options.origin ?? origin });
    if (options.cookie) headers.set("Cookie", options.cookie);
    if (options.csrf !== false) headers.set("X-CampusAI-CSRF", "1");
    if (options.body && !(options.body instanceof FormData))
      headers.set("Content-Type", "application/json");
    const response = await fetch(base + path, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body instanceof FormData
          ? options.body
          : options.body
            ? JSON.stringify(options.body)
            : undefined,
    });
    assert.equal(
      response.status,
      code,
      `${options.method ?? "GET"} ${path} was ${response.status}: ${response.ok ? "" : await response.clone().text()}`,
    );
    return response;
  }

  const email = (name: string) => `${fixture}-${name}@example.test`;
  const extractToken = (recipient: string) => {
    const latest = messages.filter((message) => message.to === recipient).at(-1);
    const token = /#token=([A-Za-z0-9_-]{43})/.exec(latest?.text ?? "")?.[1];
    assert.ok(token);
    return token;
  };
  const institution = await database.institution.create({
    data: { slug: "pilot-" + fixture, name: "Pilot University" },
  });
  const second = await database.institution.create({
    data: { slug: "other-" + fixture, name: "Second University" },
  });
  const scope = "/institutions/" + institution.id;
  const other = "/institutions/" + second.id;
  const admin = await database.user.create({
    data: {
      email: email("admin"),
      passwordHash: await hashPassword(password),
      emailVerifiedAt: new Date(),
    },
  });
  await database.membership.create({
    data: { userId: admin.id, institutionId: institution.id, role: "ADMINISTRATOR" },
  });
  const secondAdmin = await database.user.create({
    data: {
      email: email("admin2"),
      passwordHash: await hashPassword(password),
      emailVerifiedAt: new Date(),
    },
  });
  await database.membership.create({
    data: { userId: secondAdmin.id, institutionId: second.id, role: "ADMINISTRATOR" },
  });

  async function login(userEmail: string, credential = password, previous?: string) {
    const response = await call("/auth/login", 204, {
      method: "POST",
      cookie: previous,
      body: { email: userEmail, password: credential },
    });
    const set = response.headers.get("set-cookie");
    assert.ok(set?.includes("HttpOnly"));
    assert.ok(set?.includes("SameSite=Lax"));
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
    return set!.split(";")[0]!;
  }

  async function invite(path: string, actor: string, recipient: string, role: Role) {
    await call(path + "/invitations", 201, {
      method: "POST",
      cookie: actor,
      body: { email: recipient, role },
    });
    return extractToken(recipient);
  }

  async function accept(token: string, status = 204) {
    await call("/auth/invitations/accept", status, { method: "POST", body: { token, password } });
  }

  let adminCookie = "";
  let otherCookie = "";
  let officer = "";
  let student = "";
  let peer = "";
  let recruiter = "";
  let unassigned = "";
  let programId = "";
  let academicId = "";
  let employerId = "";
  let resumeId = "";
  let studentId = "";
  const personal = {
    fullName: "Synthetic Student",
    phone: null,
    skills: ["TypeScript"],
    certifications: [],
    projects: [],
  };

  await context.test(
    "Argon2id, generic login errors, strict CORS, CSRF, fixation and anonymous denial",
    async () => {
      assert.match(admin.passwordHash, /^\$argon2id\$/);
      assert.equal(await verifyPassword(admin.passwordHash, password), true);
      assert.equal(await verifyPassword(admin.passwordHash, "incorrect"), false);
      await call(scope + "/memberships", 401);
      const wrong = await call("/auth/login", 401, {
        method: "POST",
        body: { email: admin.email, password: "incorrect" },
      });
      const unknown = await call("/auth/login", 401, {
        method: "POST",
        body: { email: email("missing"), password: "incorrect" },
      });
      assert.deepEqual(await wrong.json(), await unknown.json());
      await call("/auth/login", 403, {
        method: "POST",
        csrf: false,
        body: { email: admin.email, password },
      });
      const badOrigin = await call("/auth/login", 403, {
        method: "POST",
        origin: "https://outside.example",
        body: { email: admin.email, password },
      });
      assert.equal(badOrigin.headers.get("access-control-allow-origin"), null);
      const initial = await login(admin.email);
      adminCookie = await login(admin.email, password, initial);
      assert.notEqual(adminCookie, initial);
      await call("/auth/me", 401, { cookie: initial });
      assert.ok(
        await database.session.findUnique({
          where: { tokenDigest: digest(adminCookie.split("=")[1]!) },
        }),
      );
      assert.equal(
        await database.session.count({ where: { tokenDigest: adminCookie.split("=")[1] } }),
        0,
      );
      otherCookie = await login(secondAdmin.email);
      await call(other + "/memberships", 403, { cookie: adminCookie });
    },
  );

  await context.test(
    "single-use and expired invitations, four role logins, and privilege boundaries",
    async () => {
      const expired = await invite(scope, adminCookie, email("expired"), "STUDENT");
      await database.invitation.update({
        where: { tokenDigest: digest(expired) },
        data: {
          createdAt: new Date(Date.now() - 7200000),
          expiresAt: new Date(Date.now() - 3600000),
        },
      });
      await accept(expired, 400);
      const officerToken = await invite(scope, adminCookie, email("officer"), "PLACEMENT_OFFICER");
      await accept(officerToken);
      await accept(officerToken, 400);
      officer = await login(email("officer"));
      await call(scope + "/memberships", 403, { cookie: officer });
      await call(scope + "/invitations", 403, {
        method: "POST",
        cookie: officer,
        body: { role: "RECRUITER", email: email("blocked") },
      });
      await call(scope + "/invitations", 400, {
        method: "POST",
        cookie: adminCookie,
        body: { role: "ADMINISTRATOR", email: email("blocked") },
      });
      await accept(await invite(scope, officer, email("student"), "STUDENT"));
      await accept(await invite(scope, officer, email("peer"), "STUDENT"));
      await accept(await invite(scope, adminCookie, email("recruiter"), "RECRUITER"));
      await accept(await invite(scope, adminCookie, email("unassigned"), "RECRUITER"));
      student = await login(email("student"));
      peer = await login(email("peer"));
      recruiter = await login(email("recruiter"));
      unassigned = await login(email("unassigned"));
      const me = await (await call("/auth/me", 200, { cookie: student })).json();
      assert.equal(me.memberships[0].role, "STUDENT");
      await call(other + "/students/me", 403, { cookie: student });
    },
  );

  await context.test(
    "student ownership and catalog isolation, officer verification and revision invalidation",
    async () => {
      const department = await (
        await call(scope + "/departments", 201, {
          method: "POST",
          cookie: officer,
          body: { name: "Engineering", code: "ENG" },
        })
      ).json();
      const program = await (
        await call(scope + `/departments/${department.id}/programs`, 201, {
          method: "POST",
          cookie: officer,
          body: { name: "Computing", code: "CS" },
        })
      ).json();
      programId = program.id;
      const foreign = await database.department.create({
        data: { institutionId: second.id, name: "Engineering", code: "ENG" },
      });
      const foreignProgram = await database.degreeProgram.create({
        data: { institutionId: second.id, departmentId: foreign.id, name: "Computing", code: "CS" },
      });
      await call(scope + "/students/me", 204, { method: "PUT", cookie: student, body: personal });
      await call(scope + "/students/me", 204, {
        method: "PUT",
        cookie: peer,
        body: { ...personal, fullName: "Synthetic Peer" },
      });
      const own = await (await call(scope + "/students/me", 200, { cookie: student })).json();
      studentId = own.profile.id;
      const theirs = await (await call(scope + "/students/me", 200, { cookie: peer })).json();
      assert.notEqual(own.profile.id, theirs.profile.id);
      await call(scope + "/students/me", 400, {
        method: "PUT",
        cookie: peer,
        body: { ...personal, id: studentId },
      });
      const facts = { programId, graduationYear: 2028, cgpa: 8.71, activeBacklogs: 0 };
      await call(scope + "/students/me/academic", 404, {
        method: "PUT",
        cookie: student,
        body: { ...facts, programId: foreignProgram.id },
      });
      await call(scope + "/students/me/academic", 400, {
        method: "PUT",
        cookie: student,
        body: { ...facts, status: "VERIFIED" },
      });
      await call(scope + "/students/me/academic", 204, {
        method: "PUT",
        cookie: student,
        body: facts,
      });
      const queue = await (
        await call(scope + "/academic-records", 200, { cookie: officer })
      ).json();
      const record = queue.items[0];
      assert.equal(record.cgpa, "8.71");
      academicId = record.id;
      const review = { status: "VERIFIED", revision: record.revision };
      await call(scope + `/academic-records/${academicId}/review`, 403, {
        method: "POST",
        cookie: student,
        body: review,
      });
      await call(scope + `/academic-records/${academicId}/review`, 204, {
        method: "POST",
        cookie: officer,
        body: review,
      });
      await call(scope + "/students/me/academic", 204, {
        method: "PUT",
        cookie: student,
        body: facts,
      });
      assert.equal(
        (await database.academicRecord.findUniqueOrThrow({ where: { id: academicId } })).status,
        "VERIFIED",
      );
      await call(scope + "/students/me/academic", 204, {
        method: "PUT",
        cookie: student,
        body: { ...facts, cgpa: 8.72 },
      });
      await call(scope + `/academic-records/${academicId}/review`, 409, {
        method: "POST",
        cookie: officer,
        body: review,
      });
      await assert.rejects(
        database.academicRecord.update({
          where: { id: academicId },
          data: { programId: foreignProgram.id },
        }),
        { code: "P2003" },
      );
    },
  );

  await context.test(
    "employer approval gates active assignments and only scoped administrators can change access",
    async () => {
      await call(scope + "/recruiters/me", 204, {
        method: "PUT",
        cookie: recruiter,
        body: { fullName: "Synthetic Recruiter", title: "Talent partner" },
      });
      const employer = await (
        await call(scope + "/employers", 201, {
          method: "POST",
          cookie: recruiter,
          body: { name: "Synthetic Employer", website: "https://example.test" },
        })
      ).json();
      employerId = employer.id;
      const path = `${scope}/employers/${employerId}`;
      await call(path, 404, { cookie: recruiter });
      await call(path + "/review", 403, {
        method: "POST",
        cookie: recruiter,
        body: { status: "VERIFIED", revision: 1 },
      });
      await call(path + "/review", 204, {
        method: "POST",
        cookie: officer,
        body: { status: "VERIFIED", revision: 1 },
      });
      await call(path, 200, { cookie: recruiter });
      await call(path, 404, { cookie: unassigned });
      const members = await (
        await call(scope + "/memberships", 200, { cookie: adminCookie })
      ).json();
      const member = members.items.find(
        (entry: { user: { email: string } }) => entry.user.email === email("unassigned"),
      );
      await call(path + "/assignments/" + member.id, 403, {
        method: "PUT",
        cookie: recruiter,
        body: { status: "ACTIVE" },
      });
      await call(path + "/assignments/" + member.id, 204, {
        method: "PUT",
        cookie: adminCookie,
        body: { status: "ACTIVE" },
      });
      await call(path, 200, { cookie: unassigned });
      await call(path + "/assignments/" + member.id, 204, {
        method: "PUT",
        cookie: adminCookie,
        body: { status: "REVOKED" },
      });
      await call(path, 404, { cookie: unassigned });
      await call(other + "/employers", 403, { cookie: recruiter });
      await call(scope + "/memberships/" + member.id, 400, {
        method: "PATCH",
        cookie: adminCookie,
        body: { role: "ADMINISTRATOR" },
      });
      await call(scope + "/memberships/" + member.id, 403, {
        method: "PATCH",
        cookie: otherCookie,
        body: { role: "PLACEMENT_OFFICER" },
      });
    },
  );

  await context.test(
    "real object uploads, private downloads, compensation, activation and deletion",
    async () => {
      const pdf =
        "%PDF-1.4\nxref\n0 1\n0000000000 65535 f \ntrailer\n<< /Size 1 >>\nstartxref\n9\n%%EOF\n";
      function multipart(body: BlobPart, filename: string) {
        const form = new FormData();
        form.set("resume", new Blob([body]), filename);
        return form;
      }
      await call(scope + "/resumes", 400, {
        method: "POST",
        cookie: student,
        body: multipart("not a resume", "fake.pdf"),
      });
      await call(scope + "/resumes", 400, {
        method: "POST",
        cookie: student,
        body: multipart("not a resume", "fake.docx"),
      });
      await call(scope + "/resumes", 413, {
        method: "POST",
        cookie: student,
        body: multipart(new Uint8Array(5 * 1024 * 1024 + 1), "large.pdf"),
      });
      const result = await (
        await call(scope + "/resumes", 201, {
          method: "POST",
          cookie: student,
          body: multipart(pdf, "resume.pdf"),
        })
      ).json();
      resumeId = result.id;
      assert.equal(result.storageKey, undefined);
      const docx = await readFile(new URL("./resume.fixture.docx", import.meta.url));
      const secondResume = await (
        await call(scope + "/resumes", 201, {
          method: "POST",
          cookie: student,
          body: multipart(new Uint8Array(docx), "resume.docx"),
        })
      ).json();
      const path = `${scope}/resumes/${resumeId}`;
      await call(path + "/download", 401);
      await call(path + "/download", 404, { cookie: peer });
      await call(path + "/download", 403, { cookie: recruiter });
      const dl = await call(path + "/download", 200, { cookie: student });
      assert.equal(await dl.text(), pdf);
      assert.match(dl.headers.get("content-disposition") ?? "", /^attachment/);
      const objectKey = storedKeys[0]!;
      if (process.env.S3_ENDPOINT?.startsWith("http")) {
        const anonymous = await fetch(
          `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}/${objectKey}`,
        );
        const failure = await anonymous.text();
        assert.ok(
          [401, 403].includes(anonymous.status) ||
            (anonymous.status === 400 && failure.includes("Authorization header is invalid")),
          `Anonymous object HTTP status ${anonymous.status}`,
        );
        assert.notEqual(failure, pdf);
      }
      await call(path, 204, { method: "PATCH", cookie: student, body: { status: "ACTIVE" } });
      await call(`${scope}/resumes/${secondResume.id}`, 204, {
        method: "PATCH",
        cookie: student,
        body: { status: "ACTIVE" },
      });
      assert.equal(
        (await database.resumeVersion.findUniqueOrThrow({ where: { id: resumeId } })).status,
        "ARCHIVED",
      );
      const filler = Array.from({ length: 18 }, () => ({
        studentId,
        institutionId: institution.id,
        storageKey: "synthetic-fixture/" + randomUUID(),
        filename: "fixture.pdf",
        contentType: "application/pdf",
        size: 1,
      }));
      await database.resumeVersion.createMany({ data: filler });
      await call(scope + "/resumes", 409, {
        method: "POST",
        cookie: student,
        body: multipart(pdf, "conflict.pdf"),
      });
      const dropped = storedKeys.at(-1)!;
      await assert.rejects(storage.get(dropped));
      assert.equal(await database.documentCleanup.count({ where: { storageKey: dropped } }), 0);
      await database.resumeVersion.deleteMany({
        where: { storageKey: { in: filler.map((entry) => entry.storageKey) } },
      });
      await call(path, 204, { method: "DELETE", cookie: student });
      await assert.rejects(storage.get(objectKey));
      await call(path + "/download", 404, { cookie: student });
      await call(`${scope}/resumes/${secondResume.id}`, 204, { method: "DELETE", cookie: student });
    },
  );

  await context.test(
    "session expiration, manual revocation, password reset reuse denial, and membership revocation",
    async () => {
      const expired = await login(email("peer"));
      await database.session.update({
        where: { tokenDigest: digest(expired.split("=")[1]!) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await call("/auth/me", 401, { cookie: expired });
      const sessions = await (await call("/auth/sessions", 200, { cookie: peer })).json();
      const current = sessions.find((entry: { current: boolean }) => entry.current);
      await call("/auth/sessions/" + current.id, 204, { method: "DELETE", cookie: peer });
      await call("/auth/me", 401, { cookie: peer });
      await call("/auth/password/reset/request", 202, {
        method: "POST",
        body: { email: email("student") },
      });
      await call("/auth/password/reset/request", 202, {
        method: "POST",
        body: { email: email("missing") },
      });
      const token = extractToken(email("student"));
      await call("/auth/password/reset/confirm", 204, {
        method: "POST",
        body: { token, password: nextPassword },
      });
      await call("/auth/password/reset/confirm", 400, {
        method: "POST",
        body: { token, password },
      });
      await call("/auth/me", 401, { cookie: student });
      student = await login(email("student"), nextPassword);
      const member = await database.membership.findFirstOrThrow({
        where: { institutionId: institution.id, user: { email: email("student") } },
      });
      await call(scope + "/memberships/" + member.id, 204, {
        method: "PATCH",
        cookie: adminCookie,
        body: { status: "REVOKED" },
      });
      await call(scope + "/students/me", 401, { cookie: student });
      student = await login(email("student"), nextPassword);
      await call(scope + "/students/me", 403, { cookie: student });
      const audits = (await (
        await call(scope + "/audit", 200, { cookie: adminCookie })
      ).json()) as { action: string }[];
      for (const action of [
        "MEMBERSHIP_INVITED",
        "ACADEMIC_VERIFIED",
        "EMPLOYER_APPROVED",
        "RESUME_UPLOADED",
        "RESUME_DOWNLOADED",
        "RESUME_DELETED",
        "MEMBERSHIP_REVOKED",
      ]) {
        assert.ok(
          audits.some((event) => event.action === action),
          action,
        );
      }
      const identityLogs = await database.auditEvent.findMany({
        where: { actorId: member.userId },
      });
      assert.ok(identityLogs.some((entry) => entry.action === "PASSWORD_RESET"));
    },
  );
});
