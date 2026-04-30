const state = {
  mode: "signup",
  token: localStorage.getItem("ttm_token") || "",
  user: null,
  dashboard: null,
  users: [],
  projects: [],
  activeProjectId: null,
  activeProject: null
};

const authView = document.getElementById("auth-view");
const appView = document.getElementById("app-view");
const authForm = document.getElementById("auth-form");
const authToggle = document.getElementById("auth-toggle");
const authSubmit = document.getElementById("auth-submit");
const authHeading = document.getElementById("auth-heading");
const authSubheading = document.getElementById("auth-subheading");
const nameRow = document.getElementById("name-row");
const welcomeText = document.getElementById("welcome-text");
const roleBadge = document.getElementById("role-badge");
const logoutBtn = document.getElementById("logout-btn");
const statsGrid = document.getElementById("stats-grid");
const myTasks = document.getElementById("my-tasks");
const projectsList = document.getElementById("projects-list");
const projectTitle = document.getElementById("project-title");
const projectDescription = document.getElementById("project-description");
const projectMembers = document.getElementById("project-members");
const projectTasks = document.getElementById("project-tasks");
const projectSummary = document.getElementById("project-summary");
const newProjectBtn = document.getElementById("new-project-btn");
const addMemberBtn = document.getElementById("add-member-btn");
const newTaskBtn = document.getElementById("new-task-btn");
const modal = document.getElementById("modal");
const modalTitle = document.getElementById("modal-title");
const modalForm = document.getElementById("modal-form");
const modalFields = document.getElementById("modal-fields");
const closeModal = document.getElementById("close-modal");
const toast = document.getElementById("toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2600);
}

function setMode(mode) {
  state.mode = mode;
  const isSignup = mode === "signup";
  nameRow.classList.toggle("hidden", !isSignup);
  const nameInput = document.getElementById("name");
  if (nameInput) {
    nameInput.required = isSignup;
  }
  authSubmit.textContent = isSignup ? "Create account" : "Login";
  authToggle.textContent = isSignup ? "Already have an account? Login" : "Need an account? Sign up";
  authHeading.textContent = isSignup ? "Create your workspace account" : "Access your workspace";
  authSubheading.textContent = isSignup
    ? "The first registered account becomes Admin automatically."
    : "Sign in to manage projects, tasks, and team delivery.";
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

function formatDate(date) {
  if (!date) return "No due date";
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function isOverdue(task) {
  return !!task.due_date && new Date(task.due_date) < new Date() && task.status !== "COMPLETED";
}

function getStatusClass(status) {
  return status.toLowerCase().replace("_", "-");
}

function renderEmpty(target, message) {
  target.innerHTML = `<div class="empty">${message}</div>`;
}

function summarizeTasks(tasks) {
  const summary = {
    total: tasks.length,
    completed: 0,
    inProgress: 0,
    overdue: 0
  };

  for (const task of tasks) {
    if (task.status === "COMPLETED") summary.completed += 1;
    if (task.status === "IN_PROGRESS") summary.inProgress += 1;
    if (isOverdue(task)) summary.overdue += 1;
  }

  return summary;
}

function getProjectProgress(projectId) {
  const detail = state.activeProjectId === projectId ? state.activeProject : null;
  if (!detail) return 0;
  const total = detail.tasks.length;
  if (!total) return 0;
  const completed = detail.tasks.filter((task) => task.status === "COMPLETED").length;
  return Math.round((completed / total) * 100);
}

function renderStats() {
  const stats = state.dashboard?.stats;
  if (!stats) return;

  const cards = [
    ["Total Tasks", stats.total_tasks, "Across your accessible workspace"],
    ["To Do", stats.todo_tasks, "Tasks waiting to be started"],
    ["In Progress", stats.in_progress_tasks, "Currently being executed"],
    ["Overdue", stats.overdue_tasks, "Need immediate attention"]
  ];

  statsGrid.innerHTML = cards
    .map(([label, value, copy]) => `
      <article class="stat-card">
        <p class="eyebrow">${label}</p>
        <h3>${value}</h3>
        <p class="subtle">${copy}</p>
      </article>
    `)
    .join("");
}

function renderMyTasks() {
  const tasks = state.dashboard?.myTasks || [];
  if (!tasks.length) {
    return renderEmpty(myTasks, "No tasks are assigned to you yet.");
  }

  myTasks.innerHTML = tasks
    .map((task) => `
      <article class="task-card">
        <div class="task-card-head">
          <div>
            <h4>${task.title}</h4>
            <p class="task-meta-text">${task.project_name}</p>
          </div>
        </div>
        <div class="pill-row">
          <span class="pill ${getStatusClass(task.status)}">${task.status}</span>
          <span class="pill">${task.priority}</span>
          <span class="pill ${isOverdue(task) ? "overdue" : ""}">${formatDate(task.due_date)}</span>
        </div>
      </article>
    `)
    .join("");
}

function renderProjects() {
  if (!state.projects.length) {
    return renderEmpty(projectsList, "No projects yet. Admin can create the first project.");
  }

  projectsList.innerHTML = state.projects
    .map((project) => {
      const progress = project.id === state.activeProjectId ? getProjectProgress(project.id) : 0;
      return `
        <article class="project-card ${project.id === state.activeProjectId ? "active" : ""}" data-project-id="${project.id}">
          <h4>${project.name}</h4>
          <p class="project-description">${project.description || "No project description added."}</p>
          <div class="pill-row">
            <span class="pill">${project.task_count} tasks</span>
            <span class="pill">${project.member_role || "MEMBER"}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${progress}%"></div>
          </div>
        </article>
      `;
    })
    .join("");

  projectsList.querySelectorAll("[data-project-id]").forEach((node) => {
    node.addEventListener("click", () => loadProject(node.dataset.projectId));
  });
}

function renderProjectSummary() {
  if (!state.activeProject) {
    projectSummary.innerHTML = "";
    return;
  }

  const summary = summarizeTasks(state.activeProject.tasks);
  const completionRate = summary.total ? Math.round((summary.completed / summary.total) * 100) : 0;
  const cards = [
    ["Members", state.activeProject.members.length],
    ["Tasks", summary.total],
    ["Completion", `${completionRate}%`],
    ["Overdue", summary.overdue]
  ];

  projectSummary.innerHTML = cards
    .map(([label, value]) => `
      <article class="summary-card">
        <p class="eyebrow">${label}</p>
        <div class="summary-value">${value}</div>
      </article>
    `)
    .join("");
}

function renderProjectMembers() {
  if (!state.activeProject?.members.length) {
    return renderEmpty(projectMembers, "No members assigned to this project.");
  }

  projectMembers.innerHTML = state.activeProject.members
    .map((member) => `
      <article class="member-card">
        <h4>${member.name}</h4>
        <div class="member-meta">
          <span class="pill">${member.role}</span>
          <span class="pill">${member.email}</span>
        </div>
      </article>
    `)
    .join("");
}

function renderTaskAction(task) {
  const canUpdate = state.user.role === "ADMIN" || task.assigned_to === state.user.id;
  if (!canUpdate) return "";

  const options = ["TODO", "IN_PROGRESS", "COMPLETED"]
    .map((status) => `<option value="${status}" ${status === task.status ? "selected" : ""}>${status}</option>`)
    .join("");

  return `<select data-task-id="${task.id}" data-task-status>${options}</select>`;
}

function renderProjectTasks() {
  if (!state.activeProject?.tasks.length) {
    return renderEmpty(projectTasks, "No tasks created for this project.");
  }

  projectTasks.innerHTML = state.activeProject.tasks
    .map((task) => `
      <article class="task-card">
        <div class="task-card-head">
          <div>
            <h4>${task.title}</h4>
            <p class="task-meta-text">${task.assignee_name || "Unassigned"} · ${formatDate(task.due_date)}</p>
          </div>
          ${renderTaskAction(task)}
        </div>
        <p class="task-desc">${task.description || "No task description added."}</p>
        <div class="pill-row">
          <span class="pill ${getStatusClass(task.status)}">${task.status}</span>
          <span class="pill">${task.priority}</span>
          <span class="pill ${isOverdue(task) ? "overdue" : ""}">${isOverdue(task) ? "Overdue" : "On Track"}</span>
        </div>
      </article>
    `)
    .join("");

  document.querySelectorAll("[data-task-status]").forEach((select) => {
    select.addEventListener("change", async (event) => {
      const taskId = event.target.dataset.taskId;
      try {
        await api(`/api/tasks/${taskId}`, {
          method: "PATCH",
          body: JSON.stringify({ status: event.target.value })
        });
        showToast("Task status updated.");
        await refreshData();
      } catch (error) {
        showToast(error.message);
      }
    });
  });
}

function renderProjectDetail() {
  if (!state.activeProject) {
    projectTitle.textContent = "Select a project";
    projectDescription.textContent = "Choose any project to review members, progress, and tasks.";
    addMemberBtn.classList.add("hidden");
    newTaskBtn.classList.add("hidden");
    renderProjectSummary();
    renderEmpty(projectMembers, "No project selected.");
    renderEmpty(projectTasks, "No project selected.");
    return;
  }

  projectTitle.textContent = state.activeProject.project.name;
  projectDescription.textContent = state.activeProject.project.description || "No project description added.";
  const canManage = state.user.role === "ADMIN";
  addMemberBtn.classList.toggle("hidden", !canManage);
  newTaskBtn.classList.toggle("hidden", !canManage);
  renderProjectSummary();
  renderProjectMembers();
  renderProjectTasks();
}

function openModal(title, fields, onSubmit) {
  modalTitle.textContent = title;
  modalFields.innerHTML = fields;
  modal.showModal();

  modalForm.onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(modalForm);
    try {
      await onSubmit(form);
      modal.close();
      modalForm.reset();
      await refreshData();
      showToast(`${title} completed successfully.`);
    } catch (error) {
      showToast(error.message);
    }
  };
}

async function refreshData() {
  const [meData, dashboardData, projectData] = await Promise.all([
    api("/api/auth/me"),
    api("/api/dashboard"),
    api("/api/projects")
  ]);

  state.user = meData.user;
  state.dashboard = dashboardData;
  state.projects = projectData.projects;

  if (state.user.role === "ADMIN") {
    const userData = await api("/api/users");
    state.users = userData.users;
  } else {
    state.users = [];
  }

  if (!state.activeProjectId && state.projects.length) {
    state.activeProjectId = state.projects[0].id;
  }

  if (state.activeProjectId) {
    try {
      state.activeProject = await api(`/api/projects/${state.activeProjectId}`);
    } catch (_error) {
      state.activeProject = null;
      state.activeProjectId = state.projects[0]?.id || null;
      if (state.activeProjectId) {
        state.activeProject = await api(`/api/projects/${state.activeProjectId}`);
      }
    }
  }

  welcomeText.textContent = `Welcome back, ${state.user.name}`;
  roleBadge.textContent = state.user.role;
  newProjectBtn.classList.toggle("hidden", state.user.role !== "ADMIN");
  renderStats();
  renderMyTasks();
  renderProjects();
  renderProjectDetail();
}

async function loadProject(projectId) {
  state.activeProjectId = projectId;
  state.activeProject = await api(`/api/projects/${projectId}`);
  renderProjects();
  renderProjectDetail();
}

function showApp() {
  authView.classList.add("hidden");
  appView.classList.remove("hidden");
}

function showAuth() {
  appView.classList.add("hidden");
  authView.classList.remove("hidden");
}

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(authForm);
  const payload = {
    email: form.get("email"),
    password: form.get("password")
  };

  if (state.mode === "signup") {
    payload.name = form.get("name");
  }

  try {
    const data = await api(`/api/auth/${state.mode}`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    state.token = data.token;
    localStorage.setItem("ttm_token", data.token);
    await refreshData();
    showApp();
    showToast(state.mode === "signup" ? "Account created successfully." : "Logged in successfully.");
  } catch (error) {
    showToast(error.message);
  }
});

authToggle.addEventListener("click", () => {
  setMode(state.mode === "signup" ? "login" : "signup");
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("ttm_token");
  state.token = "";
  state.user = null;
  state.activeProject = null;
  state.activeProjectId = null;
  showAuth();
  showToast("Logged out.");
});

newProjectBtn.addEventListener("click", () => {
  openModal(
    "Create Project",
    `
      <div class="input-group">
        <label>Name</label>
        <input name="name" placeholder="Client Onboarding Portal" required />
      </div>
      <div class="input-group">
        <label>Description</label>
        <textarea name="description" rows="4" placeholder="Describe the project scope and purpose"></textarea>
      </div>
    `,
    async (form) => {
      await api("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description")
        })
      });
    }
  );
});

addMemberBtn.addEventListener("click", () => {
  const currentMemberIds = new Set((state.activeProject?.members || []).map((member) => member.user_id));
  const candidates = state.users.filter((user) => !currentMemberIds.has(user.id));

  if (!candidates.length) {
    return showToast("All users are already assigned to this project.");
  }

  const options = candidates
    .map((user) => `<option value="${user.id}">${user.name} (${user.email})</option>`)
    .join("");

  openModal(
    "Add Member",
    `
      <div class="input-group">
        <label>User</label>
        <select name="userId" required>${options}</select>
      </div>
      <div class="input-group">
        <label>Project Role</label>
        <select name="role">
          <option value="MEMBER">MEMBER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      </div>
    `,
    async (form) => {
      await api(`/api/projects/${state.activeProjectId}/members`, {
        method: "POST",
        body: JSON.stringify({
          userId: form.get("userId"),
          role: form.get("role")
        })
      });
    }
  );
});

newTaskBtn.addEventListener("click", () => {
  const memberOptions = (state.activeProject?.members || [])
    .map((member) => `<option value="${member.user_id}">${member.name}</option>`)
    .join("");

  openModal(
    "Create Task",
    `
      <div class="input-group">
        <label>Title</label>
        <input name="title" placeholder="Prepare sprint execution plan" required />
      </div>
      <div class="input-group">
        <label>Description</label>
        <textarea name="description" rows="4" placeholder="Add task details and expected outcome"></textarea>
      </div>
      <div class="input-group">
        <label>Assign To</label>
        <select name="assignedTo">
          <option value="">Unassigned</option>
          ${memberOptions}
        </select>
      </div>
      <div class="input-group">
        <label>Status</label>
        <select name="status">
          <option value="TODO">TODO</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="COMPLETED">COMPLETED</option>
        </select>
      </div>
      <div class="input-group">
        <label>Priority</label>
        <select name="priority">
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
        </select>
      </div>
      <div class="input-group">
        <label>Due Date</label>
        <input name="dueDate" type="datetime-local" />
      </div>
    `,
    async (form) => {
      const dueDate = form.get("dueDate");
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          projectId: state.activeProjectId,
          title: form.get("title"),
          description: form.get("description"),
          assignedTo: form.get("assignedTo") || null,
          status: form.get("status"),
          priority: form.get("priority"),
          dueDate: dueDate ? new Date(dueDate).toISOString() : null
        })
      });
    }
  );
});

closeModal.addEventListener("click", () => modal.close());

(async function init() {
  setMode("signup");
  if (!state.token) {
    return showAuth();
  }

  try {
    await refreshData();
    showApp();
  } catch (_error) {
    localStorage.removeItem("ttm_token");
    state.token = "";
    showAuth();
  }
})();
