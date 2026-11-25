export type Role = "STUDENT" | "RECRUITER" | "PLACEMENT_OFFICER" | "ADMINISTRATOR";
export type AccessStatus = "ACTIVE" | "REVOKED";
export type ReviewStatus = "PENDING" | "VERIFIED" | "REJECTED";
export interface Membership {
  id: string;
  institutionId: string;
  role: Role;
  institution: { name: string; slug: string };
}
export interface Account {
  email: string;
  emailVerified: boolean;
  memberships: Membership[];
}
export interface Program {
  id: string;
  name: string;
  code: string;
}
export interface Department {
  id: string;
  name: string;
  code: string;
  programs: Program[];
}
export interface Academic {
  id: string;
  programId: string;
  graduationYear: number;
  cgpa: string;
  activeBacklogs: number;
  status: ReviewStatus;
  revision: number;
  program: Program & { department: Department };
}
export interface Employer {
  id: string;
  name: string;
  website?: string;
  status: ReviewStatus;
  revision: number;
}
