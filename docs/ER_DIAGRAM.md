# Phase 2 entity relationships

```mermaid
erDiagram
    INSTITUTION ||--o{ MEMBERSHIP : scopes
    USER ||--o{ MEMBERSHIP : holds
    USER ||--o{ SESSION : authenticates
    USER ||--o{ EMAIL_VERIFICATION_TOKEN : verifies
    USER ||--o{ PASSWORD_RESET_TOKEN : recovers
    INSTITUTION ||--o{ INVITATION : issues
    EMPLOYER o|--o{ INVITATION : preassigns
    MEMBERSHIP ||--o| STUDENT_PROFILE : owns
    MEMBERSHIP ||--o| RECRUITER_PROFILE : owns
    INSTITUTION ||--o{ DEPARTMENT : contains
    DEPARTMENT ||--o{ DEGREE_PROGRAM : includes
    DEGREE_PROGRAM ||--o{ ACADEMIC_RECORD : categorizes
    STUDENT_PROFILE ||--o| ACADEMIC_RECORD : submits
    STUDENT_PROFILE ||--o{ STUDENT_SKILL : lists
    SKILL ||--o{ STUDENT_SKILL : normalizes
    STUDENT_PROFILE ||--o{ CERTIFICATION : lists
    STUDENT_PROFILE ||--o{ STUDENT_PROJECT : lists
    STUDENT_PROFILE ||--o{ RESUME_VERSION : owns
    INSTITUTION ||--o{ EMPLOYER : reviews
    MEMBERSHIP ||--o{ RECRUITER_ASSIGNMENT : grants
    EMPLOYER ||--o{ RECRUITER_ASSIGNMENT : receives
    USER o|--o{ AUDIT_EVENT : acts
    INSTITUTION o|--o{ AUDIT_EVENT : scopes
```

The Phase 1 institution and migration remain intact. Composite foreign keys enforce equal institution IDs between memberships and profiles, departments and programs, students and academic programs, employers and assignments or invitations, and students and resumes. Certification, project and skill joins inherit scope through the profile. The normalized skill vocabulary is shared.

An academic record represents the current revision. Changes to academic facts increment that revision and invalidate verification. An unchanged resubmission preserves verification. Employer and academic decisions store status and review time, with reviewing actors identified in audit events. Audit targets reference heterogeneous resources by ID.

Resume metadata carries a random private object key. A partial unique index allows one active version per student. Deletion timestamps track denial of future access and physical removal. The independent `DocumentCleanup` table holds object keys awaiting upload compensation. A second partial unique index permits one pending invitation per institution and email. Check constraints guard lifecycle combinations and numeric limits.
