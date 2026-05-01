======================================================
TEAM TASK MANAGER
======================================================
Live Demo: https://team-task-manager-production-7d4f.up.railway.app/

OVERVIEW
--------
Team Task Manager is a full-stack, secure web application designed to help teams collaborate, organize projects, and track tasks efficiently. 

It features a robust role-based access control (RBAC) system where Admins can manage projects and assign tasks, and Members can view their assignments and update task statuses. The project includes a fully responsive frontend integrated seamlessly with a secure, RESTful Node.js/Express backend and a PostgreSQL database.

KEY FEATURES
------------
- Authentication & Security: Secure Signup/Login using bcrypt for password hashing and JSON Web Tokens (JWT) for session management.
- Role-Based Access Control: The first registered user is automatically assigned the 'ADMIN' role. Subsequent users default to 'MEMBER'.
- Project Management: Admins can create new projects and add team members to them.
- Task Tracking: Admins can assign tasks with deadlines. Members can view and update the status of tasks assigned to them (Pending, In Progress, Completed).
- Interactive Dashboard: Real-time overview with total tasks, status distribution, and overdue task tracking.
- Robust Validation: Strict API payload and relationship validation using Zod to ensure data integrity.

TECHNOLOGY STACK
----------------
- Frontend: HTML5, CSS3, Vanilla JavaScript (DOM Manipulation, Fetch API)
- Backend: Node.js, Express.js
- Database: PostgreSQL (Production), SQLite fallback (Local Development)
- Authentication: JWT, bcrypt
- Validation: Zod

PROJECT SETUP & INSTALLATION
----------------------------
The application is designed to run seamlessly out of the box with zero database configuration required for local testing, gracefully falling back to a local SQLite file if PostgreSQL is not provided.

1. Install Dependencies:
   npm install

2. Configure Environment Variables:
   Copy the contents of .env.example into a new file named .env.
   
   (Optional) If you wish to use PostgreSQL locally:
   DATABASE_URL=postgresql://postgres:password@localhost:5432/team_task_manager
   JWT_SECRET=your-secure-jwt-secret
   PORT=3000

3. Start the Server:
   npm start
   
   Note: The application will automatically initialize the database schema and required tables on startup.

DEPLOYMENT DETAILS (RAILWAY)
----------------------------
This application is fully production-ready. It is currently deployed on Railway with a managed PostgreSQL database. Environment variables are securely managed within the Railway dashboard, and deployment is automated via railway.json.

TESTING INSTRUCTIONS
--------------------
To test the Role-Based Access Control (RBAC):
1. Register a new user - this user will automatically become the 'ADMIN'.
2. Open a new browser window, and register a second user - this user will be a 'MEMBER'.
3. Log in as the Admin to create a project, add the Member to the project, and create a task for them.
4. Log in as the Member to view the assigned task and update its status.

======================================================
Thank you for reviewing my project!
