import { useEffect, useMemo, useState } from "react";
import { getSubjects } from "../api/subjectsApi";
import { getProjects } from "../api/projectsApi";
import { getFiles, getFileDownloadUrl } from "../api/filesApi";
import {
  createWorkspaceItem,
  deleteWorkspaceItem,
  getWorkspaceItems,
  updateWorkspaceItem,
} from "../api/workspaceApi";
import "./LibraryWorkspace.css";

const MODULE = "knowledge";

const initialForm = {
  module: MODULE,
  title: "",
  category: "concept",
  status: "active",
  priority: "medium",
  subject: "",
  project_name: "",
  target_date: "",
  file_path: "",
  url: "",
  tags: "",
  content: "",
};

const categoryOptions = [
  { value: "concept", label: "Khái niệm" },
  { value: "formula", label: "Công thức" },
  { value: "question", label: "Câu hỏi" },
  { value: "answer", label: "Câu trả lời mẫu" },
  { value: "code", label: "Code mẫu" },
  { value: "mistake", label: "Lỗi sai" },
  { value: "summary", label: "Tóm tắt" },
  { value: "exam", label: "Ôn thi" },
  { value: "other", label: "Khác" },
];

const statusOptions = [
  { value: "active", label: "Đang dùng" },
  { value: "review", label: "Cần xem lại" },
  { value: "pending", label: "Chưa chắc" },
  { value: "done", label: "Đã chắc" },
];

const priorityOptions = [
  { value: "low", label: "Thấp" },
  { value: "medium", label: "Trung bình" },
  { value: "high", label: "Cao" },
];

const templates = [
  {
    title: "Khái niệm mới",
    category: "concept",
    tags: "#khai-niem #can-hieu",
    content:
      "Định nghĩa:\n\nGiải thích bằng lời của mình:\n\nVí dụ đơn giản:\n\nĐiểm dễ nhầm:",
  },
  {
    title: "Công thức / quy tắc",
    category: "formula",
    tags: "#cong-thuc #ghi-nho",
    content:
      "Công thức:\n\nÝ nghĩa từng thành phần:\n\nKhi nào dùng:\n\nVí dụ áp dụng:",
  },
  {
    title: "Câu hỏi giảng viên",
    category: "question",
    tags: "#cau-hoi #giang-vien",
    content:
      "Câu hỏi:\n\nBối cảnh bài học:\n\nCâu trả lời ngắn:\n\nPhần cần hỏi lại:",
  },
  {
    title: "Lỗi sai cần nhớ",
    category: "mistake",
    status: "review",
    priority: "high",
    tags: "#loi-sai #can-on-lai",
    content:
      "Mình sai ở đâu:\n\nNguyên nhân:\n\nCách sửa đúng:\n\nDấu hiệu nhận biết lần sau:",
  },
];

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function getLabel(options, value, fallback = "Không rõ") {
  return options.find((option) => option.value === value)?.label || fallback;
}

function splitTags(tags) {
  return String(tags || "")
    .split(/[#,\s]+/)
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

function displayTags(tags) {
  return splitTags(tags).slice(0, 5);
}

function formatDate(value) {
  if (!value) return "Chưa có";

  try {
    return new Date(value).toLocaleDateString("vi-VN");
  } catch {
    return value;
  }
}

function previewText(value, limit = 120) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "Chưa có nội dung ghi chú.";
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function getStatusTone(status) {
  if (status === "done") return "is-green";
  if (status === "review") return "is-orange";
  if (status === "pending") return "is-purple";
  return "is-blue";
}

function getPriorityTone(priority) {
  if (priority === "high") return "is-red";
  if (priority === "low") return "is-green";
  return "is-blue";
}

function scoreDocumentRelation(item, documentItem) {
  let score = 0;

  if (item.subject && normalize(item.subject) === normalize(documentItem.subject)) {
    score += 5;
  }

  if (
    item.project_name &&
    normalize(item.project_name) === normalize(documentItem.project_name)
  ) {
    score += 4;
  }

  const itemTags = splitTags(item.tags);
  const documentTags = splitTags(documentItem.tags);
  const matchedTags = itemTags.filter((tag) => documentTags.includes(tag));
  score += matchedTags.length * 2;

  const titleWords = normalize(item.title)
    .split(/\s+/)
    .filter((word) => word.length >= 4);
  const documentText = normalize(
    `${documentItem.original_name} ${documentItem.note} ${documentItem.tags}`
  );

  if (titleWords.some((word) => documentText.includes(word))) {
    score += 1;
  }

  return score;
}

function KnowledgePage() {
  const [items, setItems] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [shelf, setShelf] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated_desc");

  async function loadData(preferredSelectedId = null) {
    try {
      setLoading(true);
      setError("");

      const [knowledgeData, documentData, subjectData, projectData] =
        await Promise.all([
          getWorkspaceItems(MODULE),
          getFiles("documents"),
          getSubjects(),
          getProjects(),
        ]);

      setItems(knowledgeData);
      setDocuments(documentData);
      setSubjects(subjectData);
      setProjects(projectData);

      const nextSelectedId =
        preferredSelectedId ?? selectedId ?? knowledgeData[0]?.id ?? null;
      const exists = knowledgeData.some((item) => item.id === nextSelectedId);
      setSelectedId(exists ? nextSelectedId : knowledgeData[0]?.id ?? null);
    } catch (err) {
      console.error(err);
      setError("Không tải được dữ liệu kho tri thức.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  );

  const shelves = useMemo(() => {
    const counter = new Map();

    items.forEach((item) => {
      const key = item.subject || "Chưa gắn môn";
      counter.set(key, (counter.get(key) || 0) + 1);
    });

    return [
      { id: "all", name: "Tất cả tri thức", count: items.length },
      ...Array.from(counter.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "vi"))
        .map(([name, count]) => ({ id: name, name, count })),
    ];
  }, [items]);

  const stats = useMemo(() => {
    const subjectsCount = new Set(items.map((item) => item.subject).filter(Boolean))
      .size;
    const linkedDocuments = items.filter((item) => {
      return documents.some((documentItem) => scoreDocumentRelation(item, documentItem) > 0);
    }).length;

    return {
      total: items.length,
      subjectsCount,
      review: items.filter((item) => item.status === "review").length,
      high: items.filter((item) => item.priority === "high").length,
      done: items.filter((item) => item.status === "done").length,
      linkedDocuments,
    };
  }, [documents, items]);

  const filteredItems = useMemo(() => {
    const keyword = normalize(query);

    const filtered = items.filter((item) => {
      const matchesQuery =
        !keyword ||
        [
          item.title,
          item.category,
          item.status,
          item.priority,
          item.subject,
          item.project_name,
          item.tags,
          item.content,
          item.url,
          item.file_path,
        ]
          .filter(Boolean)
          .some((value) => normalize(value).includes(keyword));

      const matchesShelf =
        shelf === "all" || normalize(item.subject || "Chưa gắn môn") === normalize(shelf);
      const matchesCategory =
        categoryFilter === "all" || item.category === categoryFilter;
      const matchesStatus = statusFilter === "all" || item.status === statusFilter;

      return matchesQuery && matchesShelf && matchesCategory && matchesStatus;
    });

    const sorted = [...filtered];

    switch (sortBy) {
      case "priority": {
        const rank = { high: 0, medium: 1, low: 2 };
        sorted.sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9));
        break;
      }
      case "subject":
        sorted.sort((a, b) =>
          (a.subject || "zzz").localeCompare(b.subject || "zzz", "vi")
        );
        break;
      case "title":
        sorted.sort((a, b) => a.title.localeCompare(b.title, "vi"));
        break;
      case "created_desc":
        sorted.sort(
          (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
        );
        break;
      case "updated_desc":
      default:
        sorted.sort(
          (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
        );
        break;
    }

    return sorted;
  }, [categoryFilter, items, query, shelf, sortBy, statusFilter]);

  const relatedDocuments = useMemo(() => {
    if (!selectedItem) return [];

    return documents
      .map((documentItem) => ({
        ...documentItem,
        relationScore: scoreDocumentRelation(selectedItem, documentItem),
      }))
      .filter((documentItem) => documentItem.relationScore > 0)
      .sort((a, b) => b.relationScore - a.relationScore)
      .slice(0, 6);
  }, [documents, selectedItem]);

  const focusItems = useMemo(() => {
    const rank = { review: 0, pending: 1, active: 2, done: 3 };

    return [...items]
      .sort((a, b) => {
        const statusDiff = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
        if (statusDiff !== 0) return statusDiff;
        if (a.priority === "high" && b.priority !== "high") return -1;
        if (b.priority === "high" && a.priority !== "high") return 1;
        return a.title.localeCompare(b.title, "vi");
      })
      .slice(0, 5);
  }, [items]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(false);
  }

  function openCreateForm() {
    setEditingId(null);
    setForm(initialForm);
    setShowForm(true);
  }

  function selectItem(itemId) {
    setSelectedId(itemId);
    setShowForm(false);
    setEditingId(null);
  }

  function applyTemplate(template) {
    setShowForm(true);
    setEditingId(null);
    setForm((current) => ({
      ...current,
      title: template.title,
      category: template.category,
      status: template.status || "active",
      priority: template.priority || "medium",
      tags: template.tags,
      content: template.content,
    }));
  }

  function handleEdit(item) {
    setSelectedId(item.id);
    setEditingId(item.id);
    setShowForm(true);
    setForm({
      module: item.module || MODULE,
      title: item.title || "",
      category: item.category || "concept",
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

  function buildPayload() {
    return {
      ...form,
      module: MODULE,
      title: form.title.trim(),
      subject: form.subject || null,
      project_name: form.project_name || null,
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
      alert("Vui lòng nhập tiêu đề tri thức.");
      return;
    }

    try {
      const payload = buildPayload();
      let savedItem = null;

      if (editingId) {
        savedItem = await updateWorkspaceItem(editingId, payload);
      } else {
        savedItem = await createWorkspaceItem(payload);
      }

      resetForm();
      await loadData(savedItem?.id || editingId);
    } catch (err) {
      console.error(err);
      alert("Lưu tri thức thất bại.");
    }
  }

  async function handleDelete(itemId) {
    const confirmed = window.confirm("Bạn có chắc muốn xóa mục tri thức này?");
    if (!confirmed) return;

    try {
      await deleteWorkspaceItem(itemId);
      if (editingId === itemId) resetForm();
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Xóa tri thức thất bại.");
    }
  }

  function clearFilters() {
    setQuery("");
    setShelf("all");
    setCategoryFilter("all");
    setStatusFilter("all");
    setSortBy("updated_desc");
  }

  return (
    <div className={`library-page ${showForm ? "entry-mode" : ""}`}>
      <header className="page-header library-header">
        <div>
          <span className="library-eyebrow">PERSONAL LIBRARY</span>
          <h2>Kho tri thức cá nhân</h2>
          <p>
            Biến kiến thức rời rạc thành một thư viện học tập có kệ sách theo môn,
            ghi chú lõi, câu hỏi, công thức, lỗi sai và tài liệu liên quan.
          </p>
        </div>

        <div className="library-header-actions">
          <button className="primary-button" type="button" onClick={openCreateForm}>
            + Thêm tri thức
          </button>
        </div>
      </header>

      <section className="library-summary-grid">
        <article className="library-card is-blue">
          <span>Tổng mục tri thức</span>
          <strong>{stats.total}</strong>
          <small>Các ghi chú, công thức, câu hỏi và code mẫu.</small>
        </article>
        <article className="library-card is-purple">
          <span>Kệ môn học</span>
          <strong>{stats.subjectsCount}</strong>
          <small>Số môn đang có tri thức được lưu.</small>
        </article>
        <article className="library-card is-warning">
          <span>Cần xem lại</span>
          <strong>{stats.review}</strong>
          <small>Nên ưu tiên ôn lại trước khi thi hoặc làm bài.</small>
        </article>
        <article className="library-card">
          <span>Ưu tiên cao</span>
          <strong>{stats.high}</strong>
          <small>Những mục quan trọng không nên bỏ sót.</small>
        </article>
        <article className="library-card is-success">
          <span>Đã chắc</span>
          <strong>{stats.done}</strong>
          <small>Kiến thức đã được chốt hoặc ôn ổn.</small>
        </article>
        <article className="library-card">
          <span>Có tài liệu liên quan</span>
          <strong>{stats.linkedDocuments}</strong>
          <small>Liên kết tự động theo môn, dự án và tag.</small>
        </article>
      </section>

      <section className="library-panel">
        <div className="library-toolbar">
          <label className="library-field">
            <span>Tìm trong thư viện</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tiêu đề, môn, tag, nội dung, link..."
            />
          </label>

          <label className="library-field">
            <span>Phân loại</span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="all">Tất cả</option>
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="library-field">
            <span>Trạng thái</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">Tất cả</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="library-field">
            <span>Sắp xếp</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="updated_desc">Mới cập nhật</option>
              <option value="created_desc">Mới thêm</option>
              <option value="priority">Ưu tiên</option>
              <option value="subject">Theo môn học</option>
              <option value="title">Theo tiêu đề</option>
            </select>
          </label>

          <label className="library-field">
            <span>Kệ đang xem</span>
            <select value={shelf} onChange={(event) => setShelf(event.target.value)}>
              {shelves.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="library-toolbar-footer">
          <p>
            Đang hiển thị <strong>{filteredItems.length}</strong> / {items.length} mục tri thức.
          </p>
          <button className="library-text-button" type="button" onClick={clearFilters}>
            Xóa bộ lọc
          </button>
        </div>
      </section>

      <div className="library-layout">
        <aside className="library-panel">
          <div className="library-section-heading">
            <div>
              <h3>Kệ thư viện</h3>
              <p>Gom tri thức theo môn học.</p>
            </div>
          </div>

          <div className="library-shelf-list">
            {shelves.map((item) => (
              <button
                key={item.id}
                className={`library-shelf-button ${shelf === item.id ? "is-active" : ""}`}
                type="button"
                onClick={() => setShelf(item.id)}
              >
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.id === "all" ? "Toàn bộ thư viện" : "Kệ môn học"}</span>
                </div>
                <span className="library-count-pill">{item.count}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="library-panel">
          <div className="library-section-heading">
            <div>
              <h3>Thẻ tri thức</h3>
              <p>Mỗi thẻ nên chứa một ý chính, một công thức hoặc một lỗi cần nhớ.</p>
            </div>
          </div>

          {error && <p className="error-message">{error}</p>}

          {loading ? (
            <p className="empty">Đang tải thư viện tri thức...</p>
          ) : filteredItems.length === 0 ? (
            <div className="library-empty-state">
              <h4>Chưa có tri thức phù hợp</h4>
              <p>Tạo một thẻ mới hoặc đổi bộ lọc để xem nhiều mục hơn.</p>
              <button className="secondary-button" type="button" onClick={openCreateForm}>
                Thêm tri thức đầu tiên
              </button>
            </div>
          ) : (
            <div className="library-grid">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  className={`library-item-card ${selectedId === item.id ? "is-active" : ""}`}
                  type="button"
                  onClick={() => selectItem(item.id)}
                >
                  <div className="library-item-top">
                    <span className="library-icon">{item.category === "code" ? "⌘" : "📘"}</span>
                    <span className={`library-badge ${getStatusTone(item.status)}`}>
                      {getLabel(statusOptions, item.status, "Đang dùng")}
                    </span>
                  </div>

                  <div>
                    <h4>{item.title}</h4>
                    <p>{previewText(item.content)}</p>
                  </div>

                  <div className="library-meta-row">
                    <span className="library-badge">
                      {getLabel(categoryOptions, item.category, "Khác")}
                    </span>
                    <span className={`library-badge ${getPriorityTone(item.priority)}`}>
                      {getLabel(priorityOptions, item.priority, "Trung bình")}
                    </span>
                  </div>

                  <div className="library-tag-row">
                    {(item.subject || item.project_name) && (
                      <span className="library-tag">
                        {item.subject || item.project_name}
                      </span>
                    )}
                    {displayTags(item.tags).map((tag) => (
                      <span className="library-tag" key={tag}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </main>

        <aside className="library-side-panel library-stack">
          <section className="library-panel">
            <div className="library-section-heading">
              <div>
                <h3>{showForm ? (editingId ? "Cập nhật tri thức" : "Thêm tri thức") : "Chi tiết"}</h3>
                <p>
                  {showForm
                    ? "Lưu ngắn gọn nhưng đủ ý. Một thẻ tốt phải đọc lại là hiểu."
                    : "Xem nội dung, tài liệu liên quan và thao tác nhanh."}
                </p>
              </div>

              {!showForm && (
                <button className="library-icon-button" type="button" onClick={openCreateForm}>
                  +
                </button>
              )}
            </div>

            {showForm ? (
              <form className="library-form" onSubmit={handleSubmit}>
                <label className="library-field">
                  <span>Tiêu đề *</span>
                  <input
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Ví dụ: Phân biệt CNN và YOLO"
                  />
                </label>

                <div className="library-two-columns">
                  <label className="library-field">
                    <span>Phân loại</span>
                    <select name="category" value={form.category} onChange={handleChange}>
                      {categoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="library-field">
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

                <div className="library-two-columns">
                  <label className="library-field">
                    <span>Ưu tiên</span>
                    <select name="priority" value={form.priority} onChange={handleChange}>
                      {priorityOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="library-field">
                    <span>Ngày liên quan</span>
                    <input
                      type="date"
                      name="target_date"
                      value={form.target_date}
                      onChange={handleChange}
                    />
                  </label>
                </div>

                <label className="library-field">
                  <span>Môn học</span>
                  <select name="subject" value={form.subject} onChange={handleChange}>
                    <option value="">Không gắn môn</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.name}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="library-field">
                  <span>Dự án liên quan</span>
                  <select
                    name="project_name"
                    value={form.project_name}
                    onChange={handleChange}
                  >
                    <option value="">Không gắn dự án</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.name}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="library-field">
                  <span>Link nguồn</span>
                  <input
                    name="url"
                    value={form.url}
                    onChange={handleChange}
                    placeholder="Link bài giảng, Colab, GitHub, Drive..."
                  />
                </label>

                <label className="library-field">
                  <span>Đường dẫn file / ghi chú tài liệu</span>
                  <input
                    name="file_path"
                    value={form.file_path}
                    onChange={handleChange}
                    placeholder="Ví dụ: XLA.docx hoặc E:\\TaiLieu\\file.pdf"
                  />
                </label>

                <label className="library-field">
                  <span>Tag</span>
                  <input
                    name="tags"
                    value={form.tags}
                    onChange={handleChange}
                    placeholder="#cnn #yolo #xulyanh"
                  />
                </label>

                <label className="library-field">
                  <span>Nội dung</span>
                  <textarea
                    name="content"
                    value={form.content}
                    onChange={handleChange}
                    rows="8"
                    placeholder="Ghi kiến thức cốt lõi, ví dụ, lỗi sai, cách nhớ..."
                  />
                </label>

                <div className="library-form-actions">
                  <button className="primary-button" type="submit">
                    {editingId ? "Lưu cập nhật" : "Thêm vào thư viện"}
                  </button>
                  <button className="secondary-button" type="button" onClick={resetForm}>
                    Hủy
                  </button>
                </div>
              </form>
            ) : selectedItem ? (
              <div className="library-detail-card">
                <div className="library-detail-title">
                  <div>
                    <h3>{selectedItem.title}</h3>
                    <p>{selectedItem.subject || "Chưa gắn môn"}</p>
                  </div>
                  <span className={`library-badge ${getStatusTone(selectedItem.status)}`}>
                    {getLabel(statusOptions, selectedItem.status, "Đang dùng")}
                  </span>
                </div>

                <div className="library-detail-grid">
                  <article>
                    <span>Phân loại</span>
                    <strong>{getLabel(categoryOptions, selectedItem.category, "Khác")}</strong>
                  </article>
                  <article>
                    <span>Ưu tiên</span>
                    <strong>{getLabel(priorityOptions, selectedItem.priority, "Trung bình")}</strong>
                  </article>
                  <article>
                    <span>Dự án</span>
                    <strong>{selectedItem.project_name || "Chưa gắn"}</strong>
                  </article>
                  <article>
                    <span>Ngày liên quan</span>
                    <strong>{formatDate(selectedItem.target_date)}</strong>
                  </article>
                </div>

                <div className="library-note-box">
                  <span>Nội dung</span>
                  <p>{selectedItem.content || "Chưa có nội dung."}</p>
                </div>

                {(selectedItem.tags || selectedItem.url || selectedItem.file_path) && (
                  <div className="library-note-box">
                    <span>Nguồn và tag</span>
                    <p>
                      {selectedItem.tags ? `Tag: ${selectedItem.tags}\n` : ""}
                      {selectedItem.url ? `Link: ${selectedItem.url}\n` : ""}
                      {selectedItem.file_path ? `File: ${selectedItem.file_path}` : ""}
                    </p>
                  </div>
                )}

                <div className="library-actions">
                  {selectedItem.url && (
                    <a
                      className="library-link-button library-secondary-link"
                      href={selectedItem.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Mở link
                    </a>
                  )}
                  <button
                    className="edit-button"
                    type="button"
                    onClick={() => handleEdit(selectedItem)}
                  >
                    Sửa
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => handleDelete(selectedItem.id)}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ) : (
              <div className="library-empty-state">
                <h4>Chưa chọn thẻ tri thức</h4>
                <p>Chọn một thẻ ở giữa hoặc thêm tri thức mới.</p>
                <button className="secondary-button" type="button" onClick={openCreateForm}>
                  Thêm tri thức
                </button>
              </div>
            )}
          </section>

          {!showForm && selectedItem && (
            <section className="library-panel">
              <div className="library-section-heading">
                <div>
                  <h3>Tài liệu liên quan</h3>
                  <p>Tự ghép theo môn học, dự án, tag và tiêu đề.</p>
                </div>
              </div>

              {relatedDocuments.length === 0 ? (
                <div className="library-empty-state">
                  <h4>Chưa thấy tài liệu phù hợp</h4>
                  <p>Gắn cùng môn học hoặc cùng tag để thư viện tự nối lại.</p>
                </div>
              ) : (
                <div className="library-related-list">
                  {relatedDocuments.map((documentItem) => (
                    <div className="library-related-item" key={documentItem.id}>
                      <div>
                        <strong>{documentItem.original_name}</strong>
                        <span>
                          {documentItem.subject || "Không môn"} · {documentItem.tags || "Không tag"}
                        </span>
                      </div>

                      {documentItem.file_path ? (
                        <a
                          className="library-link-button"
                          href={getFileDownloadUrl(documentItem.id)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Tải
                        </a>
                      ) : documentItem.url ? (
                        <a
                          className="library-link-button library-secondary-link"
                          href={documentItem.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Mở
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {!showForm && (
            <section className="library-panel">
              <div className="library-section-heading">
                <div>
                  <h3>Mẫu ghi nhanh</h3>
                  <p>Dùng khuôn sẵn để ghi nhanh và đều hơn.</p>
                </div>
              </div>

              <div className="library-template-grid">
                {templates.map((template) => (
                  <button
                    key={template.title}
                    className="library-template-button"
                    type="button"
                    onClick={() => applyTemplate(template)}
                  >
                    <strong>{template.title}</strong>
                    <span>{getLabel(categoryOptions, template.category)}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {!showForm && focusItems.length > 0 && (
            <section className="library-panel">
              <div className="library-section-heading">
                <div>
                  <h3>Cần mở lại sớm</h3>
                  <p>Những mục nên xem trước khi học hoặc ôn thi.</p>
                </div>
              </div>

              <div className="library-focus-list">
                {focusItems.map((item) => (
                  <button
                    key={item.id}
                    className="library-focus-item"
                    type="button"
                    onClick={() => selectItem(item.id)}
                  >
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.subject || "Chưa gắn môn"}</span>
                    </div>
                    <span className={`library-badge ${getStatusTone(item.status)}`}>
                      {getLabel(statusOptions, item.status)}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

export default KnowledgePage;
