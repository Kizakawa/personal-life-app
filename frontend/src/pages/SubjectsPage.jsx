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
  attendance_limit: "3",
  target_score: "",
  progress_status: "studying",
  note: "",
};

const progressOptions = [
  { value: "studying", label: "Đang học" },
  { value: "needs_review", label: "Cần xem lại" },
  { value: "completed", label: "Đã ôn / Đã xong" },
];

const progressLabelMap = {
  studying: "Đang học",
  needs_review: "Cần xem lại",
  completed: "Đã xong",
  reviewed: "Đã ôn",
  not_started: "Chưa học",
};

const progressToneMap = {
  studying: "info",
  needs_review: "warning",
  completed: "success",
  reviewed: "success",
  not_started: "neutral",
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

  const totalCount = subjects.length;
  const showGhostGuide = !loading && totalCount === 0;

  const duplicateSubject = useMemo(() => {
    const trimmed = form.name.trim().toLowerCase();
    if (!trimmed) return null;
    return subjects.find(
      (item) => item.name.trim().toLowerCase() === trimmed && item.id !== editingId
    );
  }, [subjects, form.name, editingId]);

  useEffect(() => {
    loadSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lắng nghe Domain Event Bus với Debounce 150ms và Edit Guard
  useEffect(() => {
    let timer = null;
    function handleDataInvalidated(event) {
      const { modules = [] } = event.detail || {};
      if (!modules.includes("subjects")) return;

      // Edit Guard: Không refetch ghi đè nếu form đang mở hoặc đang chỉnh sửa
      if (showForm || editingId !== null) {
        return;
      }

      clearTimeout(timer);
      timer = setTimeout(() => {
        loadSubjects();
      }, 150);
    }

    window.addEventListener("app:data-invalidated", handleDataInvalidated);
    return () => {
      window.removeEventListener("app:data-invalidated", handleDataInvalidated);
      clearTimeout(timer);
    };
  }, [showForm, editingId]);

  // 4 Chỉ số KPI thống kê tương tác
  const stats = useMemo(() => {
    const totalCredits = subjects.reduce(
      (sum, item) => sum + (Number(item.credits) || 0),
      0
    );

    const studying = subjects.filter(
      (item) => item.progress_status === "studying"
    ).length;

    const needsReview = subjects.filter(
      (item) => item.progress_status === "needs_review"
    ).length;

    const completed = subjects.filter(
      (item) => item.progress_status === "completed" || item.progress_status === "reviewed"
    ).length;

    return {
      total: subjects.length,
      totalCredits,
      studying,
      needsReview,
      completed,
    };
  }, [subjects]);

  const filteredSubjects = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    const filtered = subjects.filter((item) => {
      const matchesQuery =
        !keyword ||
        [item.name, item.lecturer, item.room, item.note]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(keyword));

      let matchesStatus = true;
      if (statusFilter === "studying") {
        matchesStatus = item.progress_status === "studying";
      } else if (statusFilter === "needs_review") {
        matchesStatus = item.progress_status === "needs_review";
      } else if (statusFilter === "completed") {
        matchesStatus = item.progress_status === "completed" || item.progress_status === "reviewed";
      }

      return matchesQuery && matchesStatus;
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
          completed: 2,
          reviewed: 2,
          not_started: 3,
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
  }, [query, sortBy, statusFilter, subjects]);

  const selectedSubject = useMemo(() => {
    return subjects.find((item) => item.id === selectedId) || null;
  }, [selectedId, subjects]);

  const prioritySubjects = useMemo(() => {
    const rank = {
      needs_review: 0,
      studying: 1,
      not_started: 2,
      completed: 3,
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
      note: form.note.trim() || null,
      credits: form.credits === "" ? null : Math.max(0, Number(form.credits) || 0),
      attendance_limit: form.attendance_limit === "" ? null : Math.max(0, Number(form.attendance_limit) || 0),
      target_score: form.target_score === "" ? null : Math.max(0, Number(form.target_score) || 0),
      progress_status: form.progress_status || "studying",
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      alert("Vui lòng nhập tên môn học.");
      return;
    }

    if (duplicateSubject) {
      alert(`Môn học "${duplicateSubject.name}" đã tồn tại trong danh sách. Vui lòng kiểm tra lại.`);
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

      // Phát Domain Event Bus để đồng bộ sang Schedules, Dashboard, StudentHub
      window.dispatchEvent(
        new CustomEvent("app:data-invalidated", {
          detail: {
            modules: ["subjects", "schedules", "dashboard", "student-hub"],
            source: "subjects-page",
          },
        })
      );
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

      // Phát Domain Event Bus
      window.dispatchEvent(
        new CustomEvent("app:data-invalidated", {
          detail: {
            modules: ["subjects", "schedules", "dashboard", "student-hub"],
            source: "subjects-page",
          },
        })
      );
    } catch (error) {
      console.error(error);
      alert("Xóa môn học thất bại.");
    }
  }

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setSortBy("name_asc");
  }

  function selectSubject(subjectId) {
    setSelectedId(subjectId);
    setShowForm(false);
    setEditingId(null);
  }

  return (
    <div className={`subjects-page ${showForm ? "entry-mode" : ""}`}>
      {/* 3.1 Header Tinh Gọn với Nút + Thêm Môn góc phải */}
      <header className="page-header subjects-header">
        <div className="subjects-header-left">
          <div className="subjects-title-row">
            <span className="subjects-section-label">SUBJECTS</span>
            <h2>Môn học</h2>
          </div>
          <p className="subjects-subtitle">
            Theo dõi môn học, trạng thái tiến độ và chi tiết học phần.
          </p>
        </div>

        <button className="primary-button compact-add-btn" type="button" onClick={startCreate}>
          + Thêm môn
        </button>
      </header>

      {/* 3.2 4 Thẻ KPI Tương Tác (Quick Tab Filter 1 Hàng Ngang) */}
      <section className="subjects-kpi-grid">
        <button
          type="button"
          className={`subjects-kpi-card ${statusFilter === "all" ? "is-active" : ""}`}
          onClick={() => setStatusFilter("all")}
          title="Xem tất cả môn học"
        >
          <div className="kpi-card-header">
            <span className="kpi-label">Tổng môn</span>
            <span className="kpi-tag">{stats.totalCredits} TC</span>
          </div>
          <strong className="kpi-value">{stats.total}</strong>
          <small className="kpi-desc">Toàn bộ môn học</small>
        </button>

        <button
          type="button"
          className={`subjects-kpi-card info ${statusFilter === "studying" ? "is-active" : ""}`}
          onClick={() => setStatusFilter("studying")}
          title="Lọc môn đang học"
        >
          <div className="kpi-card-header">
            <span className="kpi-label">Đang học</span>
            <span className="kpi-dot info" />
          </div>
          <strong className="kpi-value info">{stats.studying}</strong>
          <small className="kpi-desc">Đang theo học hiện tại</small>
        </button>

        <button
          type="button"
          className={`subjects-kpi-card warning ${statusFilter === "needs_review" ? "is-active" : ""}`}
          onClick={() => setStatusFilter("needs_review")}
          title="Lọc môn cần xem lại"
        >
          <div className="kpi-card-header">
            <span className="kpi-label">Cần xem lại</span>
            <span className="kpi-dot warning" />
          </div>
          <strong className="kpi-value warning">{stats.needsReview}</strong>
          <small className="kpi-desc">Cần chú ý ôn tập / vắng</small>
        </button>

        <button
          type="button"
          className={`subjects-kpi-card success ${statusFilter === "completed" ? "is-active" : ""}`}
          onClick={() => setStatusFilter("completed")}
          title="Lọc môn đã hoàn thành"
        >
          <div className="kpi-card-header">
            <span className="kpi-label">Đã ôn / Đã xong</span>
            <span className="kpi-dot success" />
          </div>
          <strong className="kpi-value success">{stats.completed}</strong>
          <small className="kpi-desc">Đã hoàn tất học phần</small>
        </button>
      </section>

      {/* 3.3 Thanh Công Cụ Compact (Chiều cao <= 42px) */}
      <section className="subjects-compact-toolbar">
        <div className="toolbar-search-box">
          <svg className="search-icon" viewBox="0 0 20 20" fill="currentColor" width="15" height="15">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            className="compact-search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm tên môn, giảng viên, phòng học..."
          />
          {query && (
            <button className="clear-search-btn" type="button" onClick={() => setQuery("")} title="Xóa tìm kiếm">
              ✕
            </button>
          )}
        </div>

        <div className="toolbar-actions">
          <span className="toolbar-count">
            Hiển thị <strong>{filteredSubjects.length}</strong> / {subjects.length} môn
          </span>

          <div className="toolbar-sort-wrap">
            <select
              className="compact-sort-select"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              title="Sắp xếp danh sách"
            >
              <option value="name_asc">Tên A-Z</option>
              <option value="credits_desc">Tín chỉ cao - thấp</option>
              <option value="credits_asc">Tín chỉ thấp - cao</option>
              <option value="updated_desc">Mới cập nhật</option>
              <option value="status">Ưu tiên cần xem lại</option>
            </select>
          </div>

          {(query || statusFilter !== "all") && (
            <button className="reset-filter-btn" type="button" onClick={clearFilters} title="Đặt lại bộ lọc">
              Đặt lại
            </button>
          )}
        </div>
      </section>

      {/* 3.4 Bố Cục Above-The-Fold: Danh Sách Bảng và Khung Chi Tiết */}
      <div className="subjects-layout">
        <section className="subjects-panel subjects-list-panel">
          <div className="subjects-panel-header">
            <div>
              <h3>Bảng môn học</h3>
              <p>Bấm vào từng dòng để xem chi tiết hoặc chỉnh sửa.</p>
            </div>
          </div>

          {loading ? (
            <div className="subjects-empty-state">
              <p>Đang tải danh sách môn học...</p>
            </div>
          ) : showGhostGuide ? (
            <div className="subjects-ghost-guide-box">
              <div className="ghost-guide-header">
                <span className="ghost-guide-badge">[Ví dụ mẫu]</span>
                <strong>Chưa có môn học nào trong hệ thống</strong>
              </div>
              <p>
                Danh sách môn học của bạn đang trống hoàn toàn. Khi bạn thêm môn học hoặc thời khóa biểu (bằng form hoặc Trợ lý AI), môn học sẽ tự động được liên kết và hiển thị ở đây.
              </p>
              <div className="subjects-table-wrapper">
                <table className="subjects-table ghost-table">
                  <thead>
                    <tr>
                      <th>Môn học</th>
                      <th>Giảng viên</th>
                      <th>Tín chỉ</th>
                      <th>Phòng</th>
                      <th>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="ghost-guide-row">
                      <td>
                        <div className="subject-primary-cell">
                          <strong>[Ví dụ mẫu] Học Máy Tính</strong>
                          <span>Môn học mẫu minh họa</span>
                        </div>
                      </td>
                      <td>Thầy Nam</td>
                      <td>3</td>
                      <td>A2-301</td>
                      <td>
                        <span className="subject-badge info">Đang học</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="ghost-guide-actions">
                <button className="primary-button" type="button" onClick={startCreate}>
                  + Thêm môn học đầu tiên
                </button>
              </div>
            </div>
          ) : filteredSubjects.length === 0 ? (
            <div className="subjects-empty-state">
              <span className="empty-icon">🔍</span>
              <h4>Không tìm thấy môn học phù hợp</h4>
              <p>
                Không có môn học nào khớp với từ khóa "{query}" hoặc bộ lọc đang chọn.
              </p>
              <button
                className="secondary-button"
                type="button"
                onClick={clearFilters}
              >
                Đặt lại bộ lọc
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
                        <td>
                          <span className="credits-badge">{subject.credits || 0}</span>
                        </td>
                        <td>{subject.room || "Chưa có"}</td>
                        <td>
                          <span
                            className={`subject-badge ${progressToneMap[subject.progress_status] || "neutral"}`}
                          >
                            {progressLabelMap[subject.progress_status] || "Đang học"}
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
                    ? "Điền thông tin môn học thật gọn để theo dõi tiến độ."
                    : "Xem thông tin nhanh hoặc chỉnh sửa khi cần."}
                </p>
              </div>

              {!showForm && (
                <button className="icon-button" type="button" onClick={startCreate} title="Thêm môn mới">
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
                    autoFocus
                  />
                  {duplicateSubject && (
                    <span className="subjects-duplicate-hint">
                      ⚠️ Môn học "{duplicateSubject.name}" đã tồn tại trong danh sách.
                    </span>
                  )}
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
                      placeholder="Ví dụ: 8.5"
                    />
                  </label>
                </div>

                <label className="subjects-field">
                  <span>Trạng thái môn học</span>
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

                <label className="subjects-field">
                  <span>Ghi chú</span>
                  <textarea
                    name="note"
                    value={form.note}
                    onChange={handleChange}
                    placeholder="Tài liệu cần ôn, yêu cầu môn học, deadline kiểm tra, mẹo học..."
                    rows="3"
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
                    {progressLabelMap[selectedSubject.progress_status] || "Đang học"}
                  </span>
                </div>

                <div className="subject-detail-grid">
                  <article>
                    <span>Tín chỉ</span>
                    <strong>{selectedSubject.credits || 0} TC</strong>
                  </article>
                  <article>
                    <span>Phòng học</span>
                    <strong>{selectedSubject.room || "Chưa có"}</strong>
                  </article>
                  <article>
                    <span>Được vắng</span>
                    <strong>{selectedSubject.attendance_limit ?? 3} buổi</strong>
                  </article>
                  <article>
                    <span>Mục tiêu điểm</span>
                    <strong>{selectedSubject.target_score ?? "Chưa đặt"}</strong>
                  </article>
                </div>

                <div className="subject-detail-note">
                  <span>Ghi chú môn học</span>
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
                    Sửa thông tin
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => handleDelete(selectedSubject.id)}
                  >
                    Xóa môn
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
                <p>Gợi ý nhanh để ưu tiên xem lại môn có nguy cơ hoặc cần ôn tập.</p>
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
                        {subject.credits ? `${subject.credits} tín chỉ` : "Chưa có tín chỉ"} · {subject.room ? `Phòng ${subject.room}` : (subject.lecturer || "Chưa có phòng")}
                      </span>
                    </div>
                    <span
                      className={`subject-badge ${progressToneMap[subject.progress_status] || "neutral"}`}
                    >
                      {progressLabelMap[subject.progress_status] || "Đang học"}
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
