import { useEffect, useState } from "react";
import {
  createWorkspaceItem,
  deleteWorkspaceItem,
  getWorkspaceItems,
  updateWorkspaceItem,
} from "../api/workspaceApi";

function createInitialForm(module) {
  return {
    module,
    title: "",
    category: "",
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
}

function WorkspaceModulePage({ module, title, description, titlePlaceholder }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(createInitialForm(module));
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadItems() {
    try {
      setLoading(true);
      setError("");
      const data = await getWorkspaceItems(module);
      setItems(data);
    } catch (err) {
      console.error(err);
      setError("Không tải được dữ liệu.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, [module]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm(createInitialForm(module));
    setEditingId(null);
  }

  function buildPayload() {
    return {
      ...form,
      target_date: form.target_date || null,
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      alert("Vui lòng nhập tiêu đề.");
      return;
    }

    try {
      const payload = buildPayload();

      if (editingId) {
        await updateWorkspaceItem(editingId, payload);
      } else {
        await createWorkspaceItem(payload);
      }

      resetForm();
      await loadItems();
    } catch (err) {
      console.error(err);
      alert("Lưu dữ liệu thất bại.");
    }
  }

  function handleEdit(item) {
    setEditingId(item.id);

    setForm({
      module: item.module || module,
      title: item.title || "",
      category: item.category || "",
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

  async function handleDelete(itemId) {
    const confirmDelete = window.confirm("Bạn có chắc muốn xóa mục này?");

    if (!confirmDelete) {
      return;
    }

    try {
      await deleteWorkspaceItem(itemId);
      await loadItems();
    } catch (err) {
      console.error(err);
      alert("Xóa dữ liệu thất bại.");
    }
  }

  return (
    <>
      <header className="page-header">
        <h2>{title}</h2>
        <p>{description}</p>
      </header>

      <div className="layout">
        <section className="panel">
          <h3>{editingId ? "Cập nhật mục" : "Thêm mục mới"}</h3>

          <form onSubmit={handleSubmit}>
            <label>
              Tiêu đề
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder={titlePlaceholder}
              />
            </label>

            <div className="two-columns">
              <label>
                Phân loại
                <input
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  placeholder="Ví dụ: Báo cáo, code, ôn thi..."
                />
              </label>

              <label>
                Trạng thái
                <select name="status" value={form.status} onChange={handleChange}>
                  <option value="active">Đang dùng</option>
                  <option value="pending">Chưa làm</option>
                  <option value="doing">Đang làm</option>
                  <option value="review">Cần xem lại</option>
                  <option value="done">Đã xong</option>
                </select>
              </label>
            </div>

            <div className="two-columns">
              <label>
                Ưu tiên
                <select
                  name="priority"
                  value={form.priority}
                  onChange={handleChange}
                >
                  <option value="low">Thấp</option>
                  <option value="medium">Trung bình</option>
                  <option value="high">Cao</option>
                </select>
              </label>

              <label>
                Ngày liên quan
                <input
                  type="date"
                  name="target_date"
                  value={form.target_date}
                  onChange={handleChange}
                />
              </label>
            </div>

            <label>
              Môn học
              <input
                name="subject"
                value={form.subject}
                onChange={handleChange}
                placeholder="Ví dụ: Machine Learning, Xử lý ảnh..."
              />
            </label>

            <label>
              Dự án liên quan
              <input
                name="project_name"
                value={form.project_name}
                onChange={handleChange}
                placeholder="Ví dụ: Phần mềm cá nhân, Báo cáo CNN..."
              />
            </label>

            <label>
              Đường dẫn file
              <input
                name="file_path"
                value={form.file_path}
                onChange={handleChange}
                placeholder="Ví dụ: E:\\Projects\\file.docx"
              />
            </label>

            <label>
              Link
              <input
                name="url"
                value={form.url}
                onChange={handleChange}
                placeholder="Colab, GitHub, Drive, tài liệu..."
              />
            </label>

            <label>
              Tag
              <input
                name="tags"
                value={form.tags}
                onChange={handleChange}
                placeholder="#machine-learning #baocao #code-loi"
              />
            </label>

            <label>
              Nội dung / ghi chú
              <textarea
                name="content"
                value={form.content}
                onChange={handleChange}
                placeholder="Ghi nội dung chính, lỗi gặp phải, cách sửa, checklist..."
              />
            </label>

            <button className="primary-button" type="submit">
              {editingId ? "Cập nhật" : "Thêm mới"}
            </button>

            {editingId && (
              <button
                className="secondary-button"
                type="button"
                onClick={resetForm}
              >
                Hủy sửa
              </button>
            )}
          </form>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h3>Danh sách</h3>
          </div>

          {error && <p className="error-message">{error}</p>}

          {loading ? (
            <p className="empty">Đang tải dữ liệu...</p>
          ) : items.length === 0 ? (
            <p className="empty">Chưa có dữ liệu.</p>
          ) : (
            <div className="event-list">
              {items.map((item) => (
                <article className="event-card" key={item.id}>
                  <div>
                    <h4>{item.title}</h4>

                    <p>
                      {item.category || "Chưa phân loại"} ·{" "}
                      {item.status || "active"} · {item.priority || "medium"}
                    </p>

                    {item.subject && <small>Môn: {item.subject}</small>}
                    {item.project_name && (
                      <small>Dự án: {item.project_name}</small>
                    )}
                    {item.target_date && <small>Ngày: {item.target_date}</small>}
                    {item.tags && <small>Tag: {item.tags}</small>}
                    {item.file_path && <small>File: {item.file_path}</small>}
                    {item.url && <small>Link: {item.url}</small>}
                    {item.content && <small>{item.content}</small>}
                  </div>

                  <div className="card-actions">
                    <button
                      className="edit-button"
                      type="button"
                      onClick={() => handleEdit(item)}
                    >
                      Sửa
                    </button>

                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => handleDelete(item.id)}
                    >
                      Xóa
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export default WorkspaceModulePage;