# Team Task Manager

Full-stack Team Task Manager with a static frontend, Node.js/Express API, PostgreSQL database, JWT auth, and role-based Admin/Member access.

## Free Deployment Plan

- Frontend: Vercel Hobby, static hosting from `public/`
- Backend: Render Free Web Service
- Database: Neon Free Postgres

Do not use Render Postgres for the free database if you need it to keep working after 30 days. Render free Postgres databases expire after 30 days, while Neon has a no-time-limit free tier.

## Features

- Signup and login
- First registered user automatically becomes `ADMIN`
- Later users become `MEMBER`
- Project creation and management
- Team member assignment
- Task creation, assignment, and status tracking
- Dashboard with task totals, status counts, and overdue tracking
- REST APIs with validation

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js + Express
- Database: PostgreSQL in production, local SQL file fallback for development
- Validation: Zod
- Auth: JWT + bcrypt

## Local Setup

Install dependencies:

```bash
npm install
```

Copy environment variables:

```bash
copy .env.example .env
```

Run locally:

```bash
npm start
```

The app opens at `http://localhost:3000`. If `DATABASE_URL` is not set, the app uses a local database file under `.data/` for development.

## Backend Deployment: Render

1. Push this repository to GitHub.
2. Create a Neon project and copy the pooled Postgres connection string.
3. In Render, create a new Web Service from this repo.
4. Use these settings:
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `npm start`
   - Plan: Free
   - Health check path: `/api/health`
5. Add these Render environment variables:
   - `DATABASE_URL`: your Neon pooled connection string
   - `JWT_SECRET`: a long random secret
   - `CORS_ORIGIN`: your Vercel frontend URL, for example `https://team-task-manager.vercel.app`

Render can also read `render.yaml`, but `DATABASE_URL` and `CORS_ORIGIN` still need to be filled in from the dashboard because they depend on your deployed URLs.

## Frontend Deployment: Vercel

1. Import the same GitHub repo into Vercel.
2. Use these settings:
   - Framework preset: Other
   - Build command: `npm run build:frontend`
   - Output directory: `public`
3. Add this Vercel environment variable:
   - `VITE_API_BASE_URL`: your Render backend URL, for example `https://team-task-manager-api.onrender.com`
4. Deploy.
5. Copy the final Vercel URL back into Render as `CORS_ORIGIN`, then redeploy the Render service.

`scripts/write-frontend-config.js` writes `public/config.js` during Vercel builds so the static frontend knows where the Render API is hosted.

## Notes

- Render Free Web Services spin down after inactivity, so the first request after a quiet period can be slow.
- Neon Free Postgres has usage limits, but it is not a 30-day trial.
- The frontend and backend are deployable separately, but the backend can still serve the frontend locally for development.
