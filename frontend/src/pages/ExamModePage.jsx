import { useEffect, useMemo, useState } from "react";
import {
  createWorkspaceItem,
  deleteWorkspaceItem,
  getWorkspaceItems,
  updateWorkspaceItem,
} from "../api/workspaceApi";
import { getSubjects } from "../api/subjectsApi";
import { getDeadlines } from "../api/deadlineApi";
import "./StudyWorkspace.css";

const MODULE = "exam";

const initialForm = {
  module: MODULE,
  title: "",
  category: "Chủ đề ôn tập",
  status: "pending",
  priority: "high",
  subject: "",
  project_name: "",
  target_date: "",
  file_path: "",
  url: "",
  tags: "#on-thi",
  content: "",
};

const statusColumns = [
  { value: "pending", label: "Chưa học", tone: "neutral" },
  { value: "doing", label: "Đang học", tone: "info" },
  { value: "review", label: "Cần xem lại", tone: "warning" },
  { value: "done", label: "Đã chắc", tone: "success" },
];

const priorityOptions = [
  { value: "low", label: "Thấp", tone: "neutral" },
  { value: "medium", label: "Trung bình", tone: "info" },
  { value: "high", label: "Cao", tone: "danger" },
];

const examTemplates = [
  {
    title: "Chia đề cương ôn thi",
    category: "Đề cương",
    status: "pending",
    priority: "high",
    tags: "#de-cuong #on-thi",
    content: "Danh sách chương / chủ đề:\n- \n\nPhần chắc:\n- \n\nPhần yếu:\n- ",
  },
  {
    title: "Làm đề thử",
    category: "Đề thi thử",
    status: "pending",
    priority: "high",
    tags: "#de-thi #luyen-de",
    content: "Đề số:\nThời gian làm:\nĐiểm tự chấm:\n\nCâu sai:\n- \n\nLý do sai:\n- ",
  },
  {
    title: "Bảng lỗi sai",
    category: "Lỗi sai",
    status: "review",
    priority: "high",
    tags: "#loi-sai #can-xem-lai",
    content: "Lỗi sai thường gặp:\n- \n\nCách tránh:\n- \n\nCâu tương tự cần luyện:\n- ",
  },
  {
    title: "Câu hỏi tự kiểm tra",
    category: "Tự kiểm tra",
    status: "pending",
    priority: "medium",
    tags: "#flashcard #tu-kiem-tra",
    content: "Câu hỏi:\n- \n\nTrả lời ngắn:\n- \n\nGợi ý nhớ nhanh:\n- ",
  },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(baseISO, amount) {
  const date = new Date(`${baseISO}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
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
  return Math.ceil((date - today) / 86400000);
}

function compactText(value, limit = 110) {
  if (!value) return "Chưa có mô tả ôn tập.";
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function getOption(options, value) {
  return options.find((option) => option.value === value) || options[0];
}

function isExamDeadline(deadline) {
  const text = `${deadline.type || ""} ${deadline.title || ""}`.toLowerCase();
  return text.includes("exam") || text.includes("thi") || text.includes("kiểm tra") || text.includes("kiem tra") || text.includes("final") || text.includes("midterm");
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

function ExamModePage() {
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
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("sprint");

  async function loadData(preferredSelectedId = null) {
    try {
      setLoading(true);
      setError("");

      const [examData, subjectData, deadlineData] = await Promise.all([
        getWorkspaceItems(MODULE),
        getSubjects().catch(() => []),
        getDeadlines().catch(() => []),
      ]);

      setItems(examData);
      setSubjects(subjectData);
      setDeadlines(deadlineData);

      const nextSelected = preferredSelectedId ?? selectedId ?? examData[0]?.id ?? null;
      const stillExists = examData.some((item) => item.id === nextSelected);
      setSelectedId(stillExists ? nextSelected : examData[0]?.id ?? null);
    } catch (err) {
      console.error(err);
      setError("Không tải được dữ liệu ôn thi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const examDeadlines = useMemo(() => {
    return deadlines
      .filter((deadline) => deadline.status !== "done" && isExamDeadline(deadline))
      .sort((a, b) => (toDate(a.due_date)?.getTime() || 0) - (toDate(b.due_date)?.getTime() || 0));
  }, [deadlines]);

  const nextExam = examDeadlines[0] || null;
  const daysToNextExam = nextExam ? getDaysLeft(nextExam.due_date) : null;

  const stats = useMemo(() => {
    const done = items.filter((item) => item.status === "done").length;
    const needsReview = items.filter((item) => item.status === "review").length;
    const unfinished = items.filter((item) => item.status !== "done").length;
    const high = items.filter((item) => item.priority === "high" && item.status !== "done").length;

    return {
      total: items.length,
      unfinished,
      doing: items.filter((item) => item.status === "doing").length,
      needsReview,
      done,
      high,
      completion: items.length ? Math.round((done / items.length) * 100) : 0,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const filtered = items.filter((item) => {
      const okText = matchesText(item, query.trim());
      const okSubject = subjectFilter === "all" || item.subject === subjectFilter;
      const okPriority = priorityFilter === "all" || item.priority === priorityFilter;
      const okCategory = categoryFilter === "all" || item.category === categoryFilter;
      return okText && okSubject && okPriority && okCategory;
    });

    const priorityRank = { high: 0, medium: 1, low: 2 };
    const statusRank = { review: 0, pending: 1, doing: 2, done: 3 };

    return [...filtered].sort((a, b) => {
      if (sortBy === "date") {
        return (toDate(a.target_date)?.getTime() || Infinity) - (toDate(b.target_date)?.getTime() || Infinity);
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
  }, [categoryFilter, items, priorityFilter, query, sortBy, subjectFilter]);

  const selectedItem = useMemo(() => {
    return items.find((item) => item.id === selectedId) || null;
  }, [items, selectedId]);

  const focusedSubject = selectedItem?.subject || (subjectFilter !== "all" ? subjectFilter : "");

  const focusedSubjectInfo = useMemo(() => {
    if (!focusedSubject) return null;
    return subjects.find((subject) => subject.name === focusedSubject) || null;
  }, [focusedSubject, subjects]);

  const board = useMemo(() => {
    return statusColumns.map((column) => ({
      ...column,
      items: filteredItems.filter((item) => (item.status || "pending") === column.value),
    }));
  }, [filteredItems]);

  const weekPlan = useMemo(() => {
    const unfinished = filteredItems
      .filter((item) => item.status !== "done")
      .sort((a, b) => {
        const priorityRank = { high: 0, medium: 1, low: 2 };
        return (
          (priorityRank[a.priority] ?? 99) - (priorityRank[b.priority] ?? 99) ||
          (toDate(a.target_date)?.getTime() || Infinity) - (toDate(b.target_date)?.getTime() || Infinity)
        );
      });

    return Array.from({ length: 7 }, (_, index) => {
      const date = addDaysISO(todayISO(), index);
      return {
        date,
        label: index === 0 ? "Hôm nay" : `Ngày ${index + 1}`,
        item: unfinished[index] || null,
      };
    });
  }, [filteredItems]);

  const focusDeadlines = useMemo(() => {
    const source = focusedSubject
      ? examDeadlines.filter((deadline) => deadline.subject === focusedSubject)
      : examDeadlines;
    return source.slice(0, 5);
  }, [examDeadlines, focusedSubject]);

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
      subject: focusedSubject || (subjectFilter !== "all" ? subjectFilter : ""),
    });
  }

  function buildPayload() {
    return {
      ...form,
      module: MODULE,
      title: form.title.trim(),
      category: form.category.trim() || null,
      status: form.status || "pending",
      priority: form.priority || "medium",
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
      alert("Vui lòng nhập tiêu đề mục ôn thi.");
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
      alert("Lưu mục ôn thi thất bại.");
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
      status: item.status || "pending",
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
    const confirmed = window.confirm("Bạn có chắc muốn xóa mục ôn thi này?");
    if (!confirmed) return;

    try {
      await deleteWorkspaceItem(itemId);
      if (editingId === itemId) resetForm();
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Xóa mục ôn thi thất bại.");
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

  async function createFromDeadline(deadline) {
    try {
      const created = await createWorkspaceItem({
        module: MODULE,
        title: `Ôn thi: ${deadline.title}`,
        category: deadline.type === "exam" ? "Lịch thi" : "Deadline ôn tập",
        status: "pending",
        priority: deadline.priority || "high",
        subject: deadline.subject || "",
        project_name: "",
        target_date: deadline.due_date || null,
        file_path: "",
        url: "",
        tags: "#deadline #on-thi",
        content: `Nguồn từ deadline: ${deadline.title}\nHạn: ${formatDate(deadline.due_date)}\n\nViệc cần ôn:\n- Đọc lại đề cương\n- Làm bài tập trọng tâm\n- Tổng hợp lỗi sai`,
      });
      await loadData(created.id);
      setSelectedId(created.id);
    } catch (err) {
      console.error(err);
      alert("Không tạo được checklist từ deadline.");
    }
  }

  async function createFromSubject(subjectName) {
    try {
      const subject = subjects.find((item) => item.name === subjectName);
      const created = await createWorkspaceItem({
        module: MODULE,
        title: `Kế hoạch ôn thi ${subjectName}`,
        category: "Kế hoạch tổng ôn",
        status: "pending",
        priority: subject?.progress_status === "needs_review" ? "high" : "medium",
        subject: subjectName,
        project_name: "",
        target_date: "",
        file_path: "",
        url: "",
        tags: "#ke-hoach #tong-on",
        content: `Mục tiêu môn ${subjectName}:\n- Nắm lại đề cương\n- Tách phần chắc / phần yếu\n- Luyện bài tập và đề\n- Tổng kết lỗi sai trước ngày thi`,
      });
      await loadData(created.id);
      setSelectedId(created.id);
    } catch (err) {
      console.error(err);
      alert("Không tạo được kế hoạch ôn thi từ môn học.");
    }
  }

  function clearFilters() {
    setQuery("");
    setSubjectFilter("all");
    setPriorityFilter("all");
    setCategoryFilter("all");
    setSortBy("sprint");
  }

  return (
    <div className="learning-page">
      <header className="learning-header">
        <div>
          <span className="learning-eyebrow">EXAM SPRINT</span>
          <h2>Ôn thi / Nước rút</h2>
          <p>
            Biến môn học và deadline thành checklist ôn thi rõ ràng. Mục tiêu là biết phần nào chưa học,
            phần nào đang học, phần nào cần xem lại và phần nào đã đủ chắc trước khi vào phòng thi.
          </p>
        </div>

        <div className="learning-header-actions">
          <button className="learning-button" type="button" onClick={() => startCreate()}>
            + Thêm mục ôn thi
          </button>
          {focusedSubject && (
            <button className="learning-button-secondary" type="button" onClick={() => createFromSubject(focusedSubject)}>
              Tạo kế hoạch môn này
            </button>
          )}
        </div>
      </header>

      <section className="learning-panel exam-focus-strip">
        <article className="exam-focus-card">
          <h3>{nextExam ? nextExam.title : "Chưa có lịch thi gần"}</h3>
          <p>
            {nextExam
              ? `${nextExam.subject || "Không gắn môn"} · ${formatDate(nextExam.due_date)} · ${daysToNextExam < 0 ? "Đã quá hạn" : `còn ${daysToNextExam} ngày`}`
              : "Khi module Deadline có mục loại exam hoặc tiêu đề chứa từ thi/kiểm tra, hệ thống sẽ đưa vào nước rút."}
          </p>
        </article>

        <div className="exam-days-grid">
          {weekPlan.map((day) => (
            <div key={day.date} className="exam-day-pill">
              <strong>{day.label}</strong>
              <span>{formatDate(day.date)}</span>
              <span>{day.item ? compactText(day.item.title, 28) : "Chừa trống"}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="learning-summary-grid">
        <article className="learning-summary-card">
          <span>Tổng checklist</span>
          <strong>{stats.total}</strong>
          <small>{stats.completion}% đã chắc</small>
        </article>
        <article className="learning-summary-card danger">
          <span>Chưa xong</span>
          <strong>{stats.unfinished}</strong>
          <small>Cần xử lý trước ngày thi</small>
        </article>
        <article className="learning-summary-card">
          <span>Đang học</span>
          <strong>{stats.doing}</strong>
          <small>Đang nằm trong phiên ôn tập</small>
        </article>
        <article className="learning-summary-card warning">
          <span>Cần xem lại</span>
          <strong>{stats.needsReview}</strong>
          <small>Phần dễ mất điểm hoặc chưa chắc</small>
        </article>
        <article className="learning-summary-card danger">
          <span>Ưu tiên cao</span>
          <strong>{stats.high}</strong>
          <small>Nên xếp trước trong kế hoạch ngày</small>
        </article>
        <article className="learning-summary-card success">
          <span>Đã chắc</span>
          <strong>{stats.done}</strong>
          <small>Có thể rà lại nhanh trước thi</small>
        </article>
      </section>

      <section className="learning-panel learning-toolbar-panel">
        <div className="learning-toolbar compact">
          <label className="learning-field">
            <span>Tìm kiếm</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm chương, dạng bài, lỗi sai, tag..." />
          </label>

          <label className="learning-field">
            <span>Môn học</span>
            <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
              <option value="all">Tất cả môn</option>
              {subjectNames.map((subjectName) => (
                <option key={subjectName} value={subjectName}>{subjectName}</option>
              ))}
            </select>
          </label>

          <label className="learning-field">
            <span>Ưu tiên</span>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
              <option value="all">Tất cả</option>
              {priorityOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="learning-field">
            <span>Phân loại</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">Tất cả loại</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="learning-toolbar-footer">
          <p>Đang hiển thị <strong>{filteredItems.length}</strong> / {items.length} mục ôn thi.</p>
          <div className="learning-inline-actions">
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="sprint">Ưu tiên nước rút</option>
              <option value="date">Theo ngày gần nhất</option>
              <option value="subject">Theo môn học</option>
            </select>
            <button className="learning-button-ghost" type="button" onClick={clearFilters}>Xóa bộ lọc</button>
          </div>
        </div>
      </section>

      <div className="learning-layout">
        <main className="learning-main-column">
          <section className="learning-panel">
            <div className="learning-panel-header">
              <div>
                <h3>Bảng nước rút</h3>
                <p>Checklist chia theo tiến độ. Bấm vào thẻ để xem chi tiết, chuyển trạng thái ngay trên thẻ.</p>
              </div>
            </div>

            {error && <p className="error-message">{error}</p>}

            {loading ? (
              <p className="learning-empty">Đang tải dữ liệu...</p>
            ) : filteredItems.length === 0 ? (
              <div className="learning-empty">
                <h4>Chưa có checklist phù hợp</h4>
                <p>Tạo mục ôn thi từ môn học, deadline hoặc mẫu có sẵn.</p>
                <button className="learning-button" type="button" onClick={() => startCreate()}>Thêm mục ôn thi</button>
              </div>
            ) : (
              <div className="exam-board">
                {board.map((column) => (
                  <section key={column.value} className="exam-column">
                    <div className="exam-column-header">
                      <h4>{column.label}</h4>
                      <span className={`learning-badge ${column.tone}`}>{column.items.length}</span>
                    </div>

                    <div className="exam-column-list">
                      {column.items.map((item) => {
                        const priority = getOption(priorityOptions, item.priority || "medium");
                        const daysLeft = getDaysLeft(item.target_date);

                        return (
                          <article
                            key={item.id}
                            className={`exam-mini-card ${selectedId === item.id ? "active" : ""}`}
                            onClick={() => {
                              setSelectedId(item.id);
                              setShowForm(false);
                              setEditingId(null);
                            }}
                          >
                            <h5>{item.title}</h5>
                            <p>{compactText(item.content)}</p>
                            <div className="learning-chip-row">
                              <span className={`learning-badge ${priority.tone}`}>{priority.label}</span>
                              {item.subject && <span className="learning-badge info">{item.subject}</span>}
                              {item.target_date && (
                                <span className={`learning-badge ${daysLeft !== null && daysLeft <= 2 ? "danger" : "neutral"}`}>
                                  {formatDate(item.target_date)}
                                </span>
                              )}
                            </div>
                            <div className="exam-mini-actions" onClick={(event) => event.stopPropagation()}>
                              {item.status !== "doing" && item.status !== "done" && (
                                <button className="learning-status-button" type="button" onClick={() => updateStatus(item, "doing")}>Học</button>
                              )}
                              {item.status !== "review" && item.status !== "done" && (
                                <button className="learning-status-button" type="button" onClick={() => updateStatus(item, "review")}>Xem lại</button>
                              )}
                              {item.status !== "done" && (
                                <button className="learning-status-button done" type="button" onClick={() => updateStatus(item, "done")}>Đã chắc</button>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>

          <section className="learning-panel">
            <div className="learning-panel-header">
              <div>
                <h3>Kế hoạch 7 ngày đề xuất</h3>
                <p>Gợi ý chia việc dựa trên ưu tiên và ngày liên quan. Có thể dùng để nhập sang Kế hoạch ngày.</p>
              </div>
            </div>

            <div className="exam-plan-list">
              {weekPlan.map((day) => (
                <article key={day.date} className="exam-plan-card">
                  <div>
                    <h4>{day.label} · {formatDate(day.date)}</h4>
                    <p>{day.item ? `${day.item.title} · ${day.item.subject || "Chưa gắn môn"}` : "Không có mục gấp. Dùng ngày này để nghỉ, rà lỗi sai hoặc học nhẹ."}</p>
                  </div>
                  {day.item && <span className={`learning-badge ${getOption(priorityOptions, day.item.priority || "medium").tone}`}>{getOption(priorityOptions, day.item.priority || "medium").label}</span>}
                </article>
              ))}
            </div>
          </section>
        </main>

        <aside className="learning-side-column">
          <section className="learning-panel">
            <div className="learning-panel-header">
              <div>
                <h3>{showForm ? (editingId ? "Cập nhật checklist" : "Thêm checklist") : "Chi tiết ôn thi"}</h3>
                <p>{showForm ? "Gắn checklist với môn học và ngày thi để nước rút không bị rối." : "Xem chi tiết và thao tác nhanh với mục đang chọn."}</p>
              </div>
              {!showForm && <button className="learning-icon-button" type="button" onClick={() => startCreate()}>+</button>}
            </div>

            {showForm ? (
              <form className="learning-form" onSubmit={handleSubmit}>
                <label className="learning-field">
                  <span>Tiêu đề *</span>
                  <input name="title" value={form.title} onChange={handleChange} placeholder="Ví dụ: Ôn chương CNN" />
                </label>

                <div className="learning-two-columns">
                  <label className="learning-field">
                    <span>Phân loại</span>
                    <input name="category" value={form.category} onChange={handleChange} placeholder="Đề cương, lỗi sai, đề thi..." />
                  </label>
                  <label className="learning-field">
                    <span>Trạng thái</span>
                    <select name="status" value={form.status} onChange={handleChange}>
                      {statusColumns.map((option) => (
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
                    <span>Ngày thi / ngày cần xong</span>
                    <input type="date" name="target_date" value={form.target_date} onChange={handleChange} />
                  </label>
                </div>

                <label className="learning-field">
                  <span>Môn học liên kết</span>
                  <input name="subject" list="exam-subject-list" value={form.subject} onChange={handleChange} placeholder="Chọn hoặc nhập tên môn" />
                  <datalist id="exam-subject-list">
                    {subjectNames.map((subjectName) => <option key={subjectName} value={subjectName} />)}
                  </datalist>
                </label>

                <label className="learning-field">
                  <span>Đường dẫn file / đề cương</span>
                  <input name="file_path" value={form.file_path} onChange={handleChange} placeholder="File đề cương, slide, đề thi..." />
                </label>

                <label className="learning-field">
                  <span>Link tài liệu</span>
                  <input name="url" value={form.url} onChange={handleChange} placeholder="Drive, Colab, GitHub, video bài giảng..." />
                </label>

                <label className="learning-field">
                  <span>Tag</span>
                  <input name="tags" value={form.tags} onChange={handleChange} placeholder="#on-thi #cnn #loi-sai" />
                </label>

                <label className="learning-field">
                  <span>Nội dung / checklist</span>
                  <textarea name="content" value={form.content} onChange={handleChange} placeholder="Chia chương, câu hỏi, dạng bài, lỗi sai, việc cần làm..." />
                </label>

                <div className="learning-form-actions">
                  <button className="learning-button" type="submit">{editingId ? "Lưu cập nhật" : "Thêm checklist"}</button>
                  <button className="learning-button-secondary" type="button" onClick={resetForm}>Hủy</button>
                </div>
              </form>
            ) : selectedItem ? (
              <div className="learning-detail-card">
                <div className="learning-detail-title">
                  <div>
                    <h4>{selectedItem.title}</h4>
                    <p>{selectedItem.subject || "Chưa gắn môn"}</p>
                  </div>
                  <span className={`learning-badge ${getOption(statusColumns, selectedItem.status || "pending").tone}`}>
                    {getOption(statusColumns, selectedItem.status || "pending").label}
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
                  <article><span>Ngày cần xong</span><strong>{formatDate(selectedItem.target_date)}</strong></article>
                  <article><span>Môn học</span><strong>{selectedItem.subject || "Chưa có"}</strong></article>
                  <article><span>Tạo lúc</span><strong>{formatDate(selectedItem.created_at?.slice(0, 10))}</strong></article>
                  <article><span>Cập nhật</span><strong>{formatDate(selectedItem.updated_at?.slice(0, 10))}</strong></article>
                </div>

                <div className="learning-note-box"><span>Nội dung</span><p>{selectedItem.content || "Chưa có checklist."}</p></div>

                {selectedItem.file_path && <div className="learning-link-box"><span>File</span><p>{selectedItem.file_path}</p></div>}
                {selectedItem.url && (
                  <div className="learning-link-box"><span>Link</span><a href={selectedItem.url} target="_blank" rel="noreferrer">{selectedItem.url}</a></div>
                )}

                <div className="learning-form-actions">
                  <button className="learning-button-secondary" type="button" onClick={() => handleEdit(selectedItem)}>Sửa</button>
                  <button className="learning-button-ghost" type="button" onClick={() => updateStatus(selectedItem, "review")}>Đánh dấu cần xem lại</button>
                  <button className="learning-button" type="button" onClick={() => updateStatus(selectedItem, "done")}>Đã chắc</button>
                  <button className="learning-button-danger" type="button" onClick={() => handleDelete(selectedItem.id)}>Xóa</button>
                </div>
              </div>
            ) : (
              <div className="learning-empty">
                <h4>Chưa chọn mục ôn thi</h4>
                <p>Chọn một thẻ trong bảng nước rút hoặc tạo checklist mới.</p>
                <button className="learning-button" type="button" onClick={() => startCreate()}>Thêm checklist</button>
              </div>
            )}
          </section>

          <section className="learning-panel">
            <div className="learning-panel-header">
              <div>
                <h3>Mẫu nước rút</h3>
                <p>Tạo checklist nhanh theo cách ôn thi truyền thống: đề cương, luyện đề, lỗi sai.</p>
              </div>
            </div>

            <div className="learning-template-grid">
              {examTemplates.map((template) => (
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
                <h3>{focusedSubject ? `Lịch thi của ${focusedSubject}` : "Deadline thi gần nhất"}</h3>
                <p>Nhấn tạo checklist để biến deadline thành việc ôn cụ thể.</p>
              </div>
            </div>

            {focusedSubjectInfo && (
              <div className="learning-note-box">
                <span>Thông tin môn</span>
                <p>{focusedSubjectInfo.lecturer || "Chưa có giảng viên"} · {focusedSubjectInfo.credits || 0} tín chỉ · {focusedSubjectInfo.semester || "Chưa có học kỳ"}</p>
              </div>
            )}

            {focusDeadlines.length === 0 ? (
              <p className="learning-empty">Chưa có deadline thi liên quan.</p>
            ) : (
              <div className="learning-deadline-list">
                {focusDeadlines.map((deadline) => {
                  const daysLeft = getDaysLeft(deadline.due_date);
                  return (
                    <article key={deadline.id} className="learning-deadline-card">
                      <div>
                        <h4>{deadline.title}</h4>
                        <p>{deadline.subject || "Không gắn môn"} · {formatDate(deadline.due_date)}</p>
                      </div>
                      <div className="learning-card-actions">
                        <span className={`learning-badge ${daysLeft !== null && daysLeft <= 3 ? "danger" : "warning"}`}>
                          {daysLeft === null ? "Chưa rõ" : daysLeft < 0 ? "Quá hạn" : `${daysLeft} ngày`}
                        </span>
                        <button className="learning-status-button" type="button" onClick={() => createFromDeadline(deadline)}>
                          Tạo checklist
                        </button>
                      </div>
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

export default ExamModePage;
