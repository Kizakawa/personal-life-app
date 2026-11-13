import { useEffect, useMemo, useState } from "react";
import { getSubjects } from "../api/subjectsApi";
import { getProjects } from "../api/projectsApi";
import {
  createFileRecord,
  deleteFileRecord,
  getFileDownloadUrl,
  getFiles,
  updateFileRecord,
} from "../api/filesApi";
import {
  createWorkspaceItem,
  getWorkspaceItems,
} from "../api/workspaceApi";
import "./LibraryWorkspace.css";

const initialForm = {
  title: "",
  file_type: "report",
  module: "documents",
  subject: "",
  project_name: "",
  url: "",
  tags: "",
  note: "",
  upload_file: null,
};

const fileTypeOptions = [
  { value: "report", label: "Báo cáo", icon: "📄" },
  { value: "slide", label: "Slide", icon: "📊" },
  { value: "code", label: "Code", icon: "⌘" },
  { value: "dataset", label: "Dữ liệu", icon: "🧩" },
  { value: "image", label: "Ảnh lỗi / minh họa", icon: "🖼️" },
  { value: "link", label: "Link", icon: "🔗" },
  { value: "paper", label: "Bài báo / tài liệu đọc", icon: "📚" },
  { value: "other", label: "Khác", icon: "📦" },
];

function normalize(value) {
  return String(value || "").trim().toLowerCase();
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

function getFileType(type) {
  return fileTypeOptions.find((option) => option.value === type) || fileTypeOptions[fileTypeOptions.length - 1];
}

function formatDate(value) {
  if (!value) return "Chưa có";

  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return value;
  }
}

function previewText(value, limit = 130) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "Chưa có ghi chú cho tài liệu này.";
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function getSourceLabel(item) {
  if (item.file_path && item.url) return "File + link";
  if (item.file_path) return "File upload";
  if (item.url) return "Link online";
  return "Bản ghi";
}

function scoreKnowledgeRelation(documentItem, knowledgeItem) {
  let score = 0;

  if (
    documentItem.subject &&
    normalize(documentItem.subject) === normalize(knowledgeItem.subject)
  ) {
    score += 5;
  }

  if (
    documentItem.project_name &&
    normalize(documentItem.project_name) === normalize(knowledgeItem.project_name)
  ) {
    score += 4;
  }

  const documentTags = splitTags(documentItem.tags);
  const knowledgeTags = splitTags(knowledgeItem.tags);
  const matchedTags = documentTags.filter((tag) => knowledgeTags.includes(tag));
  score += matchedTags.length * 2;

  const documentWords = normalize(documentItem.original_name)
    .split(/\s+/)
    .filter((word) => word.length >= 4);
  const knowledgeText = normalize(
    `${knowledgeItem.title} ${knowledgeItem.content} ${knowledgeItem.tags}`
  );

  if (documentWords.some((word) => knowledgeText.includes(word))) {
    score += 1;
  }

  return score;
}

function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [knowledgeItems, setKnowledgeItems] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [shelf, setShelf] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_desc");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadData(preferredSelectedId = null) {
    try {
      setLoading(true);
      setError("");

      const [documentData, knowledgeData, subjectData, projectData] =
        await Promise.all([
          getFiles("documents"),
          getWorkspaceItems("knowledge"),
          getSubjects(),
          getProjects(),
        ]);

      setDocuments(documentData);
      setKnowledgeItems(knowledgeData);
      setSubjects(subjectData);
      setProjects(projectData);

      const nextSelectedId = preferredSelectedId ?? selectedId ?? documentData[0]?.id ?? null;
      const exists = documentData.some((item) => item.id === nextSelectedId);
      setSelectedId(exists ? nextSelectedId : documentData[0]?.id ?? null);
    } catch (err) {
      console.error(err);
      setError("Không tải được dữ liệu tài liệu.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedDocument = useMemo(
    () => documents.find((item) => item.id === selectedId) || null,
    [documents, selectedId]
  );

  const shelves = useMemo(() => {
    const counter = new Map();

    documents.forEach((item) => {
      const key = item.subject || "Chưa gắn môn";
      counter.set(key, (counter.get(key) || 0) + 1);
    });

    return [
      { id: "all", name: "Tất cả tài liệu", count: documents.length },
      ...Array.from(counter.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "vi"))
        .map(([name, count]) => ({ id: name, name, count })),
    ];
  }, [documents]);

  const projectOptions = useMemo(() => {
    const existingProjects = new Set(
      documents.map((item) => item.project_name).filter(Boolean)
    );

    projects.forEach((project) => existingProjects.add(project.name));

    return Array.from(existingProjects).sort((a, b) => a.localeCompare(b, "vi"));
  }, [documents, projects]);

  const stats = useMemo(() => {
    const uploads = documents.filter((item) => item.file_path).length;
    const links = documents.filter((item) => item.url).length;
    const unlinked = documents.filter(
      (item) => !item.subject && !item.project_name && !item.tags
    ).length;
    const withKnowledge = documents.filter((documentItem) => {
      return knowledgeItems.some(
        (knowledgeItem) => scoreKnowledgeRelation(documentItem, knowledgeItem) > 0
      );
    }).length;

    return {
      total: documents.length,
      uploads,
      links,
      unlinked,
      withKnowledge,
      subjects: new Set(documents.map((item) => item.subject).filter(Boolean)).size,
    };
  }, [documents, knowledgeItems]);

  const filteredDocuments = useMemo(() => {
    const keyword = normalize(query);

    const filtered = documents.filter((item) => {
      const matchesQuery =
        !keyword ||
        [
          item.original_name,
          item.file_type,
          item.subject,
          item.project_name,
          item.tags,
          item.note,
          item.url,
        ]
          .filter(Boolean)
          .some((value) => normalize(value).includes(keyword));

      const matchesShelf =
        shelf === "all" || normalize(item.subject || "Chưa gắn môn") === normalize(shelf);
      const matchesType = typeFilter === "all" || item.file_type === typeFilter;
      const matchesProject =
        projectFilter === "all" || normalize(item.project_name) === normalize(projectFilter);
      const matchesSource =
        sourceFilter === "all" ||
        (sourceFilter === "upload" && item.file_path) ||
        (sourceFilter === "link" && item.url && !item.file_path) ||
        (sourceFilter === "both" && item.file_path && item.url) ||
        (sourceFilter === "record" && !item.file_path && !item.url);

      return matchesQuery && matchesShelf && matchesType && matchesProject && matchesSource;
    });

    const sorted = [...filtered];

    switch (sortBy) {
      case "name":
        sorted.sort((a, b) => a.original_name.localeCompare(b.original_name, "vi"));
        break;
      case "subject":
        sorted.sort((a, b) =>
          (a.subject || "zzz").localeCompare(b.subject || "zzz", "vi")
        );
        break;
      case "type":
        sorted.sort((a, b) => (a.file_type || "").localeCompare(b.file_type || ""));
        break;
      case "created_desc":
      default:
        sorted.sort(
          (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
        );
        break;
    }

    return sorted;
  }, [documents, projectFilter, query, shelf, sortBy, sourceFilter, typeFilter]);

  const relatedKnowledge = useMemo(() => {
    if (!selectedDocument) return [];

    return knowledgeItems
      .map((item) => ({
        ...item,
        relationScore: scoreKnowledgeRelation(selectedDocument, item),
      }))
      .filter((item) => item.relationScore > 0)
      .sort((a, b) => b.relationScore - a.relationScore)
      .slice(0, 6);
  }, [knowledgeItems, selectedDocument]);

  const focusDocuments = useMemo(() => {
    return [...documents]
      .filter((item) => !item.subject || !item.tags || !item.note)
      .slice(0, 5);
  }, [documents]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0] || null;

    setForm((current) => ({
      ...current,
      upload_file: file,
      title: current.title || file?.name || "",
      file_type:
        current.file_type === "link" && file ? "other" : current.file_type,
    }));
  }

  function resetFileInput() {
    const fileInput = document.getElementById("document-file-input");
    if (fileInput) fileInput.value = "";
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(false);
    resetFileInput();
  }

  function openCreateForm() {
    setForm(initialForm);
    setEditingId(null);
    setShowForm(true);
    resetFileInput();
  }

  function handleEdit(item) {
    setSelectedId(item.id);
    setEditingId(item.id);
    setShowForm(true);
    setForm({
      title: item.original_name || "",
      file_type: item.file_type || "other",
      module: item.module || "documents",
      subject: item.subject || "",
      project_name: item.project_name || "",
      url: item.url || "",
      tags: item.tags || "",
      note: item.note || "",
      upload_file: null,
    });
    resetFileInput();
  }

  function selectDocument(itemId) {
    setSelectedId(itemId);
    setShowForm(false);
    setEditingId(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.title.trim() && !form.upload_file && !form.url.trim()) {
      alert("Vui lòng chọn file, nhập link hoặc nhập tên tài liệu.");
      return;
    }

    try {
      setSaving(true);
      let savedDocument = null;

      if (editingId) {
        savedDocument = await updateFileRecord(editingId, form);
      } else {
        savedDocument = await createFileRecord(form);
      }

      resetForm();
      await loadData(savedDocument?.id || editingId);
    } catch (err) {
      console.error(err);
      alert("Lưu tài liệu thất bại. Nếu bạn chưa chép file backend nâng cấp, hãy chép cả backend/app/routers/files.py.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(fileId) {
    const confirmed = window.confirm(
      "Bạn có chắc muốn xóa tài liệu này? File đã upload cũng sẽ bị xóa khỏi thư mục uploads."
    );
    if (!confirmed) return;

    try {
      await deleteFileRecord(fileId);
      if (editingId === fileId) resetForm();
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Xóa tài liệu thất bại.");
    }
  }

  async function createKnowledgeFromDocument(documentItem) {
    try {
      const fileType = getFileType(documentItem.file_type).label;
      const payload = {
        module: "knowledge",
        title: `Ghi chú từ: ${documentItem.original_name}`,
        category: "summary",
        status: "active",
        priority: "medium",
        subject: documentItem.subject || null,
        project_name: documentItem.project_name || null,
        target_date: null,
        file_path: documentItem.file_path ? `File upload: ${documentItem.original_name}` : null,
        url: documentItem.url || null,
        tags: documentItem.tags || null,
        content: `Nguồn: ${documentItem.original_name}\nLoại: ${fileType}\n\nTóm tắt nội dung:\n\nÝ chính cần nhớ:\n\nCâu hỏi / phần chưa hiểu:\n\nGhi chú gốc:\n${documentItem.note || "Chưa có"}`,
      };

      await createWorkspaceItem(payload);
      await loadData(documentItem.id);
      alert("Đã tạo một thẻ tri thức từ tài liệu này.");
    } catch (err) {
      console.error(err);
      alert("Không tạo được tri thức từ tài liệu.");
    }
  }

  function clearFilters() {
    setQuery("");
    setShelf("all");
    setTypeFilter("all");
    setProjectFilter("all");
    setSourceFilter("all");
    setSortBy("created_desc");
  }

  return (
    <div className={`library-page ${showForm ? "entry-mode" : ""}`}>
      <header className="page-header library-header">
        <div>
          <span className="library-eyebrow">DOCUMENT LIBRARY</span>
          <h2>Tài liệu học tập</h2>
          <p>
            Quản lý file, link online và tài liệu theo kiểu thư viện: có kệ môn học,
            bộ lọc, ghi chú, tài liệu liên quan và kết nối trực tiếp với kho tri thức.
          </p>
        </div>

        <div className="library-header-actions">
          <button className="primary-button" type="button" onClick={openCreateForm}>
            + Thêm tài liệu
          </button>
        </div>
      </header>

      <section className="library-summary-grid">
        <article className="library-card is-blue">
          <span>Tổng tài liệu</span>
          <strong>{stats.total}</strong>
          <small>File upload, link online và bản ghi tài liệu.</small>
        </article>
        <article className="library-card is-success">
          <span>File đã upload</span>
          <strong>{stats.uploads}</strong>
          <small>Có thể tải lại trực tiếp từ app.</small>
        </article>
        <article className="library-card">
          <span>Link online</span>
          <strong>{stats.links}</strong>
          <small>Drive, GitHub, Colab, bài đọc hoặc tài nguyên mạng.</small>
        </article>
        <article className="library-card is-purple">
          <span>Kệ môn học</span>
          <strong>{stats.subjects}</strong>
          <small>Số môn đang có tài liệu được gắn.</small>
        </article>
        <article className="library-card is-warning">
          <span>Chưa phân loại kỹ</span>
          <strong>{stats.unlinked}</strong>
          <small>Nên bổ sung môn, dự án hoặc tag để dễ tìm.</small>
        </article>
        <article className="library-card">
          <span>Có tri thức liên quan</span>
          <strong>{stats.withKnowledge}</strong>
          <small>Tài liệu đã kết nối với ghi chú trong kho tri thức.</small>
        </article>
      </section>

      <section className="library-panel">
        <div className="library-toolbar">
          <label className="library-field">
            <span>Tìm tài liệu</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tên, môn học, dự án, tag, ghi chú..."
            />
          </label>

          <label className="library-field">
            <span>Loại</span>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">Tất cả</option>
              {fileTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="library-field">
            <span>Dự án</span>
            <select
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
            >
              <option value="all">Tất cả</option>
              {projectOptions.map((projectName) => (
                <option key={projectName} value={projectName}>
                  {projectName}
                </option>
              ))}
            </select>
          </label>

          <label className="library-field">
            <span>Nguồn</span>
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
            >
              <option value="all">Tất cả</option>
              <option value="upload">File upload</option>
              <option value="link">Chỉ link online</option>
              <option value="both">File + link</option>
              <option value="record">Chỉ bản ghi</option>
            </select>
          </label>

          <label className="library-field">
            <span>Sắp xếp</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="created_desc">Mới thêm</option>
              <option value="name">Tên A-Z</option>
              <option value="subject">Theo môn</option>
              <option value="type">Theo loại</option>
            </select>
          </label>
        </div>

        <div className="library-toolbar-footer">
          <p>
            Đang hiển thị <strong>{filteredDocuments.length}</strong> / {documents.length} tài liệu.
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
              <h3>Kệ tài liệu</h3>
              <p>Gom tài liệu theo môn học.</p>
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
              <h3>Thư viện tài liệu</h3>
              <p>Bấm vào một tài liệu để xem chi tiết, tải file hoặc tạo tri thức.</p>
            </div>
          </div>

          {error && <p className="error-message">{error}</p>}

          {loading ? (
            <p className="empty">Đang tải thư viện tài liệu...</p>
          ) : filteredDocuments.length === 0 ? (
            <div className="library-empty-state">
              <h4>Không có tài liệu phù hợp</h4>
              <p>Đổi bộ lọc hoặc thêm tài liệu mới.</p>
              <button className="secondary-button" type="button" onClick={openCreateForm}>
                Thêm tài liệu
              </button>
            </div>
          ) : (
            <div className="library-grid">
              {filteredDocuments.map((item) => {
                const fileType = getFileType(item.file_type);

                return (
                  <button
                    key={item.id}
                    className={`library-item-card ${selectedId === item.id ? "is-active" : ""}`}
                    type="button"
                    onClick={() => selectDocument(item.id)}
                  >
                    <div className="library-item-top">
                      <span className="library-icon">{fileType.icon}</span>
                      <span className="library-badge is-blue">{fileType.label}</span>
                    </div>

                    <div>
                      <h4>{item.original_name}</h4>
                      <p>{previewText(item.note)}</p>
                    </div>

                    <div className="library-meta-row">
                      <span className="library-badge">
                        {item.subject || "Chưa gắn môn"}
                      </span>
                      <span className="library-badge is-purple">{getSourceLabel(item)}</span>
                    </div>

                    <div className="library-tag-row">
                      {item.project_name && (
                        <span className="library-tag">{item.project_name}</span>
                      )}
                      {displayTags(item.tags).map((tag) => (
                        <span className="library-tag" key={tag}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </main>

        <aside className="library-side-panel library-stack">
          <section className="library-panel">
            <div className="library-section-heading">
              <div>
                <h3>{showForm ? (editingId ? "Cập nhật tài liệu" : "Thêm tài liệu") : "Chi tiết tài liệu"}</h3>
                <p>
                  {showForm
                    ? "Gắn môn, dự án và tag ngay từ đầu để sau này tìm lại nhanh hơn."
                    : "Xem nguồn, ghi chú và các tri thức liên quan."}
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
                  <span>{editingId ? "Thay file mới nếu cần" : "Chọn file từ máy"}</span>
                  <input
                    id="document-file-input"
                    className="library-file-input"
                    type="file"
                    onChange={handleFileChange}
                  />
                </label>

                <label className="library-field">
                  <span>Tên tài liệu</span>
                  <input
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Ví dụ: BaoCaoMangNoron_final.docx"
                  />
                </label>

                <div className="library-two-columns">
                  <label className="library-field">
                    <span>Loại tài liệu</span>
                    <select name="file_type" value={form.file_type} onChange={handleChange}>
                      {fileTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="library-field">
                    <span>Tag</span>
                    <input
                      name="tags"
                      value={form.tags}
                      onChange={handleChange}
                      placeholder="#baocao #slide #xulyanh"
                    />
                  </label>
                </div>

                <label className="library-field">
                  <span>Gắn với môn học</span>
                  <select name="subject" value={form.subject} onChange={handleChange}>
                    <option value="">Không gắn môn học</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.name}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="library-field">
                  <span>Gắn với dự án</span>
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
                  <span>Link online</span>
                  <input
                    name="url"
                    value={form.url}
                    onChange={handleChange}
                    placeholder="Google Drive, GitHub, Colab, tài liệu online..."
                  />
                </label>

                <label className="library-field">
                  <span>Ghi chú</span>
                  <textarea
                    name="note"
                    value={form.note}
                    onChange={handleChange}
                    rows="6"
                    placeholder="File này dùng để làm gì, phần nào quan trọng, cần đọc lại trang nào..."
                  />
                </label>

                <div className="library-form-actions">
                  <button className="primary-button" type="submit" disabled={saving}>
                    {saving ? "Đang lưu..." : editingId ? "Lưu cập nhật" : "Lưu tài liệu"}
                  </button>
                  <button className="secondary-button" type="button" onClick={resetForm}>
                    Hủy
                  </button>
                </div>
              </form>
            ) : selectedDocument ? (
              <div className="library-detail-card">
                <div className="library-detail-title">
                  <div>
                    <h3>{selectedDocument.original_name}</h3>
                    <p>{getFileType(selectedDocument.file_type).label}</p>
                  </div>
                  <span className="library-icon">{getFileType(selectedDocument.file_type).icon}</span>
                </div>

                <div className="library-detail-grid">
                  <article>
                    <span>Môn học</span>
                    <strong>{selectedDocument.subject || "Chưa gắn"}</strong>
                  </article>
                  <article>
                    <span>Dự án</span>
                    <strong>{selectedDocument.project_name || "Chưa gắn"}</strong>
                  </article>
                  <article>
                    <span>Nguồn</span>
                    <strong>{getSourceLabel(selectedDocument)}</strong>
                  </article>
                  <article>
                    <span>Ngày thêm</span>
                    <strong>{formatDate(selectedDocument.created_at)}</strong>
                  </article>
                </div>

                <div className="library-note-box">
                  <span>Ghi chú</span>
                  <p>{selectedDocument.note || "Chưa có ghi chú."}</p>
                </div>

                {selectedDocument.tags && (
                  <div className="library-note-box">
                    <span>Tag</span>
                    <p>{selectedDocument.tags}</p>
                  </div>
                )}

                {(!selectedDocument.subject || !selectedDocument.tags || !selectedDocument.note) && (
                  <div className="library-warning-box">
                    <span>Gợi ý sắp xếp</span>
                    <p>
                      Tài liệu này còn thiếu môn học, tag hoặc ghi chú. Bổ sung các trường đó sẽ giúp kho tri thức tự liên kết chính xác hơn.
                    </p>
                  </div>
                )}

                <div className="library-actions">
                  {selectedDocument.file_path && (
                    <a
                      className="library-link-button"
                      href={getFileDownloadUrl(selectedDocument.id)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Tải file
                    </a>
                  )}
                  {selectedDocument.url && (
                    <a
                      className="library-link-button library-secondary-link"
                      href={selectedDocument.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Mở link
                    </a>
                  )}
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => createKnowledgeFromDocument(selectedDocument)}
                  >
                    Tạo tri thức
                  </button>
                  <button
                    className="edit-button"
                    type="button"
                    onClick={() => handleEdit(selectedDocument)}
                  >
                    Sửa
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => handleDelete(selectedDocument.id)}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ) : (
              <div className="library-empty-state">
                <h4>Chưa chọn tài liệu</h4>
                <p>Chọn một thẻ tài liệu hoặc thêm tài liệu mới.</p>
                <button className="secondary-button" type="button" onClick={openCreateForm}>
                  Thêm tài liệu
                </button>
              </div>
            )}
          </section>

          {!showForm && selectedDocument && (
            <section className="library-panel">
              <div className="library-section-heading">
                <div>
                  <h3>Tri thức liên quan</h3>
                  <p>Ghi chú được nối tự động theo môn, dự án và tag.</p>
                </div>
              </div>

              {relatedKnowledge.length === 0 ? (
                <div className="library-empty-state">
                  <h4>Chưa có thẻ tri thức</h4>
                  <p>Tạo một thẻ tri thức từ tài liệu này để biến file thành kiến thức có thể ôn lại.</p>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => createKnowledgeFromDocument(selectedDocument)}
                  >
                    Tạo tri thức
                  </button>
                </div>
              ) : (
                <div className="library-related-list">
                  {relatedKnowledge.map((item) => (
                    <div className="library-related-item" key={item.id}>
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.subject || "Không môn"} · {item.tags || "Không tag"}</span>
                      </div>
                      <span className="library-badge is-blue">{item.category || "note"}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {!showForm && focusDocuments.length > 0 && (
            <section className="library-panel">
              <div className="library-section-heading">
                <div>
                  <h3>Cần sắp xếp lại</h3>
                  <p>Các tài liệu thiếu môn, tag hoặc ghi chú.</p>
                </div>
              </div>

              <div className="library-focus-list">
                {focusDocuments.map((item) => (
                  <button
                    key={item.id}
                    className="library-focus-item"
                    type="button"
                    onClick={() => selectDocument(item.id)}
                  >
                    <div>
                      <strong>{item.original_name}</strong>
                      <span>{item.subject || "Chưa gắn môn"}</span>
                    </div>
                    <span className="library-badge is-orange">Bổ sung</span>
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

export default DocumentsPage;
