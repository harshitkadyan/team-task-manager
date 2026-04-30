const express = require("express");
const path = require("path");
const { z } = require("zod");
const { port, publicDir } = require("./config");
const {
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
} = require("./db");
const {
  signupSchema,
  loginSchema,
  hashPassword,
  comparePassword,
  signToken,
  requireAuth,
  requireAdmin
} = require("./auth");

const app = express();

const projectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).default("")
});

const memberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER")
});

const taskCreateSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(2).max(150),
  description: z.string().trim().max(1000).default(""),
  assignedTo: z.string().uuid().nullable().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "COMPLETED"]).default("TODO"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  dueDate: z.string().datetime().nullable().optional()
});

const taskUpdateSchema = z.object({
  title: z.string().trim().min(2).max(150).optional(),
  description: z.string().trim().max(1000).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "COMPLETED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  dueDate: z.string().datetime().nullable().optional()
});

app.use(express.json());
app.use(express.static(publicDir));

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function toUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at
  };
}

async function seedInitialWorkspace(adminUserId) {
  const project = await createProject({
    name: "Client Delivery Command Center",
    description: "Track onboarding, delivery milestones, and execution health for enterprise workstreams.",
    createdBy: adminUserId
  });

  await addProjectMember({
    projectId: project.id,
    userId: adminUserId,
    role: "ADMIN"
  });

  const sampleTasks = [
    {
      title: "Define project charter and delivery scope",
      description: "Document milestones, owners, timeline assumptions, and reporting expectations.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      title: "Prepare stakeholder kickoff agenda",
      description: "Draft the session plan, objectives, attendee list, and communication summary.",
      status: "TODO",
      priority: "MEDIUM",
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      title: "Create weekly risk and dependency tracker",
      description: "Set up a reusable operational view for blockers, ownership, and escalation status.",
      status: "COMPLETED",
      priority: "MEDIUM",
      dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  for (const task of sampleTasks) {
    await createTask({
      projectId: project.id,
      title: task.title,
      description: task.description,
      assignedTo: adminUserId,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      createdBy: adminUserId
    });
  }
}

app.post("/api/auth/signup", asyncHandler(async (req, res) => {
  const payload = signupSchema.parse(req.body);
  const existing = await getUserByEmail(payload.email.toLowerCase());

  if (existing) {
    return res.status(409).json({ message: "Email already registered." });
  }

  const role = (await countUsers()) === 0 ? "ADMIN" : "MEMBER";
  const passwordHash = await hashPassword(payload.password);
  const inserted = await createUser({
    name: payload.name,
    email: payload.email.toLowerCase(),
    passwordHash,
    role
  });
  if (role === "ADMIN") {
    await seedInitialWorkspace(inserted.id);
  }
  const user = toUser(inserted);
  return res.status(201).json({ token: signToken(user), user });
}));

app.post("/api/auth/login", asyncHandler(async (req, res) => {
  const payload = loginSchema.parse(req.body);
  const userRow = await getUserByEmail(payload.email.toLowerCase());

  if (!userRow) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const valid = await comparePassword(payload.password, userRow.password_hash);
  if (!valid) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const user = toUser(userRow);
  return res.json({ token: signToken(user), user });
}));

app.get("/api/auth/me", requireAuth, asyncHandler(async (req, res) => {
  const user = await getUserById(req.user.sub);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }
  return res.json({ user: toUser(user) });
}));

app.get("/api/users", requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  const users = await listUsers();
  return res.json({ users: users.map(toUser) });
}));

app.get("/api/dashboard", requireAuth, asyncHandler(async (req, res) => {
  return res.json(await getDashboard(req.user.sub, req.user.role));
}));

app.get("/api/projects", requireAuth, asyncHandler(async (req, res) => {
  return res.json({ projects: await listProjectsForUser(req.user.sub, req.user.role) });
}));

app.post("/api/projects", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const payload = projectSchema.parse(req.body);
  const project = await createProject({
    name: payload.name,
    description: payload.description,
    createdBy: req.user.sub
  });
  await addProjectMember({ projectId: project.id, userId: req.user.sub, role: "ADMIN" });

  return res.status(201).json({ project });
}));

app.get("/api/projects/:projectId", requireAuth, asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const membership = await getProjectMembership(projectId, req.user.sub);

  if (req.user.role !== "ADMIN" && !membership) {
    return res.status(403).json({ message: "You do not have access to this project." });
  }

  const [project, members, tasks] = await Promise.all([
    getProjectById(projectId),
    listProjectMembers(projectId),
    listProjectTasks(projectId)
  ]);

  if (!project) {
    return res.status(404).json({ message: "Project not found." });
  }

  return res.json({
    project,
    members,
    tasks,
    membershipRole: req.user.role === "ADMIN" ? "ADMIN" : membership.role
  });
}));

app.post("/api/projects/:projectId/members", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const payload = memberSchema.parse(req.body);

  const project = await getProjectById(projectId);
  if (!project) {
    return res.status(404).json({ message: "Project not found." });
  }

  const user = await getUserById(payload.userId);
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }

  return res.status(201).json({
    member: await addProjectMember({ projectId, userId: payload.userId, role: payload.role })
  });
}));

app.post("/api/tasks", requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  const payload = taskCreateSchema.parse(req.body);

  const project = await getProjectById(payload.projectId);
  if (!project) {
    return res.status(404).json({ message: "Project not found." });
  }

  if (payload.assignedTo) {
    const member = await getProjectMembership(payload.projectId, payload.assignedTo);
    if (!member) {
      return res.status(400).json({ message: "Assigned user must belong to the project." });
    }
  }

  return res.status(201).json({
    task: await createTask({
      projectId: payload.projectId,
      title: payload.title,
      description: payload.description,
      assignedTo: payload.assignedTo || null,
      status: payload.status,
      priority: payload.priority,
      dueDate: payload.dueDate || null,
      createdBy: req.user.sub
    })
  });
}));

app.patch("/api/tasks/:taskId", requireAuth, asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const payload = taskUpdateSchema.parse(req.body);

  const task = await getTaskById(taskId);
  if (!task) {
    return res.status(404).json({ message: "Task not found." });
  }
  const membership = await getProjectMembership(task.project_id, req.user.sub);
  const canAdminister = req.user.role === "ADMIN";
  const isAssignedUser = task.assigned_to === req.user.sub;

  if (!canAdminister && !membership && !isAssignedUser) {
    return res.status(403).json({ message: "You cannot update this task." });
  }

  if (!canAdminister) {
    const allowedKeys = Object.keys(payload);
    const onlyStatus = allowedKeys.length === 1 && allowedKeys[0] === "status";
    if (!isAssignedUser || !onlyStatus) {
      return res.status(403).json({ message: "Members can only update status on their assigned tasks." });
    }
  }

  if (payload.assignedTo) {
    const assigneeMembership = await getProjectMembership(task.project_id, payload.assignedTo);
    if (!assigneeMembership) {
      return res.status(400).json({ message: "Assigned user must belong to the project." });
    }
  }

  const next = {
    title: payload.title ?? task.title,
    description: payload.description ?? task.description,
    assignedTo: payload.assignedTo === undefined ? task.assigned_to : payload.assignedTo,
    status: payload.status ?? task.status,
    priority: payload.priority ?? task.priority,
    dueDate: payload.dueDate === undefined ? task.due_date : payload.dueDate
  };

  return res.json({
    task: await updateTask(taskId, next)
  });
}));

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((error, _req, res, _next) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      message: "Validation failed.",
      errors: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message
      }))
    });
  }

  console.error(error);
  return res.status(500).json({ message: "Internal server error." });
});

initDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
