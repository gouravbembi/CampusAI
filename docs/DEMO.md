# Development demo accounts

Use fictional addresses and files on a local instance. Local Mailpit accepts outgoing development mail at http://localhost:8025. The application ships without seeded credentials.

Run this after starting the stack and applying migrations:

```bash
read -rsp 'Choose a local password of at least 12 characters: ' campusai_demo_password
printf '\n'
printf '%s\n' "$campusai_demo_password" | docker compose exec -T \
  -e BOOTSTRAP_INSTITUTION_NAME='Northbridge University' \
  -e BOOTSTRAP_INSTITUTION_SLUG=northbridge-demo \
  -e BOOTSTRAP_ADMIN_EMAIL=admin@example.test \
  api npm run bootstrap:admin -w @campusai/api
unset campusai_demo_password
```

For host development, run `npm run bootstrap:admin -w @campusai/api` on the right side of the pipe with the same three environment variables. Use a different slug and email to create a second institution. Bootstrap refuses to overwrite an existing administrator or email.

1. Sign in at http://localhost:5173/login as the administrator. Invite `officer@example.test` as a Placement Officer and `recruiter@example.test` as a Recruiter.
2. Open both messages in Mailpit. Use the invitation links to choose passwords for the new accounts.
3. Sign in as the officer, create a department and degree program, and invite `student@example.test`. Accept the student invitation through Mailpit.
4. As the student, submit profile and academic details. Upload a synthetic PDF or DOCX. As the officer, verify the academic record. A change to an academic fact returns it to pending review.
5. As the recruiter, save a profile and submit an employer. The officer can approve it, and the administrator can manage recruiter assignments for verified employers.
6. Request a password reset from sign-in, follow the Mailpit link, and confirm that the previous session expires.
