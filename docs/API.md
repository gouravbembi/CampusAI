# Phase 2 API

The prefix is `/api/v1`. Mutations require the configured Origin and the `X-CampusAI-CSRF: 1` header. Authenticated calls include the session cookie. JSON errors contain `error` and may include invalid field paths. Business responses use `Cache-Control: no-store`.

## Identity routes

| Method and route                        | Input or result                                                   |
| --------------------------------------- | ----------------------------------------------------------------- |
| `POST /auth/invitations/accept`         | `token`, `password`. Existing users enter their current password. |
| `POST /auth/login`                      | `email`, `password`. Returns 204 and a session cookie.            |
| `POST /auth/logout`                     | Revokes the present session and clears the cookie.                |
| `GET /auth/me`                          | Email, verification flag, active institution memberships.         |
| `GET /auth/sessions`                    | Own sessions with ID, creation time, expiry and current flag.     |
| `DELETE /auth/sessions/{sessionId}`     | Revokes own session.                                              |
| `POST /auth/password/reset/request`     | `email`. Generic 202.                                             |
| `POST /auth/password/reset/confirm`     | `token`, `password`. Revokes existing sessions.                   |
| `POST /auth/password/change`            | `currentPassword`, `password`. Requires current session.          |
| `POST /auth/email/verification/request` | Requests a verification email when applicable.                    |
| `POST /auth/email/verification/confirm` | `token`. Confirms ownership.                                      |

## Institution route suffixes

Prepend `/institutions/{institutionId}` using the institution UUID.

| Method and suffix                                         | Input or result                                                                                                                                                |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`, `PATCH` on institution path                        | Read name and slug. Patch accepts `name`.                                                                                                                      |
| `GET /memberships`                                        | Members with roles and access states. Supports `after`.                                                                                                        |
| `PATCH /memberships/{id}`                                 | One or more of `role`, `status`, `accountStatus`.                                                                                                              |
| `GET /invitations`, `POST /invitations`                   | Pending invites, or invite by `email`, `role` and optional verified `employerId`.                                                                              |
| `DELETE /invitations/{id}`                                | Revokes a pending invitation.                                                                                                                                  |
| `GET /audit`                                              | Recent institution events.                                                                                                                                     |
| `GET /departments`                                        | Catalog with degree programs.                                                                                                                                  |
| `POST /departments`, `PATCH /departments/{id}`            | `name`, `code`.                                                                                                                                                |
| `POST /departments/{id}/programs`, `PATCH /programs/{id}` | `name`, `code`.                                                                                                                                                |
| `GET /students/me`, `PUT /students/me`                    | Profile and completeness. Put accepts `fullName`, nullable `phone`, `skills`, `certifications` with name and issuer, and `projects` with name and description. |
| `PUT /students/me/academic`                               | `programId`, `graduationYear`, `cgpa` out of ten, `activeBacklogs`.                                                                                            |
| `GET /academic-records`                                   | Scoped academic review queue. Supports `status` and `after`.                                                                                                   |
| `POST /academic-records/{id}/review`                      | `status` VERIFIED or REJECTED, and reviewed `revision`.                                                                                                        |
| `GET /recruiters/me`, `PUT /recruiters/me`                | Profile and assignments. Put accepts `fullName` and `title`.                                                                                                   |
| `GET /employers`, `POST /employers`                       | Review list with optional `status` and `after`, or submit `name` and nullable HTTP(S) `website`.                                                               |
| `GET /employers/{id}`                                     | Verified employer with an active assignment.                                                                                                                   |
| `POST /employers/{id}/review`                             | `status` VERIFIED or REJECTED, and reviewed `revision`.                                                                                                        |
| `PUT /employers/{id}/assignments/{membershipId}`          | `status` ACTIVE or REVOKED.                                                                                                                                    |
| `GET /resumes`, `POST /resumes`                           | Lists visible versions or accepts one multipart `resume` with a PDF or DOCX up to 5 MiB.                                                                       |
| `GET /resumes/{id}/download`                              | Authorized file attachment.                                                                                                                                    |
| `PATCH /resumes/{id}`                                     | `status` ACTIVE or ARCHIVED.                                                                                                                                   |
| `DELETE /resumes/{id}`                                    | Immediately denies future retrieval. Returns 202 if storage removal is deferred, otherwise 204.                                                                |

Cursor lists return `{ items, next }`. A conflict or stale revision returns 409. Reload the record before retrying. [Permission matrix](PERMISSIONS.md)
