import { useEffect, useMemo, useState } from "react";
import {
  createWorkspaceItem,
  deleteWorkspaceItem,
  getWorkspaceItems,
  updateWorkspaceItem,
} from "../api/workspaceApi";
import { getProjects } from "../api/projectsApi";
import "./CommandsPage.css";

const MODULE_NAME = "commands";

const categoryOptions = [
  { value: "backend", label: "Backend", icon: "BE" },
  { value: "frontend", label: "Frontend", icon: "FE" },
  { value: "git", label: "Git", icon: "GT" },
  { value: "database", label: "Database", icon: "DB" },
  { value: "api", label: "API / Postman", icon: "API" },
  { value: "colab", label: "Colab / AI", icon: "AI" },
  { value: "workflow", label: "Quy trình nhiều bước", icon: "WF" },
  { value: "fix", label: "Sửa lỗi thường gặp", icon: "FX" },
  { value: "tool", label: "Công cụ khác", icon: "TL" },
];

const riskOptions = [
  {
    value: "low",
    label: "An toàn",
    hint: "Lệnh chỉ đọc, chạy app hoặc thao tác ít rủi ro.",
  },
  {
    value: "medium",
    label: "Cần chú ý",
    hint: "Lệnh có thể thay đổi file, package, môi trường hoặc trạng thái dự án.",
  },
  {
    value: "high",
    label: "Nguy hiểm",
    hint: "Có thể xóa dữ liệu, mất code, kill process hoặc reset thay đổi.",
  },
];

const statusOptions = [
  { value: "active", label: "Đang dùng" },
  { value: "pinned", label: "Đã ghim" },
  { value: "archived", label: "Lưu trữ" },
  { value: "deprecated", label: "Không nên dùng" },
];

const sortOptions = [
  { value: "pinned_first", label: "Ghim và rủi ro trước" },
  { value: "updated_desc", label: "Mới cập nhật" },
  { value: "title_asc", label: "Tên A-Z" },
  { value: "risk_desc", label: "Rủi ro cao trước" },
  { value: "category", label: "Theo nhóm công cụ" },
];

const initialForm = {
  title: "",
  category: "backend",
  status: "active",
  priority: "low",
  subject: "",
  project_name: "",
  file_path: "",
  url: "",
  tags: "",
  command: "",
  usage: "",
  errorSymptoms: "",
  cause: "",
  fix: "",
  note: "",
  steps: [{ title: "", command: "", note: "" }],
};

const commandTemplates = [
  {
    name: "Chạy backend FastAPI",
    description: "Mẫu cơ bản để khởi động API local.",
    form: {
      title: "Chạy backend FastAPI",
      category: "backend",
      subject: "FastAPI / Uvicorn",
      priority: "low",
      file_path: "E:\\Projects\\personal-life-app\\backend",
      command: "uvicorn app.main:app --reload",
      usage: "Dùng khi cần chạy server API ở cổng 8000.",
      note: "Mở CMD/PowerShell tại thư mục backend rồi chạy lệnh này.",
      tags: "#backend #fastapi #uvicorn #localhost8000",
    },
  },
  {
    name: "Chạy frontend Vite",
    description: "Mở giao diện React ở localhost:5173.",
    form: {
      title: "Chạy frontend Vite",
      category: "frontend",
      subject: "React / Vite",
      priority: "low",
      file_path: "E:\\Projects\\personal-life-app\\frontend",
      command: "npm run dev",
      usage: "Dùng khi cần mở giao diện web của app.",
      fix: "Nếu báo thiếu package, chạy npm install trước rồi chạy lại npm run dev.",
      tags: "#frontend #vite #react #localhost5173",
    },
  },
  {
    name: "Khởi động toàn bộ dự án",
    description: "Checklist nhiều bước cho backend + frontend.",
    form: {
      title: "Khởi động personal-life-app",
      category: "workflow",
      subject: "FastAPI + React",
      priority: "low",
      project_name: "personal-life-app",
      usage: "Dùng khi bắt đầu làm việc với dự án cá nhân.",
      command: "Chạy backend và frontend ở hai cửa sổ terminal riêng.",
      steps: [
        {
          title: "Mở backend",
          command: "cd E:\\Projects\\personal-life-app\\backend",
          note: "Đứng đúng thư mục backend trước khi chạy API.",
        },
        {
          title: "Chạy backend",
          command: "uvicorn app.main:app --reload",
          note: "API chạy ở http://127.0.0.1:8000.",
        },
        {
          title: "Mở frontend",
          command: "cd E:\\Projects\\personal-life-app\\frontend",
          note: "Mở thêm một cửa sổ terminal khác.",
        },
        {
          title: "Chạy frontend",
          command: "npm run dev",
          note: "Giao diện chạy ở http://localhost:5173.",
        },
      ],
      tags: "#workflow #personal-life-app #backend #frontend",
    },
  },
  {
    name: "Commit Git nhanh",
    description: "Quy trình commit code cơ bản.",
    form: {
      title: "Commit thay đổi lên Git",
      category: "git",
      subject: "Git",
      priority: "medium",
      command: "git status\ngit add .\ngit commit -m \"update feature\"\ngit push",
      usage: "Dùng sau khi đã kiểm tra code và muốn lưu thay đổi.",
      note: "Không commit node_modules, file .env hoặc dữ liệu nhạy cảm.",
      tags: "#git #commit #push",
    },
  },
  {
    name: "Port 8000 bị chiếm",
    description: "Tìm và tắt process đang chiếm cổng backend.",
    form: {
      title: "Sửa lỗi port 8000 bị chiếm",
      category: "fix",
      subject: "Windows / CMD",
      priority: "high",
      command: "netstat -ano | findstr :8000\ntaskkill /PID <PID> /F",
      usage: "Dùng khi FastAPI không chạy được vì cổng 8000 đang bị chiếm.",
      errorSymptoms: "Uvicorn báo address already in use hoặc không bind được cổng 8000.",
      cause: "Một tiến trình backend cũ vẫn đang chạy.",
      fix: "Tìm PID bằng netstat, sau đó taskkill đúng PID. Kiểm tra kỹ trước khi tắt process.",
      tags: "#fix #port8000 #windows #fastapi",
    },
  },
  {
    name: "Sửa lỗi node_modules",
    description: "Cài lại package frontend khi Vite lỗi dependency.",
    form: {
      title: "Sửa lỗi frontend thiếu package",
      category: "fix",
      subject: "Node / npm / Vite",
      priority: "medium",
      file_path: "E:\\Projects\\personal-life-app\\frontend",
      command: "npm install\nnpm run dev",
      usage: "Dùng khi npm run dev báo thiếu package hoặc node_modules không khớp môi trường.",
      errorSymptoms: "Cannot find module, thiếu native binding, Vite không khởi động.",
      cause: "node_modules bị thiếu, bị copy từ môi trường khác hoặc package-lock chưa được cài lại.",
      fix: "Chạy npm install trong thư mục frontend. Nếu vẫn lỗi, xóa node_modules rồi cài lại.",
      tags: "#fix #npm #vite #node_modules",
    },
  },
  {
    name: "Gọi API nhanh",
    description: "Mẫu lưu endpoint để test bằng Postman/curl.",
    form: {
      title: "Test API danh sách deadline",
      category: "api",
      subject: "FastAPI / Postman",
      priority: "low",
      url: "http://127.0.0.1:8000/deadlines/",
      command: "GET http://127.0.0.1:8000/deadlines/",
      usage: "Dùng để kiểm tra backend deadline có trả dữ liệu không.",
      tags: "#api #postman #deadline #get",
    },
  },
];

function getCategoryMeta(value) {
  return categoryOptions.find((option) => option.value === value) || categoryOptions[8];
}

function getRiskMeta(value) {
  return riskOptions.find((option) => option.value === value) || riskOptions[1];
}

function getStatusMeta(value) {
  return statusOptions.find((option) => option.value === value) || statusOptions[0];
}

function formatDate(value) {
  if (!value) return "Chưa có";

  try {
    return new Date(value).toLocaleDateString("vi-VN");
  } catch {
    return "Chưa có";
  }
}

function parseCommandContent(rawContent) {
  if (!rawContent) {
    return {
      command: "",
      steps: [],
      usage: "",
      errorSymptoms: "",
      cause: "",
      fix: "",
      note: "",
    };
  }

  try {
    const parsed = JSON.parse(rawContent);

    if (parsed && typeof parsed === "object") {
      return {
        command: parsed.command || "",
        steps: Array.isArray(parsed.steps) ? parsed.steps : [],
        usage: parsed.usage || "",
        errorSymptoms: parsed.errorSymptoms || "",
        cause: parsed.cause || "",
        fix: parsed.fix || "",
        note: parsed.note || parsed.notes || "",
      };
    }
  } catch {
    // Dữ liệu cũ có thể chỉ là ghi chú thường, giữ lại để không mất nội dung.
  }

  return {
    command: "",
    steps: [],
    usage: "",
    errorSymptoms: "",
    cause: "",
    fix: "",
    note: rawContent,
  };
}

function normalizeItem(item) {
  const detail = parseCommandContent(item.content);

  return {
    ...item,
    category: item.category || "tool",
    status: item.status || "active",
    priority: item.priority || "medium",
    subject: item.subject || "",
    project_name: item.project_name || "",
    file_path: item.file_path || "",
    url: item.url || "",
    tags: item.tags || "",
    detail,
  };
}

function buildContent(form) {
  const normalizedSteps = form.steps
    .map((step) => ({
      title: step.title.trim(),
      command: step.command.trim(),
      note: step.note.trim(),
    }))
    .filter((step) => step.title || step.command || step.note);

  return JSON.stringify(
    {
      command: form.command.trim(),
      steps: normalizedSteps,
      usage: form.usage.trim(),
      errorSymptoms: form.errorSymptoms.trim(),
      cause: form.cause.trim(),
      fix: form.fix.trim(),
      note: form.note.trim(),
    },
    null,
    2
  );
}

function buildPayloadFromItem(item, overrides = {}) {
  return {
    module: MODULE_NAME,
    title: item.title,
    category: item.category,
    status: item.status,
    priority: item.priority,
    subject: item.subject,
    project_name: item.project_name,
    target_date: item.target_date || null,
    file_path: item.file_path,
    url: item.url,
    tags: item.tags,
    content: item.content,
    ...overrides,
  };
}

function makeSearchText(item) {
  const detail = item.detail || parseCommandContent(item.content);
  const stepsText = (detail.steps || [])
    .map((step) => `${step.title || ""} ${step.command || ""} ${step.note || ""}`)
    .join(" ");

  return [
    item.title,
    item.category,
    item.status,
    item.priority,
    item.subject,
    item.project_name,
    item.file_path,
    item.url,
    item.tags,
    detail.command,
    detail.usage,
    detail.errorSymptoms,
    detail.cause,
    detail.fix,
    detail.note,
    stepsText,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function commandTextForCopy(item) {
  const detail = item.detail || parseCommandContent(item.content);

  if (detail.steps?.length) {
    return detail.steps
      .map((step, index) => {
        const title = step.title ? `# Bước ${index + 1}: ${step.title}` : `# Bước ${index + 1}`;
        const command = step.command || "";
        const note = step.note ? `# ${step.note}` : "";
        return [title, command, note].filter(Boolean).join("\n");
      })
      .join("\n\n");
  }

  return detail.command || item.url || item.file_path || item.title;
}

function CommandsPage() {
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [sortBy, setSortBy] = useState("pinned_first");
  const [copiedKey, setCopiedKey] = useState("");

  async function loadItems(preferredSelectedId = null) {
    try {
      setLoading(true);
      const data = await getWorkspaceItems(MODULE_NAME);
      const normalized = data.map(normalizeItem);
      setItems(normalized);

      const nextSelectedId =
        preferredSelectedId ?? selectedId ?? (normalized.length > 0 ? normalized[0].id : null);
      const stillExists = normalized.some((item) => item.id === nextSelectedId);
      setSelectedId(stillExists ? nextSelectedId : normalized[0]?.id ?? null);
    } catch (error) {
      console.error(error);
      alert("Không tải được danh sách lệnh thường dùng.");
    } finally {
      setLoading(false);
    }
  }

  async function loadProjects() {
    try {
      const data = await getProjects();
      setProjects(data || []);
    } catch (error) {
      console.warn("Không tải được dự án liên kết:", error);
      setProjects([]);
    }
  }

  useEffect(() => {
    loadItems();
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const projectNames = useMemo(() => {
    const fromItems = items.map((item) => item.project_name).filter(Boolean);
    const fromProjects = projects.map((project) => project.name).filter(Boolean);
    return Array.from(new Set([...fromProjects, ...fromItems])).sort((a, b) =>
      a.localeCompare(b, "vi")
    );
  }, [items, projects]);

  const stats = useMemo(() => {
    const activeItems = items.filter((item) => item.status !== "archived");

    return {
      total: items.length,
      active: activeItems.length,
      pinned: items.filter((item) => item.status === "pinned").length,
      fixes: items.filter((item) => item.category === "fix").length,
      workflows: items.filter((item) => item.category === "workflow").length,
      dangerous: items.filter((item) => item.priority === "high").length,
      linkedProjects: new Set(items.map((item) => item.project_name).filter(Boolean)).size,
    };
  }, [items]);

  const categoryCounts = useMemo(() => {
    return items.reduce((accumulator, item) => {
      accumulator[item.category] = (accumulator[item.category] || 0) + 1;
      return accumulator;
    }, {});
  }, [items]);

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    const filtered = items.filter((item) => {
      const matchesKeyword = !keyword || makeSearchText(item).includes(keyword);
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      const matchesRisk = riskFilter === "all" || item.priority === riskFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;
      const matchesProject = projectFilter === "all" || item.project_name === projectFilter;

      return matchesKeyword && matchesCategory && matchesRisk && matchesStatus && matchesProject;
    });

    const riskRank = { high: 3, medium: 2, low: 1 };
    const statusRank = { pinned: 0, active: 1, deprecated: 2, archived: 3 };

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "updated_desc":
          return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
        case "title_asc":
          return a.title.localeCompare(b.title, "vi");
        case "risk_desc":
          return (riskRank[b.priority] || 0) - (riskRank[a.priority] || 0);
        case "category":
          return `${a.category}-${a.title}`.localeCompare(`${b.category}-${b.title}`, "vi");
        case "pinned_first":
        default: {
          const statusDiff = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
          if (statusDiff !== 0) return statusDiff;
          const riskDiff = (riskRank[b.priority] || 0) - (riskRank[a.priority] || 0);
          if (riskDiff !== 0) return riskDiff;
          return a.title.localeCompare(b.title, "vi");
        }
      }
    });
  }, [categoryFilter, items, projectFilter, query, riskFilter, sortBy, statusFilter]);

  const selectedItem = useMemo(() => {
    return items.find((item) => item.id === selectedId) || null;
  }, [items, selectedId]);

  const focusItems = useMemo(() => {
    const riskRank = { high: 3, medium: 2, low: 1 };

    return [...items]
      .sort((a, b) => {
        if (a.status === "pinned" && b.status !== "pinned") return -1;
        if (a.status !== "pinned" && b.status === "pinned") return 1;
        return (riskRank[b.priority] || 0) - (riskRank[a.priority] || 0);
      })
      .slice(0, 4);
  }, [items]);

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function updateStep(index, field, value) {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, [field]: value } : step
      ),
    }));
  }

  function addStep() {
    setForm((current) => ({
      ...current,
      steps: [...current.steps, { title: "", command: "", note: "" }],
    }));
  }

  function removeStep(index) {
    setForm((current) => ({
      ...current,
      steps:
        current.steps.length === 1
          ? [{ title: "", command: "", note: "" }]
          : current.steps.filter((_, stepIndex) => stepIndex !== index),
    }));
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(false);
  }

  function startCreate() {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(true);
  }

  function applyTemplate(template) {
    setForm({
      ...initialForm,
      ...template.form,
      steps: template.form.steps || initialForm.steps,
    });
    setEditingId(null);
    setShowForm(true);
  }

  function handleEdit(item) {
    const detail = item.detail || parseCommandContent(item.content);

    setSelectedId(item.id);
    setEditingId(item.id);
    setShowForm(true);
    setForm({
      title: item.title || "",
      category: item.category || "tool",
      status: item.status || "active",
      priority: item.priority || "medium",
      subject: item.subject || "",
      project_name: item.project_name || "",
      file_path: item.file_path || "",
      url: item.url || "",
      tags: item.tags || "",
      command: detail.command || "",
      usage: detail.usage || "",
      errorSymptoms: detail.errorSymptoms || "",
      cause: detail.cause || "",
      fix: detail.fix || "",
      note: detail.note || "",
      steps: detail.steps?.length ? detail.steps : [{ title: "", command: "", note: "" }],
    });
  }

  function buildPayload() {
    return {
      module: MODULE_NAME,
      title: form.title.trim(),
      category: form.category,
      status: form.status,
      priority: form.priority,
      subject: form.subject.trim() || null,
      project_name: form.project_name.trim() || null,
      target_date: null,
      file_path: form.file_path.trim() || null,
      url: form.url.trim() || null,
      tags: form.tags.trim() || null,
      content: buildContent(form),
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      alert("Vui lòng nhập tiêu đề lệnh.");
      return;
    }

    if (!form.command.trim() && !form.steps.some((step) => step.command.trim()) && !form.fix.trim()) {
      alert("Vui lòng nhập lệnh chính, quy trình bước hoặc cách sửa lỗi.");
      return;
    }

    try {
      const payload = buildPayload();
      let preferredSelectedId = editingId;

      if (editingId) {
        await updateWorkspaceItem(editingId, payload);
      } else {
        const created = await createWorkspaceItem(payload);
        preferredSelectedId = created.id;
      }

      resetForm();
      await loadItems(preferredSelectedId);
    } catch (error) {
      console.error(error);
      alert("Lưu lệnh thất bại.");
    }
  }

  async function handleDelete(itemId) {
    const confirmed = window.confirm("Bạn có chắc muốn xóa mục lệnh này?");
    if (!confirmed) return;

    try {
      await deleteWorkspaceItem(itemId);
      if (editingId === itemId) resetForm();
      await loadItems();
    } catch (error) {
      console.error(error);
      alert("Xóa lệnh thất bại.");
    }
  }

  async function togglePin(item) {
    const nextStatus = item.status === "pinned" ? "active" : "pinned";

    try {
      await updateWorkspaceItem(item.id, buildPayloadFromItem(item, { status: nextStatus }));
      await loadItems(item.id);
    } catch (error) {
      console.error(error);
      alert("Cập nhật trạng thái ghim thất bại.");
    }
  }

  async function markArchived(item) {
    try {
      await updateWorkspaceItem(item.id, buildPayloadFromItem(item, { status: "archived" }));
      await loadItems(item.id);
    } catch (error) {
      console.error(error);
      alert("Lưu trữ lệnh thất bại.");
    }
  }

  async function copyText(text, key) {
    if (!text.trim()) {
      alert("Chưa có nội dung để copy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(""), 1600);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(""), 1600);
    }
  }

  function clearFilters() {
    setQuery("");
    setCategoryFilter("all");
    setRiskFilter("all");
    setStatusFilter("all");
    setProjectFilter("all");
    setSortBy("pinned_first");
  }

  return (
    <div className="commands-page">
      <header className="commands-hero">
        <div>
          <span className="commands-kicker">COMMAND CENTER</span>
          <h2>Lệnh và công cụ thường dùng</h2>
          <p>
            Lưu lệnh chạy dự án, quy trình nhiều bước, API test nhanh và sổ lỗi thường gặp.
            Mục tiêu là mở app lên, copy đúng lệnh, chạy đúng thư mục, không phải nhớ lại từ đầu.
          </p>
        </div>

        <div className="commands-hero-actions">
          <button className="secondary-button" type="button" onClick={() => copyText("cd E:\\Projects\\personal-life-app\\backend\nuvicorn app.main:app --reload", "quick-backend")}>
            {copiedKey === "quick-backend" ? "Đã copy" : "Copy backend"}
          </button>
          <button className="primary-button" type="button" onClick={startCreate}>
            + Thêm lệnh
          </button>
        </div>
      </header>

      <section className="commands-stat-grid">
        <article className="commands-stat-card main">
          <span>Tổng mục lệnh</span>
          <strong>{stats.total}</strong>
          <small>{stats.active} mục đang sử dụng</small>
        </article>
        <article className="commands-stat-card">
          <span>Đã ghim</span>
          <strong>{stats.pinned}</strong>
          <small>Lệnh nên đặt ở đầu bảng</small>
        </article>
        <article className="commands-stat-card warning">
          <span>Sửa lỗi</span>
          <strong>{stats.fixes}</strong>
          <small>Sổ lỗi kỹ thuật thường gặp</small>
        </article>
        <article className="commands-stat-card danger">
          <span>Lệnh rủi ro cao</span>
          <strong>{stats.dangerous}</strong>
          <small>Cần kiểm tra trước khi copy</small>
        </article>
        <article className="commands-stat-card">
          <span>Quy trình</span>
          <strong>{stats.workflows}</strong>
          <small>Các checklist nhiều bước</small>
        </article>
        <article className="commands-stat-card">
          <span>Dự án liên kết</span>
          <strong>{stats.linkedProjects}</strong>
          <small>Lệnh được gắn với project</small>
        </article>
      </section>

      <section className="commands-panel commands-toolbar-panel">
        <div className="commands-toolbar">
          <label className="commands-field search-field">
            <span>Tìm lệnh, lỗi, công cụ</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ví dụ: backend, npm, port 8000, git push, FastAPI..."
            />
          </label>

          <label className="commands-field">
            <span>Nhóm</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">Tất cả nhóm</option>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="commands-field">
            <span>Rủi ro</span>
            <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
              <option value="all">Tất cả mức</option>
              {riskOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="commands-field">
            <span>Trạng thái</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Tất cả trạng thái</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="commands-field">
            <span>Dự án</span>
            <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
              <option value="all">Tất cả dự án</option>
              {projectNames.map((projectName) => (
                <option key={projectName} value={projectName}>
                  {projectName}
                </option>
              ))}
            </select>
          </label>

          <label className="commands-field">
            <span>Sắp xếp</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="commands-toolbar-footer">
          <p>
            Đang hiển thị <strong>{filteredItems.length}</strong> / {items.length} mục.
          </p>
          <button className="text-button" type="button" onClick={clearFilters}>
            Xóa bộ lọc
          </button>
        </div>
      </section>

      <section className="commands-template-strip">
        <div>
          <h3>Mẫu tạo nhanh</h3>
          <p>Chọn mẫu, sửa lại theo máy của bạn, rồi lưu vào sổ lệnh.</p>
        </div>

        <div className="commands-template-list">
          {commandTemplates.map((template) => (
            <button key={template.name} type="button" onClick={() => applyTemplate(template)}>
              <strong>{template.name}</strong>
              <span>{template.description}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="commands-layout">
        <aside className="commands-sidebar-panel commands-panel">
          <h3>Nhóm lệnh</h3>
          <button
            className={categoryFilter === "all" ? "category-filter active" : "category-filter"}
            type="button"
            onClick={() => setCategoryFilter("all")}
          >
            <span className="category-icon">ALL</span>
            <span>Tất cả</span>
            <strong>{items.length}</strong>
          </button>

          {categoryOptions.map((category) => (
            <button
              key={category.value}
              className={categoryFilter === category.value ? "category-filter active" : "category-filter"}
              type="button"
              onClick={() => setCategoryFilter(category.value)}
            >
              <span className="category-icon">{category.icon}</span>
              <span>{category.label}</span>
              <strong>{categoryCounts[category.value] || 0}</strong>
            </button>
          ))}
        </aside>

        <main className="commands-main-panel commands-panel">
          <div className="commands-panel-heading">
            <div>
              <h3>Bảng lệnh thao tác nhanh</h3>
              <p>Bấm vào card để xem chi tiết. Bấm Copy để lấy lệnh ngay.</p>
            </div>
          </div>

          {loading ? (
            <p className="commands-empty">Đang tải danh sách lệnh...</p>
          ) : filteredItems.length === 0 ? (
            <div className="commands-empty-state">
              <h4>Chưa có lệnh phù hợp</h4>
              <p>Hãy đổi bộ lọc hoặc tạo lệnh mới từ mẫu phía trên.</p>
              <button className="secondary-button" type="button" onClick={startCreate}>
                Thêm lệnh mới
              </button>
            </div>
          ) : (
            <div className="command-card-list">
              {filteredItems.map((item) => {
                const category = getCategoryMeta(item.category);
                const risk = getRiskMeta(item.priority);
                const status = getStatusMeta(item.status);
                const copyTextContent = commandTextForCopy(item);
                const isActive = selectedId === item.id;
                const firstLine = copyTextContent.split("\n").find(Boolean) || "Chưa có lệnh chính";

                return (
                  <article
                    key={item.id}
                    className={isActive ? "command-card active" : "command-card"}
                    onClick={() => {
                      setSelectedId(item.id);
                      setShowForm(false);
                      setEditingId(null);
                    }}
                  >
                    <div className="command-card-top">
                      <span className="command-category-icon">{category.icon}</span>
                      <div>
                        <h4>{item.title}</h4>
                        <p>
                          {category.label} · {item.subject || "Chưa có công cụ"}
                          {item.project_name ? ` · ${item.project_name}` : ""}
                        </p>
                      </div>
                    </div>

                    <pre>{firstLine}</pre>

                    <div className="command-card-footer">
                      <div className="command-badges">
                        <span className={`command-risk ${item.priority}`}>{risk.label}</span>
                        <span className={`command-status ${item.status}`}>{status.label}</span>
                      </div>

                      <div className="command-card-actions">
                        <button
                          className="copy-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            copyText(copyTextContent, `copy-${item.id}`);
                          }}
                        >
                          {copiedKey === `copy-${item.id}` ? "Đã copy" : "Copy"}
                        </button>
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            togglePin(item);
                          }}
                        >
                          {item.status === "pinned" ? "Bỏ ghim" : "Ghim"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>

        <aside className="commands-detail-column">
          <section className="commands-panel commands-detail-panel">
            <div className="commands-panel-heading align-top">
              <div>
                <h3>{showForm ? (editingId ? "Cập nhật lệnh" : "Thêm lệnh mới") : "Chi tiết lệnh"}</h3>
                <p>
                  {showForm
                    ? "Lưu đủ ngữ cảnh để lần sau copy là chạy được ngay."
                    : "Kiểm tra thư mục, rủi ro và ghi chú trước khi chạy lệnh."}
                </p>
              </div>

              {!showForm && (
                <button className="icon-button" type="button" onClick={startCreate}>
                  +
                </button>
              )}
            </div>

            {showForm ? (
              <form className="commands-form" onSubmit={handleSubmit}>
                <label className="commands-field">
                  <span>Tiêu đề *</span>
                  <input
                    value={form.title}
                    onChange={(event) => updateField("title", event.target.value)}
                    placeholder="Ví dụ: Chạy backend FastAPI"
                  />
                </label>

                <div className="commands-two-columns">
                  <label className="commands-field">
                    <span>Nhóm</span>
                    <select value={form.category} onChange={(event) => updateField("category", event.target.value)}>
                      {categoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="commands-field">
                    <span>Mức rủi ro</span>
                    <select value={form.priority} onChange={(event) => updateField("priority", event.target.value)}>
                      {riskOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="commands-two-columns">
                  <label className="commands-field">
                    <span>Trạng thái</span>
                    <select value={form.status} onChange={(event) => updateField("status", event.target.value)}>
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="commands-field">
                    <span>Công cụ</span>
                    <input
                      value={form.subject}
                      onChange={(event) => updateField("subject", event.target.value)}
                      placeholder="Ví dụ: FastAPI, Git, npm, Postman"
                    />
                  </label>
                </div>

                <label className="commands-field">
                  <span>Dự án liên kết</span>
                  <input
                    list="command-project-options"
                    value={form.project_name}
                    onChange={(event) => updateField("project_name", event.target.value)}
                    placeholder="Ví dụ: personal-life-app"
                  />
                  <datalist id="command-project-options">
                    {projectNames.map((projectName) => (
                      <option key={projectName} value={projectName} />
                    ))}
                  </datalist>
                </label>

                <label className="commands-field">
                  <span>Thư mục cần đứng</span>
                  <input
                    value={form.file_path}
                    onChange={(event) => updateField("file_path", event.target.value)}
                    placeholder="Ví dụ: E:\\Projects\\personal-life-app\\backend"
                  />
                </label>

                <label className="commands-field">
                  <span>Lệnh chính</span>
                  <textarea
                    value={form.command}
                    onChange={(event) => updateField("command", event.target.value)}
                    placeholder="Dán lệnh CMD, PowerShell, Git, API hoặc Colab vào đây..."
                    rows="5"
                  />
                </label>

                <div className="risk-helper">
                  <strong>{getRiskMeta(form.priority).label}</strong>
                  <span>{getRiskMeta(form.priority).hint}</span>
                </div>

                <div className="commands-steps-editor">
                  <div className="steps-editor-heading">
                    <div>
                      <h4>Quy trình nhiều bước</h4>
                      <p>Dùng khi một việc cần nhiều lệnh theo thứ tự.</p>
                    </div>
                    <button className="secondary-button small" type="button" onClick={addStep}>
                      + Bước
                    </button>
                  </div>

                  {form.steps.map((step, index) => (
                    <div className="step-editor-card" key={`step-${index}`}> 
                      <div className="step-editor-title">
                        <strong>Bước {index + 1}</strong>
                        <button className="text-button danger" type="button" onClick={() => removeStep(index)}>
                          Xóa
                        </button>
                      </div>

                      <label className="commands-field">
                        <span>Tên bước</span>
                        <input
                          value={step.title}
                          onChange={(event) => updateStep(index, "title", event.target.value)}
                          placeholder="Ví dụ: Mở thư mục backend"
                        />
                      </label>

                      <label className="commands-field">
                        <span>Lệnh của bước</span>
                        <textarea
                          value={step.command}
                          onChange={(event) => updateStep(index, "command", event.target.value)}
                          placeholder="cd ... hoặc npm run dev"
                          rows="3"
                        />
                      </label>

                      <label className="commands-field">
                        <span>Ghi chú bước</span>
                        <input
                          value={step.note}
                          onChange={(event) => updateStep(index, "note", event.target.value)}
                          placeholder="Nhắc nhở nhỏ trước khi chạy bước này"
                        />
                      </label>
                    </div>
                  ))}
                </div>

                <label className="commands-field">
                  <span>Khi nào dùng</span>
                  <textarea
                    value={form.usage}
                    onChange={(event) => updateField("usage", event.target.value)}
                    placeholder="Nêu rõ hoàn cảnh dùng lệnh để sau này không chạy nhầm."
                    rows="3"
                  />
                </label>

                <div className="commands-two-columns">
                  <label className="commands-field">
                    <span>Dấu hiệu lỗi</span>
                    <textarea
                      value={form.errorSymptoms}
                      onChange={(event) => updateField("errorSymptoms", event.target.value)}
                      placeholder="Thông báo lỗi, hiện tượng, dấu hiệu nhận biết..."
                      rows="3"
                    />
                  </label>

                  <label className="commands-field">
                    <span>Nguyên nhân</span>
                    <textarea
                      value={form.cause}
                      onChange={(event) => updateField("cause", event.target.value)}
                      placeholder="Vì sao lỗi xảy ra?"
                      rows="3"
                    />
                  </label>
                </div>

                <label className="commands-field">
                  <span>Cách sửa / cảnh báo</span>
                  <textarea
                    value={form.fix}
                    onChange={(event) => updateField("fix", event.target.value)}
                    placeholder="Cách xử lý, cảnh báo backup, điều kiện cần kiểm tra..."
                    rows="4"
                  />
                </label>

                <div className="commands-two-columns">
                  <label className="commands-field">
                    <span>Link tham khảo / API URL</span>
                    <input
                      value={form.url}
                      onChange={(event) => updateField("url", event.target.value)}
                      placeholder="http://127.0.0.1:8000/docs"
                    />
                  </label>

                  <label className="commands-field">
                    <span>Tag</span>
                    <input
                      value={form.tags}
                      onChange={(event) => updateField("tags", event.target.value)}
                      placeholder="#backend #vite #git #fix"
                    />
                  </label>
                </div>

                <label className="commands-field">
                  <span>Ghi chú thêm</span>
                  <textarea
                    value={form.note}
                    onChange={(event) => updateField("note", event.target.value)}
                    placeholder="Kinh nghiệm cá nhân, lưu ý nhỏ, phiên bản công cụ..."
                    rows="3"
                  />
                </label>

                <div className="commands-form-actions">
                  <button className="primary-button" type="submit">
                    {editingId ? "Lưu cập nhật" : "Thêm lệnh"}
                  </button>
                  <button className="secondary-button" type="button" onClick={resetForm}>
                    Hủy
                  </button>
                </div>
              </form>
            ) : selectedItem ? (
              <div className="command-detail-card">
                <div className="command-detail-head">
                  <div>
                    <span className="commands-kicker">{getCategoryMeta(selectedItem.category).label}</span>
                    <h4>{selectedItem.title}</h4>
                    <p>
                      {selectedItem.subject || "Chưa có công cụ"}
                      {selectedItem.project_name ? ` · ${selectedItem.project_name}` : ""}
                    </p>
                  </div>
                  <span className={`command-risk ${selectedItem.priority}`}>
                    {getRiskMeta(selectedItem.priority).label}
                  </span>
                </div>

                {selectedItem.priority === "high" && (
                  <div className="danger-warning">
                    <strong>Cảnh báo rủi ro cao</strong>
                    <p>Kiểm tra kỹ thư mục, dữ liệu và trạng thái Git trước khi chạy. Với lệnh xóa/reset/kill process, nên backup trước.</p>
                  </div>
                )}

                <div className="command-meta-grid">
                  <article>
                    <span>Trạng thái</span>
                    <strong>{getStatusMeta(selectedItem.status).label}</strong>
                  </article>
                  <article>
                    <span>Cập nhật</span>
                    <strong>{formatDate(selectedItem.updated_at)}</strong>
                  </article>
                  <article>
                    <span>Thư mục</span>
                    <strong>{selectedItem.file_path || "Chưa khai báo"}</strong>
                  </article>
                  <article>
                    <span>Tags</span>
                    <strong>{selectedItem.tags || "Chưa có"}</strong>
                  </article>
                </div>

                {selectedItem.detail.command && (
                  <div className="command-code-block">
                    <div>
                      <span>Lệnh chính</span>
                      <button
                        className="copy-button"
                        type="button"
                        onClick={() => copyText(selectedItem.detail.command, `detail-command-${selectedItem.id}`)}
                      >
                        {copiedKey === `detail-command-${selectedItem.id}` ? "Đã copy" : "Copy lệnh"}
                      </button>
                    </div>
                    <pre>{selectedItem.detail.command}</pre>
                  </div>
                )}

                {selectedItem.detail.steps?.length > 0 && (
                  <div className="command-workflow-block">
                    <div className="workflow-heading">
                      <h4>Quy trình thực hiện</h4>
                      <button
                        className="copy-button"
                        type="button"
                        onClick={() => copyText(commandTextForCopy(selectedItem), `workflow-${selectedItem.id}`)}
                      >
                        {copiedKey === `workflow-${selectedItem.id}` ? "Đã copy" : "Copy toàn bộ"}
                      </button>
                    </div>

                    {selectedItem.detail.steps.map((step, index) => (
                      <article className="workflow-step" key={`${selectedItem.id}-step-${index}`}>
                        <span>{index + 1}</span>
                        <div>
                          <strong>{step.title || `Bước ${index + 1}`}</strong>
                          {step.command && <pre>{step.command}</pre>}
                          {step.note && <p>{step.note}</p>}
                          {step.command && (
                            <button
                              className="text-button"
                              type="button"
                              onClick={() => copyText(step.command, `step-${selectedItem.id}-${index}`)}
                            >
                              {copiedKey === `step-${selectedItem.id}-${index}` ? "Đã copy" : "Copy bước này"}
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                <div className="command-info-sections">
                  {selectedItem.detail.usage && (
                    <article>
                      <span>Khi nào dùng</span>
                      <p>{selectedItem.detail.usage}</p>
                    </article>
                  )}
                  {selectedItem.detail.errorSymptoms && (
                    <article>
                      <span>Dấu hiệu lỗi</span>
                      <p>{selectedItem.detail.errorSymptoms}</p>
                    </article>
                  )}
                  {selectedItem.detail.cause && (
                    <article>
                      <span>Nguyên nhân</span>
                      <p>{selectedItem.detail.cause}</p>
                    </article>
                  )}
                  {selectedItem.detail.fix && (
                    <article>
                      <span>Cách sửa / cảnh báo</span>
                      <p>{selectedItem.detail.fix}</p>
                    </article>
                  )}
                  {selectedItem.detail.note && (
                    <article>
                      <span>Ghi chú</span>
                      <p>{selectedItem.detail.note}</p>
                    </article>
                  )}
                </div>

                {selectedItem.url && (
                  <a className="command-link" href={selectedItem.url} target="_blank" rel="noreferrer">
                    Mở link tham khảo
                  </a>
                )}

                <div className="command-detail-actions">
                  <button
                    className="copy-button"
                    type="button"
                    onClick={() => copyText(commandTextForCopy(selectedItem), `copy-all-${selectedItem.id}`)}
                  >
                    {copiedKey === `copy-all-${selectedItem.id}` ? "Đã copy" : "Copy nội dung"}
                  </button>
                  <button className="edit-button" type="button" onClick={() => handleEdit(selectedItem)}>
                    Sửa
                  </button>
                  <button className="secondary-button" type="button" onClick={() => togglePin(selectedItem)}>
                    {selectedItem.status === "pinned" ? "Bỏ ghim" : "Ghim"}
                  </button>
                  <button className="secondary-button" type="button" onClick={() => markArchived(selectedItem)}>
                    Lưu trữ
                  </button>
                  <button className="danger-button" type="button" onClick={() => handleDelete(selectedItem.id)}>
                    Xóa
                  </button>
                </div>
              </div>
            ) : (
              <div className="commands-empty-state compact">
                <h4>Chưa chọn lệnh nào</h4>
                <p>Chọn một mục trong bảng hoặc tạo lệnh mới.</p>
                <button className="secondary-button" type="button" onClick={startCreate}>
                  Thêm lệnh
                </button>
              </div>
            )}
          </section>

          <section className="commands-panel commands-focus-panel">
            <div className="commands-panel-heading">
              <div>
                <h3>Lệnh nên đặt gần tay</h3>
                <p>Ưu tiên lệnh đã ghim và lệnh có rủi ro cần nhớ.</p>
              </div>
            </div>

            {focusItems.length === 0 ? (
              <p className="commands-empty">Chưa có dữ liệu.</p>
            ) : (
              <div className="focus-command-list">
                {focusItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id);
                      setShowForm(false);
                    }}
                  >
                    <div>
                      <strong>{item.title}</strong>
                      <span>
                        {getCategoryMeta(item.category).label} · {item.project_name || item.subject || "Chưa gắn ngữ cảnh"}
                      </span>
                    </div>
                    <span className={`command-risk ${item.priority}`}>{getRiskMeta(item.priority).label}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

export default CommandsPage;
