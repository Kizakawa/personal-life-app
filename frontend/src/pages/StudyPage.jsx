import { useEffect, useMemo, useState } from "react";
import {
  createWorkspaceItem,
  deleteWorkspaceItem,
  getWorkspaceItems,
  updateWorkspaceItem,
} from "../api/workspaceApi";
import { getSubjects } from "../api/subjectsApi";
import { getDeadlines } from "../api/deadlineApi";
import { createFocusSession, getFocusSummary } from "../api/focusApi";
import "./StudyWorkspace.css";

const MODULE = "study";

const initialForm = {
  module: MODULE,
  title: "",
  category: "Ghi chú học tập",
  status: "doing",
  priority: "medium",
  subject: "",
  project_name: "",
  target_date: "",
  file_path: "",
  url: "",
  tags: "",
  content: "",
};

const statusOptions = [
  { value: "active", label: "Đang dùng", tone: "info" },
  { value: "pending", label: "Chưa làm", tone: "neutral" },
  { value: "doing", label: "Đang học", tone: "info" },
  { value: "review", label: "Cần xem lại", tone: "warning" },
  { value: "done", label: "Đã xong", tone: "success" },
];

const priorityOptions = [
  { value: "low", label: "Thấp", tone: "neutral" },
  { value: "medium", label: "Trung bình", tone: "info" },
  { value: "high", label: "Cao", tone: "danger" },
];

const studyTemplates = [
  {
    title: "Ghi chú bài học",
    category: "Ghi chú học tập",
    status: "doing",
    priority: "medium",
    tags: "#note #bai-hoc",
    content: "Ý chính:\n- \n\nPhần chưa hiểu:\n- \n\nViệc cần làm tiếp:\n- ",
  },
  {
    title: "Tài liệu cần đọc",
    category: "Tài liệu",
    status: "pending",
    priority: "medium",
    tags: "#tai-lieu #can-doc",
    content: "Mục tiêu đọc:\n- \n\nTrang / chương quan trọng:\n- \n\nTóm tắt sau khi đọc:\n- ",
  },
  {
    title: "Bài tập / báo cáo",
    category: "Bài tập",
    status: "pending",
    priority: "high",
    tags: "#bai-tap #deadline",
    content: "Yêu cầu:\n- \n\nCách làm dự kiến:\n- \n\nVướng mắc:\n- ",
  },
  {
    title: "Lỗi cần sửa",
    category: "Lỗi / vướng mắc",
    status: "review",
    priority: "high",
    tags: "#loi #can-sua",
    content: "Hiện tượng lỗi:\n- \n\nNguyên nhân nghi ngờ:\n- \n\nCách đã thử:\n- ",
  },
];

function getOption(options, value) {
  return options.find((option) => option.value === value) || options[0];
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return "Chưa đặt";
  return date.toLocaleDateString("vi-VN");
}

function getDaysLeft(value) {
  const date = toDate(value);
  if (!date) return null;
  const today = toDate(todayISO());
  const diff = Math.ceil((date - today) / 86400000);
  return diff;
}

function compactText(value, limit = 130) {
  if (!value) return "Chưa có ghi chú.";
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function formatTimer(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function matchesText(item, keyword) {
  if (!keyword) return true;
  const text = [
    item.title,
    item.category,
    item.status,
    item.priority,
    item.subject,
    item.project_name,
    item.file_path,
    item.url,
    item.tags,
    item.content,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return text.includes(keyword.toLowerCase());
}

function StudyPage() {
  const [items, setItems] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("priority");
  const [focusSummary, setFocusSummary] = useState(null);
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [focusSeconds, setFocusSeconds] = useState(25 * 60);
  const [focusRunning, setFocusRunning] = useState(false);
  const [focusReadyToSave, setFocusReadyToSave] = useState(false);
  const [focusNote, setFocusNote] = useState("");

  async function loadData(preferredSelectedId = null) {
    try {
      setLoading(true);
      setError("");

      const [studyData, subjectData, deadlineData, focusData] = await Promise.all([
        getWorkspaceItems(MODULE),
        getSubjects().catch(() => []),
        getDeadlines().catch(() => []),
        getFocusSummary().catch(() => null),
      ]);

      setItems(studyData);
      setSubjects(subjectData);
      setDeadlines(deadlineData);
      setFocusSummary(focusData);

      const nextSelected = preferredSelectedId ?? selectedId ?? studyData[0]?.id ?? null;
      const stillExists = studyData.some((item) => item.id === nextSelected);
      setSelectedId(stillExists ? nextSelected : studyData[0]?.id ?? null);
    } catch (err) {
      console.error(err);
      setError("Không tải được dữ liệu học tập.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!focusRunning) return undefined;

    const timerId = window.setInterval(() => {
      setFocusSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(timerId);
          setFocusRunning(false);
          setFocusReadyToSave(true);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [focusRunning]);

  useEffect(() => {
    if (!focusRunning && !focusReadyToSave) {
      setFocusSeconds(focusMinutes * 60);
    }
  }, [focusMinutes, focusReadyToSave, focusRunning]);

  const subjectNames = useMemo(() => {
    const names = new Set();
    subjects.forEach((subject) => subject.name && names.add(subject.name));
    items.forEach((item) => item.subject && names.add(item.subject));
    deadlines.forEach((deadline) => deadline.subject && names.add(deadline.subject));
    return Array.from(names).sort((a, b) => a.localeCompare(b, "vi"));
  }, [deadlines, items, subjects]);

  const categories = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort(
      (a, b) => a.localeCompare(b, "vi")
    );
  }, [items]);

  const stats = useMemo(() => {
    const done = items.filter((item) => item.status === "done").length;
    const needsReview = items.filter((item) => item.status === "review").length;
    const highPriority = items.filter((item) => item.priority === "high" && item.status !== "done").length;
    const upcomingDeadlines = deadlines.filter((deadline) => {
      const daysLeft = getDaysLeft(deadline.due_date);
      return deadline.status !== "done" && daysLeft !== null && daysLeft >= 0 && daysLeft <= 14;
    });

    return {
      total: items.length,
      doing: items.filter((item) => item.status === "doing" || item.status === "active").length,
      needsReview,
      done,
      highPriority,
      completion: items.length ? Math.round((done / items.length) * 100) : 0,
      upcomingDeadlines: upcomingDeadlines.length,
    };
  }, [deadlines, items]);

  const filteredItems = useMemo(() => {
    const filtered = items.filter((item) => {
      const okText = matchesText(item, query.trim());
      const okSubject = subjectFilter === "all" || item.subject === subjectFilter;
      const okCategory = categoryFilter === "all" || item.category === categoryFilter;
      const okStatus = statusFilter === "all" || item.status === statusFilter;
      return okText && okSubject && okCategory && okStatus;
    });

    const priorityRank = { high: 0, medium: 1, low: 2 };
    const statusRank = { review: 0, doing: 1, active: 2, pending: 3, done: 4 };

    return [...filtered].sort((a, b) => {
      if (sortBy === "date") {
        return (toDate(a.target_date)?.getTime() || Infinity) - (toDate(b.target_date)?.getTime() || Infinity);
      }

      if (sortBy === "updated") {
        return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
      }

      if (sortBy === "subject") {
        return (a.subject || "").localeCompare(b.subject || "", "vi");
      }

      return (
        (statusRank[a.status] ?? 99) - (statusRank[b.status] ?? 99) ||
        (priorityRank[a.priority] ?? 99) - (priorityRank[b.priority] ?? 99) ||
        (toDate(a.target_date)?.getTime() || Infinity) - (toDate(b.target_date)?.getTime() || Infinity)
      );
    });
  }, [categoryFilter, items, query, sortBy, statusFilter, subjectFilter]);

  const selectedItem = useMemo(() => {
    return items.find((item) => item.id === selectedId) || null;
  }, [items, selectedId]);

  const focusSubjectName = selectedItem?.subject || (subjectFilter !== "all" ? subjectFilter : "");

  const focusSubject = useMemo(() => {
    if (!focusSubjectName) return null;
    return subjects.find((subject) => subject.name === focusSubjectName) || null;
  }, [focusSubjectName, subjects]);

  const subjectCards = useMemo(() => {
    const subjectMap = subjectNames.map((name) => {
      const subjectInfo = subjects.find((subject) => subject.name === name);
      const relatedItems = items.filter((item) => item.subject === name);
      const relatedDeadlines = deadlines.filter((deadline) => deadline.subject === name && deadline.status !== "done");
      const score =
        relatedItems.filter((item) => item.status === "review").length * 3 +
        relatedItems.filter((item) => item.priority === "high" && item.status !== "done").length * 2 +
        relatedDeadlines.length;

      return {
        name,
        subjectInfo,
        relatedItems,
        relatedDeadlines,
        score,
      };
    });

    return subjectMap.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "vi")).slice(0, 6);
  }, [deadlines, items, subjectNames, subjects]);

  const focusDeadlines = useMemo(() => {
    const source = focusSubjectName
      ? deadlines.filter((deadline) => deadline.subject === focusSubjectName)
      : deadlines;

    return source
      .filter((deadline) => deadline.status !== "done")
      .sort((a, b) => (toDate(a.due_date)?.getTime() || 0) - (toDate(b.due_date)?.getTime() || 0))
      .slice(0, 5);
  }, [deadlines, focusSubjectName]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(false);
  }

  function startCreate(extra = {}) {
    setForm({ ...initialForm, ...extra, module: MODULE });
    setEditingId(null);
    setShowForm(true);
  }

  function applyTemplate(template) {
    startCreate({
      ...template,
      title: "",
      subject: focusSubjectName || (subjectFilter !== "all" ? subjectFilter : ""),
      target_date: "",
    });
  }

  function buildPayload() {
    return {
      ...form,
      module: MODULE,
      title: form.title.trim(),
      category: form.category.trim() || null,
      subject: form.subject.trim() || null,
      project_name: form.project_name.trim() || null,
      target_date: form.target_date || null,
      file_path: form.file_path.trim() || null,
      url: form.url.trim() || null,
      tags: form.tags.trim() || null,
      content: form.content.trim() || null,
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      alert("Vui lòng nhập tiêu đề mục học tập.");
      return;
    }

    try {
      const payload = buildPayload();

      if (editingId) {
        await updateWorkspaceItem(editingId, payload);
      } else {
        await createWorkspaceItem(payload);
      }

      const preferredSelectedId = editingId;
      resetForm();
      await loadData(preferredSelectedId);
    } catch (err) {
      console.error(err);
      alert("Lưu mục học tập thất bại.");
    }
  }

  function handleEdit(item) {
    setEditingId(item.id);
    setSelectedId(item.id);
    setShowForm(true);
    setForm({
      module: MODULE,
      title: item.title || "",
      category: item.category || "",
      status: item.status || "active",
      priority: item.priority || "medium",
      subject: item.subject || "",
      project_name: item.project_name || "",
      target_date: item.target_date || "",
      file_path: item.file_path || "",
      url: item.url || "",
      tags: item.tags || "",
      content: item.content || "",
    });
  }

  async function handleDelete(itemId) {
    const confirmed = window.confirm("Bạn có chắc muốn xóa mục học tập này?");
    if (!confirmed) return;

    try {
      await deleteWorkspaceItem(itemId);
      if (editingId === itemId) resetForm();
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Xóa mục học tập thất bại.");
    }
  }

  async function updateStatus(item, status) {
    try {
      await updateWorkspaceItem(item.id, { ...item, status });
      await loadData(item.id);
    } catch (err) {
      console.error(err);
      alert("Cập nhật trạng thái thất bại.");
    }
  }

  async function createExamItemFromStudy(item) {
    try {
      await createWorkspaceItem({
        module: "exam",
        title: `Ôn lại: ${item.title}`,
        category: item.subject ? `Ôn ${item.subject}` : "Ôn tập",
        status: "pending",
        priority: item.priority || "medium",
        subject: item.subject || "",
        project_name: item.project_name || "",
        target_date: item.target_date || null,
        file_path: item.file_path || "",
        url: item.url || "",
        tags: item.tags ? `${item.tags} #on-thi` : "#on-thi",
        content: `Nguồn từ mục học tập: ${item.title}\n\nPhần cần ôn:\n- ${compactText(item.content, 220)}`,
      });
      alert("Đã tạo mục ôn thi từ nội dung học tập này.");
    } catch (err) {
      console.error(err);
      alert("Không tạo được mục ôn thi.");
    }
  }

  function clearFilters() {
    setQuery("");
    setSubjectFilter("all");
    setCategoryFilter("all");
    setStatusFilter("all");
    setSortBy("priority");
  }

  function startFocusTimer() {
    setFocusReadyToSave(false);
    setFocusSeconds((current) => (current > 0 ? current : focusMinutes * 60));
    setFocusRunning(true);
  }

  function pauseFocusTimer() {
    setFocusRunning(false);
  }

  function resetFocusTimer() {
    setFocusRunning(false);
    setFocusReadyToSave(false);
    setFocusSeconds(focusMinutes * 60);
  }

  async function saveFocusSession() {
    const elapsedSeconds = focusMinutes * 60 - focusSeconds;

    if (elapsedSeconds < 60 && !focusReadyToSave) {
      alert("Hãy học ít nhất 1 phút trước khi lưu phiên tập trung.");
      return;
    }

    try {
      const actualMinutes = focusReadyToSave ? focusMinutes : Math.max(1, Math.round(elapsedSeconds / 60));
      await createFocusSession({
        title: focusSubjectName ? `Pomodoro: ${focusSubjectName}` : "Pomodoro tự học",
        subject_id: focusSubject?.id || null,
        subject_name: focusSubjectName || null,
        mode: "pomodoro",
        planned_minutes: focusMinutes,
        actual_minutes: actualMinutes,
        status: "completed",
        note: focusNote.trim() || null,
      });

      setFocusNote("");
      resetFocusTimer();
      await loadData(selectedId);
    } catch (err) {
      console.error(err);
      alert("Không lưu được phiên tập trung.");
    }
  }

  return (
    <div className="learning-page">
      <header className="learning-header">
        <div>
          <span className="learning-eyebrow">STUDY HUB</span>
          <h2>Quản lý học tập</h2>
          <p>
            Gom môn học, tài liệu, ghi chú, bài tập và deadline vào một trung tâm.
            Module này liên kết với dữ liệu Môn học bằng tên môn để bạn chọn môn một lần,
            sau đó lọc được tài liệu, việc cần học và hạn nộp liên quan.
          </p>
        </div>

        <div className="learning-header-actions">
          <button className="learning-button" type="button" onClick={() => startCreate()}>
            + Thêm mục học tập
          </button>
          <button
            className="learning-button-secondary"
            type="button"
            onClick={() => startCreate({ category: "Ghi chú nhanh", status: "active" })}
          >
            Ghi chú nhanh
          </button>
        </div>
      </header>

      <section className="learning-summary-grid">
        <article className="learning-summary-card">
          <span>Tổng mục học tập</span>
          <strong>{stats.total}</strong>
          <small>{stats.completion}% đã hoàn thành</small>
        </article>
        <article className="learning-summary-card">
          <span>Đang học</span>
          <strong>{stats.doing}</strong>
          <small>Tài liệu, bài tập hoặc ghi chú đang dùng</small>
        </article>
        <article className="learning-summary-card success">
          <span>Focus tuần này</span>
          <strong>{focusSummary?.weekMinutes || 0}</strong>
          <small>{focusSummary?.weekSessions || 0} phiên Pomodoro đã lưu</small>
        </article>
        <article className="learning-summary-card warning">
          <span>Cần xem lại</span>
          <strong>{stats.needsReview}</strong>
          <small>Nên đưa sang ôn thi hoặc kế hoạch ngày</small>
        </article>
        <article className="learning-summary-card danger">
          <span>Ưu tiên cao</span>
          <strong>{stats.highPriority}</strong>
          <small>Mục chưa xong và có độ gấp cao</small>
        </article>
        <article className="learning-summary-card success">
          <span>Đã xong</span>
          <strong>{stats.done}</strong>
          <small>Có thể dùng lại khi ôn thi</small>
        </article>
        <article className="learning-summary-card warning">
          <span>Deadline 14 ngày</span>
          <strong>{stats.upcomingDeadlines}</strong>
          <small>Hạn liên quan học tập chưa hoàn thành</small>
        </article>
      </section>

      <section className="learning-panel learning-toolbar-panel">
        <div className="learning-toolbar">
          <label className="learning-field">
            <span>Tìm kiếm</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm tài liệu, môn học, tag, lỗi, link..."
            />
          </label>

          <label className="learning-field">
            <span>Môn học</span>
            <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
              <option value="all">Tất cả môn</option>
              {subjectNames.map((subjectName) => (
                <option key={subjectName} value={subjectName}>
                  {subjectName}
                </option>
              ))}
            </select>
          </label>

          <label className="learning-field">
            <span>Phân loại</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">Tất cả loại</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="learning-field">
            <span>Trạng thái</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Tất cả</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="learning-field">
            <span>Sắp xếp</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="priority">Ưu tiên thông minh</option>
              <option value="date">Ngày liên quan gần nhất</option>
              <option value="updated">Mới cập nhật</option>
              <option value="subject">Theo môn học</option>
            </select>
          </label>
        </div>

        <div className="learning-toolbar-footer">
          <p>
            Đang hiển thị <strong>{filteredItems.length}</strong> / {items.length} mục.
          </p>
          <button className="learning-button-ghost" type="button" onClick={clearFilters}>
            Xóa bộ lọc
          </button>
        </div>
      </section>

      <div className="learning-layout">
        <main className="learning-main-column">
          <section className="learning-panel">
            <div className="learning-panel-header">
              <div>
                <h3>Môn học cần chú ý</h3>
                <p>Dữ liệu lấy từ module Môn học, kết hợp với mục học tập và deadline theo tên môn.</p>
              </div>
            </div>

            {subjectCards.length === 0 ? (
              <div className="learning-empty">
                <h4>Chưa có môn học liên kết</h4>
                <p>Hãy thêm môn ở module Môn học hoặc nhập tên môn trong mục học tập.</p>
              </div>
            ) : (
              <div className="learning-subject-grid">
                {subjectCards.map((card) => (
                  <button
                    key={card.name}
                    className={`learning-subject-card ${subjectFilter === card.name ? "active" : ""}`}
                    type="button"
                    onClick={() => setSubjectFilter(card.name)}
                  >
                    <h4>{card.name}</h4>
                    <p>
                      {card.subjectInfo?.lecturer || "Chưa có giảng viên"} · {card.subjectInfo?.credits || 0} tín chỉ
                    </p>
                    <div className="learning-subject-meta">
                      <span className="learning-badge info">{card.relatedItems.length} mục học</span>
                      <span className="learning-badge warning">{card.relatedDeadlines.length} deadline</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="learning-panel">
            <div className="learning-panel-header">
              <div>
                <h3>Danh sách học tập</h3>
                <p>Chọn một mục để xem chi tiết, chuyển trạng thái hoặc tạo mục ôn thi từ nội dung đó.</p>
              </div>
            </div>

            {error && <p className="error-message">{error}</p>}

            {loading ? (
              <p className="learning-empty">Đang tải dữ liệu...</p>
            ) : filteredItems.length === 0 ? (
              <div className="learning-empty">
                <h4>Không có mục học tập phù hợp</h4>
                <p>Đổi bộ lọc hoặc thêm một ghi chú học tập mới.</p>
                <button className="learning-button" type="button" onClick={() => startCreate()}>
                  Thêm mục học tập
                </button>
              </div>
            ) : (
              <div className="learning-list">
                {filteredItems.map((item) => {
                  const status = getOption(statusOptions, item.status || "active");
                  const priority = getOption(priorityOptions, item.priority || "medium");
                  const daysLeft = getDaysLeft(item.target_date);

                  return (
                    <article
                      key={item.id}
                      className={`learning-item-card ${selectedId === item.id ? "active" : ""}`}
                      onClick={() => {
                        setSelectedId(item.id);
                        setShowForm(false);
                        setEditingId(null);
                      }}
                    >
                      <div className="learning-item-main">
                        <h4>{item.title}</h4>
                        <p>{compactText(item.content)}</p>
                        <div className="learning-item-meta">
                          <span className={`learning-badge ${status.tone}`}>{status.label}</span>
                          <span className={`learning-badge ${priority.tone}`}>Ưu tiên {priority.label}</span>
                          <span className="learning-badge purple">{item.category || "Chưa phân loại"}</span>
                          {item.subject && <span className="learning-badge info">{item.subject}</span>}
                          {item.target_date && (
                            <span className={`learning-badge ${daysLeft !== null && daysLeft < 0 ? "danger" : "neutral"}`}>
                              {formatDate(item.target_date)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="learning-card-actions" onClick={(event) => event.stopPropagation()}>
                        {item.status !== "done" && (
                          <button className="learning-status-button done" type="button" onClick={() => updateStatus(item, "done")}>
                            Xong
                          </button>
                        )}
                        <button className="learning-status-button" type="button" onClick={() => updateStatus(item, "review")}>
                          Cần ôn
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        <aside className="learning-side-column">
          <section className="learning-panel">
            <div className="learning-panel-header">
              <div>
                <h3>{showForm ? (editingId ? "Cập nhật mục học" : "Thêm mục học") : "Chi tiết mục học"}</h3>
                <p>{showForm ? "Gắn mục học với môn để sau này lọc, ôn thi và theo dõi deadline dễ hơn." : "Xem nội dung, file, link và thao tác nhanh."}</p>
              </div>
              {!showForm && (
                <button className="learning-icon-button" type="button" onClick={() => startCreate()}>
                  +
                </button>
              )}
            </div>

            {showForm ? (
              <form className="learning-form" onSubmit={handleSubmit}>
                <label className="learning-field">
                  <span>Tiêu đề *</span>
                  <input name="title" value={form.title} onChange={handleChange} placeholder="Ví dụ: Tóm tắt chương CNN" />
                </label>

                <div className="learning-two-columns">
                  <label className="learning-field">
                    <span>Phân loại</span>
                    <input name="category" value={form.category} onChange={handleChange} placeholder="Ghi chú, tài liệu, bài tập..." />
                  </label>
                  <label className="learning-field">
                    <span>Trạng thái</span>
                    <select name="status" value={form.status} onChange={handleChange}>
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="learning-two-columns">
                  <label className="learning-field">
                    <span>Ưu tiên</span>
                    <select name="priority" value={form.priority} onChange={handleChange}>
                      {priorityOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="learning-field">
                    <span>Ngày liên quan</span>
                    <input type="date" name="target_date" value={form.target_date} onChange={handleChange} />
                  </label>
                </div>

                <label className="learning-field">
                  <span>Môn học liên kết</span>
                  <input
                    name="subject"
                    list="study-subject-list"
                    value={form.subject}
                    onChange={handleChange}
                    placeholder="Chọn hoặc nhập tên môn"
                  />
                  <datalist id="study-subject-list">
                    {subjectNames.map((subjectName) => (
                      <option key={subjectName} value={subjectName} />
                    ))}
                  </datalist>
                </label>

                <label className="learning-field">
                  <span>Dự án / bài lớn liên quan</span>
                  <input name="project_name" value={form.project_name} onChange={handleChange} placeholder="Ví dụ: Báo cáo CNN, phần mềm cá nhân..." />
                </label>

                <label className="learning-field">
                  <span>Đường dẫn file</span>
                  <input name="file_path" value={form.file_path} onChange={handleChange} placeholder="Ví dụ: E:\\Projects\\bao_cao.docx" />
                </label>

                <label className="learning-field">
                  <span>Link tài liệu</span>
                  <input name="url" value={form.url} onChange={handleChange} placeholder="Drive, GitHub, Colab, YouTube, website..." />
                </label>

                <label className="learning-field">
                  <span>Tag</span>
                  <input name="tags" value={form.tags} onChange={handleChange} placeholder="#cnn #baocao #can-on" />
                </label>

                <label className="learning-field">
                  <span>Nội dung / ghi chú</span>
                  <textarea name="content" value={form.content} onChange={handleChange} placeholder="Ý chính, phần chưa hiểu, lỗi gặp phải, checklist cần làm..." />
                </label>

                <div className="learning-form-actions">
                  <button className="learning-button" type="submit">{editingId ? "Lưu cập nhật" : "Thêm mục"}</button>
                  <button className="learning-button-secondary" type="button" onClick={resetForm}>Hủy</button>
                </div>
              </form>
            ) : selectedItem ? (
              <div className="learning-detail-card">
                <div className="learning-detail-title">
                  <div>
                    <h4>{selectedItem.title}</h4>
                    <p>{selectedItem.subject || "Chưa gắn môn học"}</p>
                  </div>
                  <span className={`learning-badge ${getOption(statusOptions, selectedItem.status || "active").tone}`}>
                    {getOption(statusOptions, selectedItem.status || "active").label}
                  </span>
                </div>

                <div className="learning-detail-meta">
                  <span className={`learning-badge ${getOption(priorityOptions, selectedItem.priority || "medium").tone}`}>
                    Ưu tiên {getOption(priorityOptions, selectedItem.priority || "medium").label}
                  </span>
                  <span className="learning-badge purple">{selectedItem.category || "Chưa phân loại"}</span>
                  {selectedItem.tags && <span className="learning-badge neutral">{selectedItem.tags}</span>}
                </div>

                <div className="learning-detail-grid">
                  <article><span>Ngày liên quan</span><strong>{formatDate(selectedItem.target_date)}</strong></article>
                  <article><span>Dự án</span><strong>{selectedItem.project_name || "Chưa có"}</strong></article>
                  <article><span>Tạo lúc</span><strong>{formatDate(selectedItem.created_at?.slice(0, 10))}</strong></article>
                  <article><span>Cập nhật</span><strong>{formatDate(selectedItem.updated_at?.slice(0, 10))}</strong></article>
                </div>

                <div className="learning-note-box">
                  <span>Nội dung</span>
                  <p>{selectedItem.content || "Chưa có nội dung."}</p>
                </div>

                {selectedItem.file_path && (
                  <div className="learning-link-box"><span>File</span><p>{selectedItem.file_path}</p></div>
                )}

                {selectedItem.url && (
                  <div className="learning-link-box">
                    <span>Link</span>
                    <a href={selectedItem.url} target="_blank" rel="noreferrer">{selectedItem.url}</a>
                  </div>
                )}

                <div className="learning-form-actions">
                  <button className="learning-button-secondary" type="button" onClick={() => handleEdit(selectedItem)}>Sửa</button>
                  <button className="learning-button-ghost" type="button" onClick={() => createExamItemFromStudy(selectedItem)}>Đưa sang ôn thi</button>
                  <button className="learning-button-danger" type="button" onClick={() => handleDelete(selectedItem.id)}>Xóa</button>
                </div>
              </div>
            ) : (
              <div className="learning-empty">
                <h4>Chưa chọn mục học tập</h4>
                <p>Chọn một mục ở danh sách hoặc tạo mới.</p>
                <button className="learning-button" type="button" onClick={() => startCreate()}>Thêm mục</button>
              </div>
            )}
          </section>

          <section className="learning-panel learning-focus-panel">
            <div className="learning-panel-header">
              <div>
                <h3>Pomodoro / Focus Mode</h3>
                <p>Chọn môn đang học, bật đồng hồ 25/5 và lưu phiên để nhận EXP.</p>
              </div>
            </div>

            <div className="learning-focus-display">
              <span>{focusSubjectName || "Tự học"}</span>
              <strong>{formatTimer(focusSeconds)}</strong>
              <small>{focusReadyToSave ? "Đã hết giờ, hãy lưu phiên tập trung." : focusRunning ? "Đang tập trung, hạn chế đổi tab." : "Sẵn sàng bắt đầu."}</small>
            </div>

            <div className="learning-focus-controls">
              <label className="learning-field">
                <span>Thời lượng</span>
                <select
                  value={focusMinutes}
                  onChange={(event) => setFocusMinutes(Number(event.target.value))}
                  disabled={focusRunning}
                >
                  <option value={15}>15 phút</option>
                  <option value={25}>25 phút</option>
                  <option value={45}>45 phút</option>
                  <option value={60}>60 phút</option>
                </select>
              </label>
              <label className="learning-field">
                <span>Ghi chú phiên học</span>
                <input value={focusNote} onChange={(event) => setFocusNote(event.target.value)} placeholder="Ví dụ: đọc chương 3, làm lab..." />
              </label>
            </div>

            <div className="learning-form-actions">
              {!focusRunning ? (
                <button className="learning-button" type="button" onClick={startFocusTimer}>Bắt đầu</button>
              ) : (
                <button className="learning-button-secondary" type="button" onClick={pauseFocusTimer}>Tạm dừng</button>
              )}
              <button className="learning-button-secondary" type="button" onClick={resetFocusTimer}>Đặt lại</button>
              <button className="learning-button-ghost" type="button" onClick={saveFocusSession}>Lưu phiên</button>
            </div>

            <div className="learning-focus-stats">
              <article><span>Hôm nay</span><strong>{focusSummary?.todayMinutes || 0} phút</strong></article>
              <article><span>Tuần này</span><strong>{focusSummary?.weekMinutes || 0} phút</strong></article>
              <article><span>Tổng</span><strong>{focusSummary?.totalMinutes || 0} phút</strong></article>
            </div>
          </section>

          <section className="learning-panel">
            <div className="learning-panel-header">
              <div>
                <h3>Mẫu thêm nhanh</h3>
                <p>Giảm thao tác nhập liệu, giữ cách ghi chép thống nhất.</p>
              </div>
            </div>

            <div className="learning-template-grid">
              {studyTemplates.map((template) => (
                <button key={template.title} className="learning-template-button" type="button" onClick={() => applyTemplate(template)}>
                  {template.title}
                  <span>{template.category}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="learning-panel">
            <div className="learning-panel-header">
              <div>
                <h3>{focusSubjectName ? `Deadline của ${focusSubjectName}` : "Deadline học tập gần nhất"}</h3>
                <p>Deadline lấy từ module Deadline, lọc theo môn đang chọn khi có thể.</p>
              </div>
            </div>

            {focusSubject && (
              <div className="learning-note-box">
                <span>Thông tin môn</span>
                <p>
                  {focusSubject.lecturer || "Chưa có giảng viên"} · {focusSubject.credits || 0} tín chỉ · {focusSubject.semester || "Chưa có học kỳ"}
                </p>
              </div>
            )}

            {focusDeadlines.length === 0 ? (
              <p className="learning-empty">Chưa có deadline liên quan.</p>
            ) : (
              <div className="learning-deadline-list">
                {focusDeadlines.map((deadline) => {
                  const daysLeft = getDaysLeft(deadline.due_date);
                  return (
                    <article key={deadline.id} className="learning-deadline-card">
                      <div>
                        <h4>{deadline.title}</h4>
                        <p>{deadline.subject || "Không gắn môn"} · {deadline.type || "deadline"}</p>
                      </div>
                      <span className={`learning-badge ${daysLeft !== null && daysLeft <= 3 ? "danger" : "warning"}`}>
                        {daysLeft === null ? formatDate(deadline.due_date) : daysLeft < 0 ? "Quá hạn" : `${daysLeft} ngày`}
                      </span>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

export default StudyPage;
