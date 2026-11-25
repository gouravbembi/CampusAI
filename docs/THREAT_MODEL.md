# Phase 2 threat model

The browser, API, PostgreSQL, SMTP service and object storage each cross a trust boundary. Credentials, private resumes, academic facts, access decisions and audit entries are sensitive. Business authorization is owned by the API.

| Threat                               | Current controls                                                                                                                 | Before real-data deployment                                             |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Credential abuse                     | Argon2id, generic errors, IP rate limits, bounded input, digested tokens, HttpOnly cookies                                       | Shared rate limiting, MFA or SSO, security alerting                     |
| Session replay                       | Expiry, rotation on login, user revocation, credential version checks                                                            | Credential row cleanup and monitoring                                   |
| Cross-site and cross-tenant access   | Exact Origin and custom-header checks, credentialed CORS allowlist, database foreign keys, server-side role and ownership checks | Independent review and secure reverse-proxy configuration               |
| Forged academic or employer approval | Officer role, scope, pending status and revision checks, transactional audit                                                     | Institution review policy and reviewer training                         |
| Harmful or public documents          | Private S3, owner-only access, random keys, attachment delivery, bounded format validation and no-store responses                | Quarantine and malware scanning, encryption and tenant retention review |
| Interrupted storage operations       | Durable upload tickets and delete tombstones, compensation, retry command                                                        | Schedule cleanup, monitor failures, test restore and backup retention   |
| Recovery link leakage                | Fragments, single-use TTLs, digested credentials and no token logging                                                            | Durable email delivery and administrator recovery                       |
| Audit exposure                       | Scope enforcement, transactional protected mutations and minimal event metadata                                                  | Write isolation, retention, export controls and alerting                |

Format checks establish structure and basic file invariants. A separate scanner is needed before handling real candidate documents. The API authorizes downloads when they are requested. Previously downloaded copies cannot be recalled. Use TLS for production SMTP and storage and provision a private bucket with least-privilege credentials.
