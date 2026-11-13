import { useEffect, useMemo, useState } from "react";
import { getDeadlines } from "../api/deadlineApi";
import {
  createTask,
  deleteTask,
  getTasks,
  markTaskDone,
  updateTask,
} from "../api/taskApi";
import "./TasksPage.css";

function toDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const today = toDateInputValue();
const TASK_PAGE_SIZE = 300;

const initialForm = {
  title: "",
  task_date: today,
  start_time: "",
  end_time: "",
  priority: "medium",
  status: "pending",
  note: "",
  linked_deadline_id: "",
};

const priorityOptions = [
  { value: "low", label: "Nhẹ", tone: "low" },
  { value: "medium", label: "Vừa", tone: "medium" },
  { value: "high", label: "Quan trọng", tone: "high" },
];

const statusOptions = [
  { value: "pending", label: "Chưa làm", tone: "pending" },
  { value: "doing", label: "Đang làm", tone: "doing" },
  { value: "done", label: "Đã xong", tone: "done" },
];

const routineTemplates = [
  {
    label: "Tự học sâu",
    title: "Tự học / ôn bài tập trung",
    start_time: "08:00",
    end_time: "10:00",
    priority: "high",
    note: "Chọn một môn quan trọng, tắt thông báo và học liền mạch.",
  },
  {
    label: "Việc thường nhật",
    title: "Dọn dẹp và xử lý việc cá nhân",
    start_time: "10:15",
    end_time: "11:00",
    priority: "medium",
    note: "Xử lý việc nhỏ để đầu óc gọn gàng hơn.",
  },
  {
    label: "Nghỉ trưa",
    title: "Ăn trưa và nghỉ ngắn",
    start_time: "12:00",
    end_time: "13:15",
    priority: "low",
    note: "Nghỉ thật sự, tránh kéo dài việc học khi cơ thể đã mệt.",
  },
  {
    label: "Vận động",
    title: "Đi bộ / vận động nhẹ",
    start_time: "17:30",
    end_time: "18:00",
    priority: "medium",
    note: "Giữ sức khỏe để lịch học và sinh hoạt bền hơn.",
  },
  {
    label: "Tổng kết ngày",
    title: "Tổng kết ngày và chuẩn bị ngày mai",
    start_time: "21:30",
    end_time: "22:00",
    priority: "medium",
    note: "Đánh dấu việc đã xong, ghi lại việc tồn và chọn 3 việc chính cho ngày mai.",
  },
];

const timeSections = [
  { key: "morning", title: "Buổi sáng", subtitle: "05:00 - 11:59", start: 5, end: 12 },
  { key: "afternoon", title: "Buổi chiều", subtitle: "12:00 - 17:59", start: 12, end: 18 },
  { key: "evening", title: "Buổi tối", subtitle: "18:00 - 23:59", start: 18, end: 24 },
];

function parseLocalDate(dateString) {
  if (!dateString) return new Date();
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(dateString, amount) {
  const date = parseLocalDate(dateString);
  date.setDate(date.getDate() + amount);
  return toDateInputValue(date);
}

function getWeekStart(dateString) {
  const date = parseLocalDate(dateString);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function getWeekdayDates(dateString) {
  const weekStart = getWeekStart(dateString);
  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return toDateInputValue(date);
  });
}

function getDayName(dateString) {
  const day = parseLocalDate(dateString).getDay();
  if (day === 0) return "Chủ nhật";
  return `Thứ ${day + 1}`;
}

function formatDate(dateString, mode = "long") {
  if (!dateString) return "Chưa có ngày";
  const date = parseLocalDate(dateString);

  if (mode === "short") {
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
    });
  }

  return date.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function normalizeTime(time) {
  return time ? time.slice(0, 5) : "";
}

function timeToMinutes(time) {
  if (!time) return null;
  const [hour, minute] = normalizeTime(time).split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return hour * 60 + minute;
}

function getTaskTimeLabel(task) {
  const start = normalizeTime(task.start_time);
  const end = normalizeTime(task.end_time);

  if (start && end) return `${start} - ${end}`;
  if (start) return `Từ ${start}`;
  if (end) return `Trước ${end}`;
  return "Chưa đặt giờ";
}

function getDurationLabel(task) {
  const start = timeToMinutes(task.start_time);
  const end = timeToMinutes(task.end_time);

  if (start === null || end === null || end <= start) return "Chưa rõ thời lượng";

  const diff = end - start;
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;

  if (hours && minutes) return `${hours} giờ ${minutes} phút`;
  if (hours) return `${hours} giờ`;
  return `${minutes} phút`;
}

function getPriorityLabel(priority) {
  return priorityOptions.find((item) => item.value === priority)?.label || "Không rõ";
}

function getStatusLabel(status) {
  return statusOptions.find((item) => item.value === status)?.label || "Không rõ";
}

function sortTasks(a, b) {
  const priorityRank = { high: 0, medium: 1, low: 2 };
  const statusRank = { doing: 0, pending: 1, done: 2 };
  const aStart = timeToMinutes(a.start_time);
  const bStart = timeToMinutes(b.start_time);

  if (aStart !== null && bStart !== null && aStart !== bStart) return aStart - bStart;
  if (aStart !== null && bStart === null) return -1;
  if (aStart === null && bStart !== null) return 1;

  const statusDiff = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
  if (statusDiff !== 0) return statusDiff;

  const priorityDiff = (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
  if (priorityDiff !== 0) return priorityDiff;

  return a.title.localeCompare(b.title, "vi");
}

function groupTasksBySession(tasks) {
  const groups = {
    morning: [],
    afternoon: [],
    evening: [],
    unscheduled: [],
  };

  tasks.forEach((task) => {
    const start = timeToMinutes(task.start_time);
    if (start === null) {
      groups.unscheduled.push(task);
      return;
    }

    const hour = Math.floor(start / 60);
    const section = timeSections.find((item) => hour >= item.start && hour < item.end);
    groups[section?.key || "unscheduled"].push(task);
  });

  return groups;
}

function getConflictIds(tasks) {
  const timedTasks = tasks
    .map((task) => ({
      ...task,
      startMinute: timeToMinutes(task.start_time),
      endMinute: timeToMinutes(task.end_time),
    }))
    .filter((task) => task.startMinute !== null && task.endMinute !== null && task.endMinute > task.startMinute)
    .sort((a, b) => a.startMinute - b.startMinute);

  const conflictIds = new Set();

  for (let i = 0; i < timedTasks.length; i += 1) {
    for (let j = i + 1; j < timedTasks.length; j += 1) {
      if (timedTasks[j].startMinute >= timedTasks[i].endMinute) break;
      conflictIds.add(timedTasks[i].id);
      conflictIds.add(timedTasks[j].id);
    }
  }

  return conflictIds;
}

function getFreeBlocks(tasks) {
  const dayStart = 6 * 60;
  const dayEnd = 23 * 60;
  const timedTasks = tasks
    .map((task) => ({
      start: timeToMinutes(task.start_time),
      end: timeToMinutes(task.end_time),
    }))
    .filter((task) => task.start !== null && task.end !== null && task.end > task.start)
    .sort((a, b) => a.start - b.start);

  const blocks = [];
  let cursor = dayStart;

  timedTasks.forEach((task) => {
    if (task.start - cursor >= 45) {
      blocks.push({ start: cursor, end: task.start });
    }
    cursor = Math.max(cursor, task.end);
  });

  if (dayEnd - cursor >= 45) {
    blocks.push({ start: cursor, end: dayEnd });
  }

  return blocks.slice(0, 4);
}

function minutesToTime(minutes) {
  const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [form, setForm] = useState({ ...initialForm, task_date: today });
  const [editingId, setEditingId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [repeatMode, setRepeatMode] = useState("none");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasMoreTasks, setHasMoreTasks] = useState(false);
  const [loadingMoreTasks, setLoadingMoreTasks] = useState(false);

  async function loadData(preferredTaskId = null) {
    try {
      setLoading(true);
      setError("");

      const [taskData, deadlineData] = await Promise.all([getTasks({ limit: TASK_PAGE_SIZE, offset: 0 }), getDeadlines()]);
      setTasks(taskData);
      setHasMoreTasks(taskData.length === TASK_PAGE_SIZE);
      setDeadlines(deadlineData);

      setSelectedTaskId((current) => {
        const preferredExists = preferredTaskId && taskData.some((item) => item.id === preferredTaskId);
        if (preferredExists) return preferredTaskId;

        const currentExists = current && taskData.some((item) => item.id === current);
        if (currentExists) return current;

        return null;
      });
    } catch (err) {
      console.error(err);
      setError("Không tải được dữ liệu kế hoạch ngày hoặc deadline.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    function handleTasksChanged(event) {
      loadData(event.detail?.taskId || null);
    }

    window.addEventListener("personal-life:tasks-changed", handleTasksChanged);

    return () => {
      window.removeEventListener("personal-life:tasks-changed", handleTasksChanged);
    };
  }, []);

  const tasksByDate = useMemo(() => {
    return tasks.reduce((map, task) => {
      const key = task.task_date;
      if (!map[key]) map[key] = [];
      map[key].push(task);
      return map;
    }, {});
  }, [tasks]);

  const weekDays = useMemo(() => {
    const weekStart = getWeekStart(selectedDate);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      const value = toDateInputValue(date);
      const dayTasks = tasksByDate[value] || [];
      const done = dayTasks.filter((item) => item.status === "done").length;

      return {
        value,
        dayName: getDayName(value),
        dateLabel: formatDate(value, "short"),
        count: dayTasks.length,
        done,
      };
    });
  }, [selectedDate, tasksByDate]);

  const selectedDayRawTasks = useMemo(() => {
    return [...(tasksByDate[selectedDate] || [])].sort(sortTasks);
  }, [selectedDate, tasksByDate]);

  const selectedDayTasks = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return selectedDayRawTasks.filter((task) => {
      const matchesStatus = statusFilter === "all" || task.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;
      const matchesQuery =
        !keyword ||
        [task.title, task.note]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(keyword));

      return matchesStatus && matchesPriority && matchesQuery;
    });
  }, [priorityFilter, query, selectedDayRawTasks, statusFilter]);

  const selectedTask = useMemo(() => {
    return tasks.find((task) => task.id === selectedTaskId) || null;
  }, [selectedTaskId, tasks]);

  const groupedTasks = useMemo(() => groupTasksBySession(selectedDayTasks), [selectedDayTasks]);
  const conflictIds = useMemo(() => getConflictIds(selectedDayRawTasks), [selectedDayRawTasks]);
  const freeBlocks = useMemo(() => getFreeBlocks(selectedDayRawTasks), [selectedDayRawTasks]);

  const dayStats = useMemo(() => {
    const total = selectedDayRawTasks.length;
    const done = selectedDayRawTasks.filter((task) => task.status === "done").length;
    const doing = selectedDayRawTasks.filter((task) => task.status === "doing").length;
    const pending = selectedDayRawTasks.filter((task) => task.status === "pending").length;
    const high = selectedDayRawTasks.filter((task) => task.priority === "high" && task.status !== "done").length;

    const plannedMinutes = selectedDayRawTasks.reduce((sum, task) => {
      const start = timeToMinutes(task.start_time);
      const end = timeToMinutes(task.end_time);
      if (start === null || end === null || end <= start) return sum;
      return sum + end - start;
    }, 0);

    return {
      total,
      done,
      doing,
      pending,
      high,
      plannedMinutes,
      completion: total ? Math.round((done / total) * 100) : 0,
    };
  }, [selectedDayRawTasks]);

  const upcomingDeadlines = useMemo(() => {
    const start = parseLocalDate(selectedDate).getTime();
    const end = parseLocalDate(addDays(selectedDate, 7)).getTime();

    return deadlines
      .filter((deadline) => deadline.status !== "done")
      .filter((deadline) => {
        const due = parseLocalDate(deadline.due_date).getTime();
        return due >= start && due <= end;
      })
      .sort((a, b) => parseLocalDate(a.due_date) - parseLocalDate(b.due_date))
      .slice(0, 4);
  }, [deadlines, selectedDate]);

  function getDeadline(deadlineId) {
    if (!deadlineId) return null;
    return deadlines.find((item) => item.id === Number(deadlineId)) || null;
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm({ ...initialForm, task_date: selectedDate });
    setEditingId(null);
    setRepeatMode("none");
    setShowForm(false);
  }

  function startCreate(overrides = {}) {
    setEditingId(null);
    setRepeatMode("none");
    setForm({
      ...initialForm,
      task_date: selectedDate,
      ...overrides,
    });
    setShowForm(true);
  }

  function startTemplate(template) {
    startCreate({
      ...template,
      task_date: selectedDate,
      status: "pending",
      linked_deadline_id: "",
    });
  }

  function startFromDeadline(deadline) {
    startCreate({
      title: `Xử lý: ${deadline.title}`,
      task_date: selectedDate,
      start_time: "",
      end_time: "",
      priority: deadline.priority || "high",
      status: deadline.status === "doing" ? "doing" : "pending",
      note: deadline.subject
        ? `Deadline môn ${deadline.subject}, hạn ${formatDate(deadline.due_date)}.`
        : `Deadline hạn ${formatDate(deadline.due_date)}.`,
      linked_deadline_id: String(deadline.id),
    });
  }

  function handleEdit(task) {
    setEditingId(task.id);
    setSelectedTaskId(task.id);
    setSelectedDate(task.task_date || selectedDate);
    setRepeatMode("none");
    setShowForm(true);

    setForm({
      title: task.title || "",
      task_date: task.task_date || selectedDate,
      start_time: normalizeTime(task.start_time),
      end_time: normalizeTime(task.end_time),
      priority: task.priority || "medium",
      status: task.status || "pending",
      note: task.note || "",
      linked_deadline_id: task.linked_deadline_id ? String(task.linked_deadline_id) : "",
    });
  }

  function selectTask(task) {
    setSelectedTaskId(task.id);
    setShowForm(false);
    setEditingId(null);
  }

  function buildPayload(dateOverride = form.task_date) {
    return {
      title: form.title.trim(),
      task_date: dateOverride,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      priority: form.priority,
      status: form.status,
      note: form.note.trim() || null,
      linked_deadline_id: form.linked_deadline_id ? Number(form.linked_deadline_id) : null,
    };
  }

  function getSubmitDates() {
    if (editingId || repeatMode === "none") return [form.task_date];
    if (repeatMode === "next7") {
      return Array.from({ length: 7 }, (_, index) => addDays(form.task_date, index));
    }
    if (repeatMode === "weekdays") return getWeekdayDates(form.task_date);
    return [form.task_date];
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      alert("Vui lòng nhập tên việc cần làm.");
      return;
    }

    if (!form.task_date) {
      alert("Vui lòng chọn ngày thực hiện.");
      return;
    }

    const start = timeToMinutes(form.start_time);
    const end = timeToMinutes(form.end_time);

    if (start !== null && end !== null && end <= start) {
      alert("Giờ kết thúc phải sau giờ bắt đầu.");
      return;
    }

    try {
      if (editingId) {
        await updateTask(editingId, buildPayload());
        setSelectedDate(form.task_date);
        await loadData(editingId);
      } else {
        const dates = getSubmitDates();
        const createdTasks = await Promise.all(dates.map((date) => createTask(buildPayload(date))));
        setSelectedDate(form.task_date);
        await loadData(createdTasks[0]?.id || null);
      }

      resetForm();
    } catch (err) {
      console.error(err);
      alert("Lưu việc cần làm thất bại.");
    }
  }

  async function handleDelete(taskId) {
    const confirmDelete = window.confirm("Bạn có chắc muốn xóa việc này?");
    if (!confirmDelete) return;

    try {
      await deleteTask(taskId);
      setSelectedTaskId((current) => (current === taskId ? null : current));
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Xóa việc cần làm thất bại.");
    }
  }

  async function handleStatusChange(task, nextStatus) {
    try {
      if (nextStatus === "done") {
        await markTaskDone(task.id);
      } else {
        await updateTask(task.id, { status: nextStatus });
      }
      await loadData(task.id);
    } catch (err) {
      console.error(err);
      alert("Không thể cập nhật trạng thái việc cần làm.");
    }
  }

  function clearFilters() {
    setStatusFilter("all");
    setPriorityFilter("all");
    setQuery("");
  }

  async function handleLoadMoreTasks() {
    try {
      setLoadingMoreTasks(true);
      const moreTasks = await getTasks({ limit: TASK_PAGE_SIZE, offset: tasks.length });
      setTasks((current) => [...current, ...moreTasks]);
      setHasMoreTasks(moreTasks.length === TASK_PAGE_SIZE);
    } catch (err) {
      console.error(err);
      setError("Không tải thêm được kế hoạch ngày.");
    } finally {
      setLoadingMoreTasks(false);
    }
  }

  return (
    <div className={`tasks-page ${showForm ? "entry-mode" : ""}`}>
      <header className="page-header tasks-header">
        <div>
          <span className="tasks-section-label">DAILY PLAN</span>
          <h2>Kế hoạch ngày</h2>
          <p>
            Lập thời khóa biểu sinh hoạt hằng ngày, chia việc theo buổi, quản lý giờ học,
            việc cá nhân, deadline và các khoảng nghỉ để một ngày không bị rối.
          </p>
        </div>

        <button className="primary-button" type="button" onClick={() => startCreate()}>
          + Thêm việc
        </button>
      </header>

      <section className="tasks-day-switcher">
        <label>
          <span>Ngày đang xem</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => {
              setSelectedDate(event.target.value || today);
              setShowForm(false);
              setEditingId(null);
            }}
          />
        </label>
      </section>

      <section className="tasks-week-strip" aria-label="Tuần đang xem">
        {weekDays.map((day) => {
          const isActive = day.value === selectedDate;
          const isToday = day.value === today;
          const percent = day.count ? Math.round((day.done / day.count) * 100) : 0;

          return (
            <button
              key={day.value}
              type="button"
              className={`${isActive ? "is-active" : ""} ${isToday ? "is-today" : ""}`}
              onClick={() => {
                setSelectedDate(day.value);
                setShowForm(false);
                setEditingId(null);
              }}
            >
              <strong>{day.dayName}</strong>
              <span>{day.dateLabel}</span>
              <small>
                {day.count ? `${day.done}/${day.count} xong · ${percent}%` : "Chưa có việc"}
              </small>
            </button>
          );
        })}
      </section>

      <section className="tasks-summary-grid">
        <article className="tasks-summary-card progress-card">
          <div
            className="tasks-progress-ring"
            style={{ "--progress": `${dayStats.completion * 3.6}deg` }}
          >
            <strong>{dayStats.completion}%</strong>
          </div>
          <div>
            <span>Tiến độ ngày</span>
            <p>
              {dayStats.done}/{dayStats.total || 0} việc đã hoàn thành trong {formatDate(selectedDate)}.
            </p>
          </div>
        </article>

        <article className="tasks-summary-card">
          <span>Đang làm</span>
          <strong>{dayStats.doing}</strong>
          <small>{dayStats.pending} việc chưa làm</small>
        </article>

        <article className="tasks-summary-card warning">
          <span>Việc quan trọng</span>
          <strong>{dayStats.high}</strong>
          <small>Cần ưu tiên trước khi xử lý việc nhẹ</small>
        </article>

        <article className="tasks-summary-card">
          <span>Thời lượng đã lên lịch</span>
          <strong>{Math.floor(dayStats.plannedMinutes / 60)}h{dayStats.plannedMinutes % 60 ? ` ${dayStats.plannedMinutes % 60}m` : ""}</strong>
          <small>Tính từ các việc có giờ bắt đầu và kết thúc</small>
        </article>
      </section>

      <section className="tasks-panel tasks-toolbar-panel">
        <div className="tasks-toolbar">
          <label className="tasks-field search-field">
            <span>Tìm nhanh trong ngày</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm việc học, sinh hoạt, deadline, ghi chú..."
            />
          </label>

          <label className="tasks-field">
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

          <label className="tasks-field">
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
        </div>

        <div className="tasks-toolbar-footer">
          <p>
            Đang hiển thị <strong>{selectedDayTasks.length}</strong> / {selectedDayRawTasks.length} việc trong ngày.
          </p>
          <button className="text-button" type="button" onClick={clearFilters}>
            Xóa bộ lọc
          </button>
          {hasMoreTasks && (
            <button className="text-button" type="button" onClick={handleLoadMoreTasks} disabled={loadingMoreTasks}>
              {loadingMoreTasks ? "Đang tải..." : "Tải thêm việc"}
            </button>
          )}
        </div>
      </section>

      {error && <p className="tasks-error-message">{error}</p>}

      <div className="tasks-layout">
        <main className="tasks-main-column">
          <section className="tasks-panel tasks-timeline-panel">
            <div className="tasks-panel-header">
              <div>
                <h3>{formatDate(selectedDate)}</h3>
                <p>Chia ngày thành các buổi để nhìn rõ việc học, việc cá nhân và giờ nghỉ.</p>
              </div>
              <button className="icon-button" type="button" onClick={() => startCreate()}>
                +
              </button>
            </div>

            {loading ? (
              <p className="tasks-empty">Đang tải kế hoạch ngày...</p>
            ) : selectedDayTasks.length === 0 ? (
              <div className="tasks-empty-state">
                <h4>Ngày này chưa có kế hoạch</h4>
                <p>Hãy thêm một việc nhỏ trước, ví dụ tự học 90 phút hoặc tổng kết ngày.</p>
                <button className="secondary-button" type="button" onClick={() => startCreate()}>
                  Thêm việc đầu tiên
                </button>
              </div>
            ) : (
              <div className="tasks-timeline">
                {timeSections.map((section) => (
                  <section className="tasks-time-section" key={section.key}>
                    <div className="tasks-time-label">
                      <strong>{section.title}</strong>
                      <span>{section.subtitle}</span>
                    </div>

                    <div className="tasks-time-list">
                      {groupedTasks[section.key].length === 0 ? (
                        <button
                          className="tasks-empty-slot"
                          type="button"
                          onClick={() =>
                            startCreate({
                              start_time: section.key === "morning" ? "08:00" : section.key === "afternoon" ? "14:00" : "19:30",
                              end_time: section.key === "morning" ? "09:00" : section.key === "afternoon" ? "15:00" : "20:30",
                            })
                          }
                        >
                          + Thêm việc cho {section.title.toLowerCase()}
                        </button>
                      ) : (
                        groupedTasks[section.key].map((task) => {
                          const deadline = getDeadline(task.linked_deadline_id);
                          const hasConflict = conflictIds.has(task.id);

                          return (
                            <article
                              className={`tasks-timeline-card status-${task.status} priority-${task.priority} ${
                                selectedTaskId === task.id ? "is-selected" : ""
                              }`}
                              key={task.id}
                              onClick={() => selectTask(task)}
                            >
                              <div className="tasks-card-time">
                                <strong>{getTaskTimeLabel(task)}</strong>
                                <span>{getDurationLabel(task)}</span>
                              </div>

                              <div className="tasks-card-content">
                                <div className="tasks-card-title-row">
                                  <h4>{task.title}</h4>
                                  {hasConflict && <span className="tasks-conflict-badge">Trùng giờ</span>}
                                </div>

                                <div className="tasks-card-meta">
                                  <span className={`task-badge priority-${task.priority}`}>
                                    {getPriorityLabel(task.priority)}
                                  </span>
                                  <span className={`task-badge status-${task.status}`}>
                                    {getStatusLabel(task.status)}
                                  </span>
                                  {deadline && <span className="task-badge deadline">{deadline.title}</span>}
                                </div>

                                {task.note && <p>{task.note}</p>}
                              </div>

                              <div className="tasks-card-actions" onClick={(event) => event.stopPropagation()}>
                                {task.status !== "done" && (
                                  <button type="button" onClick={() => handleStatusChange(task, "done")}>
                                    Xong
                                  </button>
                                )}
                                {task.status === "pending" && (
                                  <button type="button" onClick={() => handleStatusChange(task, "doing")}>
                                    Bắt đầu
                                  </button>
                                )}
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>
                  </section>
                ))}

                <section className="tasks-time-section">
                  <div className="tasks-time-label">
                    <strong>Chưa đặt giờ</strong>
                    <span>Việc linh hoạt</span>
                  </div>

                  <div className="tasks-time-list">
                    {groupedTasks.unscheduled.length === 0 ? (
                      <p className="tasks-muted-line">Không có việc linh hoạt.</p>
                    ) : (
                      groupedTasks.unscheduled.map((task) => {
                        const deadline = getDeadline(task.linked_deadline_id);

                        return (
                          <article
                            className={`tasks-timeline-card compact status-${task.status} priority-${task.priority} ${
                              selectedTaskId === task.id ? "is-selected" : ""
                            }`}
                            key={task.id}
                            onClick={() => selectTask(task)}
                          >
                            <div className="tasks-card-content">
                              <div className="tasks-card-title-row">
                                <h4>{task.title}</h4>
                              </div>

                              <div className="tasks-card-meta">
                                <span className={`task-badge priority-${task.priority}`}>
                                  {getPriorityLabel(task.priority)}
                                </span>
                                <span className={`task-badge status-${task.status}`}>
                                  {getStatusLabel(task.status)}
                                </span>
                                {deadline && <span className="task-badge deadline">{deadline.title}</span>}
                              </div>

                              {task.note && <p>{task.note}</p>}
                            </div>

                            <div className="tasks-card-actions" onClick={(event) => event.stopPropagation()}>
                              {task.status !== "done" && (
                                <button type="button" onClick={() => handleStatusChange(task, "done")}>
                                  Xong
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </section>
              </div>
            )}
          </section>
        </main>

        <aside className="tasks-side-column">
          <section className="tasks-panel tasks-detail-panel">
            <div className="tasks-panel-header align-top">
              <div>
                <h3>{showForm ? (editingId ? "Cập nhật kế hoạch" : "Thêm kế hoạch") : "Chi tiết"}</h3>
                <p>
                  {showForm
                    ? "Tạo việc theo giờ hoặc nhân bản thành lịch sinh hoạt trong tuần."
                    : "Chọn một việc trong ngày để xem, sửa hoặc đánh dấu trạng thái."}
                </p>
              </div>

              {!showForm && (
                <button className="icon-button" type="button" onClick={() => startCreate()}>
                  +
                </button>
              )}
            </div>

            {showForm ? (
              <form className="tasks-form" onSubmit={handleSubmit}>
                <label className="tasks-field">
                  <span>Tên việc cần làm *</span>
                  <input
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Ví dụ: Tự học xử lý ảnh số"
                  />
                </label>

                <label className="tasks-field">
                  <span>Ngày thực hiện</span>
                  <input type="date" name="task_date" value={form.task_date} onChange={handleChange} />
                </label>

                <div className="tasks-two-columns">
                  <label className="tasks-field">
                    <span>Bắt đầu</span>
                    <input type="time" name="start_time" value={form.start_time} onChange={handleChange} />
                  </label>

                  <label className="tasks-field">
                    <span>Kết thúc</span>
                    <input type="time" name="end_time" value={form.end_time} onChange={handleChange} />
                  </label>
                </div>

                <div className="tasks-two-columns">
                  <label className="tasks-field">
                    <span>Ưu tiên</span>
                    <select name="priority" value={form.priority} onChange={handleChange}>
                      {priorityOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="tasks-field">
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

                <label className="tasks-field">
                  <span>Deadline liên kết</span>
                  <select name="linked_deadline_id" value={form.linked_deadline_id} onChange={handleChange}>
                    <option value="">Không gắn deadline</option>
                    {deadlines.map((deadline) => (
                      <option key={deadline.id} value={deadline.id}>
                        {deadline.title}
                        {deadline.subject ? ` - ${deadline.subject}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                {!editingId && (
                  <label className="tasks-field">
                    <span>Nhân bản lịch</span>
                    <select value={repeatMode} onChange={(event) => setRepeatMode(event.target.value)}>
                      <option value="none">Chỉ tạo cho ngày này</option>
                      <option value="next7">Lặp trong 7 ngày tới</option>
                      <option value="weekdays">Tạo cho Thứ 2 - Thứ 6 của tuần này</option>
                    </select>
                  </label>
                )}

                <label className="tasks-field">
                  <span>Ghi chú</span>
                  <textarea
                    name="note"
                    value={form.note}
                    onChange={handleChange}
                    placeholder="Ghi rõ mục tiêu nhỏ, tài liệu cần mở, hoặc lý do việc này quan trọng..."
                    rows="5"
                  />
                </label>

                <div className="tasks-form-actions">
                  <button className="primary-button" type="submit">
                    {editingId ? "Lưu cập nhật" : "Thêm vào kế hoạch"}
                  </button>
                  <button className="secondary-button" type="button" onClick={resetForm}>
                    Hủy
                  </button>
                </div>
              </form>
            ) : selectedTask ? (
              <div className="tasks-detail-card">
                <div className="tasks-detail-top">
                  <div>
                    <span>{formatDate(selectedTask.task_date)}</span>
                    <h4>{selectedTask.title}</h4>
                    <p>{getTaskTimeLabel(selectedTask)} · {getDurationLabel(selectedTask)}</p>
                  </div>
                  <span className={`task-badge status-${selectedTask.status}`}>
                    {getStatusLabel(selectedTask.status)}
                  </span>
                </div>

                <div className="tasks-detail-grid">
                  <article>
                    <span>Ưu tiên</span>
                    <strong>{getPriorityLabel(selectedTask.priority)}</strong>
                  </article>
                  <article>
                    <span>Deadline</span>
                    <strong>{getDeadline(selectedTask.linked_deadline_id)?.title || "Không gắn"}</strong>
                  </article>
                  <article>
                    <span>Ngày</span>
                    <strong>{formatDate(selectedTask.task_date, "short")}</strong>
                  </article>
                  <article>
                    <span>Trạng thái</span>
                    <strong>{getStatusLabel(selectedTask.status)}</strong>
                  </article>
                </div>

                <div className="tasks-detail-note">
                  <span>Ghi chú</span>
                  <p>{selectedTask.note || "Chưa có ghi chú cho việc này."}</p>
                </div>

                <div className="tasks-detail-actions">
                  {selectedTask.status !== "doing" && selectedTask.status !== "done" && (
                    <button className="edit-button" type="button" onClick={() => handleStatusChange(selectedTask, "doing")}>
                      Bắt đầu
                    </button>
                  )}
                  {selectedTask.status !== "done" && (
                    <button className="edit-button" type="button" onClick={() => handleStatusChange(selectedTask, "done")}>
                      Xong
                    </button>
                  )}
                  <button className="edit-button" type="button" onClick={() => handleEdit(selectedTask)}>
                    Sửa
                  </button>
                  <button className="danger-button" type="button" onClick={() => handleDelete(selectedTask.id)}>
                    Xóa
                  </button>
                </div>
              </div>
            ) : (
              <div className="tasks-empty-state compact">
                <h4>Chưa chọn việc nào</h4>
                <p>Chọn một thẻ trong timeline hoặc thêm một kế hoạch mới cho ngày này.</p>
                <button className="secondary-button" type="button" onClick={() => startCreate()}>
                  Thêm kế hoạch
                </button>
              </div>
            )}
          </section>

          <section className="tasks-panel tasks-template-panel">
            <div className="tasks-panel-header">
              <div>
                <h3>Lịch sinh hoạt mẫu</h3>
                <p>Chạm một lần để điền nhanh những việc quen thuộc.</p>
              </div>
            </div>

            <div className="tasks-template-list">
              {routineTemplates.map((template) => (
                <button key={template.label} type="button" onClick={() => startTemplate(template)}>
                  <strong>{template.label}</strong>
                  <span>{template.start_time} - {template.end_time}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="tasks-panel tasks-suggestion-panel">
            <div className="tasks-panel-header">
              <div>
                <h3>Gợi ý trong ngày</h3>
                <p>Các khoảng trống và deadline gần để biến thành việc cụ thể.</p>
              </div>
            </div>

            <div className="tasks-free-blocks">
              <h4>Khoảng trống có thể dùng</h4>
              {freeBlocks.length === 0 ? (
                <p className="tasks-muted-line">Ngày này đã khá kín hoặc chưa có đủ giờ để phân tích.</p>
              ) : (
                freeBlocks.map((block) => (
                  <button
                    key={`${block.start}-${block.end}`}
                    type="button"
                    onClick={() =>
                      startCreate({
                        start_time: minutesToTime(block.start),
                        end_time: minutesToTime(Math.min(block.end, block.start + 60)),
                      })
                    }
                  >
                    {minutesToTime(block.start)} - {minutesToTime(block.end)}
                  </button>
                ))
              )}
            </div>

            <div className="tasks-deadline-suggestions">
              <h4>Deadline 7 ngày tới</h4>
              {upcomingDeadlines.length === 0 ? (
                <p className="tasks-muted-line">Không có deadline gần trong khoảng này.</p>
              ) : (
                upcomingDeadlines.map((deadline) => (
                  <button key={deadline.id} type="button" onClick={() => startFromDeadline(deadline)}>
                    <div>
                      <strong>{deadline.title}</strong>
                      <span>{deadline.subject || "Không có môn"} · hạn {formatDate(deadline.due_date, "short")}</span>
                    </div>
                    <span className={`task-badge priority-${deadline.priority || "medium"}`}>
                      {getPriorityLabel(deadline.priority || "medium")}
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default TasksPage;
