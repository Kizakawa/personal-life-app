import { useEffect, useMemo, useState } from "react";
import {
  createDeadline,
  deleteDeadline,
  getDeadlines,
  updateDeadline,
} from "../api/deadlineApi";
import { getSubjects } from "../api/subjectsApi";
import "./DeadlinesPage.css";

const typeOptions = [
  { value: "assignment", label: "Bài tập", icon: "BT" },
  { value: "report", label: "Báo cáo", icon: "BC" },
  { value: "exam", label: "Thi", icon: "TH" },
  { value: "presentation", label: "Thuyết trình", icon: "TT" },
  { value: "other", label: "Khác", icon: "KH" },
];

const priorityOptions = [
  { value: "low", label: "Thấp" },
  { value: "medium", label: "Trung bình" },
  { value: "high", label: "Cao" },
];

const statusOptions = [
  { value: "pending", label: "Chưa làm" },
  { value: "doing", label: "Đang làm" },
  { value: "done", label: "Đã xong" },
];

const sortOptions = [
  { value: "urgency", label: "Cấp bách nhất" },
  { value: "due_asc", label: "Hạn gần nhất" },
  { value: "priority", label: "Ưu tiên cao nhất" },
  { value: "subject", label: "Theo môn học" },
  { value: "created_desc", label: "Mới thêm" },
];

const timeFilterOptions = [
  { value: "active", label: "Việc chưa xong" },
  { value: "overdue", label: "Quá hạn" },
  { value: "today", label: "Hôm nay" },
  { value: "three_days", label: "3 ngày tới" },
  { value: "week", label: "7 ngày tới" },
  { value: "done", label: "Đã xong" },
  { value: "all", label: "Tất cả" },
];

const deadlineTemplates = [
  {
    label: "Bài tập tuần",
    title: "Hoàn thành bài tập",
    type: "assignment",
    priority: "medium",
    note: "Việc cần làm: đọc yêu cầu, làm bản nháp, kiểm tra lại trước khi nộp.",
  },
  {
    label: "Báo cáo",
    title: "Nộp báo cáo",
    type: "report",
    priority: "high",
    note: "Chia nhỏ: dàn ý, nội dung chính, hình ảnh/bảng biểu, rà lỗi định dạng.",
  },
  {
    label: "Lịch thi",
    title: "Ôn thi",
    type: "exam",
    priority: "high",
    note: "Chuẩn bị: đề cương, công thức, bài tập mẫu, danh sách lỗi sai hay gặp.",
  },
  {
    label: "Thuyết trình",
    title: "Chuẩn bị thuyết trình",
    type: "presentation",
    priority: "high",
    note: "Chuẩn bị slide, phân vai nói, tập thử, kiểm tra file trước ngày trình bày.",
  },
];

const priorityRank = {
  high: 3,
  medium: 2,
  low: 1,
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function createEmptyForm() {
  return {
    title: "",
    subject: "",
    type: "assignment",
    due_date: todayString(),
    priority: "medium",
    status: "pending",
    note: "",
  };
}

function parseDateOnly(value) {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDaysUntil(value) {
  const dueDate = parseDateOnly(value);
  if (!dueDate) return null;

  const diff = dueDate.getTime() - startOfToday().getTime();
  return Math.round(diff / 86400000);
}

function formatDate(value) {
  const date = parseDateOnly(value);
  if (!date) return "Chưa có hạn";

  return date.toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCompactDate(value) {
  const date = parseDateOnly(value);
  if (!date) return "--/--";

  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  });
}

function getRelativeDueText(deadline) {
  if (deadline.status === "done") return "Đã hoàn thành";

  const days = getDaysUntil(deadline.due_date);
  if (days === null) return "Chưa có hạn";
  if (days < 0) return `Quá hạn ${Math.abs(days)} ngày`;
  if (days === 0) return "Hạn hôm nay";
  if (days === 1) return "Còn 1 ngày";
  return `Còn ${days} ngày`;
}

function getUrgency(deadline) {
  const days = getDaysUntil(deadline.due_date);
  const priorityBoost = deadline.priority === "high" ? 12 : deadline.priority === "medium" ? 6 : 0;

  if (deadline.status === "done") {
    return {
      key: "done",
      tone: "done",
      label: "Đã xong",
      helper: "Có thể lưu lại để đối chiếu sau.",
      score: -1,
    };
  }

  if (days === null) {
    return {
      key: "unknown",
      tone: "neutral",
      label: "Chưa rõ hạn",
      helper: "Nên bổ sung ngày hạn để hệ thống nhắc đúng.",
      score: 10 + priorityBoost,
    };
  }

  if (days < 0) {
    return {
      key: "overdue",
      tone: "danger",
      label: "Quá hạn",
      helper: "Cần xử lý ngay hoặc chủ động xin gia hạn.",
      score: 120 + Math.abs(days) + priorityBoost,
    };
  }

  if (days === 0) {
    return {
      key: "today",
      tone: "danger",
      label: "Hôm nay",
      helper: "Ưu tiên hoàn thành trước các việc khác.",
      score: 105 + priorityBoost,
    };
  }

  if (days <= 2) {
    return {
      key: "critical",
      tone: "warning",
      label: "Rất gấp",
      helper: "Nên chia nhỏ và bắt đầu ngay trong hôm nay.",
      score: 85 + priorityBoost,
    };
  }

  if (days <= 7) {
    return {
      key: "soon",
      tone: "notice",
      label: "Sắp tới",
      helper: "Đưa vào kế hoạch ngày để tránh dồn việc.",
      score: 55 + priorityBoost,
    };
  }

  return {
    key: "later",
    tone: "calm",
    label: "Còn thời gian",
    helper: "Có thể chuẩn bị dần, tránh để sát hạn.",
    score: 25 + priorityBoost,
  };
}

function getTypeLabel(type) {
  return typeOptions.find((item) => item.value === type)?.label || "Khác";
}

function getTypeIcon(type) {
  return typeOptions.find((item) => item.value === type)?.icon || "DL";
}

function getPriorityLabel(priority) {
  return priorityOptions.find((item) => item.value === priority)?.label || "Không rõ";
}

function getStatusLabel(status) {
  return statusOptions.find((item) => item.value === status)?.label || "Không rõ";
}

function buildDayRadar(deadlines) {
  const today = startOfToday();

  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const value = date.toISOString().slice(0, 10);
    const items = deadlines.filter(
      (deadline) => deadline.status !== "done" && deadline.due_date === value
    );

    return {
      value,
      label: index === 0 ? "Hôm nay" : date.toLocaleDateString("vi-VN", { weekday: "short" }),
      date: date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }),
      count: items.length,
      highCount: items.filter((item) => item.priority === "high").length,
    };
  });
}

function DeadlinesPage() {
  const [deadlines, setDeadlines] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState(createEmptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("active");
  const [sortBy, setSortBy] = useState("urgency");

  async function loadData(preferredSelectedId = null) {
    try {
      setLoading(true);
      setError("");

      const [deadlineData, subjectData] = await Promise.all([
        getDeadlines(),
        getSubjects(),
      ]);

      setDeadlines(deadlineData);
      setSubjects(subjectData);
      setSelectedId((current) => {
        const candidate = preferredSelectedId ?? current;
        const exists = deadlineData.some((item) => item.id === candidate);
        return exists ? candidate : deadlineData[0]?.id ?? null;
      });
    } catch (err) {
      console.error(err);
      setError("Không tải được dữ liệu deadline hoặc môn học.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const subjectOptions = useMemo(() => {
    const names = new Set();
    subjects.forEach((subject) => subject.name && names.add(subject.name));
    deadlines.forEach((deadline) => deadline.subject && names.add(deadline.subject));
    return Array.from(names).sort((a, b) => a.localeCompare(b, "vi"));
  }, [deadlines, subjects]);

  const enrichedDeadlines = useMemo(() => {
    return deadlines.map((deadline) => ({
      ...deadline,
      urgency: getUrgency(deadline),
      daysUntil: getDaysUntil(deadline.due_date),
    }));
  }, [deadlines]);

  const stats = useMemo(() => {
    const total = enrichedDeadlines.length;
    const active = enrichedDeadlines.filter((item) => item.status !== "done");
    const done = enrichedDeadlines.filter((item) => item.status === "done").length;
    const overdue = active.filter((item) => item.urgency.key === "overdue").length;
    const today = active.filter((item) => item.urgency.key === "today").length;
    const nextThreeDays = active.filter(
      (item) => item.daysUntil !== null && item.daysUntil >= 0 && item.daysUntil <= 3
    ).length;
    const nextSevenDays = active.filter(
      (item) => item.daysUntil !== null && item.daysUntil >= 0 && item.daysUntil <= 7
    ).length;
    const highPriority = active.filter((item) => item.priority === "high").length;
    const doing = active.filter((item) => item.status === "doing").length;
    const completionRate = total === 0 ? 0 : Math.round((done / total) * 100);

    const nearest = [...active].sort((a, b) => {
      const scoreDiff = b.urgency.score - a.urgency.score;
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(a.due_date || 0) - new Date(b.due_date || 0);
    })[0];

    return {
      total,
      active: active.length,
      done,
      overdue,
      today,
      nextThreeDays,
      nextSevenDays,
      highPriority,
      doing,
      completionRate,
      nearest,
    };
  }, [enrichedDeadlines]);

  const filteredDeadlines = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    const filtered = enrichedDeadlines.filter((deadline) => {
      const matchesQuery =
        !keyword ||
        [deadline.title, deadline.subject, deadline.note, deadline.due_date, getTypeLabel(deadline.type)]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(keyword));

      const matchesSubject = subjectFilter === "all" || (deadline.subject || "") === subjectFilter;
      const matchesType = typeFilter === "all" || deadline.type === typeFilter;
      const matchesPriority = priorityFilter === "all" || deadline.priority === priorityFilter;
      const matchesStatus = statusFilter === "all" || deadline.status === statusFilter;

      let matchesTime = true;
      if (timeFilter === "active") matchesTime = statusFilter === "done" ? true : deadline.status !== "done";
      if (timeFilter === "done") matchesTime = deadline.status === "done";
      if (timeFilter === "overdue") matchesTime = deadline.urgency.key === "overdue";
      if (timeFilter === "today") matchesTime = deadline.urgency.key === "today";
      if (timeFilter === "three_days") {
        matchesTime =
          deadline.status !== "done" &&
          deadline.daysUntil !== null &&
          deadline.daysUntil >= 0 &&
          deadline.daysUntil <= 3;
      }
      if (timeFilter === "week") {
        matchesTime =
          deadline.status !== "done" &&
          deadline.daysUntil !== null &&
          deadline.daysUntil >= 0 &&
          deadline.daysUntil <= 7;
      }

      return (
        matchesQuery &&
        matchesSubject &&
        matchesType &&
        matchesPriority &&
        matchesStatus &&
        matchesTime
      );
    });

    const sorted = [...filtered];

    switch (sortBy) {
      case "due_asc":
        sorted.sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0));
        break;
      case "priority":
        sorted.sort((a, b) => {
          const priorityDiff = (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
          if (priorityDiff !== 0) return priorityDiff;
          return b.urgency.score - a.urgency.score;
        });
        break;
      case "subject":
        sorted.sort((a, b) => {
          const subjectDiff = (a.subject || "Không gắn môn").localeCompare(
            b.subject || "Không gắn môn",
            "vi"
          );
          if (subjectDiff !== 0) return subjectDiff;
          return new Date(a.due_date || 0) - new Date(b.due_date || 0);
        });
        break;
      case "created_desc":
        sorted.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        break;
      case "urgency":
      default:
        sorted.sort((a, b) => {
          const urgencyDiff = b.urgency.score - a.urgency.score;
          if (urgencyDiff !== 0) return urgencyDiff;
          return new Date(a.due_date || 0) - new Date(b.due_date || 0);
        });
        break;
    }

    return sorted;
  }, [
    enrichedDeadlines,
    priorityFilter,
    query,
    sortBy,
    statusFilter,
    subjectFilter,
    timeFilter,
    typeFilter,
  ]);

  const groupedDeadlines = useMemo(() => {
    const groups = [
      {
        key: "overdue",
        title: "Quá hạn",
        helper: "Không nên để im lặng. Cần xử lý ngay hoặc chủ động xin gia hạn.",
        items: [],
      },
      {
        key: "today",
        title: "Hạn hôm nay",
        helper: "Đây là vùng cần ưu tiên cao nhất trong ngày.",
        items: [],
      },
      {
        key: "critical",
        title: "1 - 2 ngày tới",
        helper: "Rất dễ bị dồn việc. Nên chia nhỏ và đưa vào kế hoạch ngày.",
        items: [],
      },
      {
        key: "soon",
        title: "Trong 7 ngày",
        helper: "Nên chuẩn bị trước để không sát hạn mới làm.",
        items: [],
      },
      {
        key: "later",
        title: "Sau 7 ngày",
        helper: "Còn thời gian nhưng vẫn cần giữ trong tầm mắt.",
        items: [],
      },
      {
        key: "done",
        title: "Đã hoàn thành",
        helper: "Lưu lại để theo dõi tiến độ học tập.",
        items: [],
      },
      {
        key: "unknown",
        title: "Chưa rõ hạn",
        helper: "Cần bổ sung hạn để hệ thống phân loại chính xác.",
        items: [],
      },
    ];

    const groupMap = Object.fromEntries(groups.map((group) => [group.key, group]));

    filteredDeadlines.forEach((deadline) => {
      const target = groupMap[deadline.urgency.key] || groupMap.unknown;
      target.items.push(deadline);
    });

    return groups.filter((group) => group.items.length > 0);
  }, [filteredDeadlines]);

  const selectedDeadline = useMemo(() => {
    return enrichedDeadlines.find((deadline) => deadline.id === selectedId) || null;
  }, [enrichedDeadlines, selectedId]);

  const radarDays = useMemo(() => buildDayRadar(enrichedDeadlines), [enrichedDeadlines]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm(createEmptyForm());
    setEditingId(null);
    setShowForm(false);
  }

  function startCreate() {
    setForm(createEmptyForm());
    setEditingId(null);
    setShowForm(true);
  }

  function buildPayload() {
    return {
      title: form.title.trim(),
      subject: form.subject || null,
      type: form.type,
      due_date: form.due_date,
      priority: form.priority,
      status: form.status,
      note: form.note.trim() || null,
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      alert("Vui lòng nhập tên deadline.");
      return;
    }

    if (!form.due_date) {
      alert("Vui lòng chọn hạn nộp.");
      return;
    }

    try {
      const payload = buildPayload();
      const saved = editingId
        ? await updateDeadline(editingId, payload)
        : await createDeadline(payload);

      resetForm();
      await loadData(saved?.id ?? editingId);
    } catch (err) {
      console.error(err);
      alert("Lưu deadline thất bại.");
    }
  }

  function handleEdit(deadline) {
    setEditingId(deadline.id);
    setSelectedId(deadline.id);
    setShowForm(true);
    setForm({
      title: deadline.title || "",
      subject: deadline.subject || "",
      type: deadline.type || "assignment",
      due_date: deadline.due_date || todayString(),
      priority: deadline.priority || "medium",
      status: deadline.status || "pending",
      note: deadline.note || "",
    });
  }

  async function handleDelete(deadlineId) {
    const confirmed = window.confirm("Bạn có chắc muốn xóa deadline này?");
    if (!confirmed) return;

    try {
      await deleteDeadline(deadlineId);
      if (editingId === deadlineId) resetForm();
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Xóa deadline thất bại.");
    }
  }

  async function handleStatusChange(deadline, status) {
    try {
      await updateDeadline(deadline.id, { status });
      await loadData(deadline.id);
    } catch (err) {
      console.error(err);
      alert("Không thể cập nhật trạng thái deadline.");
    }
  }

  function handleSelect(deadlineId) {
    setSelectedId(deadlineId);
    setShowForm(false);
    setEditingId(null);
  }

  function applyTemplate(template) {
    setShowForm(true);
    setEditingId(null);
    setForm((current) => ({
      ...current,
      title: current.title || template.title,
      type: template.type,
      priority: template.priority,
      status: "pending",
      note: current.note ? `${current.note}\n${template.note}` : template.note,
    }));
  }

  function clearFilters() {
    setQuery("");
    setSubjectFilter("all");
    setTypeFilter("all");
    setPriorityFilter("all");
    setStatusFilter("all");
    setTimeFilter("active");
    setSortBy("urgency");
  }

  return (
    <div className="deadlines-page">
      <header className="page-header deadlines-header">
        <div>
          <span className="deadline-section-label">DEADLINE CONTROL</span>
          <h2>Deadline</h2>
          <p>
            Theo dõi hạn nộp theo mức độ cấp bách, ưu tiên việc sát hạn và gắn
            deadline với môn học để sinh viên luôn biết hôm nay cần xử lý gì trước.
          </p>
        </div>

        <button className="primary-button" type="button" onClick={startCreate}>
          + Thêm deadline
        </button>
      </header>

      <section className={`deadline-hero ${stats.nearest ? stats.nearest.urgency.tone : "calm"}`}>
        <div className="deadline-hero-main">
          <span className="deadline-hero-label">Cần chú ý nhất</span>
          {stats.nearest ? (
            <>
              <h3>{stats.nearest.title}</h3>
              <p>
                {getRelativeDueText(stats.nearest)} · {formatDate(stats.nearest.due_date)} · {stats.nearest.subject || "Không gắn môn"}
              </p>
            </>
          ) : (
            <>
              <h3>Không có deadline đang mở</h3>
              <p>Bạn đang tạm an toàn. Hãy thêm deadline mới ngay khi có bài tập, báo cáo hoặc lịch thi.</p>
            </>
          )}
        </div>

        <div className="deadline-hero-meter">
          <strong>{stats.completionRate}%</strong>
          <span>hoàn thành</span>
          <div className="deadline-progress-track">
            <div style={{ width: `${stats.completionRate}%` }} />
          </div>
        </div>
      </section>

      <section className="deadline-summary-grid">
        <article className="deadline-summary-card danger">
          <span>Quá hạn</span>
          <strong>{stats.overdue}</strong>
          <small>Cần xử lý trước tiên</small>
        </article>

        <article className="deadline-summary-card today">
          <span>Hạn hôm nay</span>
          <strong>{stats.today}</strong>
          <small>Không nên để qua ngày</small>
        </article>

        <article className="deadline-summary-card warning">
          <span>3 ngày tới</span>
          <strong>{stats.nextThreeDays}</strong>
          <small>Vùng nước rút gần</small>
        </article>

        <article className="deadline-summary-card">
          <span>7 ngày tới</span>
          <strong>{stats.nextSevenDays}</strong>
          <small>Cần đưa vào kế hoạch</small>
        </article>

        <article className="deadline-summary-card high">
          <span>Ưu tiên cao</span>
          <strong>{stats.highPriority}</strong>
          <small>Việc quan trọng đang mở</small>
        </article>

        <article className="deadline-summary-card success">
          <span>Đã xong</span>
          <strong>{stats.done}</strong>
          <small>{stats.active} việc còn mở</small>
        </article>
      </section>

      <section className="deadline-radar-panel">
        <div className="deadline-panel-heading">
          <div>
            <h3>Radar 14 ngày</h3>
            <p>Nhìn nhanh ngày nào đang có hạn nộp để tránh bị dồn việc.</p>
          </div>
        </div>

        <div className="deadline-radar-list">
          {radarDays.map((day) => (
            <button
              key={day.value}
              className={`deadline-radar-day ${day.count > 0 ? "has-deadline" : ""} ${day.highCount > 0 ? "has-high" : ""}`}
              type="button"
              onClick={() => {
                setTimeFilter(day.value === todayString() ? "today" : "all");
                setQuery(day.value);
              }}
              title={day.count > 0 ? `${day.count} deadline` : "Không có deadline"}
            >
              <span>{day.label}</span>
              <strong>{day.date}</strong>
              <small>{day.count > 0 ? `${day.count} hạn` : "trống"}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="deadline-toolbar-panel">
        <div className="deadline-toolbar">
          <label className="deadline-field search-field">
            <span>Tìm kiếm</span>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tên deadline, môn học, ghi chú..."
            />
          </label>

          <label className="deadline-field">
            <span>Môn học</span>
            <select value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
              <option value="all">Tất cả môn</option>
              {subjectOptions.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </label>

          <label className="deadline-field">
            <span>Khoảng thời gian</span>
            <select value={timeFilter} onChange={(event) => setTimeFilter(event.target.value)}>
              {timeFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="deadline-field">
            <span>Loại</span>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">Tất cả loại</option>
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="deadline-field">
            <span>Ưu tiên</span>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
              <option value="all">Tất cả</option>
              {priorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="deadline-field">
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

          <label className="deadline-field">
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

        <div className="deadline-toolbar-footer">
          <p>
            Hiển thị <strong>{filteredDeadlines.length}</strong> / {deadlines.length} deadline.
          </p>
          <button className="text-button" type="button" onClick={clearFilters}>
            Xóa bộ lọc
          </button>
        </div>
      </section>

      <div className="deadline-layout">
        <main className="deadline-main-column">
          {error && <p className="deadline-error">{error}</p>}

          {loading ? (
            <section className="deadline-panel deadline-empty-state">
              <h3>Đang tải deadline...</h3>
              <p>Hệ thống đang lấy dữ liệu hạn nộp và môn học.</p>
            </section>
          ) : filteredDeadlines.length === 0 ? (
            <section className="deadline-panel deadline-empty-state">
              <h3>Không có deadline phù hợp</h3>
              <p>Hãy đổi bộ lọc hoặc thêm hạn nộp mới để hệ thống theo dõi giúp bạn.</p>
              <button className="secondary-button" type="button" onClick={startCreate}>
                Thêm deadline
              </button>
            </section>
          ) : (
            groupedDeadlines.map((group) => (
              <section className={`deadline-panel deadline-group ${group.key}`} key={group.key}>
                <div className="deadline-group-heading">
                  <div>
                    <h3>{group.title}</h3>
                    <p>{group.helper}</p>
                  </div>
                  <span>{group.items.length}</span>
                </div>

                <div className="deadline-list">
                  {group.items.map((deadline) => (
                    <article
                      className={`deadline-item ${deadline.urgency.tone} ${selectedId === deadline.id ? "is-active" : ""}`}
                      key={deadline.id}
                      onClick={() => handleSelect(deadline.id)}
                    >
                      <div className="deadline-countdown">
                        <span>{deadline.urgency.label}</span>
                        <strong>{getRelativeDueText(deadline)}</strong>
                      </div>

                      <div className="deadline-content">
                        <div className="deadline-title-row">
                          <span className="deadline-type-icon">{getTypeIcon(deadline.type)}</span>
                          <div>
                            <h4>{deadline.title}</h4>
                            <p>
                              {deadline.subject || "Không gắn môn"} · {getTypeLabel(deadline.type)} · {formatDate(deadline.due_date)}
                            </p>
                          </div>
                        </div>

                        {deadline.note && <p className="deadline-note">{deadline.note}</p>}

                        <div className="deadline-badges">
                          <span className={`deadline-badge priority-${deadline.priority}`}>
                            Ưu tiên {getPriorityLabel(deadline.priority)}
                          </span>
                          <span className={`deadline-badge status-${deadline.status}`}>
                            {getStatusLabel(deadline.status)}
                          </span>
                        </div>
                      </div>

                      <div className="deadline-actions" onClick={(event) => event.stopPropagation()}>
                        {deadline.status !== "doing" && deadline.status !== "done" && (
                          <button
                            className="soft-button"
                            type="button"
                            onClick={() => handleStatusChange(deadline, "doing")}
                          >
                            Làm
                          </button>
                        )}
                        {deadline.status !== "done" ? (
                          <button
                            className="done-button"
                            type="button"
                            onClick={() => handleStatusChange(deadline, "done")}
                          >
                            Xong
                          </button>
                        ) : (
                          <button
                            className="soft-button"
                            type="button"
                            onClick={() => handleStatusChange(deadline, "pending")}
                          >
                            Mở lại
                          </button>
                        )}
                        <button className="edit-button" type="button" onClick={() => handleEdit(deadline)}>
                          Sửa
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}
        </main>

        <aside className="deadline-side-column">
          <section className="deadline-panel deadline-detail-panel">
            <div className="deadline-panel-heading align-top">
              <div>
                <h3>{showForm ? (editingId ? "Cập nhật deadline" : "Thêm deadline") : "Chi tiết deadline"}</h3>
                <p>
                  {showForm
                    ? "Ghi hạn nộp rõ ràng để hệ thống phân loại mức độ gấp."
                    : "Chọn một deadline để xem mức độ cấp bách và thao tác nhanh."}
                </p>
              </div>

              {!showForm && (
                <button className="icon-button" type="button" onClick={startCreate}>
                  +
                </button>
              )}
            </div>

            {showForm ? (
              <form className="deadline-form" onSubmit={handleSubmit}>
                <label className="deadline-field">
                  <span>Tên deadline *</span>
                  <input
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Ví dụ: Nộp báo cáo chương 3"
                  />
                </label>

                <label className="deadline-field">
                  <span>Môn học</span>
                  <select name="subject" value={form.subject} onChange={handleChange}>
                    <option value="">Không gắn môn học</option>
                    {subjectOptions.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="deadline-two-columns">
                  <label className="deadline-field">
                    <span>Loại</span>
                    <select name="type" value={form.type} onChange={handleChange}>
                      {typeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="deadline-field">
                    <span>Hạn nộp *</span>
                    <input
                      type="date"
                      name="due_date"
                      value={form.due_date}
                      onChange={handleChange}
                    />
                  </label>
                </div>

                <div className="deadline-two-columns">
                  <label className="deadline-field">
                    <span>Ưu tiên</span>
                    <select name="priority" value={form.priority} onChange={handleChange}>
                      {priorityOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="deadline-field">
                    <span>Trạng thái</span>
                    <select name="status" value={form.status} onChange={handleChange}>
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="deadline-field">
                  <span>Ghi chú</span>
                  <textarea
                    name="note"
                    value={form.note}
                    onChange={handleChange}
                    placeholder="Yêu cầu giảng viên, file cần nộp, tài liệu cần chuẩn bị..."
                    rows="5"
                  />
                </label>

                <div className="deadline-form-actions">
                  <button className="primary-button" type="submit">
                    {editingId ? "Lưu cập nhật" : "Thêm deadline"}
                  </button>
                  <button className="secondary-button" type="button" onClick={resetForm}>
                    Hủy
                  </button>
                </div>
              </form>
            ) : selectedDeadline ? (
              <div className="deadline-detail-card">
                <div className={`deadline-detail-alert ${selectedDeadline.urgency.tone}`}>
                  <span>{selectedDeadline.urgency.label}</span>
                  <strong>{getRelativeDueText(selectedDeadline)}</strong>
                  <p>{selectedDeadline.urgency.helper}</p>
                </div>

                <div className="deadline-detail-title">
                  <span className="deadline-type-icon large">{getTypeIcon(selectedDeadline.type)}</span>
                  <div>
                    <h4>{selectedDeadline.title}</h4>
                    <p>{selectedDeadline.subject || "Không gắn môn học"}</p>
                  </div>
                </div>

                <div className="deadline-detail-grid">
                  <article>
                    <span>Hạn</span>
                    <strong>{formatDate(selectedDeadline.due_date)}</strong>
                  </article>
                  <article>
                    <span>Loại</span>
                    <strong>{getTypeLabel(selectedDeadline.type)}</strong>
                  </article>
                  <article>
                    <span>Ưu tiên</span>
                    <strong>{getPriorityLabel(selectedDeadline.priority)}</strong>
                  </article>
                  <article>
                    <span>Trạng thái</span>
                    <strong>{getStatusLabel(selectedDeadline.status)}</strong>
                  </article>
                </div>

                <div className="deadline-detail-note">
                  <span>Ghi chú</span>
                  <p>
                    {selectedDeadline.note ||
                      "Chưa có ghi chú. Nên ghi rõ yêu cầu nộp, định dạng file, tài liệu cần chuẩn bị hoặc các bước nhỏ cần làm."}
                  </p>
                </div>

                <div className="deadline-detail-actions">
                  {selectedDeadline.status !== "done" && (
                    <button
                      className="done-button"
                      type="button"
                      onClick={() => handleStatusChange(selectedDeadline, "done")}
                    >
                      Đánh dấu xong
                    </button>
                  )}
                  <button className="edit-button" type="button" onClick={() => handleEdit(selectedDeadline)}>
                    Sửa
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => handleDelete(selectedDeadline.id)}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ) : (
              <div className="deadline-empty-state compact">
                <h3>Chưa chọn deadline</h3>
                <p>Chọn một mục ở danh sách hoặc thêm deadline mới.</p>
                <button className="secondary-button" type="button" onClick={startCreate}>
                  Thêm deadline
                </button>
              </div>
            )}
          </section>

          <section className="deadline-panel deadline-template-panel">
            <div className="deadline-panel-heading">
              <div>
                <h3>Mẫu thêm nhanh</h3>
                <p>Tạo nhanh các loại hạn phổ biến của sinh viên.</p>
              </div>
            </div>

            <div className="deadline-template-list">
              {deadlineTemplates.map((template) => (
                <button
                  key={template.label}
                  className="deadline-template-item"
                  type="button"
                  onClick={() => applyTemplate(template)}
                >
                  <strong>{template.label}</strong>
                  <span>{getTypeLabel(template.type)} · Ưu tiên {getPriorityLabel(template.priority)}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="deadline-panel deadline-method-panel">
            <h3>Quy tắc xử lý</h3>
            <div className="deadline-method-list">
              <article>
                <strong>Quá hạn / hôm nay</strong>
                <span>Làm trước hoặc xin gia hạn, không để chìm trong danh sách.</span>
              </article>
              <article>
                <strong>1 - 3 ngày tới</strong>
                <span>Chia nhỏ thành việc trong Kế hoạch ngày.</span>
              </article>
              <article>
                <strong>Trên 7 ngày</strong>
                <span>Chuẩn bị tài liệu, đề cương, file mẫu từ sớm.</span>
              </article>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default DeadlinesPage;
