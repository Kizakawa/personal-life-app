import { useEffect, useMemo, useRef, useState } from "react";
import {
  createAttendanceRecord,
  createClassNote,
  createGradeItem,
  deleteAttendanceRecord,
  deleteClassNote,
  deleteGradeItem,
  getStudentHubSummary,
  getSubjectCenter,
  updateClassNote,
} from "../api/studentHubApi";
import { getCalendarExportLink, regenerateCalendarExportToken } from "../api/calendarApi";
import RichTextEditor from "../components/RichTextEditor";
import { notifyError, notifySuccess } from "../api/config";
import sanitizeHtml from "../utils/sanitizeHtml";
import "./StudentHubPage.css";

const todayIso = new Date().toISOString().slice(0, 10);
const CLASS_NOTE_PAGE_SIZE = 30;

const gradeCategories = [
  { value: "attendance", label: "Chuyên cần" },
  { value: "process", label: "Quá trình" },
  { value: "assignment", label: "Bài tập" },
  { value: "midterm", label: "Giữa kỳ" },
  { value: "project", label: "Dự án" },
  { value: "final", label: "Cuối kỳ" },
  { value: "other", label: "Khác" },
];

const attendanceStatuses = [
  { value: "present", label: "Có mặt" },
  { value: "absent", label: "Vắng" },
  { value: "late", label: "Muộn" },
  { value: "excused", label: "Có phép" },
];

const gradeInitialForm = {
  title: "",
  category: "process",
  score: "",
  max_score: "10",
  weight_percent: "",
  note: "",
};

const attendanceInitialForm = {
  session_date: todayIso,
  status: "present",
  lesson_title: "",
  note: "",
};

const noteInitialForm = {
  title: `Ghi chép ${todayIso}`,
  target_date: todayIso,
  tags: "#ghi-chep-bai-giang",
  content: "",
};

const classNoteTemplates = [
  {
    label: "Lý thuyết",
    content: "<h3>Ý chính</h3><ul><li></li></ul><h3>Ví dụ quan trọng</h3><ul><li></li></ul><h3>Phần chưa hiểu</h3><ul><li></li></ul>",
  },
  {
    label: "Thực hành / Lab",
    content: "<h3>Mục tiêu buổi lab</h3><ul><li></li></ul><h3>Các bước làm</h3><ol><li></li></ol><h3>Lỗi gặp phải</h3><ul><li></li></ul>",
  },
  {
    label: "Cornell",
    content: "<h3>Câu hỏi / Từ khóa</h3><ul><li></li></ul><h3>Ghi chép chính</h3><p></p><h3>Tóm tắt cuối buổi</h3><p></p>",
  },
];

function formatDate(value) {
  if (!value) return "Chưa có";

  try {
    return new Date(value).toLocaleDateString("vi-VN");
  } catch {
    return value;
  }
}

function formatScore(value, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "--";
  }

  return `${Number(value).toFixed(2).replace(/\.00$/, "")}${suffix}`;
}

function getToneLabel(tone) {
  const map = {
    danger: "Nguy hiểm",
    warning: "Cần chú ý",
    stable: "Ổn",
    blue: "Lịch",
    green: "Việc làm",
    slate: "Thông tin",
  };

  return map[tone] || "Thông tin";
}

function getTypeLabel(type) {
  const map = {
    schedule: "Lịch",
    event: "Sự kiện",
    task: "Việc",
    deadline: "Deadline",
  };

  return map[type] || type;
}

function normalizeNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

function EmptyBlock({ children }) {
  return <div className="student-empty">{children}</div>;
}

function MetricCard({ label, value, detail, tone = "blue" }) {
  return (
    <article className={`student-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function StudentHubPage() {
  const [summary, setSummary] = useState(null);
  const [detail, setDetail] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [gradeForm, setGradeForm] = useState(gradeInitialForm);
  const [attendanceForm, setAttendanceForm] = useState(attendanceInitialForm);
  const [noteForm, setNoteForm] = useState(noteInitialForm);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [autosaveState, setAutosaveState] = useState("idle");
  const [noteLimit, setNoteLimit] = useState(CLASS_NOTE_PAGE_SIZE);
  const autosaveSkipRef = useRef(true);

  async function loadSubjectDetail(subjectId, nextNoteLimit = noteLimit) {
    if (!subjectId) {
      setDetail(null);
      return;
    }

    try {
      setDetailLoading(true);
      const data = await getSubjectCenter(subjectId, { notesLimit: nextNoteLimit });
      setDetail(data);
      setSelectedNoteId((current) => {
        if (data.classNotes?.some((item) => item.id === current)) return current;
        return data.classNotes?.[0]?.id || null;
      });
    } catch (error) {
      console.error(error);
      alert("Không tải được trung tâm môn học.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadSummary(preferredSubjectId = null) {
    try {
      setLoading(true);
      const data = await getStudentHubSummary(21);
      setSummary(data);

      const nextId =
        preferredSubjectId ||
        selectedId ||
        data.subjects?.[0]?.id ||
        null;

      setSelectedId(nextId);
      await loadSubjectDetail(nextId);
    } catch (error) {
      console.error(error);
      alert("Không tải được Sinh viên 360. Kiểm tra backend đã chạy chưa.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lắng nghe Domain Event Bus với Debounce 150ms
  useEffect(() => {
    let timer = null;
    function handleDataInvalidated(event) {
      const { modules = [] } = event.detail || {};
      if (
        modules.length > 0 &&
        !modules.includes("student-hub") &&
        !modules.includes("subjects") &&
        !modules.includes("schedules")
      ) {
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        loadSummary();
      }, 150);
    }

    window.addEventListener("app:data-invalidated", handleDataInvalidated);
    return () => {
      window.removeEventListener("app:data-invalidated", handleDataInvalidated);
      clearTimeout(timer);
    };
  }, []);

  const selectedSubject = useMemo(() => {
    return summary?.subjects?.find((item) => item.id === selectedId) || detail?.subject || null;
  }, [detail, selectedId, summary]);

  const calendarDays = summary?.calendarDays || [];
  const subjects = summary?.subjects || [];
  const todayActions = summary?.todayActions || [];
  const gpa = summary?.gpaSummary || {};
  const overview = summary?.overview || {};
  const gamification = summary?.gamificationSummary || {};
  const classNotes = detail?.classNotes || [];
  const selectedNote = classNotes.find((item) => item.id === selectedNoteId) || classNotes[0] || null;

  function getClassNotePayload() {
    return {
      title: noteForm.title.trim(),
      target_date: noteForm.target_date || todayIso,
      tags: noteForm.tags.trim() || "#ghi-chep-bai-giang",
      content: noteForm.content || "",
      priority: "medium",
    };
  }

  function clearClassNoteDraft(subjectId = selectedId) {
    if (!subjectId) return;
    localStorage.removeItem(`personal_life_class_note_draft_${subjectId}`);
  }

  async function handleSelectSubject(subjectId) {
    setSelectedId(subjectId);
    setNoteLimit(CLASS_NOTE_PAGE_SIZE);
    await loadSubjectDetail(subjectId, CLASS_NOTE_PAGE_SIZE);
  }

  useEffect(() => {
    if (!selectedId) return undefined;

    const draftKey = `personal_life_class_note_draft_${selectedId}`;
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        editingNoteId,
        noteForm,
        savedAt: new Date().toISOString(),
      }),
    );

    if (!editingNoteId || !noteForm.title.trim()) {
      return undefined;
    }

    if (autosaveSkipRef.current) {
      autosaveSkipRef.current = false;
      return undefined;
    }

    setAutosaveState("dirty");

    const timerId = window.setTimeout(async () => {
      try {
        setAutosaveState("saving");
        const saved = await updateClassNote(editingNoteId, getClassNotePayload());
        setAutosaveState("saved");
        setDetail((current) => {
          if (!current?.classNotes) return current;
          return {
            ...current,
            classNotes: current.classNotes.map((item) => (item.id === saved.id ? saved : item)),
          };
        });
      } catch (error) {
        console.error(error);
        setAutosaveState("error");
        notifyError("Lưu tự động ghi chép thất bại.");
      }
    }, 5000);

    return () => window.clearTimeout(timerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingNoteId, noteForm, selectedId]);

  async function handleLoadMoreClassNotes() {
    const nextLimit = noteLimit + CLASS_NOTE_PAGE_SIZE;
    setNoteLimit(nextLimit);
    await loadSubjectDetail(selectedId, nextLimit);
  }

  function handleGradeChange(event) {
    const { name, value } = event.target;
    setGradeForm((current) => ({ ...current, [name]: value }));
  }

  function handleAttendanceChange(event) {
    const { name, value } = event.target;
    setAttendanceForm((current) => ({ ...current, [name]: value }));
  }

  function handleNoteChange(event) {
    const { name, value } = event.target;
    setNoteForm((current) => ({ ...current, [name]: value }));
  }

  function applyClassNoteTemplate(template) {
    setNoteForm((current) => ({
      ...current,
      title: current.title || `Ghi chép ${todayIso}`,
      content: template.content,
    }));
  }

  function resetNoteForm() {
    clearClassNoteDraft();
    setNoteForm(noteInitialForm);
    setEditingNoteId(null);
    setAutosaveState("idle");
    autosaveSkipRef.current = true;
  }

  function startEditNote(note) {
    autosaveSkipRef.current = true;
    setEditingNoteId(note.id);
    setSelectedNoteId(note.id);
    setNoteForm({
      title: note.title || "",
      target_date: note.targetDate || todayIso,
      tags: note.tags || "#ghi-chep-bai-giang",
      content: note.content || "",
    });
  }

  async function handleExportCalendar() {
    try {
      const data = await getCalendarExportLink(120);
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error(error);
      alert("Không tạo được link xuất lịch.");
    }
  }

  async function handleRegenerateCalendarLink() {
    if (!window.confirm("Tạo lại link xuất lịch? Link cũ sẽ mất hiệu lực.")) return;

    try {
      const data = await regenerateCalendarExportToken(120);
      await navigator.clipboard?.writeText(data.url);
      notifySuccess("Đã tạo link lịch mới và copy vào clipboard.");
    } catch (error) {
      console.error(error);
      alert("Không tạo lại được link lịch.");
    }
  }

  async function handleCreateGrade(event) {
    event.preventDefault();

    if (!selectedId) {
      alert("Hãy chọn môn học trước.");
      return;
    }

    if (!gradeForm.title.trim()) {
      alert("Vui lòng nhập tên đầu điểm.");
      return;
    }

    try {
      await createGradeItem({
        subject_id: selectedId,
        title: gradeForm.title.trim(),
        category: gradeForm.category,
        score: normalizeNumber(gradeForm.score),
        max_score: normalizeNumber(gradeForm.max_score) || 10,
        weight_percent: normalizeNumber(gradeForm.weight_percent),
        note: gradeForm.note.trim() || null,
      });

      setGradeForm(gradeInitialForm);
      await loadSummary(selectedId);
    } catch (error) {
      console.error(error);
      alert("Không lưu được đầu điểm.");
    }
  }

  async function handleCreateAttendance(event) {
    event.preventDefault();

    if (!selectedId) {
      alert("Hãy chọn môn học trước.");
      return;
    }

    try {
      await createAttendanceRecord({
        subject_id: selectedId,
        session_date: attendanceForm.session_date || todayIso,
        status: attendanceForm.status,
        lesson_title: attendanceForm.lesson_title.trim() || null,
        note: attendanceForm.note.trim() || null,
      });

      setAttendanceForm(attendanceInitialForm);
      await loadSummary(selectedId);
    } catch (error) {
      console.error(error);
      alert("Không lưu được chuyên cần.");
    }
  }

  async function handleSaveClassNote(event) {
    event.preventDefault();

    if (!selectedId) {
      alert("Hãy chọn môn học trước.");
      return;
    }

    if (!noteForm.title.trim()) {
      alert("Vui lòng nhập tiêu đề ghi chép.");
      return;
    }

    try {
      const payload = getClassNotePayload();

      const saved = editingNoteId
        ? await updateClassNote(editingNoteId, payload)
        : await createClassNote(selectedId, payload);

      resetNoteForm();
      setSelectedNoteId(saved.id);
      notifySuccess("Đã lưu ghi chép bài giảng.");
      await loadSummary(selectedId);
    } catch (error) {
      console.error(error);
      alert("Không lưu được ghi chép bài giảng.");
    }
  }

  async function handleDeleteClassNote(noteId) {
    if (!window.confirm("Xóa ghi chép bài giảng này?")) return;

    try {
      await deleteClassNote(noteId);
      resetNoteForm();
      setSelectedNoteId(null);
      notifySuccess("Đã xóa ghi chép bài giảng.");
      await loadSummary(selectedId);
    } catch (error) {
      console.error(error);
      alert("Xóa ghi chép thất bại.");
    }
  }

  async function handleDeleteGrade(gradeId) {
    if (!window.confirm("Xóa đầu điểm này?")) return;

    try {
      await deleteGradeItem(gradeId);
      await loadSummary(selectedId);
    } catch (error) {
      console.error(error);
      alert("Xóa đầu điểm thất bại.");
    }
  }

  async function handleDeleteAttendance(recordId) {
    if (!window.confirm("Xóa bản ghi chuyên cần này?")) return;

    try {
      await deleteAttendanceRecord(recordId);
      await loadSummary(selectedId);
    } catch (error) {
      console.error(error);
      alert("Xóa chuyên cần thất bại.");
    }
  }

  if (loading) {
    return <div className="student-loading">Đang dựng trung tâm sinh viên...</div>;
  }

  if (!summary) {
    return <EmptyBlock>Không có dữ liệu Sinh viên 360.</EmptyBlock>;
  }

  return (
    <div className="student-hub-page">
      <header className="student-hero">
        <div>
          <p className="student-kicker">Student 360</p>
          <h2>Sinh viên 360</h2>
          <p>
            Một màn hình gom lịch, deadline, môn học, điểm số và chuyên cần. Mở lên là biết hôm nay cần làm gì trước.
          </p>
        </div>

        <div className="student-hero-actions">
          <button className="student-refresh secondary" type="button" onClick={handleExportCalendar}>
            Xuất lịch .ics
          </button>
          <button className="student-refresh secondary" type="button" onClick={handleRegenerateCalendarLink}>
            Tạo lại link lịch
          </button>
          <button className="student-refresh" type="button" onClick={() => loadSummary(selectedId)}>
            Làm mới
          </button>
        </div>
      </header>

      <section className="student-metrics-grid">
        <MetricCard
          label="Môn đang quản lý"
          value={overview.subjectCount || 0}
          detail={`${overview.riskySubjectCount || 0} môn cần chú ý`}
          tone="blue"
        />
        <MetricCard
          label="GPA tạm tính"
          value={gpa.gpa10 !== null && gpa.gpa10 !== undefined ? `${formatScore(gpa.gpa10)}/10` : "--"}
          detail={gpa.gpa4 !== null && gpa.gpa4 !== undefined ? `${formatScore(gpa.gpa4)}/4 · ${gpa.totalCredits || 0} tín chỉ` : "Chưa đủ dữ liệu điểm"}
          tone="green"
        />
        <MetricCard
          label="EXP học tập"
          value={gamification.totalPoints || 0}
          detail={`Level ${gamification.level || 1} · chuỗi ${gamification.streakDays || 0} ngày`}
          tone="slate"
        />
        <MetricCard
          label="Cảnh báo chuyên cần"
          value={overview.attendanceWarningCount || 0}
          detail="Môn gần hoặc vượt giới hạn vắng"
          tone={(overview.attendanceWarningCount || 0) > 0 ? "orange" : "green"}
        />
        <MetricCard
          label="Tải 21 ngày"
          value={overview.calendarItemCount || 0}
          detail={`${overview.dangerCalendarItemCount || 0} mục có độ khẩn cao`}
          tone={(overview.dangerCalendarItemCount || 0) > 0 ? "red" : "blue"}
        />
      </section>

      <section className="student-actions-panel">
        <div className="student-panel-heading">
          <div>
            <h3>Hôm nay cần làm gì?</h3>
            <p>Danh sách ưu tiên được tổng hợp từ lịch, deadline, task, chuyên cần và điểm số.</p>
          </div>
        </div>

        <div className="student-action-grid">
          {todayActions.map((action, index) => (
            <article className={`student-action-card ${action.tone}`} key={`${action.title}-${index}`}>
              <span>{action.label || getToneLabel(action.tone)}</span>
              <strong>{action.title}</strong>
              <p>{action.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="student-calendar-panel">
        <div className="student-panel-heading">
          <div>
            <h3>Lịch tổng hợp 21 ngày</h3>
            <p>Gom thời khóa biểu, sự kiện, deadline và kế hoạch ngày vào một trục thời gian.</p>
          </div>
        </div>

        <div className="student-calendar-strip">
          {calendarDays.map((day) => (
            <article className={`student-day-card ${day.isToday ? "today" : ""}`} key={day.date}>
              <div className="student-day-head">
                <span>{day.dayLabel}</span>
                <strong>{day.dayOfMonth}</strong>
              </div>

              <div className="student-day-items">
                {day.items.length === 0 ? (
                  <small className="student-day-empty">Trống</small>
                ) : (
                  day.items.slice(0, 4).map((item, index) => (
                    <div className={`student-calendar-item ${item.tone}`} key={`${item.type}-${item.sourceId}-${index}`}>
                      <span>{getTypeLabel(item.type)}</span>
                      <strong>{item.time ? `${item.time} · ${item.title}` : item.title}</strong>
                    </div>
                  ))
                )}
                {day.items.length > 4 && <small>+{day.items.length - 4} mục khác</small>}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="student-main-grid">
        <aside className="student-subject-list-panel">
          <div className="student-panel-heading compact">
            <div>
              <h3>Trung tâm môn học</h3>
              <p>Chọn một môn để xem lịch, deadline, tài liệu, điểm và chuyên cần.</p>
            </div>
          </div>

          {subjects.length === 0 ? (
            <EmptyBlock>Chưa có môn học. Hãy tạo môn ở module Môn học trước.</EmptyBlock>
          ) : (
            <div className="student-subject-list">
              {subjects.map((subject) => (
                <button
                  className={`student-subject-card ${subject.id === selectedId ? "active" : ""} ${subject.risk}`}
                  key={subject.id}
                  type="button"
                  onClick={() => handleSelectSubject(subject.id)}
                >
                  <div>
                    <strong>{subject.name}</strong>
                    <span>{subject.semester || "Chưa có học kỳ"} · {subject.credits || 0} tín chỉ</span>
                  </div>
                  <small>{subject.risk === "stable" ? "Ổn" : subject.riskReasons?.join(", ") || "Cần chú ý"}</small>
                </button>
              ))}
            </div>
          )}
        </aside>

        <div className="student-detail-panel">
          {detailLoading ? (
            <EmptyBlock>Đang tải chi tiết môn học...</EmptyBlock>
          ) : !selectedSubject || !detail ? (
            <EmptyBlock>Chọn một môn học để xem trung tâm môn.</EmptyBlock>
          ) : (
            <>
              <div className="student-subject-hero">
                <div>
                  <span className={`student-risk-pill ${selectedSubject.risk}`}>{getToneLabel(selectedSubject.risk)}</span>
                  <h3>{selectedSubject.name}</h3>
                  <p>
                    {selectedSubject.lecturer || "Chưa có giảng viên"} · {selectedSubject.room || "Chưa có phòng"}
                  </p>
                </div>

                <div className="student-subject-score">
                  <span>Điểm tạm tính</span>
                  <strong>{formatScore(selectedSubject.gradeSummary?.score10)}/10</strong>
                  <small>{selectedSubject.gradeSummary?.letter || "--"} · {formatScore(selectedSubject.gradeSummary?.score4)}/4</small>
                </div>
              </div>

              <div className="student-detail-summary-grid">
                <MetricCard
                  label="Deadline mở"
                  value={selectedSubject.pendingDeadlineCount || 0}
                  detail={`${selectedSubject.urgentDeadlineCount || 0} gần hạn`}
                  tone={(selectedSubject.urgentDeadlineCount || 0) > 0 ? "red" : "blue"}
                />
                <MetricCard
                  label="Lịch học"
                  value={selectedSubject.scheduleCount || 0}
                  detail="Buổi trong thời khóa biểu"
                  tone="blue"
                />
                <MetricCard
                  label="Tài liệu"
                  value={selectedSubject.fileCount || 0}
                  detail="File đã gắn với môn"
                  tone="green"
                />
                <MetricCard
                  label="Ghi chép bài"
                  value={selectedSubject.classNoteCount || 0}
                  detail="Bài ghi chép đã gắn với môn"
                  tone="slate"
                />
                <MetricCard
                  label="Còn được vắng"
                  value={selectedSubject.attendanceSummary?.remaining ?? "--"}
                  detail={selectedSubject.attendanceSummary?.message || "Chưa có dữ liệu"}
                  tone={selectedSubject.attendanceSummary?.risk === "danger" ? "red" : selectedSubject.attendanceSummary?.risk === "warning" ? "orange" : "green"}
                />
              </div>

              <div className="student-detail-columns">
                <section className="student-section-card">
                  <h4>Điểm số / GPA</h4>
                  <form className="student-inline-form" onSubmit={handleCreateGrade}>
                    <input name="title" value={gradeForm.title} onChange={handleGradeChange} placeholder="Tên đầu điểm" />
                    <select name="category" value={gradeForm.category} onChange={handleGradeChange}>
                      {gradeCategories.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                    <input name="score" value={gradeForm.score} onChange={handleGradeChange} type="number" min="0" step="0.1" placeholder="Điểm" />
                    <input name="max_score" value={gradeForm.max_score} onChange={handleGradeChange} type="number" min="1" step="0.1" placeholder="Thang" />
                    <input name="weight_percent" value={gradeForm.weight_percent} onChange={handleGradeChange} type="number" min="0" max="100" step="0.1" placeholder="Trọng số %" />
                    <input name="note" value={gradeForm.note} onChange={handleGradeChange} placeholder="Ghi chú" />
                    <button className="primary-button" type="submit">Thêm điểm</button>
                  </form>

                  {detail.grades.length === 0 ? (
                    <EmptyBlock>Chưa có đầu điểm cho môn này.</EmptyBlock>
                  ) : (
                    <div className="student-table-wrap">
                      <table className="student-mini-table">
                        <thead>
                          <tr>
                            <th>Đầu điểm</th>
                            <th>Loại</th>
                            <th>Điểm</th>
                            <th>Trọng số</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.grades.map((grade) => (
                            <tr key={grade.id}>
                              <td>{grade.title}</td>
                              <td>{grade.categoryLabel}</td>
                              <td>{formatScore(grade.score)} / {formatScore(grade.maxScore)}</td>
                              <td>{grade.weightPercent ? `${grade.weightPercent}%` : "--"}</td>
                              <td>
                                <button className="student-text-button" type="button" onClick={() => handleDeleteGrade(grade.id)}>Xóa</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="student-section-card">
                  <h4>Chuyên cần</h4>
                  <form className="student-inline-form attendance" onSubmit={handleCreateAttendance}>
                    <input name="session_date" value={attendanceForm.session_date} onChange={handleAttendanceChange} type="date" />
                    <select name="status" value={attendanceForm.status} onChange={handleAttendanceChange}>
                      {attendanceStatuses.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </select>
                    <input name="lesson_title" value={attendanceForm.lesson_title} onChange={handleAttendanceChange} placeholder="Buổi học / nội dung" />
                    <input name="note" value={attendanceForm.note} onChange={handleAttendanceChange} placeholder="Ghi chú" />
                    <button className="primary-button" type="submit">Ghi chuyên cần</button>
                  </form>

                  {detail.attendanceRecords.length === 0 ? (
                    <EmptyBlock>Chưa có dữ liệu chuyên cần.</EmptyBlock>
                  ) : (
                    <div className="student-attendance-list">
                      {detail.attendanceRecords.slice(0, 8).map((record) => (
                        <article className={`student-attendance-item ${record.status}`} key={record.id}>
                          <div>
                            <strong>{formatDate(record.sessionDate)}</strong>
                            <span>{record.lessonTitle || "Buổi học"} · {record.statusLabel}</span>
                          </div>
                          <button className="student-text-button" type="button" onClick={() => handleDeleteAttendance(record.id)}>Xóa</button>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <section className="student-section-card student-class-note-card">
                <div className="student-note-heading">
                  <div>
                    <h4>Ghi chép bài giảng</h4>
                    <p>Ghi nhanh nội dung trên lớp, gắn ngày học, dùng lại khi ôn thi hoặc xem lại môn.</p>
                  </div>
                  <div className="student-note-template-row">
                    {classNoteTemplates.map((template) => (
                      <button key={template.label} type="button" onClick={() => applyClassNoteTemplate(template)}>
                        {template.label}
                      </button>
                    ))}
                  </div>
                </div>

                <form className="student-note-form" onSubmit={handleSaveClassNote}>
                  <div className="student-note-fields">
                    <input name="title" value={noteForm.title} onChange={handleNoteChange} placeholder="Tiêu đề ghi chép" />
                    <input name="target_date" value={noteForm.target_date} onChange={handleNoteChange} type="date" />
                    <input name="tags" value={noteForm.tags} onChange={handleNoteChange} placeholder="#tag" />
                  </div>
                  <RichTextEditor
                    value={noteForm.content}
                    onChange={(content) => setNoteForm((current) => ({ ...current, content }))}
                    placeholder="Ghi ý chính, công thức, ảnh bảng, phần chưa hiểu..."
                    minHeight={180}
                    imageMetadata={{ subject: selectedSubject?.name || "", module: "class_note" }}
                    autosaveState={autosaveState}
                  />
                  <div className="student-note-actions">
                    <button className="primary-button" type="submit">{editingNoteId ? "Lưu ghi chép" : "+ Ghi chép mới"}</button>
                    {editingNoteId && <button className="student-note-secondary" type="button" onClick={resetNoteForm}>Hủy sửa</button>}
                  </div>
                </form>

                <div className="student-note-layout">
                  <div className="student-note-list">
                    {classNotes.length === 0 ? (
                      <EmptyBlock>Chưa có ghi chép bài giảng cho môn này.</EmptyBlock>
                    ) : (
                      classNotes.map((note) => (
                        <button
                          key={note.id}
                          className={`student-note-item ${selectedNote?.id === note.id ? "active" : ""}`}
                          type="button"
                          onClick={() => setSelectedNoteId(note.id)}
                        >
                          <strong>{note.title}</strong>
                          <span>{formatDate(note.targetDate)} · {note.tags || "Không có tag"}</span>
                        </button>
                      ))
                    )}
                    {detail.classNotesHasMore && (
                      <button className="student-note-load-more" type="button" onClick={handleLoadMoreClassNotes}>
                        Tải thêm ghi chép ({classNotes.length}/{detail.classNotesTotal || 0})
                      </button>
                    )}
                  </div>

                  <div className="student-note-preview">
                    {selectedNote ? (
                      <>
                        <div className="student-note-preview-head">
                          <div>
                            <strong>{selectedNote.title}</strong>
                            <span>{formatDate(selectedNote.targetDate)} · cập nhật {formatDate(selectedNote.updatedAt?.slice(0, 10))}</span>
                          </div>
                          <div>
                            <button className="student-note-secondary" type="button" onClick={() => startEditNote(selectedNote)}>Sửa</button>
                            <button className="student-text-button" type="button" onClick={() => handleDeleteClassNote(selectedNote.id)}>Xóa</button>
                          </div>
                        </div>
                        <div className="student-note-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedNote.content || "<p>Chưa có nội dung.</p>") }} />
                      </>
                    ) : (
                      <EmptyBlock>Chọn một ghi chép để xem nhanh.</EmptyBlock>
                    )}
                  </div>
                </div>
              </section>

              <div className="student-context-grid">
                <section className="student-section-card">
                  <h4>Lịch học liên quan</h4>
                  {detail.schedules.length === 0 ? <EmptyBlock>Chưa có lịch gắn với môn.</EmptyBlock> : (
                    <div className="student-context-list">
                      {detail.schedules.map((item) => (
                        <article key={item.id}>
                          <strong>{item.dayLabel} · {item.startTime} - {item.endTime}</strong>
                          <span>{item.location || "Chưa có địa điểm"}</span>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section className="student-section-card">
                  <h4>Deadline môn học</h4>
                  {detail.deadlines.length === 0 ? <EmptyBlock>Chưa có deadline gắn với môn.</EmptyBlock> : (
                    <div className="student-context-list">
                      {detail.deadlines.slice(0, 8).map((item) => (
                        <article key={item.id}>
                          <strong>{item.title}</strong>
                          <span>{formatDate(item.dueDate)} · còn {item.daysLeft} ngày · {item.status}</span>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section className="student-section-card">
                  <h4>Tài liệu môn học</h4>
                  {detail.files.length === 0 ? <EmptyBlock>Chưa có tài liệu gắn với môn.</EmptyBlock> : (
                    <div className="student-context-list">
                      {detail.files.slice(0, 8).map((item) => (
                        <article key={item.id}>
                          <strong>{item.name}</strong>
                          <span>{item.fileType || "Tài liệu"} · {formatDate(item.createdAt)}</span>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default StudentHubPage;
