-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'RECRUITER', 'PLACEMENT_OFFICER', 'ADMINISTRATOR');

-- CreateEnum
CREATE TYPE "AccessStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ResumeStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "credentialVersion" INTEGER NOT NULL DEFAULT 0,
    "status" "AccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "status" "AccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenDigest" TEXT NOT NULL,
    "credentialVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "employerId" UUID,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "tokenDigest" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenDigest" TEXT NOT NULL,
    "credentialVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenDigest" TEXT NOT NULL,
    "credentialVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "degree_programs" (
    "id" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "departmentId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "degree_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_records" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "graduationYear" INTEGER NOT NULL,
    "cgpa" DECIMAL(4,2) NOT NULL,
    "activeBacklogs" INTEGER NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_skills" (
    "studentId" UUID NOT NULL,
    "skillId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_skills_pkey" PRIMARY KEY ("studentId","skillId")
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_projects" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employers" (
    "id" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruiter_profiles" (
    "membershipId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruiter_profiles_pkey" PRIMARY KEY ("membershipId")
);

-- CreateTable
CREATE TABLE "recruiter_assignments" (
    "membershipId" UUID NOT NULL,
    "employerId" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "status" "AccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruiter_assignments_pkey" PRIMARY KEY ("membershipId","employerId")
);

-- CreateTable
CREATE TABLE "resume_versions" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "institutionId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" "ResumeStatus" NOT NULL DEFAULT 'ARCHIVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "objectDeletedAt" TIMESTAMP(3),

    CONSTRAINT "resume_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "institutionId" UUID,
    "action" TEXT NOT NULL,
    "targetId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_cleanup" (
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_cleanup_pkey" PRIMARY KEY ("storageKey")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "memberships_institutionId_role_status_idx" ON "memberships"("institutionId", "role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_userId_institutionId_key" ON "memberships"("userId", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_id_institutionId_key" ON "memberships"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenDigest_key" ON "sessions"("tokenDigest");

-- CreateIndex
CREATE INDEX "sessions_userId_revokedAt_idx" ON "sessions"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_tokenDigest_key" ON "invitations"("tokenDigest");

-- CreateIndex
CREATE INDEX "invitations_institutionId_email_expiresAt_idx" ON "invitations"("institutionId", "email", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_tokenDigest_key" ON "email_verification_tokens"("tokenDigest");

-- CreateIndex
CREATE INDEX "email_verification_tokens_userId_expiresAt_idx" ON "email_verification_tokens"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenDigest_key" ON "password_reset_tokens"("tokenDigest");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_expiresAt_idx" ON "password_reset_tokens"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_membershipId_key" ON "student_profiles"("membershipId");

-- CreateIndex
CREATE INDEX "student_profiles_institutionId_fullName_idx" ON "student_profiles"("institutionId", "fullName");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_id_institutionId_key" ON "student_profiles"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_membershipId_institutionId_key" ON "student_profiles"("membershipId", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "departments_institutionId_code_key" ON "departments"("institutionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_id_institutionId_key" ON "departments"("id", "institutionId");

-- CreateIndex
CREATE INDEX "degree_programs_departmentId_institutionId_idx" ON "degree_programs"("departmentId", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "degree_programs_institutionId_code_key" ON "degree_programs"("institutionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "degree_programs_id_institutionId_key" ON "degree_programs"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "academic_records_studentId_key" ON "academic_records"("studentId");

-- CreateIndex
CREATE INDEX "academic_records_institutionId_status_idx" ON "academic_records"("institutionId", "status");

-- CreateIndex
CREATE INDEX "academic_records_programId_institutionId_idx" ON "academic_records"("programId", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "academic_records_studentId_institutionId_key" ON "academic_records"("studentId", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "skills_name_key" ON "skills"("name");

-- CreateIndex
CREATE INDEX "student_skills_skillId_idx" ON "student_skills"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "certifications_studentId_name_issuer_key" ON "certifications"("studentId", "name", "issuer");

-- CreateIndex
CREATE UNIQUE INDEX "student_projects_studentId_name_key" ON "student_projects"("studentId", "name");

-- CreateIndex
CREATE INDEX "employers_institutionId_status_idx" ON "employers"("institutionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "employers_id_institutionId_key" ON "employers"("id", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "employers_institutionId_name_key" ON "employers"("institutionId", "name");

-- CreateIndex
CREATE INDEX "recruiter_assignments_employerId_institutionId_idx" ON "recruiter_assignments"("employerId", "institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "resume_versions_storageKey_key" ON "resume_versions"("storageKey");

-- CreateIndex
CREATE INDEX "resume_versions_studentId_createdAt_idx" ON "resume_versions"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "resume_versions_status_objectDeletedAt_idx" ON "resume_versions"("status", "objectDeletedAt");

-- CreateIndex
CREATE INDEX "audit_events_institutionId_createdAt_idx" ON "audit_events"("institutionId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_events_actorId_createdAt_idx" ON "audit_events"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "document_cleanup_createdAt_idx" ON "document_cleanup"("createdAt");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_employerId_institutionId_fkey" FOREIGN KEY ("employerId", "institutionId") REFERENCES "employers"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_membershipId_institutionId_fkey" FOREIGN KEY ("membershipId", "institutionId") REFERENCES "memberships"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "degree_programs" ADD CONSTRAINT "degree_programs_departmentId_institutionId_fkey" FOREIGN KEY ("departmentId", "institutionId") REFERENCES "departments"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_records" ADD CONSTRAINT "academic_records_studentId_institutionId_fkey" FOREIGN KEY ("studentId", "institutionId") REFERENCES "student_profiles"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_records" ADD CONSTRAINT "academic_records_programId_institutionId_fkey" FOREIGN KEY ("programId", "institutionId") REFERENCES "degree_programs"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_skills" ADD CONSTRAINT "student_skills_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_skills" ADD CONSTRAINT "student_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_projects" ADD CONSTRAINT "student_projects_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employers" ADD CONSTRAINT "employers_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_profiles" ADD CONSTRAINT "recruiter_profiles_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_assignments" ADD CONSTRAINT "recruiter_assignments_membershipId_institutionId_fkey" FOREIGN KEY ("membershipId", "institutionId") REFERENCES "memberships"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_assignments" ADD CONSTRAINT "recruiter_assignments_employerId_institutionId_fkey" FOREIGN KEY ("employerId", "institutionId") REFERENCES "employers"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_versions" ADD CONSTRAINT "resume_versions_studentId_institutionId_fkey" FOREIGN KEY ("studentId", "institutionId") REFERENCES "student_profiles"("id", "institutionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- These partial indexes and checks encode lifecycle invariants outside Prisma's schema DSL.
CREATE UNIQUE INDEX "invitations_pending_email_key"
  ON "invitations" ("institutionId", "email")
  WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL;

CREATE UNIQUE INDEX "resume_versions_one_active"
  ON "resume_versions" ("studentId") WHERE "status" = 'ACTIVE';

ALTER TABLE "invitations"
  ADD CONSTRAINT "invitations_scoped_role_check"
  CHECK ("role" <> 'ADMINISTRATOR' AND ("employerId" IS NULL OR "role" = 'RECRUITER')),
  ADD CONSTRAINT "invitations_lifecycle_check"
  CHECK ("expiresAt" > "createdAt" AND ("acceptedAt" IS NULL OR "revokedAt" IS NULL));

ALTER TABLE "academic_records"
  ADD CONSTRAINT "academic_facts_check"
  CHECK ("cgpa" BETWEEN 0 AND 10 AND "activeBacklogs" BETWEEN 0 AND 200
    AND "graduationYear" >= 1900 AND "revision" > 0),
  ADD CONSTRAINT "academic_review_check"
  CHECK (("status" = 'PENDING') = ("reviewedAt" IS NULL));

ALTER TABLE "employers" ADD CONSTRAINT "employer_review_check"
  CHECK (("status" = 'PENDING') = ("reviewedAt" IS NULL) AND "revision" > 0);

ALTER TABLE "resume_versions" ADD CONSTRAINT "resume_lifecycle_check"
  CHECK ("size" BETWEEN 1 AND 5242880 AND (("status" = 'DELETED') = ("deletedAt" IS NOT NULL))
         AND ("objectDeletedAt" IS NULL OR "deletedAt" IS NOT NULL));
