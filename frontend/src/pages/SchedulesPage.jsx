import { useEffect, useMemo, useState } from "react";

import {
  createSchedule,
  deleteSchedule,
  getSchedules,
  updateSchedule,
} from "../api/schedulesApi";
import "./SchedulesPage.css";

const days = [
  { value: 2, label: "Thứ 2" },
  { value: 3, label: "Thứ 3" },
  { value: 4, label: "Thứ 4" },
  { value: 5, label: "Thứ 5" },
  { value: 6, label: "Thứ 6" },
  { value: 7, label: "Thứ 7" },
  { value: 1, label: "Chủ nhật" },
];

const sessions = [
  {
    value: "morning",
    label: "Buổi sáng",
    time: "05:00 - 11:59",
    
  },
  {
    value: "afternoon",
    label: "Buổi chiều",
    time: "12:00 - 17:59",
    
  },
  {
    value: "evening",
    label: "Buổi tối",
    time: "18:00 - 23:59",
  } 
];

const categories = [
  { value: "study", label: "Học tập", tone: "blue" },
  { value: "personal", label: "Cá nhân", tone: "violet" },
  { value: "work", label: "Công việc", tone: "amber" },
  { value: "health", label: "Sức khỏe", tone: "green" },
  { value: "rest", label: "Nghỉ ngơi", tone: "slate" },
];

const initialForm = {
  day_of_week: 2,
  start_time: "",
  end_time: "",
  title: "",
  category: "study",
  location: "",
  note: "",
};

function toShortTime(value) {
  return value ? value.slice(0, 5) : "";
}

function getDayLabel(dayValue) {
  return days.find((day) => day.value === dayValue)?.label || "Một ngày";
}

function getCategoryMeta(value) {
  return categories.find((category) => category.value === value) || categories[1];
}

function getSessionByTime(timeValue) {
  const hour = Number(toShortTime(timeValue).slice(0, 2));

  if (Number.isNaN(hour)) {
    return "morning";
  }

  if (hour < 12) {
    return "morning";
  }

  if (hour < 18) {
    return "afternoon";
  }

  return "evening";
}

function sortByTime(items) {
  return [...items].sort((a, b) =>
    `${toShortTime(a.start_time)}-${toShortTime(a.end_time)}`.localeCompare(
      `${toShortTime(b.start_time)}-${toShortTime(b.end_time)}`,
    ),
  );
}

function hasTimeConflict(items, form, editingId) {
  if (!form.start_time || !form.end_time) {
    return false;
  }

  return items.some((item) => {
    if (editingId && item.id === editingId) {
      return false;
    }

    if (Number(item.day_of_week) !== Number(form.day_of_week)) {
      return false;
    }

    const itemStart = toShortTime(item.start_time);
    const itemEnd = toShortTime(item.end_time);

    return form.start_time < itemEnd && form.end_time > itemStart;
  });
}

function SchedulesPage() {
  const [schedules, setSchedules] = useState([]);
  const [activeDay, setActiveDay] = useState(2);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const sortedSchedules = useMemo(() => sortByTime(schedules), [schedules]);

  const schedulesByDay = useMemo(() => {
    return days.reduce((map, day) => {
      map[day.value] = sortedSchedules.filter(
        (item) => Number(item.day_of_week) === day.value,
      );
      return map;
    }, {});
  }, [sortedSchedules]);

  const selectedSchedules = useMemo(
    () => schedulesByDay[activeDay] || [],
    [schedulesByDay, activeDay],
  );

  const conflictWarning = useMemo(
    () => hasTimeConflict(schedules, form, editingId),
    [schedules, form, editingId],
  );

  const busyDay = useMemo(() => {
    return days.reduce((current, day) => {
      const count = schedulesByDay[day.value]?.length || 0;

      if (count > current.count) {
        return { label: day.label, count };
      }

      return current;
    }, { label: "Chưa có", count: 0 });
  }, [schedulesByDay]);

  const studyCount = schedules.filter((item) => item.category === "study").length;
  const earliestSchedule = sortedSchedules[0];

  async function loadSchedules() {
    try {
      const data = await getSchedules();
      setSchedules(data);
      setError("");
    } catch {
      setError("Không tải được thời khóa biểu.");
    }
  }

  function openCreateForm(dayValue = activeDay) {
    setEditingId(null);
    setActiveDay(dayValue);
    setForm({
      ...initialForm,
      day_of_week: dayValue,
    });
    setShowForm(true);
  }

  function handleSelectDay(dayValue) {
    setActiveDay(dayValue);

    if (!editingId) {
      setForm((current) => ({
        ...current,
        day_of_week: dayValue,
      }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (form.start_time >= form.end_time) {
      setError("Giờ kết thúc phải sau giờ bắt đầu.");
      return;
    }

    const payload = {
      day_of_week: Number(form.day_of_week),
      start_time: form.start_time,
      end_time: form.end_time,
      title: form.title.trim(),
      category: form.category,
      location: form.location.trim() || null,
      note: form.note.trim() || null,
    };

    try {
      if (editingId) {
        await updateSchedule(editingId, payload);
      } else {
        await createSchedule(payload);
      }

      setActiveDay(payload.day_of_week);
      setForm({ ...initialForm, day_of_week: payload.day_of_week });
      setEditingId(null);
      setShowForm(false);
      await loadSchedules();
    } catch {
      setError("Không lưu được thời khóa biểu.");
    }
  }

  function handleEdit(schedule) {
    setEditingId(schedule.id);
    setActiveDay(schedule.day_of_week);
    setForm({
      day_of_week: schedule.day_of_week,
      start_time: toShortTime(schedule.start_time),
      end_time: toShortTime(schedule.end_time),
      title: schedule.title,
      category: schedule.category,
      location: schedule.location || "",
      note: schedule.note || "",
    });
    setShowForm(true);
  }

  async function handleDelete(scheduleId) {
    const confirmed = window.confirm("Bạn có chắc muốn xóa lịch này?");

    if (!confirmed) {
      return;
    }

    try {
      await deleteSchedule(scheduleId);
      await loadSchedules();
    } catch {
      setError("Không xóa được lịch.");
    }
  }

  function cancelForm() {
    setEditingId(null);
    setShowForm(false);
    setForm({ ...initialForm, day_of_week: activeDay });
  }

  useEffect(() => {
    loadSchedules();
  }, []);

  return (
    <div className="schedule-page">
      <header className="page-header schedule-header">
        <div>
          <p className="eyebrow">Schedule</p>
          <h2>Thời khóa biểu</h2>
          <p>
            Theo dõi lịch học, lịch sinh hoạt và việc cá nhân theo bảng tuần.
            Bấm vào từng ngày để xem chi tiết, thêm nhanh hoặc chỉnh lại lịch.
          </p>
        </div>
      </header>

      {error && <p className="error-message">{error}</p>}

      <section className="schedule-summary-grid" aria-label="Tổng quan lịch tuần">
        <article className="schedule-summary-card">
          <span>Tổng lịch</span>
          <strong>{schedules.length}</strong>
          <small>mục trong tuần</small>
        </article>
        <article className="schedule-summary-card">
          <span>Lịch học</span>
          <strong>{studyCount}</strong>
          <small>môn học và buổi tự học</small>
        </article>
        <article className="schedule-summary-card">
          <span>Ngày bận nhất</span>
          <strong>{busyDay.label}</strong>
          <small>{busyDay.count} mục</small>
        </article>
        <article className="schedule-summary-card">
          <span>Sớm nhất</span>
          <strong>{earliestSchedule ? toShortTime(earliestSchedule.start_time) : "--:--"}</strong>
          <small>{earliestSchedule ? earliestSchedule.title : "Chưa có lịch"}</small>
        </article>
      </section>

      <section className="schedule-workspace">
        <section className="schedule-board-panel" aria-label="Bảng thời khóa biểu tuần">
          <div className="schedule-board-heading">
            <div>
              <h3>Bảng tuần</h3>
              <p>Nhìn nhanh toàn bộ tuần theo buổi sáng, chiều và tối.</p>
            </div>
            <button
              className="schedule-add-button"
              type="button"
              onClick={() => openCreateForm(activeDay)}
              title="Thêm lịch cho ngày đang chọn"
            >
              +
            </button>
          </div>

          <div className="schedule-week-scroll">
            <div className="schedule-week-grid">
              <div className="schedule-grid-corner">Buổi</div>
              {days.map((day) => {
                const count = schedulesByDay[day.value]?.length || 0;

                return (
                  <button
                    className={`schedule-day-heading ${
                      activeDay === day.value ? "active" : ""
                    }`}
                    key={day.value}
                    type="button"
                    onClick={() => handleSelectDay(day.value)}
                  >
                    <span>{day.label}</span>
                    <small>{count} mục</small>
                  </button>
                );
              })}

              {sessions.map((session) => (
                <div className="schedule-grid-row" key={session.value}>
                  <div className="schedule-session-cell">
                    <strong>{session.label}</strong>
                    <span>{session.time}</span>
                    <small>{session.hint}</small>
                  </div>

                  {days.map((day) => {
                    const dayItems = schedulesByDay[day.value] || [];
                    const sessionItems = dayItems.filter(
                      (item) => getSessionByTime(item.start_time) === session.value,
                    );

                    return (
                      <button
                        className={`schedule-day-cell ${
                          activeDay === day.value ? "active" : ""
                        }`}
                        key={`${session.value}-${day.value}`}
                        type="button"
                        onClick={() => handleSelectDay(day.value)}
                      >
                        {sessionItems.length === 0 ? (
                          <span className="schedule-empty-cell">Trống</span>
                        ) : (
                          sessionItems.map((item) => {
                            const category = getCategoryMeta(item.category);

                            return (
                              <span
                                className={`schedule-mini-card tone-${category.tone}`}
                                key={item.id}
                              >
                                <b>
                                  {toShortTime(item.start_time)} -{" "}
                                  {toShortTime(item.end_time)}
                                </b>
                                <span>{item.title}</span>
                                {item.location && <small>{item.location}</small>}
                              </span>
                            );
                          })
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="schedule-day-panel" aria-label="Chi tiết ngày">
          <div className="schedule-day-top">
            <div>
              <p className="eyebrow">Chi tiết ngày</p>
              <h3>{getDayLabel(activeDay)}</h3>
              <span>{selectedSchedules.length} lịch đã lên</span>
            </div>
            <button
              className="schedule-add-button compact"
              type="button"
              onClick={() => openCreateForm(activeDay)}
              title="Thêm lịch cho ngày này"
            >
              +
            </button>
          </div>

          {showForm && (
            <form className="schedule-inline-form" onSubmit={handleSubmit}>
              <div className="schedule-form-heading">
                <h4>{editingId ? "Sửa lịch" : "Thêm lịch mới"}</h4>
                <button type="button" onClick={cancelForm}>
                  Đóng
                </button>
              </div>

              <label>
                Ngày
                <select
                  value={form.day_of_week}
                  onChange={(e) =>
                    setForm({ ...form, day_of_week: Number(e.target.value) })
                  }
                >
                  {days.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="two-columns">
                <label>
                  Bắt đầu
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) =>
                      setForm({ ...form, start_time: e.target.value })
                    }
                    required
                  />
                </label>

                <label>
                  Kết thúc
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) =>
                      setForm({ ...form, end_time: e.target.value })
                    }
                    required
                  />
                </label>
              </div>

              {conflictWarning && (
                <p className="schedule-warning">
                  Khung giờ này đang chồng với một lịch khác trong cùng ngày.
                </p>
              )}

              <label>
                Hoạt động / môn học
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ví dụ: Học cơ sở dữ liệu"
                  required
                />
              </label>

              <label>
                Phân loại
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {categories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Địa điểm
                <input
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                  placeholder="Ví dụ: Phòng A9"
                />
              </label>

              <label>
                Ghi chú
                <textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Giảng viên, việc cần chuẩn bị, deadline nhỏ..."
                />
              </label>

              <button className="primary-button" type="submit">
                {editingId ? "Cập nhật lịch" : "Lưu lịch"}
              </button>
            </form>
          )}

          <div className="schedule-detail-list">
            {selectedSchedules.length === 0 ? (
              <div className="schedule-empty-state">
                <strong>Ngày này còn trống.</strong>
                <p>Bấm nút + để thêm môn học, lịch tự học hoặc việc cá nhân.</p>
              </div>
            ) : (
              selectedSchedules.map((schedule) => {
                const category = getCategoryMeta(schedule.category);

                return (
                  <article
                    className={`schedule-detail-card tone-${category.tone}`}
                    key={schedule.id}
                  >
                    <div className="schedule-detail-time">
                      <strong>
                        {toShortTime(schedule.start_time)} -{" "}
                        {toShortTime(schedule.end_time)}
                      </strong>
                      <span>{category.label}</span>
                    </div>

                    <div className="schedule-detail-body">
                      <h4>{schedule.title}</h4>
                      {schedule.location && <p>{schedule.location}</p>}
                      {schedule.note && <small>{schedule.note}</small>}
                    </div>

                    <div className="card-actions">
                      <button
                        className="edit-button"
                        type="button"
                        onClick={() => handleEdit(schedule)}
                      >
                        Sửa
                      </button>
                      <button
                        className="danger-button"
                        type="button"
                        onClick={() => handleDelete(schedule.id)}
                      >
                        Xóa
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

export default SchedulesPage;
