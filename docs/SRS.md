# Software Requirements Specification

CampusAI v0.1 · Phase 1 baseline

## 1. Purpose and scope

CampusAI coordinates institution-approved hiring from drive submission through placement reporting. The first operational MVP supports one pilot institution, with explicit institution scoping in data and access policies. The operational sequence is account onboarding, verified profiles, approved drives, applications, recruiter decisions and placement reporting. A controlled AI pilot follows the core workflow. Phase 1 delivers architecture, tooling, a public landing page, a database migration and service health checks.

Deferred features include native mobile apps, public recruiter signup, job-board aggregation, automated hiring decisions, cross-campus candidate search and public institutional analytics. Multi-institution hosting requires explicit isolation testing and operational sign-off.

## 2. Users and authorization

| Role              | Allowed scope and actions                                                                                                | Access boundary                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Student           | Maintain own profile and resume, view published drives in their institution, apply and track own applications and offers | Own records and institution-published data                                               |
| Recruiter         | Maintain assigned organization postings, submit drives for approval, review and update applicants for assigned drives    | Assigned organizations and drives, application snapshots available to those drives       |
| Placement Officer | Verify academic records, approve drives, manage campus policy, review outcomes and export permitted reports              | Assigned institution, with exports and decisions audited                                 |
| Administrator     | Manage institution settings, memberships and access assignments, and inspect relevant audit events                       | Explicit administrative scope. Candidate document access requires separate authorization |

Roles are institution-scoped memberships. Permissions are default-deny and enforced on the server. A valid role alone does not grant access to any record. Document reads and exports require explicit authorization independent of general page access.

## 3. Functional requirements

| ID  | Requirement                                                                                       | Acceptance condition                                                                                                                               | Phase |
| --- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| F01 | Public overview introduces the platform and four roles.                                           | Users can find the role section using keyboard and touch on mobile and desktop.                                                                    | 1     |
| F02 | Provide Express and FastAPI liveness plus Express readiness.                                      | Liveness responds 200. API readiness responds 503 when PostgreSQL is unreachable and 200 when reachable.                                           | 1     |
| F03 | Authenticate users and administer invitations and memberships.                                    | An expired invite is rejected and a revoked membership loses protected access. Denials cover anonymous, wrong-role and wrong-institution requests. | 2     |
| F04 | Maintain student and recruiter records with verified academic facts and controlled resume access. | Students update their own data. An authorized officer can verify academic fields. Other students cannot read those records or documents.           | 2     |
| F05 | Support employer assignments, placement drives, deadlines and eligibility rules.                  | Assigned recruiters can draft drives. Campus officers approve before publication. Students see only published drives within their institution.     | 3     |
| F06 | Evaluate eligibility and create applications with a timestamped eligibility and resume snapshot.  | Submitting twice creates at most one application. Expired drives and ineligible submissions are rejected with a reason.                            | 3     |
| F07 | Record review, interview, offer, rejection and withdrawal with a stable history.                  | Invalid or stale transitions are rejected. Accepted transitions store the actor, time and reason where policy requires it.                         | 4     |
| F08 | Report institutional outcomes and provide authorized exports.                                     | Reports reconcile to persisted outcomes and exports exclude unauthorized applicant fields.                                                         | 4     |
| F09 | Generate explainable, optional resume-to-role feedback for eligible users.                        | Results record analysis version and evidence. Unavailable or out-of-scope analyses are marked explicitly. Hiring decisions require a human.        | 5     |
| F10 | Retain audit records for protected mutations and record authorized exports.                       | Audit entries contain actor, scope, action, target and timestamp, with no raw resume contents.                                                     | 2–6   |

## 4. Business rules and data

- A drive belongs to one institution and one employer organization. Recruiter membership and drive assignment determine candidate visibility. Officer approval precedes publication.
- Eligibility uses verified academic facts, drive policy and the application deadline in UTC. Version policy so a later edit cannot silently change a past application decision.
- The application lifecycle begins at submitted and can progress through review, interview and offer or rejection under authorized actor rules. The student can withdraw from permitted active states. Record offer acceptance or decline separately from the offer decision. Finalize the transition matrix in Phase 4.
- The MVP data model includes Institution, User, Membership, StudentProfile, Employer, RecruiterAssignment, Drive, EligibilityPolicyVersion, ResumeVersion, Application, StageEvent, OfferOutcome and AuditEvent. Phase 1 persists Institution only. Later document content belongs in private encrypted storage.
- A provider outage or unavailable analysis must leave eligibility, applications and human decisions usable.

## 5. Nonfunctional requirements

| ID  | Requirement and verification                                                                                                                           | Target                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| N01 | Verify keyboard access, focus visibility, semantic markup, text contrast and responsive reflow using automated accessibility checks and manual review. | WCAG 2.2 AA for public and MVP flows                                                  |
| N02 | Test API authorization, resource isolation, secret handling and protected file access. Review CSRF and CORS as part of the selected session design.    | Complete before real candidate data                                                   |
| N03 | Verify concurrent submissions, state transitions and migration behavior with PostgreSQL integration tests.                                             | Database constraints plus transactional writes                                        |
| N04 | Measure API latency in a representative pilot environment.                                                                                             | Provisional p95 under 400 ms for non-upload, non-AI operations at 25 concurrent users |
| N05 | Verify backup restore, readiness and operational alerting before pilot onboarding.                                                                     | Provisional RPO 24 hours, RTO four hours                                              |
| N06 | Establish institution-approved retention, correction and deletion procedures, including document and AI data flows.                                    | Policy sign-off before storing real records                                           |
| N07 | Use timeouts, bounded retries and correlation IDs for external service interactions. Test ordinary workflow availability during AI outages.            | No external AI dependency on application submission                                   |
| N08 | Evaluate analysis quality across representative profiles with permissioned datasets, record model provenance and provide a route for human review.     | Evaluation and institutional sign-off before AI pilot                                 |

## 6. Interfaces and release acceptance

Phase 1 exposes web `/`, Express `GET /health` and `GET /ready`, and FastAPI `GET /health`. Health payloads contain service and status only. Future business APIs use versioned contracts and authenticated JSON. Future private upload and analysis interfaces define file limits, error semantics, provenance and retention before implementation.

Phase 1 acceptance requires reproducible dependency installation, source checks, builds, baseline tests, PostgreSQL migration and a Compose smoke test. Each subsequent phase adds acceptance evidence for its requirements. Institutional policies for eligibility, data retention, identity provider choice and release service levels remain open until the pilot owner confirms them.
