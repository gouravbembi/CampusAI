# CampusAI engineering rules

- Read the [SRS](docs/SRS.md), [architecture](docs/ARCHITECTURE.md), and [implementation tracker](docs/IMPLEMENTATION_TRACKER.md) before changing a workflow. Update the relevant requirements and tracker entry when scope or behavior changes.
- Keep work in feature branches. Include test evidence and migration implications in review descriptions.
- Keep the public web app, Express API, and FastAPI service independently buildable. Put business policy in its owning API module. Limit the AI service to typed analysis contracts and keep database ownership in the API.
- Enforce authentication, role, institution, and resource scope on the API for every protected operation. UI visibility is a presentation concern. Check denial paths and cross-institution isolation.
- Keep application state and stage changes transactional. Add Prisma migrations alongside schema changes and verify them against PostgreSQL.
- Treat resumes, academic records, and recruiting decisions as sensitive. Use synthetic test fixtures. Keep real candidate data, credentials, resume text, and provider prompts out of source and logs.
- Validate inputs at the boundary, return consistent errors without internals, and keep service credentials out of browser bundles.
- Keep AI output advisory and attributable to the analysis version. Require human decisions and preserve recruiting workflows during AI outages.
- Follow the existing TypeScript and Python tooling. Run the README verification commands and add targeted tests for new behavior.
