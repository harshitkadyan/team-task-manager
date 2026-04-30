const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const initSqlJs = require("sql.js");
const { databaseUrl } = require("./config");

const dataDir = path.join(process.cwd(), ".data");
const sqliteFile = path.join(dataDir, "team-task-manager.sqlite");

let sqlJs;
let sqliteDb;
let pgPool;
let dialect = null;

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return crypto.randomUUID();
}

function ensureSqliteSchema() {
  sqliteDb.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MEMBER')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MEMBER')),
      created_at TEXT NOT NULL,
      UNIQUE(project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('TODO', 'IN_PROGRESS', 'COMPLETED')),
      priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
      due_date TEXT,
      assigned_to TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (assigned_to) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );
  `);

  persistSqlite();
}

function persistSqlite() {
  if (!sqliteDb) return;
  fs.mkdirSync(dataDir, { recursive: true });
  const bytes = sqliteDb.export();
  fs.writeFileSync(sqliteFile, Buffer.from(bytes));
}

function sqliteQueryRows(statement, params = []) {
  const stmt = sqliteDb.prepare(statement);
  stmt.bind(params);
  const rows = [];

  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }

  stmt.free();
  return rows;
}

function sqliteRun(statement, params = []) {
  sqliteDb.run(statement, params);
  persistSqlite();
}

async function initDatabase() {
  if (databaseUrl) {
    dialect = "postgres";
    const isRailway = databaseUrl.includes("railway.app") || !!process.env.RAILWAY_ENVIRONMENT;
    pgPool = new Pool({
      connectionString: databaseUrl,
      ssl: isRailway ? { rejectUnauthorized: false } : false
    });

    await pgPool.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MEMBER')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS project_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('ADMIN', 'MEMBER')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(project_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL CHECK (status IN ('TODO', 'IN_PROGRESS', 'COMPLETED')) DEFAULT 'TODO',
        priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')) DEFAULT 'MEDIUM',
        due_date TIMESTAMPTZ,
        assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
        created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    return;
  }

  dialect = "sqlite";
  sqlJs = await initSqlJs({
    locateFile: (file) => path.join(process.cwd(), "node_modules", "sql.js", "dist", file)
  });

  const fileExists = fs.existsSync(sqliteFile);
  const fileBuffer = fileExists ? fs.readFileSync(sqliteFile) : undefined;
  sqliteDb = fileBuffer ? new sqlJs.Database(fileBuffer) : new sqlJs.Database();
  ensureSqliteSchema();
}

async function countUsers() {
  if (dialect === "postgres") {
    const result = await pgPool.query("SELECT COUNT(*)::int AS total FROM users");
    return result.rows[0].total;
  }

  const rows = sqliteQueryRows("SELECT COUNT(*) AS total FROM users");
  return Number(rows[0].total);
}

async function getUserByEmail(email) {
  if (dialect === "postgres") {
    const result = await pgPool.query("SELECT * FROM users WHERE email = $1", [email]);
    return result.rows[0] || null;
  }

  const rows = sqliteQueryRows("SELECT * FROM users WHERE email = ?", [email]);
  return rows[0] || null;
}

async function getUserById(id) {
  if (dialect === "postgres") {
    const result = await pgPool.query("SELECT id, name, email, role, created_at FROM users WHERE id = $1", [id]);
    return result.rows[0] || null;
  }

  const rows = sqliteQueryRows("SELECT id, name, email, role, created_at FROM users WHERE id = ?", [id]);
  return rows[0] || null;
}

async function listUsers() {
  if (dialect === "postgres") {
    const result = await pgPool.query("SELECT id, name, email, role, created_at FROM users ORDER BY created_at ASC");
    return result.rows;
  }

  return sqliteQueryRows("SELECT id, name, email, role, created_at FROM users ORDER BY created_at ASC");
}

async function createUser({ name, email, passwordHash, role }) {
  if (dialect === "postgres") {
    const result = await pgPool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, email, passwordHash, role]
    );
    return result.rows[0];
  }

  const row = {
    id: newId(),
    name,
    email,
    password_hash: passwordHash,
    role,
    created_at: nowIso()
  };

  sqliteRun(
    `INSERT INTO users (id, name, email, password_hash, role, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [row.id, row.name, row.email, row.password_hash, row.role, row.created_at]
  );

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    created_at: row.created_at
  };
}

async function createProject({ name, description, createdBy }) {
  if (dialect === "postgres") {
    const result = await pgPool.query(
      `INSERT INTO projects (name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, description, createdBy]
    );
    return result.rows[0];
  }

  const row = {
    id: newId(),
    name,
    description,
    created_by: createdBy,
    created_at: nowIso()
  };

  sqliteRun(
    `INSERT INTO projects (id, name, description, created_by, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [row.id, row.name, row.description, row.created_by, row.created_at]
  );

  return row;
}

async function getProjectById(projectId) {
  if (dialect === "postgres") {
    const result = await pgPool.query(
      `SELECT p.*, u.name AS created_by_name
       FROM projects p
       JOIN users u ON u.id = p.created_by
       WHERE p.id = $1`,
      [projectId]
    );
    return result.rows[0] || null;
  }

  const rows = sqliteQueryRows(
    `SELECT p.*, u.name AS created_by_name
     FROM projects p
     JOIN users u ON u.id = p.created_by
     WHERE p.id = ?`,
    [projectId]
  );
  return rows[0] || null;
}

async function getProjectMembership(projectId, userId) {
  if (dialect === "postgres") {
    const result = await pgPool.query(
      `SELECT pm.role
       FROM project_members pm
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [projectId, userId]
    );
    return result.rows[0] || null;
  }

  const rows = sqliteQueryRows(
    "SELECT role FROM project_members WHERE project_id = ? AND user_id = ?",
    [projectId, userId]
  );
  return rows[0] || null;
}

async function addProjectMember({ projectId, userId, role }) {
  if (dialect === "postgres") {
    const result = await pgPool.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id)
       DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [projectId, userId, role]
    );
    return result.rows[0];
  }

  const existing = sqliteQueryRows(
    "SELECT id, created_at FROM project_members WHERE project_id = ? AND user_id = ?",
    [projectId, userId]
  )[0];

  if (existing) {
    sqliteRun("UPDATE project_members SET role = ? WHERE id = ?", [role, existing.id]);
    return { id: existing.id, project_id: projectId, user_id: userId, role, created_at: existing.created_at };
  }

  const row = {
    id: newId(),
    project_id: projectId,
    user_id: userId,
    role,
    created_at: nowIso()
  };

  sqliteRun(
    `INSERT INTO project_members (id, project_id, user_id, role, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [row.id, row.project_id, row.user_id, row.role, row.created_at]
  );
  return row;
}

async function listProjectsForUser(userId, role) {
  if (dialect === "postgres") {
    const result = await pgPool.query(
      `SELECT
         p.id, p.name, p.description, p.created_at,
         u.name AS created_by_name,
         COALESCE(pm.role, CASE WHEN $2 = 'ADMIN' THEN 'ADMIN' ELSE NULL END) AS member_role,
         COUNT(t.id)::int AS task_count
       FROM projects p
       JOIN users u ON u.id = p.created_by
       LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
       LEFT JOIN tasks t ON t.project_id = p.id
       WHERE $2 = 'ADMIN' OR pm.user_id IS NOT NULL
       GROUP BY p.id, u.name, pm.role
       ORDER BY p.created_at DESC`,
      [userId, role]
    );
    return result.rows;
  }

  const accessClause = role === "ADMIN"
    ? "1 = 1"
    : "EXISTS (SELECT 1 FROM project_members pmx WHERE pmx.project_id = p.id AND pmx.user_id = ?)";
  const params = role === "ADMIN" ? [userId] : [userId, userId];

  return sqliteQueryRows(
    `SELECT
       p.id, p.name, p.description, p.created_at,
       u.name AS created_by_name,
       ${role === "ADMIN" ? "'ADMIN'" : "pm.role"} AS member_role,
       COUNT(t.id) AS task_count
     FROM projects p
     JOIN users u ON u.id = p.created_by
     LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
     LEFT JOIN tasks t ON t.project_id = p.id
     WHERE ${accessClause}
     GROUP BY p.id, u.name, pm.role
     ORDER BY p.created_at DESC`,
    params
  ).map((row) => ({ ...row, task_count: Number(row.task_count) }));
}

async function listProjectMembers(projectId) {
  if (dialect === "postgres") {
    const result = await pgPool.query(
      `SELECT
         pm.id, pm.role, pm.created_at,
         u.id AS user_id, u.name, u.email, u.role AS account_role
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1
       ORDER BY pm.created_at ASC`,
      [projectId]
    );
    return result.rows;
  }

  return sqliteQueryRows(
    `SELECT
       pm.id, pm.role, pm.created_at,
       u.id AS user_id, u.name, u.email, u.role AS account_role
     FROM project_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = ?
     ORDER BY pm.created_at ASC`,
    [projectId]
  );
}

async function createTask(task) {
  if (dialect === "postgres") {
    const result = await pgPool.query(
      `INSERT INTO tasks (
         project_id, title, description, assigned_to, status, priority, due_date, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        task.projectId,
        task.title,
        task.description,
        task.assignedTo,
        task.status,
        task.priority,
        task.dueDate,
        task.createdBy
      ]
    );
    return result.rows[0];
  }

  const row = {
    id: newId(),
    project_id: task.projectId,
    title: task.title,
    description: task.description,
    assigned_to: task.assignedTo || null,
    status: task.status,
    priority: task.priority,
    due_date: task.dueDate || null,
    created_by: task.createdBy,
    created_at: nowIso(),
    updated_at: nowIso()
  };

  sqliteRun(
    `INSERT INTO tasks (
       id, project_id, title, description, assigned_to, status, priority, due_date, created_by, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.project_id,
      row.title,
      row.description,
      row.assigned_to,
      row.status,
      row.priority,
      row.due_date,
      row.created_by,
      row.created_at,
      row.updated_at
    ]
  );

  return row;
}

async function getTaskById(taskId) {
  if (dialect === "postgres") {
    const result = await pgPool.query("SELECT * FROM tasks WHERE id = $1", [taskId]);
    return result.rows[0] || null;
  }

  const rows = sqliteQueryRows("SELECT * FROM tasks WHERE id = ?", [taskId]);
  return rows[0] || null;
}

async function updateTask(taskId, next) {
  if (dialect === "postgres") {
    const result = await pgPool.query(
      `UPDATE tasks
       SET title = $2,
           description = $3,
           assigned_to = $4,
           status = $5,
           priority = $6,
           due_date = $7,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [taskId, next.title, next.description, next.assignedTo, next.status, next.priority, next.dueDate]
    );
    return result.rows[0];
  }

  const updatedAt = nowIso();
  sqliteRun(
    `UPDATE tasks
     SET title = ?, description = ?, assigned_to = ?, status = ?, priority = ?, due_date = ?, updated_at = ?
     WHERE id = ?`,
    [next.title, next.description, next.assignedTo, next.status, next.priority, next.dueDate, updatedAt, taskId]
  );
  return getTaskById(taskId);
}

async function listProjectTasks(projectId) {
  if (dialect === "postgres") {
    const result = await pgPool.query(
      `SELECT
         t.*,
         assignee.name AS assignee_name,
         creator.name AS creator_name
       FROM tasks t
       LEFT JOIN users assignee ON assignee.id = t.assigned_to
       JOIN users creator ON creator.id = t.created_by
       WHERE t.project_id = $1
       ORDER BY t.created_at DESC`,
      [projectId]
    );
    return result.rows;
  }

  return sqliteQueryRows(
    `SELECT
       t.*,
       assignee.name AS assignee_name,
       creator.name AS creator_name
     FROM tasks t
     LEFT JOIN users assignee ON assignee.id = t.assigned_to
     JOIN users creator ON creator.id = t.created_by
     WHERE t.project_id = ?
     ORDER BY t.created_at DESC`,
    [projectId]
  );
}

async function getDashboard(userId, role) {
  const projects = await listProjectsForUser(userId, role);
  const projectIds = new Set(projects.map((project) => project.id));

  let allTasks = [];
  if (role === "ADMIN") {
    if (dialect === "postgres") {
      const result = await pgPool.query(
        `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.assigned_to, p.name AS project_name
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
         ORDER BY t.created_at DESC`
      );
      allTasks = result.rows;
    } else {
      allTasks = sqliteQueryRows(
        `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.assigned_to, p.name AS project_name
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
         ORDER BY t.created_at DESC`
      );
    }
  } else if (projectIds.size) {
    if (dialect === "postgres") {
      const result = await pgPool.query(
        `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.assigned_to, p.name AS project_name
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
         LEFT JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = $1
         WHERE pm.user_id IS NOT NULL OR t.assigned_to = $1
         ORDER BY t.created_at DESC`,
        [userId]
      );
      allTasks = result.rows;
    } else {
      const ids = Array.from(projectIds);
      const predicate = ids.map(() => "?").join(", ");
      allTasks = sqliteQueryRows(
        `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.assigned_to, p.name AS project_name
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
         WHERE t.project_id IN (${predicate}) OR t.assigned_to = ?
         ORDER BY t.created_at DESC`,
        [...ids, userId]
      );
    }
  } else if (dialect === "postgres") {
    const result = await pgPool.query(
      `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.assigned_to, p.name AS project_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE t.assigned_to = $1
       ORDER BY t.created_at DESC`,
      [userId]
    );
    allTasks = result.rows;
  }

  const now = Date.now();
  const stats = {
    total_tasks: allTasks.length,
    todo_tasks: allTasks.filter((task) => task.status === "TODO").length,
    in_progress_tasks: allTasks.filter((task) => task.status === "IN_PROGRESS").length,
    completed_tasks: allTasks.filter((task) => task.status === "COMPLETED").length,
    overdue_tasks: allTasks.filter((task) => task.due_date && new Date(task.due_date).getTime() < now && task.status !== "COMPLETED").length
  };

  const myTasks = allTasks
    .filter((task) => task.assigned_to === userId)
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    })
    .slice(0, 8);

  return {
    stats,
    myTasks,
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      created_at: project.created_at,
      task_count: Number(project.task_count)
    }))
  };
}

module.exports = {
  initDatabase,
  countUsers,
  getUserByEmail,
  getUserById,
  listUsers,
  createUser,
  createProject,
  getProjectById,
  getProjectMembership,
  addProjectMember,
  listProjectsForUser,
  listProjectMembers,
  createTask,
  getTaskById,
  updateTask,
  listProjectTasks,
  getDashboard
};
