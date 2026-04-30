# Team Task Manager

Full-stack Team Task Manager built for the assignment using:

- REST APIs
- SQL database: PostgreSQL
- Role-based access control: Admin and Member
- Railway deployment support

## Features

- Signup and login
- Project creation and management
- Team member assignment
- Task creation, assignment, and status tracking
- Dashboard with total tasks, task status counts, and overdue tracking
- Validation for API payloads and task/member relationships

## Tech Stack

- Backend: Node.js + Express
- Database: PostgreSQL
- Validation: Zod
- Auth: JWT + bcrypt
- Frontend: HTML, CSS, JavaScript

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
copy .env.example .env
```

3. Optional for local development: create `.env` if you want to use PostgreSQL locally too.

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/team_task_manager
JWT_SECRET=replace-with-a-secure-secret
PORT=3000
```

4. Run the app:

```bash
npm start
```

The app auto-creates the required SQL tables on startup.

If `DATABASE_URL` is not set, the app uses a local SQL database file for development so the full product works immediately on your machine.

## Railway Deployment

1. Push this project to GitHub.
2. Create a new Railway project.
3. Add a PostgreSQL service in Railway.
4. Add these Railway variables to the web service:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `PORT` is optional because Railway provides it automatically
5. Deploy the repo.

Railway uses `npm start`, which is already configured in [railway.json](./railway.json).

## Role Rules

- First registered user becomes `ADMIN`
- Later users become `MEMBER`
- Admin can create projects, add project members, create tasks, and assign tasks
- Member can view assigned projects and update status on tasks assigned to them
