import { useEffect, useMemo, useState } from "react";

import {
  createEvent,
  deleteEvent,
  getEvents,
  updateEvent,
} from "../api/eventsApi";
import "./EventsPage.css";

const eventTypes = {
  birthday: {
    label: "Sinh nhật",
    short: "SN",
    color: "#ec4899",
    description: "Ngày sinh, kỷ niệm cá nhân",
  },
  exam: {
    label: "Lịch thi",
    short: "LT",
    color: "#7c3aed",
    description: "Thi, kiểm tra, vấn đáp",
  },
  assignment: {
    label: "Deadline",
    short: "DL",
    color: "#2563eb",
    description: "Nộp bài, báo cáo, đồ án",
  },
  meeting: {
    label: "Cuộc hẹn",
    short: "CH",
    color: "#0f766e",
    description: "Gặp mặt, lịch trao đổi",
  },
  personal: {
    label: "Cá nhân",
    short: "CN",
    color: "#f97316",
    description: "Việc riêng cần nhớ",
  },
  other: {
    label: "Khác",
    short: "KH",
    color: "#64748b",
    description: "Mốc quan trọng khác",
  },
};

const priorityLabels = {
  low: "Nhẹ",
  medium: "Vừa",
  high: "Quan trọng",
};

const reminderOptions = [
  { value: 0, label: "Không nhắc trước" },
  { value: 30, label: "Trước 30 phút" },
  { value: 60, label: "Trước 1 giờ" },
  { value: 1440, label: "Trước 1 ngày" },
  { value: 4320, label: "Trước 3 ngày" },
  { value: 10080, label: "Trước 1 tuần" },
];

const repeatOptions = [
  { value: "none", label: "Không lặp" },
  { value: "yearly", label: "Lặp hằng năm" },
  { value: "monthly", label: "Lặp hằng tháng" },
  { value: "weekly", label: "Lặp hằng tuần" },
];

const filterOptions = [
  { id: "all", label: "Tất cả" },
  { id: "today", label: "Hôm nay" },
  { id: "week", label: "7 ngày tới" },
  { id: "birthday", label: "Sinh nhật" },
  { id: "study", label: "Học tập" },
  { id: "personal", label: "Cá nhân" },
  { id: "past", label: "Đã qua" },
];

const weekDayLabels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

const initialForm = {
  title: "",
  event_date: "",
  event_time: "",
  event_type: "assignment",
  priority: "medium",
  location: "",
  reminder_before: 0,
  repeat_type: "none",
  status: "upcoming",
  color: eventTypes.assignment.color,
  note: "",
};

function getTodayKey() {
  return formatDateKey(new Date());
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateFromKey(dateKey) {
  return new Date(`${dateKey}T00:00:00`);
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function isSameMonth(date, monthDate) {
  return (
    date.getFullYear() === monthDate.getFullYear() &&
    date.getMonth() === monthDate.getMonth()
  );
}

function getLastDayOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function getEffectiveDateKey(event) {
  if (!event?.event_date) {
    return getTodayKey();
  }

  const repeatType = event.repeat_type || "none";

  if (repeatType === "none") {
    return event.event_date;
  }

  const today = dateFromKey(getTodayKey());
  const baseDate = dateFromKey(event.event_date);

  if (repeatType === "yearly") {
    let candidate = new Date(
      today.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
    );

    if (candidate < today) {
      candidate = new Date(
        today.getFullYear() + 1,
        baseDate.getMonth(),
        baseDate.getDate(),
      );
    }

    return formatDateKey(candidate);
  }

  if (repeatType === "monthly") {
    let candidateMonth = today.getMonth();
    let candidateYear = today.getFullYear();
    const day = Math.min(
      baseDate.getDate(),
      getLastDayOfMonth(candidateYear, candidateMonth),
    );
    let candidate = new Date(candidateYear, candidateMonth, day);

    if (candidate < today) {
      candidateMonth += 1;

      if (candidateMonth > 11) {
        candidateMonth = 0;
        candidateYear += 1;
      }

      candidate = new Date(
        candidateYear,
        candidateMonth,
        Math.min(baseDate.getDate(), getLastDayOfMonth(candidateYear, candidateMonth)),
      );
    }

    return formatDateKey(candidate);
  }

  if (repeatType === "weekly") {
    const candidate = new Date(baseDate);

    while (candidate < today) {
      candidate.setDate(candidate.getDate() + 7);
    }

    return formatDateKey(candidate);
  }

  return event.event_date;
}

function normalizeTime(time) {
  if (!time) {
    return "";
  }

  return time.slice(0, 5);
}

function formatDate(dateKey) {
  if (!dateKey) {
    return "";
  }

  return dateFromKey(dateKey).toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMonthLabel(date) {
  return date.toLocaleDateString("vi-VN", {
    month: "long",
    year: "numeric",
  });
}

function getDaysLeft(dateKey) {
  const today = dateFromKey(getTodayKey());
  const target = dateFromKey(dateKey);
  const diff = target.getTime() - today.getTime();

  return Math.round(diff / 86400000);
}

function getRelativeLabel(dateKey) {
  const daysLeft = getDaysLeft(dateKey);

  if (daysLeft === 0) {
    return "Hôm nay";
  }

  if (daysLeft === 1) {
    return "Ngày mai";
  }

  if (daysLeft > 1) {
    return `Còn ${daysLeft} ngày`;
  }

  return `Đã qua ${Math.abs(daysLeft)} ngày`;
}

function getTimelineGroupFromDateKey(dateKey) {
  const daysLeft = getDaysLeft(dateKey);

  if (daysLeft < 0) {
    return "Đã qua";
  }

  if (daysLeft === 0) {
    return "Hôm nay";
  }

  if (daysLeft <= 7) {
    return "7 ngày tới";
  }

  if (daysLeft <= 31) {
    return "Tháng này";
  }

  return "Sau này";
}

function getTimelineGroup(event) {
  return getTimelineGroupFromDateKey(getEffectiveDateKey(event));
}

function getCalendarCells(monthDate) {
  const monthStart = getMonthStart(monthDate);
  const startOffset = (monthStart.getDay() + 6) % 7;
  const firstVisibleDate = new Date(monthStart);

  firstVisibleDate.setDate(monthStart.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstVisibleDate);
    date.setDate(firstVisibleDate.getDate() + index);

    return {
      date,
      dateKey: formatDateKey(date),
      isCurrentMonth: isSameMonth(date, monthDate),
      isToday: formatDateKey(date) === getTodayKey(),
    };
  });
}

function getEventDateKeysForMonth(event, monthDate) {
  if (!event?.event_date) {
    return [];
  }

  const repeatType = event.repeat_type || "none";
  const baseDate = dateFromKey(event.event_date);
  const monthStart = getMonthStart(monthDate);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

  if (repeatType === "none") {
    return isSameMonth(baseDate, monthDate) ? [event.event_date] : [];
  }

  if (repeatType === "yearly") {
    if (baseDate.getMonth() !== monthDate.getMonth()) {
      return [];
    }

    const eventDate = new Date(
      monthDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
    );

    return [formatDateKey(eventDate)];
  }

  if (repeatType === "monthly") {
    const eventDate = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth(),
      Math.min(
        baseDate.getDate(),
        getLastDayOfMonth(monthDate.getFullYear(), monthDate.getMonth()),
      ),
    );

    return eventDate >= baseDate ? [formatDateKey(eventDate)] : [];
  }

  if (repeatType === "weekly") {
    const eventDates = [];
    const eventDate = new Date(baseDate);

    while (eventDate < monthStart) {
      eventDate.setDate(eventDate.getDate() + 7);
    }

    while (eventDate <= monthEnd) {
      eventDates.push(formatDateKey(eventDate));
      eventDate.setDate(eventDate.getDate() + 7);
    }

    return eventDates;
  }

  return [];
}

function buildPayload(form) {
  return {
    title: form.title.trim(),
    event_date: form.event_date,
    event_time: form.event_time || null,
    event_type: form.event_type,
    priority: form.priority,
    location: form.location.trim() || null,
    reminder_before: Number(form.reminder_before) || 0,
    status: form.status || "upcoming",
    color: form.color || eventTypes[form.event_type]?.color || eventTypes.other.color,
    repeat_type: form.repeat_type,
    note: form.note.trim() || null,
  };
}

function EventsPage() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [showComposer, setShowComposer] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [calendarMonth, setCalendarMonth] = useState(() => getMonthStart(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadEvents() {
    try {
      setLoading(true);
      const data = await getEvents();
      setEvents(data);
      setError("");
    } catch {
      setError("Không tải được danh sách sự kiện.");
    } finally {
      setLoading(false);
    }
  }

  function resetComposer() {
    setForm(initialForm);
    setEditingId(null);
    setShowComposer(false);
  }

  function openCreateForm() {
    setForm(initialForm);
    setEditingId(null);
    setShowComposer(true);
  }

  function openEditForm(event) {
    const type = event.event_type || "other";

    setForm({
      title: event.title || "",
      event_date: event.event_date || "",
      event_time: normalizeTime(event.event_time),
      event_type: type,
      priority: event.priority || "medium",
      location: event.location || "",
      reminder_before: event.reminder_before || 0,
      repeat_type: event.repeat_type || "none",
      status: event.status || "upcoming",
      color: event.color || eventTypes[type]?.color || eventTypes.other.color,
      note: event.note || "",
    });
    setEditingId(event.id);
    setShowComposer(true);
  }

  function handleTypeChange(eventType) {
    setForm({
      ...form,
      event_type: eventType,
      color: eventTypes[eventType]?.color || eventTypes.other.color,
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const payload = buildPayload(form);

    if (!payload.title || !payload.event_date) {
      setError("Vui lòng nhập tên và ngày sự kiện.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      if (editingId) {
        await updateEvent(editingId, payload);
      } else {
        await createEvent(payload);
      }

      resetComposer();
      await loadEvents();
    } catch {
      setError(editingId ? "Không thể cập nhật sự kiện." : "Không thể thêm sự kiện.");
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkDone(event) {
    try {
      await updateEvent(event.id, { status: "done" });
      await loadEvents();
    } catch {
      setError("Không thể đánh dấu hoàn thành.");
    }
  }

  async function handleDeleteEvent(eventId) {
    const confirmed = window.confirm("Bạn có chắc muốn xóa sự kiện này?");

    if (!confirmed) {
      return;
    }

    try {
      await deleteEvent(eventId);

      if (editingId === eventId) {
        resetComposer();
      }

      await loadEvents();
    } catch {
      setError("Không thể xóa sự kiện.");
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  const stats = useMemo(() => {
    const today = getTodayKey();

    return events.reduce(
      (result, event) => {
        const daysLeft = getDaysLeft(getEffectiveDateKey(event));

        if (getEffectiveDateKey(event) === today) {
          result.today += 1;
        }

        if (daysLeft >= 0 && daysLeft <= 7) {
          result.week += 1;
        }

        if ((event.event_type || "other") === "birthday") {
          result.birthdays += 1;
        }

        if (daysLeft < 0 || event.status === "done") {
          result.past += 1;
        }

        return result;
      },
      { today: 0, week: 0, birthdays: 0, past: 0 },
    );
  }, [events]);

  const filteredEvents = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return events.filter((event) => {
      const effectiveDateKey = getEffectiveDateKey(event);
      const daysLeft = getDaysLeft(effectiveDateKey);
      const type = event.event_type || "other";
      const haystack = [
        event.title,
        event.note,
        event.location,
        eventTypes[type]?.label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (keyword && !haystack.includes(keyword)) {
        return false;
      }

      if (selectedDateKey) {
        return getEventDateKeysForMonth(event, calendarMonth).includes(selectedDateKey);
      }

      if (activeFilter === "today") {
        return daysLeft === 0;
      }

      if (activeFilter === "week") {
        return daysLeft >= 0 && daysLeft <= 7;
      }

      if (activeFilter === "birthday") {
        return type === "birthday";
      }

      if (activeFilter === "study") {
        return ["exam", "assignment"].includes(type);
      }

      if (activeFilter === "personal") {
        return ["personal", "meeting"].includes(type);
      }

      if (activeFilter === "past") {
        return daysLeft < 0 || event.status === "done";
      }

      return true;
    }).sort((left, right) => {
      const leftTime = dateFromKey(getEffectiveDateKey(left)).getTime();
      const rightTime = dateFromKey(getEffectiveDateKey(right)).getTime();

      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return normalizeTime(left.event_time).localeCompare(normalizeTime(right.event_time));
    });
  }, [activeFilter, calendarMonth, events, searchTerm, selectedDateKey]);

  const calendarCells = useMemo(() => {
    return getCalendarCells(calendarMonth);
  }, [calendarMonth]);

  const calendarEventsByDate = useMemo(() => {
    return events.reduce((result, event) => {
      getEventDateKeysForMonth(event, calendarMonth).forEach((dateKey) => {
        if (!result[dateKey]) {
          result[dateKey] = [];
        }

        result[dateKey].push(event);
      });

      return result;
    }, {});
  }, [calendarMonth, events]);

  const selectedDateEvents = selectedDateKey
    ? calendarEventsByDate[selectedDateKey] || []
    : [];

  const groupedEvents = useMemo(() => {
    return filteredEvents.reduce((result, event) => {
      const group = selectedDateKey
        ? getTimelineGroupFromDateKey(selectedDateKey)
        : getTimelineGroup(event);

      if (!result[group]) {
        result[group] = [];
      }

      result[group].push(event);
      return result;
    }, {});
  }, [filteredEvents, selectedDateKey]);

  const groupOrder = ["Hôm nay", "7 ngày tới", "Tháng này", "Sau này", "Đã qua"];

  return (
    <div className="events-page">
      <header className="events-hero">
        <div>
          <p className="eyebrow">Events</p>
          <h2>Sự kiện quan trọng</h2>
          <p>
            Theo dõi sinh nhật, lịch thi, deadline, cuộc hẹn và các mốc không
            được phép quên trong một timeline gọn gàng.
          </p>
        </div>

        <button className="events-add-button" type="button" onClick={openCreateForm}>
          + Thêm sự kiện
        </button>
      </header>

      {error && <p className="error-message">{error}</p>}

      <section className="event-stats-grid">
        <article className="event-stat-card today">
          <span>Hôm nay</span>
          <strong>{stats.today}</strong>
          <small>Việc cần để mắt ngay</small>
        </article>

        <article className="event-stat-card week">
          <span>7 ngày tới</span>
          <strong>{stats.week}</strong>
          <small>Mốc sắp tới gần</small>
        </article>

        <article className="event-stat-card birthday">
          <span>Sinh nhật</span>
          <strong>{stats.birthdays}</strong>
          <small>Những ngày nên nhớ</small>
        </article>

        <article className="event-stat-card past">
          <span>Đã qua</span>
          <strong>{stats.past}</strong>
          <small>Cần kiểm tra lại</small>
        </article>
      </section>

      <section className="events-calendar-panel">
        <div className="events-calendar-heading">
          <div>
            <span>Lịch tháng</span>
            <h3>{formatMonthLabel(calendarMonth)}</h3>
          </div>

          <div className="calendar-actions">
            {selectedDateKey && (
              <button
                className="calendar-clear-button"
                type="button"
                onClick={() => setSelectedDateKey("")}
              >
                Bỏ chọn {dateFromKey(selectedDateKey).toLocaleDateString("vi-VN")}
              </button>
            )}

            <button
              type="button"
              onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => {
                setCalendarMonth(getMonthStart(new Date()));
                setSelectedDateKey("");
              }}
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
            >
              ›
            </button>
          </div>
        </div>

        <div className="events-calendar-grid">
          {weekDayLabels.map((day) => (
            <div className="calendar-weekday" key={day}>
              {day}
            </div>
          ))}

          {calendarCells.map((cell) => {
            const dayEvents = calendarEventsByDate[cell.dateKey] || [];
            const visibleDots = dayEvents.slice(0, 4);

            return (
              <button
                className={[
                  "calendar-day",
                  cell.isCurrentMonth ? "" : "muted",
                  cell.isToday ? "today" : "",
                  selectedDateKey === cell.dateKey ? "selected" : "",
                  dayEvents.length ? "has-events" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={cell.dateKey}
                type="button"
                onClick={() => {
                  setSelectedDateKey(
                    selectedDateKey === cell.dateKey ? "" : cell.dateKey,
                  );
                  setActiveFilter("all");
                }}
              >
                <span>{cell.date.getDate()}</span>

                {dayEvents.length > 0 && (
                  <div className="calendar-event-dots">
                    {visibleDots.map((event) => {
                      const type = event.event_type || "other";
                      const typeInfo = eventTypes[type] || eventTypes.other;

                      return (
                        <i
                          key={`${cell.dateKey}-${event.id}-${type}`}
                          style={{ background: event.color || typeInfo.color }}
                        />
                      );
                    })}

                    {dayEvents.length > visibleDots.length && (
                      <strong>+{dayEvents.length - visibleDots.length}</strong>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="calendar-hint">
          {selectedDateKey ? (
            <span>
              Đang xem {selectedDateEvents.length} sự kiện trong ngày{" "}
              {dateFromKey(selectedDateKey).toLocaleDateString("vi-VN")}.
            </span>
          ) : (
            <span>Bấm vào ngày có chấm màu để xem riêng sự kiện của ngày đó.</span>
          )}
        </div>
      </section>

      <section className={`events-workspace ${showComposer ? "with-composer" : ""}`}>
        <div className="events-main-panel">
          <div className="events-toolbar">
            <div className="event-filter-tabs">
              {filterOptions.map((filter) => (
                <button
                  className={`event-filter-tab ${
                    activeFilter === filter.id ? "active" : ""
                  }`}
                  key={filter.id}
                  type="button"
                  onClick={() => {
                    setSelectedDateKey("");
                    setActiveFilter(filter.id);
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <input
              className="events-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm sự kiện..."
            />
          </div>

          {loading ? (
            <p className="empty">Đang tải sự kiện...</p>
          ) : filteredEvents.length === 0 ? (
            <section className="events-empty-state">
              <h3>Chưa có sự kiện phù hợp</h3>
              <p>
                Thêm các mốc quan trọng để app nhắc bạn nhìn lại đúng lúc.
              </p>
              <button type="button" onClick={openCreateForm}>
                Tạo sự kiện đầu tiên
              </button>
            </section>
          ) : (
            <div className="events-timeline">
              {groupOrder
                .filter((group) => groupedEvents[group]?.length)
                .map((group) => (
                  <section className="timeline-group" key={group}>
                    <div className="timeline-group-title">
                      <span>{group}</span>
                      <small>{groupedEvents[group].length} sự kiện</small>
                    </div>

                    <div className="event-card-list">
                      {groupedEvents[group].map((event) => {
                        const type = event.event_type || "other";
                        const typeInfo = eventTypes[type] || eventTypes.other;
                        const isDone = event.status === "done";
                        const displayDateKey =
                          selectedDateKey &&
                          getEventDateKeysForMonth(event, calendarMonth).includes(
                            selectedDateKey,
                          )
                            ? selectedDateKey
                            : getEffectiveDateKey(event);

                        return (
                          <article
                            className={`event-timeline-card ${
                              isDone ? "is-done" : ""
                            }`}
                            key={event.id}
                            style={{ "--event-color": event.color || typeInfo.color }}
                          >
                            <div className="event-date-box">
                              <strong>
                                {dateFromKey(displayDateKey).toLocaleDateString(
                                  "vi-VN",
                                  { day: "2-digit" },
                                )}
                              </strong>
                              <span>
                                {dateFromKey(displayDateKey).toLocaleDateString(
                                  "vi-VN",
                                  { month: "2-digit" },
                                )}
                              </span>
                            </div>

                            <div className="event-card-body">
                              <div className="event-card-heading">
                                <div>
                                  <h3>{event.title}</h3>
                                  <p>
                                    {formatDate(displayDateKey)}
                                    {event.event_time
                                      ? ` • ${normalizeTime(event.event_time)}`
                                      : ""}
                                  </p>
                                </div>

                                <span className="event-relative">
                                  {isDone ? "Đã xong" : getRelativeLabel(displayDateKey)}
                                </span>
                              </div>

                              <div className="event-tags">
                                <span className="event-type-badge">
                                  {typeInfo.short} · {typeInfo.label}
                                </span>
                                <span>{priorityLabels[event.priority] || "Vừa"}</span>
                                {event.repeat_type && event.repeat_type !== "none" && (
                                  <span>Lặp lại</span>
                                )}
                                {event.location && <span>{event.location}</span>}
                              </div>

                              {event.note && <p className="event-note">{event.note}</p>}

                              <div className="event-card-actions">
                                <button type="button" onClick={() => openEditForm(event)}>
                                  Sửa
                                </button>
                                {!isDone && (
                                  <button
                                    type="button"
                                    onClick={() => handleMarkDone(event)}
                                  >
                                    Hoàn thành
                                  </button>
                                )}
                                <button
                                  className="delete"
                                  type="button"
                                  onClick={() => handleDeleteEvent(event.id)}
                                >
                                  Xóa
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
            </div>
          )}
        </div>

        {showComposer && (
          <aside className="event-composer">
            <div className="composer-heading">
              <div>
                <span>{editingId ? "Chỉnh sửa" : "Tạo mới"}</span>
                <h3>{editingId ? "Cập nhật sự kiện" : "Thêm sự kiện"}</h3>
              </div>
              <button type="button" onClick={resetComposer}>
                Đóng
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label>
                Tên sự kiện
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                  placeholder="Ví dụ: Nộp báo cáo cuối kỳ"
                  required
                />
              </label>

              <div className="composer-grid">
                <label>
                  Ngày
                  <input
                    type="date"
                    value={form.event_date}
                    onChange={(event) =>
                      setForm({ ...form, event_date: event.target.value })
                    }
                    required
                  />
                </label>

                <label>
                  Giờ
                  <input
                    type="time"
                    value={form.event_time}
                    onChange={(event) =>
                      setForm({ ...form, event_time: event.target.value })
                    }
                  />
                </label>
              </div>

              <div className="composer-grid">
                <label>
                  Loại sự kiện
                  <select
                    value={form.event_type}
                    onChange={(event) => handleTypeChange(event.target.value)}
                  >
                    {Object.entries(eventTypes).map(([value, item]) => (
                      <option key={value} value={value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Mức độ
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      setForm({ ...form, priority: event.target.value })
                    }
                  >
                    <option value="low">Nhẹ</option>
                    <option value="medium">Vừa</option>
                    <option value="high">Quan trọng</option>
                  </select>
                </label>
              </div>

              <label>
                Địa điểm
                <input
                  value={form.location}
                  onChange={(event) =>
                    setForm({ ...form, location: event.target.value })
                  }
                  placeholder="Ví dụ: Phòng B203"
                />
              </label>

              <div className="composer-grid">
                <label>
                  Nhắc trước
                  <select
                    value={form.reminder_before}
                    onChange={(event) =>
                      setForm({ ...form, reminder_before: event.target.value })
                    }
                  >
                    {reminderOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Lặp lại
                  <select
                    value={form.repeat_type}
                    onChange={(event) =>
                      setForm({ ...form, repeat_type: event.target.value })
                    }
                  >
                    {repeatOptions.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Màu nhấn
                <input
                  type="color"
                  value={form.color}
                  onChange={(event) =>
                    setForm({ ...form, color: event.target.value })
                  }
                />
              </label>

              <label>
                Ghi chú
                <textarea
                  value={form.note}
                  onChange={(event) =>
                    setForm({ ...form, note: event.target.value })
                  }
                  placeholder="Thêm điều cần nhớ, tài liệu cần chuẩn bị..."
                />
              </label>

              <div className="composer-actions">
                <button className="secondary-button" type="button" onClick={resetComposer}>
                  Hủy
                </button>
                <button className="primary-button" type="submit" disabled={saving}>
                  {saving
                    ? "Đang lưu..."
                    : editingId
                      ? "Cập nhật"
                      : "Lưu sự kiện"}
                </button>
              </div>
            </form>
          </aside>
        )}
      </section>
    </div>
  );
}

export default EventsPage;
