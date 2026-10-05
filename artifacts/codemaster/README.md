# CodeMaster

CodeMaster is a competitive-programming practice app with 20 seeded problems, a Monaco editor, isolated Judge0 execution, submissions, account progress, public profiles, a leaderboard, and administrator problem management.

## Services and data

- The web app is the `artifacts/codemaster` artifact and serves the frontend.
- The API is the `artifacts/api-server` service under `/api`.
- User, problem, and submission data use the workspace's provisioned PostgreSQL database with Drizzle. The database schema has been applied in development.
- On API startup, the 20 sample problems are inserted by slug if they are missing. Existing problem edits are preserved.

The original brief mentioned MongoDB Atlas. This workspace did not have an Atlas connection configured, so this implementation uses its provisioned PostgreSQL database instead.

## Runtime configuration

- `SESSION_SECRET` is required by the API and should be set through Replit Secrets.
- `CODEMASTER_ADMIN_EMAIL` is optional. Set it to an administrator's email before that person registers or logs in; matching accounts are granted the admin role.
- `JUDGE0_API_URL` is optional and defaults to `https://ce.judge0.com`.
- `JUDGE0_API_KEY` and `JUDGE0_AUTH_HEADER` are optional for Judge0-compatible endpoints that require authentication. The header defaults to `X-Auth-Token`.

The default public Judge0 CE endpoint works for development and was smoke-tested. For a production deployment, configure a dedicated Judge0-compatible service with its own capacity and access controls.

## Local commands

The workspace workflows run these services:

```sh
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/codemaster run dev
```

The API binds to `PORT`; the web workflow uses the artifact's configured `PORT` and `BASE_PATH`.