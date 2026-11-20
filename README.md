# CampusCare — Smart Campus Complaint Management

A responsive campus support app for reporting maintenance issues, routing them with AI-assisted triage, and tracking progress across student, staff, and admin workspaces.

## What’s included

- Student registration and sign-in; students can submit, search, and track their own reports.
- Admin dashboard with campus-wide queues, priority review, and staff assignment.
- Maintenance staff dashboard limited to assigned requests, with status updates.
- Complaint history, in-app latest updates, and 30-second dashboard refresh.
- AI-assisted category and priority suggestions. Local rule-based triage works without an API key; optional OpenAI classification is available by explicit server configuration.
- Responsive React dashboard, Express REST API, MongoDB persistence, password hashing, JWT sessions, role authorization, auth rate limiting, and Helmet security headers.
- Interactive browser-only preview mode with sample accounts when the API/database is unavailable. Preview changes are saved in that browser’s local storage.

## Run locally

Requirements: Node.js 20+ and a running MongoDB 6+ server. MongoDB Compass is the graphical client for connecting to and inspecting MongoDB; Compass itself does not run the database server.

1. In this folder, install dependencies:

   ```powershell
   npm install
   npm install --prefix client
   npm install --prefix server
   ```

2. Open MongoDB Compass and connect to your local MongoDB server with:

   ```powershell
   mongodb://127.0.0.1:27017
   ```

   In Compass, choose **Add new connection**, paste the URI, and click **Connect**. The app creates and uses the `smart-campus` database automatically when seeded.

3. Configure the Express API to use that same MongoDB server:

   ```powershell
   Copy-Item server\.env.example server\.env
   ```

   In `server\.env`, keep `MONGODB_URI=mongodb://127.0.0.1:27017/smart-campus` and set `JWT_SECRET` to a random secret of at least 24 characters. For example, generate one in PowerShell:

   ```powershell
   $bytes = New-Object byte[] 48
   $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
   $rng.GetBytes($bytes)
   [Convert]::ToBase64String($bytes)
   ```

   Copy the generated value after `JWT_SECRET=` in `server\.env`. If your MongoDB server is hosted elsewhere, use its connection string in both Compass and `MONGODB_URI` instead.

4. Create the demo accounts and sample complaints:

   ```powershell
   npm run seed
   ```

5. Start the API and frontend together:

   ```powershell
   npm run dev
   ```

6. Open **http://localhost:5173**. The API runs at **http://localhost:4000**. In Compass, refresh the connection and open `smart-campus` to see the `users` and `complaints` collections after seeding.

If MongoDB or the API is unavailable, the UI opens in preview mode using local sample data. Preview accounts:

| Workspace | Email | Password |
|---|---|---|
| Student | `student@campus.edu` | `Campus123!` |
| Admin | `admin@campus.edu` | `Campus123!` |
| Maintenance staff | `staff@campus.edu` | `Campus123!` |
| Electrical staff | `staff2@campus.edu` | `Campus123!` |

Seeded server accounts use the same credentials. Change these passwords and remove demo data before any shared or production deployment.

## Optional external AI provider

Without additional configuration, complaint triage runs locally in the API and issue text is not sent to an AI provider. To opt in to OpenAI classification, set both `OPENAI_API_KEY` and `ENABLE_EXTERNAL_AI=true` in `server\.env`, then restart the API. When enabled, the complaint title and description are sent to OpenAI’s API for classification. Review your institution’s privacy requirements before enabling this for real student reports.

## Useful commands

- `npm run dev` — start frontend and API in development
- `npm run build` — build the production frontend into `client/dist`
- `npm start` — start the API (configure static hosting or a reverse proxy for the built frontend)
- `npm run seed` — upsert demo users and add sample complaints if none exist

The client uses `http://localhost:4000/api` by default. Set `VITE_API_URL` at client build time if the API is hosted elsewhere. Set `CLIENT_ORIGIN` in the API environment to the hosted frontend origin.
