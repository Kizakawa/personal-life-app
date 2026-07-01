import { useEffect, useMemo, useState } from "react";
import {
  createSubject,
  deleteSubject,
  getSubjects,
  updateSubject,
} from "../api/subjectsApi";
import "./SubjectsPage.css";

const initialForm = {
  name: "",
  lecturer: "",
  credits: "",
  room: "",
  semester: "",
  attendance_limit: "3",
  target_score: "",
  progress_status: "studying",
  note: "",
};

const progressOptions = [
  { value: "not_started", label: "Chưa học" },
  { value: "studying", label: "Đang học" },
  { value: "needs_review", label: "Cần xem lại" },
  { value: "reviewed", label: "Đã ôn" },
];

const progressLabelMap = {
  not_started: "Chưa học",
  studying: "Đang học",
  needs_review: "Cần xem lại",
  reviewed: "Đã ôn",
};

const progressToneMap = {
  not_started: "neutral",
  studying: "info",
  needs_review: "warning",
  reviewed: "success",
};

function formatDate(value) {
  if (!value) return "Chưa có";

  try {
    return new Date(value).toLocaleDateString("vi-VN");
  } catch {
    return "Chưa có";
  }
}

function SubjectsPage() {
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name_asc");
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  async function loadSubjects(preferredSelectedId = null) {
    try {
      setLoading(true);
      const data = await getSubjects();
      setSubjects(data);

      const sortedData = [...data];
      const nextSelected =
        preferredSelectedId ??
        selectedId ??
        (sortedData.length > 0 ? sortedData[0].id : null);

      const stillExists = sortedData.some((item) => item.id === nextSelected);
      setSelectedId(stillExists ? nextSelected : sortedData[0]?.id ?? null);
    } catch (error) {
      console.error(error);
      alert("Không tải được danh sách môn học.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const semesters = useMemo(() => {
    return Array.from(
      new Set(subjects.map((item) => item.semester).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "vi"));
  }, [subjects]);

  const stats = useMemo(() => {
    const totalCredits = subjects.reduce(
      (sum, item) => sum + (Number(item.credits) || 0),
      0
    );

    const semesterCounter = subjects.reduce((accumulator, item) => {
      const key = item.semester || "Chưa phân học kỳ";
      accumulator[key] = (accumulator[key] || 0) + 1;
      return accumulator;
    }, {});

    const busiestSemesterEntry = Object.entries(semesterCounter).sort(
      (a, b) => b[1] - a[1]
    )[0];

    return {
      total: subjects.length,
      totalCredits,
      studying: subjects.filter((item) => item.progress_status === "studying")
        .length,
      needsReview: subjects.filter(
        (item) => item.progress_status === "needs_review"
      ).length,
      reviewed: subjects.filter((item) => item.progress_status === "reviewed")
        .length,
      notStarted: subjects.filter(
        (item) => item.progress_status === "not_started"
      ).length,
      lecturers: new Set(subjects.map((item) => item.lecturer).filter(Boolean))
        .size,
      busiestSemester: busiestSemesterEntry?.[0] || "Chưa có",
    };
  }, [subjects]);

  const filteredSubjects = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    const filtered = subjects.filter((item) => {
      const matchesQuery =
        !keyword ||
        [item.name, item.lecturer, item.room, item.semester, item.note]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(keyword));

      const matchesSemester =
        semesterFilter === "all" ||
        (item.semester || "") === semesterFilter;

      const matchesStatus =
        statusFilter === "all" || item.progress_status === statusFilter;

      return matchesQuery && matchesSemester && matchesStatus;
    });

    const sorted = [...filtered];

    switch (sortBy) {
      case "credits_desc":
        sorted.sort((a, b) => (Number(b.credits) || 0) - (Number(a.credits) || 0));
        break;
      case "credits_asc":
        sorted.sort((a, b) => (Number(a.credits) || 0) - (Number(b.credits) || 0));
        break;
      case "updated_desc":
        sorted.sort(
          (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
        );
        break;
      case "status": {
        const rank = {
          needs_review: 0,
          studying: 1,
          not_started: 2,
          reviewed: 3,
        };
        sorted.sort(
          (a, b) =>
            (rank[a.progress_status] ?? 99) - (rank[b.progress_status] ?? 99)
        );
        break;
      }
      case "name_asc":
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name, "vi"));
        break;
    }

    return sorted;
  }, [query, semesterFilter, sortBy, statusFilter, subjects]);

  const selectedSubject = useMemo(() => {
    return subjects.find((item) => item.id === selectedId) || null;
  }, [selectedId, subjects]);

  const prioritySubjects = useMemo(() => {
    const rank = {
      needs_review: 0,
      studying: 1,
      not_started: 2,
      reviewed: 3,
    };

    return [...subjects]
      .sort((a, b) => {
        const rankDiff = (rank[a.progress_status] ?? 99) - (rank[b.progress_status] ?? 99);
        if (rankDiff !== 0) return rankDiff;
        return a.name.localeCompare(b.name, "vi");
      })
      .slice(0, 4);
  }, [subjects]);

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

  function startCreate() {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(true);
  }

  function buildPayload() {
    return {
      ...form,
      name: form.name.trim(),
      lecturer: form.lecturer.trim() || null,
      room: form.room.trim() || null,
      semester: form.semester.trim() || null,
      note: form.note.trim() || null,
      credits: form.credits === "" ? null : Math.max(0, Number(form.credits) || 0),
      attendance_limit: form.attendance_limit === "" ? null : Math.max(0, Number(form.attendance_limit) || 0),
      target_score: form.target_score === "" ? null : Math.max(0, Number(form.target_score) || 0),
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      alert("Vui lòng nhập tên môn học.");
      return;
    }

    try {
      const payload = buildPayload();

      if (editingId) {
        await updateSubject(editingId, payload);
      } else {
        await createSubject(payload);
      }

      const preferredSelectedId = editingId;
      resetForm();
      await loadSubjects(preferredSelectedId);
    } catch (error) {
      console.error(error);
      alert("Lưu môn học thất bại.");
    }
  }

  function handleEdit(subject) {
    setEditingId(subject.id);
    setSelectedId(subject.id);
    setShowForm(true);
    setForm({
      name: subject.name || "",
      lecturer: subject.lecturer || "",
      credits: subject.credits ?? "",
      room: subject.room || "",
      semester: subject.semester || "",
      attendance_limit: subject.attendance_limit ?? "3",
      target_score: subject.target_score ?? "",
      progress_status: subject.progress_status || "studying",
      note: subject.note || "",
    });
  }

  async function handleDelete(subjectId) {
    const confirmed = window.confirm("Bạn có chắc muốn xóa môn học này?");
    if (!confirmed) return;

    try {
      await deleteSubject(subjectId);
      if (editingId === subjectId) {
        resetForm();
      }
      await loadSubjects();
    } catch (error) {
      console.error(error);
      alert("Xóa môn học thất bại.");
    }
  }

  function clearFilters() {
    setQuery("");
    setSemesterFilter("all");
    setStatusFilter("all");
    setSortBy("name_asc");
  }

  function selectSubject(subjectId) {
    setSelectedId(subjectId);
    setShowForm(false);
    setEditingId(null);
  }

  return (
    <div className="subjects-page">
      <header className="page-header subjects-header">
        <div>
          <span className="subjects-section-label">SUBJECTS</span>
          <h2>Môn học</h2>
          <p>
            Theo dõi toàn bộ môn học theo kiểu bảng dễ nhìn, lọc nhanh theo học kỳ,
            tình trạng học và mở chi tiết từng môn để cập nhật khi cần.
          </p>
        </div>

        <button className="primary-button" type="button" onClick={startCreate}>
          + Thêm môn học
        </button>
      </header>

      <section className="subjects-summary-grid">
        <article className="subjects-summary-card emphasis">
          <span>Tổng môn</span>
          <strong>{stats.total}</strong>
          <small>{stats.totalCredits} tín chỉ đang quản lý</small>
        </article>

        <article className="subjects-summary-card">
          <span>Đang học</span>
          <strong>{stats.studying}</strong>
          <small>Môn đang theo học hiện tại</small>
        </article>

        <article className="subjects-summary-card warning">
          <span>Cần xem lại</span>
          <strong>{stats.needsReview}</strong>
          <small>Nên ưu tiên ôn tập hoặc bổ sung ghi chú</small>
        </article>

        <article className="subjects-summary-card success">
          <span>Đã ôn</span>
          <strong>{stats.reviewed}</strong>
          <small>Đã hoàn thành hoặc ôn ổn</small>
        </article>

        <article className="subjects-summary-card">
          <span>Giảng viên</span>
          <strong>{stats.lecturers}</strong>
          <small>Số giảng viên khác nhau</small>
        </article>

        <article className="subjects-summary-card">
          <span>Học kỳ nổi bật</span>
          <strong>{stats.busiestSemester}</strong>
          <small>Nơi có nhiều môn nhất hiện tại</small>
        </article>
      </section>

      <section className="subjects-panel subjects-toolbar-panel">
        <div className="subjects-toolbar">
          <label className="subjects-field search-field">
            <span>Tìm kiếm</span>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tên môn, giảng viên, học kỳ, phòng..."
            />
          </label>

          <label className="subjects-field">
            <span>Học kỳ</span>
            <select
              value={semesterFilter}
              onChange={(event) => setSemesterFilter(event.target.value)}
            >
              <option value="all">Tất cả học kỳ</option>
              {semesters.map((semester) => (
                <option key={semester} value={semester}>
                  {semester}
                </option>
              ))}
            </select>
          </label>

          <label className="subjects-field">
            <span>Trạng thái</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Tất cả trạng thái</option>
              {progressOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="subjects-field">
            <span>Sắp xếp</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="name_asc">Tên môn A-Z</option>
              <option value="credits_desc">Tín chỉ cao đến thấp</option>
              <option value="credits_asc">Tín chỉ thấp đến cao</option>
              <option value="updated_desc">Mới cập nhật</option>
              <option value="status">Ưu tiên môn cần chú ý</option>
            </select>
          </label>
        </div>

        <div className="subjects-toolbar-footer">
          <p>
            Hiển thị <strong>{filteredSubjects.length}</strong> / {subjects.length} môn học.
          </p>

          <button className="text-button" type="button" onClick={clearFilters}>
            Xóa bộ lọc
          </button>
        </div>
      </section>

      <div className="subjects-layout">
        <section className="subjects-panel subjects-list-panel">
          <div className="subjects-panel-header">
            <div>
              <h3>Bảng môn học</h3>
              <p>Theo dõi nhanh và bấm vào từng dòng để xem chi tiết.</p>
            </div>
          </div>

          {loading ? (
            <p className="subjects-empty">Đang tải dữ liệu môn học...</p>
          ) : filteredSubjects.length === 0 ? (
            <div className="subjects-empty-state">
              <h4>Không có môn học phù hợp</h4>
              <p>Hãy đổi bộ lọc hoặc thêm môn học mới để bắt đầu quản lý.</p>
              <button className="secondary-button" type="button" onClick={startCreate}>
                Thêm môn học
              </button>
            </div>
          ) : (
            <div className="subjects-table-wrapper">
              <table className="subjects-table">
                <thead>
                  <tr>
                    <th>Môn học</th>
                    <th>Giảng viên</th>
                    <th>Tín chỉ</th>
                    <th>Phòng</th>
                    <th>Học kỳ</th>
                    <th>Trạng thái</th>
                    <th>Cập nhật</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubjects.map((subject) => {
                    const isActive = selectedId === subject.id;

                    return (
                      <tr
                        key={subject.id}
                        className={isActive ? "is-active" : ""}
                        onClick={() => selectSubject(subject.id)}
                      >
                        <td>
                          <div className="subject-primary-cell">
                            <strong>{subject.name}</strong>
                            <span>{subject.note || "Chưa có ghi chú"}</span>
                          </div>
                        </td>
                        <td>{subject.lecturer || "Chưa có"}</td>
                        <td>{subject.credits || 0}</td>
                        <td>{subject.room || "Chưa có"}</td>
                        <td>{subject.semester || "Chưa có"}</td>
                        <td>
                          <span
                            className={`subject-badge ${progressToneMap[subject.progress_status] || "neutral"}`}
                          >
                            {progressLabelMap[subject.progress_status] || "Không rõ"}
                          </span>
                        </td>
                        <td>{formatDate(subject.updated_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="subjects-side-column">
          <section className="subjects-panel subjects-detail-panel">
            <div className="subjects-panel-header align-top">
              <div>
                <h3>{showForm ? (editingId ? "Cập nhật môn học" : "Thêm môn học") : "Chi tiết môn học"}</h3>
                <p>
                  {showForm
                    ? "Điền thông tin môn học thật gọn, sau này sẽ dễ theo dõi hơn."
                    : "Xem thông tin nhanh, cập nhật khi cần hoặc tạo môn học mới."}
                </p>
              </div>

              {!showForm && (
                <button className="icon-button" type="button" onClick={startCreate}>
                  +
                </button>
              )}
            </div>

            {showForm ? (
              <form className="subjects-form" onSubmit={handleSubmit}>
                <label className="subjects-field">
                  <span>Tên môn học *</span>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Ví dụ: Xử lý ảnh số"
                  />
                </label>

                <label className="subjects-field">
                  <span>Giảng viên</span>
                  <input
                    name="lecturer"
                    value={form.lecturer}
                    onChange={handleChange}
                    placeholder="Tên giảng viên"
                  />
                </label>

                <div className="subjects-two-columns">
                  <label className="subjects-field">
                    <span>Số tín chỉ</span>
                    <input
                      type="number"
                      min="0"
                      name="credits"
                      value={form.credits}
                      onChange={handleChange}
                      placeholder="Ví dụ: 3"
                    />
                  </label>

                  <label className="subjects-field">
                    <span>Phòng học</span>
                    <input
                      name="room"
                      value={form.room}
                      onChange={handleChange}
                      placeholder="Ví dụ: A305"
                    />
                  </label>
                </div>

                <div className="subjects-two-columns">
                  <label className="subjects-field">
                    <span>Học kỳ</span>
                    <input
                      name="semester"
                      value={form.semester}
                      onChange={handleChange}
                      placeholder="Ví dụ: HK2 2026"
                    />
                  </label>

                  <label className="subjects-field">
                    <span>Số buổi được vắng</span>
                    <input
                      type="number"
                      min="0"
                      name="attendance_limit"
                      value={form.attendance_limit}
                      onChange={handleChange}
                      placeholder="Ví dụ: 3"
                    />
                  </label>
                </div>

                <div className="subjects-two-columns">
                  <label className="subjects-field">
                    <span>Mục tiêu điểm</span>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      name="target_score"
                      value={form.target_score}
                      onChange={handleChange}
                      placeholder="Ví dụ: 8"
                    />
                  </label>

                  <label className="subjects-field">
                    <span>Trạng thái</span>
                    <select
                      name="progress_status"
                      value={form.progress_status}
                      onChange={handleChange}
                    >
                      {progressOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="subjects-field">
                  <span>Ghi chú</span>
                  <textarea
                    name="note"
                    value={form.note}
                    onChange={handleChange}
                    placeholder="Tài liệu cần ôn, yêu cầu môn học, deadline kiểm tra, mẹo học..."
                    rows="5"
                  />
                </label>

                <div className="subjects-form-actions">
                  <button className="primary-button" type="submit">
                    {editingId ? "Lưu cập nhật" : "Thêm môn học"}
                  </button>
                  <button className="secondary-button" type="button" onClick={resetForm}>
                    Hủy
                  </button>
                </div>
              </form>
            ) : selectedSubject ? (
              <div className="subject-detail-card">
                <div className="subject-detail-top">
                  <div>
                    <h4>{selectedSubject.name}</h4>
                    <p>{selectedSubject.lecturer || "Chưa có giảng viên"}</p>
                  </div>
                  <span
                    className={`subject-badge ${progressToneMap[selectedSubject.progress_status] || "neutral"}`}
                  >
                    {progressLabelMap[selectedSubject.progress_status] || "Không rõ"}
                  </span>
                </div>

                <div className="subject-detail-grid">
                  <article>
                    <span>Tín chỉ</span>
                    <strong>{selectedSubject.credits || 0}</strong>
                  </article>
                  <article>
                    <span>Phòng học</span>
                    <strong>{selectedSubject.room || "Chưa có"}</strong>
                  </article>
                  <article>
                    <span>Học kỳ</span>
                    <strong>{selectedSubject.semester || "Chưa có"}</strong>
                  </article>
                  <article>
                    <span>Được vắng</span>
                    <strong>{selectedSubject.attendance_limit ?? 3} buổi</strong>
                  </article>
                  <article>
                    <span>Mục tiêu điểm</span>
                    <strong>{selectedSubject.target_score ?? "Chưa đặt"}</strong>
                  </article>
                  <article>
                    <span>Cập nhật</span>
                    <strong>{formatDate(selectedSubject.updated_at)}</strong>
                  </article>
                </div>

                <div className="subject-detail-note">
                  <span>Ghi chú</span>
                  <p>
                    {selectedSubject.note ||
                      "Chưa có ghi chú. Bạn có thể thêm tài liệu, lưu ý ôn tập hoặc các thông tin quan trọng ở đây."}
                  </p>
                </div>

                <div className="subject-detail-actions">
                  <button
                    className="edit-button"
                    type="button"
                    onClick={() => handleEdit(selectedSubject)}
                  >
                    Sửa
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => handleDelete(selectedSubject.id)}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ) : (
              <div className="subjects-empty-state compact">
                <h4>Chưa chọn môn học nào</h4>
                <p>Hãy chọn một dòng trong bảng hoặc tạo môn học mới.</p>
                <button className="secondary-button" type="button" onClick={startCreate}>
                  Thêm môn học
                </button>
              </div>
            )}
          </section>

          <section className="subjects-panel subjects-focus-panel">
            <div className="subjects-panel-header">
              <div>
                <h3>Môn cần chú ý</h3>
                <p>Gợi ý nhanh để biết môn nào nên ưu tiên xem lại.</p>
              </div>
            </div>

            {prioritySubjects.length === 0 ? (
              <p className="subjects-empty">Chưa có môn học để phân tích.</p>
            ) : (
              <div className="subjects-focus-list">
                {prioritySubjects.map((subject) => (
                  <button
                    key={subject.id}
                    type="button"
                    className="subjects-focus-item"
                    onClick={() => selectSubject(subject.id)}
                  >
                    <div>
                      <strong>{subject.name}</strong>
                      <span>
                        {subject.semester || "Chưa có học kỳ"} · {subject.credits || 0} tín chỉ
                      </span>
                    </div>
                    <span
                      className={`subject-badge ${progressToneMap[subject.progress_status] || "neutral"}`}
                    >
                      {progressLabelMap[subject.progress_status] || "Không rõ"}
                    </span>
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

export default SubjectsPage;
