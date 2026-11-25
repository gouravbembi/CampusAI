import { Router } from "express";
import { z } from "zod";
import type { IdentityOptions } from "../identity/routes.js";
import { audit, HttpError, id } from "../identity/security.js";
import { scopedAccess } from "./scope.js";

const name = z.string().trim().min(1).max(120);
const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9_-]{0,19}$/);
const profileBody = z
  .object({
    fullName: name,
    phone: z
      .string()
      .trim()
      .regex(/^[+0-9 ().-]{5,30}$/)
      .nullable(),
    skills: z.array(z.string().trim().toLowerCase().min(1).max(80)).max(30),
    certifications: z.array(z.object({ name, issuer: name }).strict()).max(20),
    projects: z
      .array(z.object({ name, description: z.string().trim().min(1).max(1500) }).strict())
      .max(20),
  })
  .strict();
const academicBody = z
  .object({
    programId: id,
    graduationYear: z
      .number()
      .int()
      .min(1900)
      .max(new Date().getUTCFullYear() + 15),
    cgpa: z.number().min(0).max(10).multipleOf(0.01),
    activeBacklogs: z.number().int().min(0).max(200),
  })
  .strict();

export function studentRoutes(options: IdentityOptions) {
  const { database } = options;
  const router = Router({ mergeParams: true });
  const access = scopedAccess(options);

  router.get("/departments", async (req, res) => {
    const { institutionId } = await access(req, ["STUDENT", "PLACEMENT_OFFICER", "ADMINISTRATOR"]);
    res.json(
      await database.department.findMany({
        where: { institutionId },
        include: { programs: { orderBy: { name: "asc" } } },
        orderBy: { name: "asc" },
      }),
    );
  });

  router.post("/departments", async (req, res) => {
    const { institutionId, actorId } = await access(req, ["PLACEMENT_OFFICER"]);
    const fields = z.object({ name, code }).strict().parse(req.body);
    const created = await database.$transaction(async (tx) => {
      const dept = await tx.department.create({ data: { ...fields, institutionId } });
      await audit(tx, "DEPARTMENT_CREATED", actorId, institutionId, dept.id);
      return dept;
    });
    res.status(201).json(created);
  });

  router.patch("/departments/:departmentId", async (req, res) => {
    const { institutionId, actorId } = await access(req, ["PLACEMENT_OFFICER"]);
    const departmentId = id.parse(req.params.departmentId);
    const fields = z.object({ name, code }).strict().parse(req.body);
    const updated = await database.$transaction(async (tx) => {
      const dept = await tx.department.update({
        where: { id_institutionId: { id: departmentId, institutionId } },
        data: fields,
      });
      await audit(tx, "DEPARTMENT_UPDATED", actorId, institutionId, dept.id);
      return dept;
    });
    res.json(updated);
  });

  router.post("/departments/:departmentId/programs", async (req, res) => {
    const { institutionId, actorId } = await access(req, ["PLACEMENT_OFFICER"]);
    const departmentId = id.parse(req.params.departmentId);
    const fields = z.object({ name, code }).strict().parse(req.body);
    const created = await database.$transaction(async (tx) => {
      if (
        !(await tx.department.findUnique({
          where: { id_institutionId: { id: departmentId, institutionId } },
        }))
      )
        throw new HttpError(404, "not_found");
      const program = await tx.degreeProgram.create({
        data: { ...fields, institutionId, departmentId },
      });
      await audit(tx, "PROGRAM_CREATED", actorId, institutionId, program.id);
      return program;
    });
    res.status(201).json(created);
  });

  router.patch("/programs/:programId", async (req, res) => {
    const { institutionId, actorId } = await access(req, ["PLACEMENT_OFFICER"]);
    const programId = id.parse(req.params.programId);
    const fields = z.object({ name, code }).strict().parse(req.body);
    const updated = await database.$transaction(async (tx) => {
      const program = await tx.degreeProgram.update({
        where: { id_institutionId: { id: programId, institutionId } },
        data: fields,
      });
      await audit(tx, "PROGRAM_UPDATED", actorId, institutionId, program.id);
      return program;
    });
    res.json(updated);
  });

  router.get("/students/me", async (req, res) => {
    const { membershipId, institutionId } = await access(req, ["STUDENT"]);
    const profile = await database.studentProfile.findUnique({
      where: { membershipId_institutionId: { membershipId, institutionId } },
      include: {
        academic: { include: { program: { include: { department: true } } } },
        skills: { include: { skill: true } },
        certifications: true,
        projects: true,
      },
    });
    const completed = [
      profile?.fullName,
      profile?.academic,
      profile?.skills.length,
      profile?.certifications.length,
      profile?.projects.length,
    ].filter(Boolean).length;
    res.json({ profile, completeness: completed * 20 });
  });

  router.put("/students/me", async (req, res) => {
    const { institutionId, actorId, membershipId } = await access(req, ["STUDENT"]);
    const { skills, certifications, projects, ...personal } = profileBody.parse(req.body);
    await database.$transaction(async (tx) => {
      const student = await tx.studentProfile.upsert({
        where: { membershipId_institutionId: { membershipId, institutionId } },
        create: { ...personal, membershipId, institutionId },
        update: personal,
      });
      await tx.studentSkill.deleteMany({ where: { studentId: student.id } });
      for (const skillName of [...new Set(skills)].sort()) {
        const skill = await tx.skill.upsert({
          where: { name: skillName },
          create: { name: skillName },
          update: {},
        });
        await tx.studentSkill.create({ data: { studentId: student.id, skillId: skill.id } });
      }
      await tx.certification.deleteMany({ where: { studentId: student.id } });
      await tx.certification.createMany({
        data: certifications.map((entry) => ({ ...entry, studentId: student.id })),
        skipDuplicates: true,
      });
      await tx.studentProject.deleteMany({ where: { studentId: student.id } });
      await tx.studentProject.createMany({
        data: projects.map((entry) => ({ ...entry, studentId: student.id })),
        skipDuplicates: true,
      });
      await audit(tx, "STUDENT_PROFILE_UPDATED", actorId, institutionId, student.id);
    });
    res.sendStatus(204);
  });

  router.put("/students/me/academic", async (req, res) => {
    const { institutionId, actorId, membershipId } = await access(req, ["STUDENT"]);
    const academic = academicBody.parse(req.body);
    await database.$transaction(
      async (tx) => {
        const student = await tx.studentProfile.findUnique({
          where: { membershipId_institutionId: { membershipId, institutionId } },
        });
        if (!student) throw new HttpError(409, "profile_required");
        if (
          !(await tx.degreeProgram.findUnique({
            where: { id_institutionId: { id: academic.programId, institutionId } },
          }))
        )
          throw new HttpError(404, "not_found");
        const existing = await tx.academicRecord.findUnique({ where: { studentId: student.id } });
        if (
          existing &&
          existing.programId === academic.programId &&
          existing.graduationYear === academic.graduationYear &&
          existing.cgpa.equals(academic.cgpa) &&
          existing.activeBacklogs === academic.activeBacklogs
        )
          return;
        const record = await tx.academicRecord.upsert({
          where: { studentId_institutionId: { studentId: student.id, institutionId } },
          create: { ...academic, institutionId, studentId: student.id },
          update: { ...academic, status: "PENDING", reviewedAt: null, revision: { increment: 1 } },
        });
        await audit(tx, "ACADEMIC_RECORD_SUBMITTED", actorId, institutionId, record.id);
      },
      { isolationLevel: "Serializable" },
    );
    res.sendStatus(204);
  });

  router.get("/academic-records", async (req, res) => {
    const { institutionId } = await access(req, ["PLACEMENT_OFFICER"]);
    const status = z
      .enum(["PENDING", "VERIFIED", "REJECTED"])
      .default("PENDING")
      .parse(req.query.status);
    const after = id.optional().parse(req.query.after);
    const records = await database.academicRecord.findMany({
      where: {
        institutionId,
        status,
        ...(after ? { id: { gt: after } } : {}),
        student: { membership: { status: "ACTIVE", role: "STUDENT", user: { status: "ACTIVE" } } },
      },
      include: {
        student: { select: { fullName: true } },
        program: { include: { department: true } },
      },
      orderBy: { id: "asc" },
      take: 51,
    });
    const items = records.slice(0, 50);
    res.json({ items, next: records.length > 50 ? items.at(-1)?.id : null });
  });

  router.post("/academic-records/:recordId/review", async (req, res) => {
    const { institutionId, actorId } = await access(req, ["PLACEMENT_OFFICER"]);
    const recordId = id.parse(req.params.recordId);
    const { status, revision } = z
      .object({ status: z.enum(["VERIFIED", "REJECTED"]), revision: z.number().int().positive() })
      .strict()
      .parse(req.body);
    await database.$transaction(async (tx) => {
      const result = await tx.academicRecord.updateMany({
        where: {
          id: recordId,
          institutionId,
          revision,
          status: "PENDING",
          student: {
            membership: { status: "ACTIVE", role: "STUDENT", user: { status: "ACTIVE" } },
          },
        },
        data: { status, reviewedAt: new Date() },
      });
      if (!result.count) throw new HttpError(409, "record_unavailable_or_changed");
      await audit(
        tx,
        status === "VERIFIED" ? "ACADEMIC_VERIFIED" : "ACADEMIC_REJECTED",
        actorId,
        institutionId,
        recordId,
      );
    });
    res.sendStatus(204);
  });

  return router;
}
