import { useEffect, useMemo, useState } from "react";
import {
  createProject,
  deleteProject,
  getProjects,
  updateProject,
} from "../api/projectsApi";
import "./ProjectsPage.css";

const initialForm = {
  name: "",
  goal: "",
  status: "pending",
  priority: "medium",
  deadline_date: "",
  todo: "",
  current_bug: "",
  solution: "",
  related_files: "",
  note: "",
};

const statusMeta = {
  pending: {
    label: "Chưa làm",
    tone: "neutral",
    progress: 12,
    helper: "Cần xác định bước đầu tiên",
  },
  doing: {
    label: "Đang làm",
    tone: "blue",
    progress: 48,
    helper: "Đang triển khai",
  },
  almost_done: {
    label: "Gần xong",
    tone: "violet",
    progress: 82,
    helper: "Cần chốt và kiểm tra",
  },
  done: {
    label: "Đã xong",
    tone: "green",
    progress: 100,
    helper: "Đã hoàn thành",
  },
};

const priorityMeta = {
  low: { label: "Thấp", weight: 1, tone: "muted" },
  medium: { label: "Trung bình", weight: 2, tone: "amber" },
  high: { label: "Cao", weight: 3, tone: "red" },
};

const statusFilters = [
  { value: "all", label: "Tất cả" },
  { value: "active", label: "Còn làm" },
  { value: "pending", label: "Chưa làm" },
  { value: "doing", label: "Đang làm" },
  { value: "almost_done", label: "Gần xong" },
  { value: "done", label: "Đã xong" },
  { value: "overdue", label: "Quá hạn" },
  { value: "bugs", label: "Có lỗi" },
];

const sortOptions = [
  { value: "urgent", label: "Ưu tiên xử lý" },
  { value: "deadline", label: "Deadline gần nhất" },
  { value: "updated", label: "Mới cập nhật" },
  { value: "name", label: "Tên A-Z" },
];

function formatDate(dateKey) {
  if (!dateKey) {
    return "Chưa đặt";
  }

  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function getDaysUntil(dateKey) {
  if (!dateKey) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadline = new Date(`${dateKey}T00:00:00`);
  deadline.setHours(0, 0, 0, 0);

  return Math.ceil((deadline - today) / 86400000);
}

function getDeadlineMeta(project) {
  if (project.status === "done") {
    return {
      label: "Đã hoàn thành",
      detail: "Không còn áp lực deadline",
      tone: "done",
      rank: 99,
    };
  }

  const daysLeft = getDaysUntil(project.deadline_date);

  if (daysLeft === null) {
    return {
      label: "Chưa có deadline",
      detail: "Nên đặt mốc để dễ kiểm soát",
      tone: "none",
      rank: 70,
    };
  }

  if (daysLeft < 0) {
    return {
      label: `Quá hạn ${Math.abs(daysLeft)} ngày`,
      detail: "Cần xử lý hoặc dời mốc có lý do",
      tone: "overdue",
      rank: 0,
    };
  }

  if (daysLeft === 0) {
    return {
      label: "Đến hạn hôm nay",
      detail: "Nên ưu tiên trong ngày",
      tone: "today",
      rank: 1,
    };
  }

  if (daysLeft <= 3) {
    return {
      label: `Còn ${daysLeft} ngày`,
      detail: "Đang vào vùng cần tập trung",
      tone: "soon",
      rank: 2 + daysLeft,
    };
  }

  return {
    label: `Còn ${daysLeft} ngày`,
    detail: `Deadline ${formatDate(project.deadline_date)}`,
    tone: "safe",
    rank: 10 + daysLeft,
  };
}

function normalizeText(value) {
  return String(value || "")
    .toLocaleLowerCase("vi-VN")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function compactText(value) {
  return String(value || "").trim();
}

function buildSearchText(project) {
  return normalizeText(
    [
      project.name,
      project.goal,
      project.todo,
      project.current_bug,
      project.solution,
      project.related_files,
      project.note,
    ].join(" ")
  );
}

function splitNotes(value) {
  return compactText(value)
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getStatus(project) {
  return statusMeta[project.status] || statusMeta.pending;
}

function getPriority(project) {
  return priorityMeta[project.priority] || priorityMeta.medium;
}

function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("urgent");
  const [showForm, setShowForm] = useState(false);

  async function loadProjects() {
    try {
      setLoading(true);
      const data = await getProjects();
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      alert("Không tải được danh sách dự án.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  const enrichedProjects = useMemo(() => {
    return projects.map((project) => ({
      ...project,
      deadlineMeta: getDeadlineMeta(project),
      searchText: buildSearchText(project),
    }));
  }, [projects]);

  const stats = useMemo(() => {
    const active = enrichedProjects.filter((item) => item.status !== "done");
    const overdue = enrichedProjects.filter(
      (item) => item.deadlineMeta.tone === "overdue"
    );
    const dueSoon = enrichedProjects.filter((item) =>
      ["today", "soon"].includes(item.deadlineMeta.tone)
    );
    const blockers = enrichedProjects.filter((item) =>
      compactText(item.current_bug)
    );
    const highPriority = active.filter((item) => item.priority === "high");

    return {
      total: enrichedProjects.length,
      active: active.length,
      done: enrichedProjects.filter((item) => item.status === "done").length,
      almostDone: enrichedProjects.filter((item) => item.status === "almost_done")
        .length,
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      blockers: blockers.length,
      highPriority: highPriority.length,
    };
  }, [enrichedProjects]);

  const filteredProjects = useMemo(() => {
    const search = normalizeText(query);

    return enrichedProjects
      .filter((project) => {
        const matchesSearch = !search || project.searchText.includes(search);
        const matchesPriority =
          priorityFilter === "all" || project.priority === priorityFilter;
        const matchesStatus =
          statusFilter === "all" ||
          project.status === statusFilter ||
          (statusFilter === "active" && project.status !== "done") ||
          (statusFilter === "overdue" &&
            project.deadlineMeta.tone === "overdue") ||
          (statusFilter === "bugs" && compactText(project.current_bug));

        return matchesSearch && matchesPriority && matchesStatus;
      })
      .sort((first, second) => {
        if (sortBy === "name") {
          return String(first.name || "").localeCompare(second.name || "", "vi");
        }

        if (sortBy === "deadline") {
          return first.deadlineMeta.rank - second.deadlineMeta.rank;
        }

        if (sortBy === "updated") {
          return new Date(second.updated_at || 0) - new Date(first.updated_at || 0);
        }

        const firstScore =
          first.deadlineMeta.rank - getPriority(first).weight * 5;
        const secondScore =
          second.deadlineMeta.rank - getPriority(second).weight * 5;

        return firstScore - secondScore;
      });
  }, [enrichedProjects, priorityFilter, query, sortBy, statusFilter]);

  const focusProject = useMemo(() => {
    return filteredProjects.find((project) => project.status !== "done");
  }, [filteredProjects]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(false);
  }

  function buildPayload() {
    return {
      name: compactText(form.name),
      goal: compactText(form.goal) || null,
      status: form.status || "pending",
      priority: form.priority || "medium",
      deadline_date: form.deadline_date || null,
      todo: compactText(form.todo) || null,
      current_bug: compactText(form.current_bug) || null,
      solution: compactText(form.solution) || null,
      related_files: compactText(form.related_files) || null,
      note: compactText(form.note) || null,
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!compactText(form.name)) {
      alert("Vui lòng nhập tên dự án.");
      return;
    }

    try {
      setSaving(true);
      const payload = buildPayload();

      if (editingId) {
        await updateProject(editingId, payload);
      } else {
        await createProject(payload);
      }

      resetForm();
      await loadProjects();
    } catch (err) {
      console.error(err);
      alert("Lưu dự án thất bại.");
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(project) {
    setEditingId(project.id);
    setShowForm(true);
    setForm({
      name: project.name || "",
      goal: project.goal || "",
      status: project.status || "pending",
      priority: project.priority || "medium",
      deadline_date: project.deadline_date || "",
      todo: project.todo || "",
      current_bug: project.current_bug || "",
      solution: project.solution || "",
      related_files: project.related_files || "",
      note: project.note || "",
    });
  }

  async function handleDelete(projectId) {
    const confirmDelete = window.confirm("Bạn có chắc muốn xóa dự án này?");

    if (!confirmDelete) {
      return;
    }

    try {
      await deleteProject(projectId);
      if (editingId === projectId) {
        resetForm();
      }
      await loadProjects();
    } catch (err) {
      console.error(err);
      alert("Xóa dự án thất bại.");
    }
  }

  async function quickUpdateStatus(project, nextStatus) {
    try {
      await updateProject(project.id, { status: nextStatus });
      await loadProjects();
    } catch (err) {
      console.error(err);
      alert("Cập nhật trạng thái thất bại.");
    }
  }

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setSortBy("urgent");
  }

  function openCreateForm() {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(true);
  }

  return (
    <main className="projects-page">
      <section className="projects-hero">
        <div className="projects-hero-main">
          <span className="projects-kicker">Không gian điều phối</span>
          <h2>Dự án cá nhân</h2>
          <p>
            Quản lý bài báo cáo, code, lỗi đang gặp, kinh nghiệm đã sửa và mốc
            cần hoàn thành trong một màn hình rõ ràng hơn.
          </p>
          <button className="project-create-button" type="button" onClick={openCreateForm}>
            + Thêm dự án
          </button>
        </div>

        <div className="projects-hero-panel">
          <span>Việc nên nhìn trước</span>
          <strong>{focusProject?.name || "Chưa có dự án cần ưu tiên"}</strong>
          <small>
            {focusProject
              ? `${focusProject.deadlineMeta.label} · ${
                  getPriority(focusProject).label
                }`
              : "Khi thêm dự án mới, hệ thống sẽ tự đưa việc quan trọng lên đầu."}
          </small>
        </div>
      </section>

      <section className="project-stats-grid" aria-label="Tổng quan dự án">
        <article className="project-stat-card primary">
          <span>Tổng dự án</span>
          <strong>{stats.total}</strong>
          <small>{stats.active} dự án còn phải theo dõi</small>
        </article>
        <article className="project-stat-card danger">
          <span>Quá hạn</span>
          <strong>{stats.overdue}</strong>
          <small>{stats.dueSoon} dự án sắp đến hạn</small>
        </article>
        <article className="project-stat-card warning">
          <span>Ưu tiên cao</span>
          <strong>{stats.highPriority}</strong>
          <small>Cần tránh để trôi khỏi lịch làm</small>
        </article>
        <article className="project-stat-card success">
          <span>Đã xong</span>
          <strong>{stats.done}</strong>
          <small>{stats.almostDone} dự án gần hoàn thiện</small>
        </article>
        <article className="project-stat-card slate">
          <span>Lỗi đang gặp</span>
          <strong>{stats.blockers}</strong>
          <small>Nên ghi lại cách sửa ngay khi xử lý xong</small>
        </article>
      </section>

      <section className={`projects-workspace ${showForm ? "with-form" : "list-only"}`}>
        {showForm && (
        <aside className="project-form-panel">
          <div className="project-panel-title">
            <div>
              <span>{editingId ? "Đang chỉnh sửa" : "Tạo bản ghi mới"}</span>
              <h3>{editingId ? "Cập nhật dự án" : "Thêm dự án"}</h3>
            </div>
            <button className="ghost-button" type="button" onClick={resetForm}>
              Đóng
            </button>
          </div>

          <form className="project-form" onSubmit={handleSubmit}>
            <label>
              Tên dự án
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Ví dụ: Phần mềm cá nhân"
              />
            </label>

            <label>
              Mục tiêu
              <textarea
                name="goal"
                value={form.goal}
                onChange={handleChange}
                placeholder="Kết quả cuối cùng cần đạt là gì?"
              />
            </label>

            <div className="project-form-grid">
              <label>
                Trạng thái
                <select name="status" value={form.status} onChange={handleChange}>
                  {Object.entries(statusMeta).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Ưu tiên
                <select
                  name="priority"
                  value={form.priority}
                  onChange={handleChange}
                >
                  {Object.entries(priorityMeta).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Deadline dự án
              <input
                type="date"
                name="deadline_date"
                value={form.deadline_date}
                onChange={handleChange}
              />
            </label>

            <label>
              Việc cần làm
              <textarea
                name="todo"
                value={form.todo}
                onChange={handleChange}
                placeholder="Mỗi dòng là một việc còn nợ."
              />
            </label>

            <label>
              Lỗi đang gặp
              <textarea
                name="current_bug"
                value={form.current_bug}
                onChange={handleChange}
                placeholder="Ghi lỗi terminal, lỗi frontend, backend, database..."
              />
            </label>

            <label>
              Cách đã sửa / kinh nghiệm
              <textarea
                name="solution"
                value={form.solution}
                onChange={handleChange}
                placeholder="Sau khi sửa xong, ghi lại cách làm để lần sau khỏi tìm lại."
              />
            </label>

            <label>
              File / link liên quan
              <textarea
                name="related_files"
                value={form.related_files}
                onChange={handleChange}
                placeholder="Đường dẫn code, ảnh lỗi, báo cáo, slide, GitHub..."
              />
            </label>

            <label>
              Ghi chú
              <textarea
                name="note"
                value={form.note}
                onChange={handleChange}
                placeholder="Quyết định kỹ thuật, rủi ro, việc cần kiểm chứng..."
              />
            </label>

            <button className="project-save-button" type="submit" disabled={saving}>
              {saving
                ? "Đang lưu..."
                : editingId
                  ? "Cập nhật dự án"
                  : "Thêm dự án"}
            </button>
          </form>
        </aside>
        )}

        <section className="project-list-panel">
          <div className="project-toolbar">
            <div>
              <span>Danh sách dự án</span>
              <h3>{filteredProjects.length} mục đang hiển thị</h3>
            </div>

            <button className="ghost-button" type="button" onClick={clearFilters}>
              Xóa lọc
            </button>
          </div>

          <div className="project-controls">
            <label>
              Tìm kiếm
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tên, lỗi, file, ghi chú..."
              />
            </label>

            <label>
              Trạng thái
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                {statusFilters.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Ưu tiên
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
              >
                <option value="all">Tất cả</option>
                {Object.entries(priorityMeta).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Sắp xếp
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                {sortOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <div className="project-empty-state">Đang tải dữ liệu...</div>
          ) : filteredProjects.length === 0 ? (
            <div className="project-empty-state">
              Không có dự án phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            <div className="project-card-list">
              {filteredProjects.map((project) => {
                const status = getStatus(project);
                const priority = getPriority(project);
                const todoItems = splitNotes(project.todo);
                const bugItems = splitNotes(project.current_bug);
                const solutionItems = splitNotes(project.solution);

                return (
                  <article
                    className={`project-card deadline-${project.deadlineMeta.tone}`}
                    key={project.id}
                  >
                    <div className="project-card-main">
                      <div className="project-card-topline">
                        <div>
                          <span className={`project-status tone-${status.tone}`}>
                            {status.label}
                          </span>
                          <span className={`project-priority tone-${priority.tone}`}>
                            Ưu tiên {priority.label}
                          </span>
                        </div>
                        <span className={`project-deadline ${project.deadlineMeta.tone}`}>
                          {project.deadlineMeta.label}
                        </span>
                      </div>

                      <h4>{project.name}</h4>
                      <p className="project-goal">
                        {project.goal || "Chưa ghi mục tiêu cụ thể cho dự án này."}
                      </p>

                      <div className="project-progress">
                        <div>
                          <span style={{ width: `${status.progress}%` }} />
                        </div>
                        <small>
                          {status.progress}% · {status.helper}
                        </small>
                      </div>

                      <div className="project-info-grid">
                        <article>
                          <span>Deadline</span>
                          <strong>{formatDate(project.deadline_date)}</strong>
                          <small>{project.deadlineMeta.detail}</small>
                        </article>
                        <article>
                          <span>Cập nhật</span>
                          <strong>{formatDateTime(project.updated_at) || "Chưa rõ"}</strong>
                          <small>Tự lưu theo lần chỉnh sửa gần nhất</small>
                        </article>
                      </div>

                      <div className="project-detail-columns">
                        <section>
                          <h5>Việc cần làm</h5>
                          {todoItems.length > 0 ? (
                            <ul>
                              {todoItems.slice(0, 4).map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            <p>Chưa có checklist.</p>
                          )}
                        </section>

                        <section>
                          <h5>Lỗi / cách sửa</h5>
                          {bugItems.length > 0 || solutionItems.length > 0 ? (
                            <>
                              {bugItems.slice(0, 2).map((item) => (
                                <p className="project-bug" key={item}>
                                  {item}
                                </p>
                              ))}
                              {solutionItems.slice(0, 2).map((item) => (
                                <p className="project-solution" key={item}>
                                  {item}
                                </p>
                              ))}
                            </>
                          ) : (
                            <p>Chưa ghi lỗi hoặc kinh nghiệm sửa.</p>
                          )}
                        </section>
                      </div>

                      {(project.related_files || project.note) && (
                        <div className="project-footnotes">
                          {project.related_files && (
                            <small>File/link: {project.related_files}</small>
                          )}
                          {project.note && <small>Ghi chú: {project.note}</small>}
                        </div>
                      )}
                    </div>

                    <div className="project-card-actions">
                      {project.status !== "done" && (
                        <button
                          type="button"
                          onClick={() => quickUpdateStatus(project, "done")}
                        >
                          Hoàn thành
                        </button>
                      )}
                      {project.status !== "almost_done" && project.status !== "done" && (
                        <button
                          type="button"
                          onClick={() => quickUpdateStatus(project, "almost_done")}
                        >
                          Gần xong
                        </button>
                      )}
                      <button type="button" onClick={() => handleEdit(project)}>
                        Sửa
                      </button>
                      <button
                        className="danger"
                        type="button"
                        onClick={() => handleDelete(project.id)}
                      >
                        Xóa
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

export default ProjectsPage;
