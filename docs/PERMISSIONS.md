# Permission matrix

A valid session, verified active account and active membership are prerequisites for institution access. Requests specify the institution ID. Roles come from the current membership. Unlisted actions are denied.

| Action                                                    | Student | Recruiter                | Placement officer        | Administrator           |
| --------------------------------------------------------- | ------- | ------------------------ | ------------------------ | ----------------------- |
| Read assigned institution and manage own sessions         | Yes     | Yes                      | Yes                      | Yes                     |
| Rename institution and inspect institution audit events   | —       | —                        | —                        | Yes                     |
| Invite or revoke pending student invitations              | —       | —                        | Yes                      | Yes                     |
| Invite or revoke pending recruiter or officer invitations | —       | —                        | —                        | Yes                     |
| Activate, revoke or change a subordinate membership       | —       | —                        | —                        | Scoped institution only |
| Suspend or reactivate a subordinate account               | —       | —                        | —                        | Sole institution only   |
| Read departments and programs                             | Yes     | —                        | Yes                      | Yes                     |
| Create or edit departments and programs                   | —       | —                        | Yes                      | —                       |
| Maintain profile, academic submissions and resumes        | Own     | —                        | —                        | —                       |
| Review or decide on academic facts                        | —       | —                        | Active students in scope | —                       |
| Maintain recruiter profile and submit an employer         | —       | Own                      | —                        | —                       |
| Read employer status                                      | —       | Own assignments          | Scoped list              | Scoped list             |
| Access a verified employer resource                       | —       | Active assigned employer | —                        | —                       |
| Approve or reject an employer                             | —       | —                        | Yes                      | —                       |
| Assign or revoke access to a verified employer            | —       | —                        | —                        | Yes                     |

Administrator provisioning is operator-only. The application cannot grant or revoke administrator memberships. Changing roles revokes employer assignments and sessions. Existing profiles stay linked to their original membership and require the corresponding active role to access. Resume retrieval is owner-only in Phase 2.
