import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { sendAIMessageStream } from "../api/aiApi";
import { getSubjects } from "../api/subjectsApi";
import {
  createWorkspaceItem,
  deleteWorkspaceItem,
  getWorkspaceItems,
  updateWorkspaceItem,
} from "../api/workspaceApi";
import "./ClassNotesPage.css";

const MODULE = "class_notes";

const today = () => new Date().toISOString().slice(0, 10);

const initialForm = {
  title: "",
  subject: "",
  target_date: today(),
  content: "",
  paperColor: "#ffffff",
  inkColor: "#182942",
};

const paperColors = ["#ffffff", "#fff7ed", "#fef3c7", "#ecfeff", "#eef2ff", "#fdf2f8", "#f0fdf4"];
const inkColors = ["#182942", "#1d4ed8", "#0f766e", "#b45309", "#dc2626", "#7c3aed", "#111827"];

function formatDate(value) {
  if (!value) {
    return "Chưa có ngày";
  }

  return new Date(value).toLocaleDateString("vi-VN");
}

function stripHtml(value = "") {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseNoteMeta(note) {
  try {
    const meta = JSON.parse(note?.tags || "{}");
    return meta && typeof meta === "object" ? meta : {};
  } catch {
    return {};
  }
}

function estimateLineCount(html = "") {
  const blockBreaks = (html.match(/<(p|div|li|tr|h[1-6])\b/gi) || []).length;
  const softBreaks = (html.match(/<br\s*\/?>/gi) || []).length;
  const plain = stripHtml(html);
  const textLines = Math.max(1, Math.ceil(plain.length / 72));
  return Math.max(1, blockBreaks + softBreaks, textLines);
}

function escapeHtml(value = "") {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textToHtml(value = "") {
  return escapeHtml(value)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const [, base64 = ""] = result.split(",");
      resolve({ base64, mimeType: file.type || "image/jpeg" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function buildPrompt(mode, note) {
  const title = note.title || "Bài ghi chưa đặt tên";
  const subject = note.subject || "Chưa rõ môn";
  const content = stripHtml(note.content || "");

  const taskMap = {
    summary: "Tóm tắt bài ghi này thành các ý dễ học, giữ đúng trọng tâm giảng viên có thể hỏi.",
    outline: "Rút ý chính, thuật ngữ quan trọng và phần nào cần xem lại trước buổi học sau.",
    quiz: "Tạo bộ câu hỏi ôn tập ngắn gồm câu hỏi tự luận, câu hỏi nhanh và đáp án gợi ý.",
  };

  return [
    "Bạn là trợ giảng học tập cho sinh viên.",
    `Môn: ${subject}`,
    `Tên bài: ${title}`,
    `Ngày ghi: ${note.target_date || "không rõ"}`,
    `Yêu cầu: ${taskMap[mode] || taskMap.summary}`,
    "Nội dung ghi bài:",
    content,
  ].join("\n");
}

function ClassNotesPage() {
  const [notes, setNotes] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [keyword, setKeyword] = useState("");
  const [activeTab, setActiveTab] = useState("write");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(2);
  const [activeFormats, setActiveFormats] = useState({});
  const editorRef = useRef(null);
  const editorSelectionRef = useRef(null);
  const imageInputRef = useRef(null);

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedId) || notes[0] || null,
    [notes, selectedId],
  );
  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(estimateLineCount(form.content) / 30)),
    [form.content],
  );

  async function loadNotes(nextKeyword = keyword) {
    try {
      setLoading(true);
      const data = await getWorkspaceItems(MODULE, nextKeyword, { limit: 120 });
      setNotes(data);
      setSelectedId((current) => current || data[0]?.id || null);
    } catch (error) {
      console.error(error);
      toast.error("Không tải được ghi bài.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotes("");
    getSubjects()
      .then(setSubjects)
      .catch(() => setSubjects([]));
  }, []);

  function setEditorContent(nextContent) {
    setForm((current) => ({ ...current, content: nextContent }));

    if (editorRef.current) {
      editorRef.current.innerHTML = nextContent || "";
    }
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    if (editorRef.current) {
      editorRef.current.innerHTML = "";
    }
  }

function editNote(note) {
    setEditingId(note.id);
    setSelectedId(note.id);
    setActiveTab("write");
    const nextForm = {
      title: note.title || "",
      subject: note.subject || "",
      target_date: note.target_date || today(),
      content: note.content || "",
      paperColor: parseNoteMeta(note).paperColor || "#ffffff",
      inkColor: parseNoteMeta(note).inkColor || "#182942",
    };
    setForm(nextForm);
    if (editorRef.current) {
      editorRef.current.innerHTML = nextForm.content || "";
    }
  }

  async function saveNote(event) {
    event.preventDefault();

    if (!form.title.trim() || !stripHtml(form.content)) {
      toast.error("Cần nhập tên bài và nội dung ghi bài.");
      return;
    }

    const payload = {
      module: MODULE,
      title: form.title.trim(),
      subject: form.subject.trim() || null,
      target_date: form.target_date || null,
      category: "lecture-note",
      status: "active",
      priority: "medium",
      tags: JSON.stringify({
        source: "class-notes",
        version: "v16",
        paperColor: form.paperColor,
        inkColor: form.inkColor,
      }),
      content: form.content.trim(),
    };

    try {
      setSaving(true);
      const saved = editingId
        ? await updateWorkspaceItem(editingId, payload)
        : await createWorkspaceItem(payload);
      toast.success(editingId ? "Đã cập nhật ghi bài." : "Đã lưu ghi bài.");
      resetForm();
      await loadNotes(keyword);
      setSelectedId(saved.id);
    } catch (error) {
      console.error(error);
      toast.error("Không lưu được ghi bài.");
    } finally {
      setSaving(false);
    }
  }

  async function removeNote(note) {
    const confirmed = window.confirm(`Xóa ghi bài "${note.title}"?`);

    if (!confirmed) {
      return;
    }

    try {
      await deleteWorkspaceItem(note.id);
      toast.success("Đã xóa ghi bài.");
      if (editingId === note.id) {
        resetForm();
      }
      setSelectedId(null);
      await loadNotes(keyword);
    } catch (error) {
      console.error(error);
      toast.error("Không xóa được ghi bài.");
    }
  }

  function askAI(mode, note = selectedNote) {
    if (!note?.content) {
      toast.error("Chọn hoặc lưu một ghi bài trước đã.");
      return;
    }

    window.dispatchEvent(
      new CustomEvent("personal-life:open-ai", {
        detail: {
          message: buildPrompt(mode, note),
        },
      }),
    );
  }

  function syncEditorContent() {
    setForm((current) => ({
      ...current,
      content: editorRef.current?.innerHTML || "",
    }));
  }

  function saveEditorSelection() {
    const selection = window.getSelection?.();

    if (!selection || selection.rangeCount === 0 || !editorRef.current) {
      return;
    }

    const range = selection.getRangeAt(0);

    if (editorRef.current.contains(range.commonAncestorContainer)) {
      editorSelectionRef.current = range.cloneRange();
    }
  }

  function restoreEditorSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection?.();

    if (!editor || !selection) {
      return;
    }

    editor.focus();

    const savedRange = editorSelectionRef.current;

    if (savedRange && editor.contains(savedRange.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    editorSelectionRef.current = range.cloneRange();
  }

  function updateActiveFormats() {
    setActiveFormats({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strikeThrough: document.queryCommandState("strikeThrough"),
    });
  }

  function runEditorCommand(command, value = null) {
    restoreEditorSelection();
    document.execCommand(command, false, value);
    syncEditorContent();
    saveEditorSelection();
    updateActiveFormats();
  }

  function insertTable() {
    restoreEditorSelection();
    const rows = Math.max(1, Math.min(Number(tableRows) || 1, 12));
    const cols = Math.max(1, Math.min(Number(tableCols) || 1, 8));
    const header = Array.from({ length: cols }, (_, index) => `<td>Cột ${index + 1}</td>`).join("");
    const bodyRows = Array.from({ length: rows - 1 }, () =>
      `<tr>${Array.from({ length: cols }, () => "<td><br></td>").join("")}</tr>`,
    ).join("");

    document.execCommand(
      "insertHTML",
      false,
      `<table class="class-note-table"><tbody><tr>${header}</tr>${bodyRows}</tbody></table><p><br></p>`,
    );
    syncEditorContent();
    saveEditorSelection();
  }

  function handleToolbarMouseDown(event) {
    event.preventDefault();
  }

  async function handleImageToText(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      setOcrLoading(true);
      toast.loading("AI đang đọc ảnh vở...", { id: "class-note-ocr" });
      const media = await readImageFile(file);
      let streamedText = "";
      const finalMessage = await sendAIMessageStream(
        "Hãy trích xuất toàn bộ chữ trong ảnh vở/bảng này thành văn bản tiếng Việt rõ ràng. Giữ xuống dòng theo ý chính, bỏ mô tả không cần thiết.",
        {
          onDelta: (chunk) => {
            streamedText += chunk;
          },
        },
        {
          imageBase64: media.base64,
          imageMimeType: media.mimeType,
        },
      );
      const extractedText = finalMessage?.content || streamedText;

      if (!extractedText.trim()) {
        toast.error("AI chưa đọc được chữ trong ảnh.", { id: "class-note-ocr" });
        return;
      }

      const current = editorRef.current?.innerHTML || form.content || "";
      const nextContent = `${current}${current ? "<p><br></p>" : ""}<h3>Chữ trích từ ảnh</h3>${textToHtml(extractedText)}`;
      setEditorContent(nextContent);
      toast.success("Đã đưa chữ từ ảnh vào bài ghi.", { id: "class-note-ocr" });
    } catch (error) {
      console.error(error);
      toast.error("Không đọc được ảnh bằng AI.", { id: "class-note-ocr" });
    } finally {
      setOcrLoading(false);
    }
  }

  async function searchNotes(event) {
    event.preventDefault();
    await loadNotes(keyword);
  }

  return (
    <div className="class-notes-page">
      <header className="page-header class-notes-hero">
        <div>
          <p className="eyebrow">CLASS NOTES</p>
          <h2>Hỗ trợ ghi bài</h2>
          <p>
            Ghi nhanh nội dung trên lớp, lưu theo môn, rồi nhờ AI tóm tắt,
            rút ý chính hoặc tạo câu hỏi ôn tập.
          </p>
        </div>

        <div className="class-notes-actions">
          <button
            className={`ghost-button ${activeTab === "write" ? "active" : ""}`}
            type="button"
            onClick={() => setActiveTab("write")}
          >
            Soạn bài
          </button>
          <button
            className={`ghost-button ${activeTab === "library" ? "active" : ""}`}
            type="button"
            onClick={() => setActiveTab("library")}
          >
            Thư viện ghi bài
          </button>
          <button className="primary-button" type="button" onClick={() => askAI("summary")}>
            AI tóm tắt bài đang chọn
          </button>
          <button className="ghost-button" type="button" onClick={() => imageInputRef.current?.click()}>
            Chụp/tải ảnh vở
          </button>
        </div>
      </header>

      <form className="panel class-note-top-search" onSubmit={searchNotes}>
        <label>
          Tìm ghi bài
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tên bài, môn, nội dung..."
          />
        </label>
        <button className="ghost-button" type="submit" onClick={() => setActiveTab("library")}>
          Tìm trong thư viện
        </button>
      </form>

      {activeTab === "write" && (
      <section className="class-notes-layout write-mode">
        <form className="panel class-note-editor" onSubmit={saveNote}>
          <div className="panel-heading">
            <div>
              <p>{editingId ? "Đang sửa" : "Ghi bài mới"}</p>
              <h3>{editingId ? "Cập nhật nội dung" : "Lưu nội dung buổi học"}</h3>
            </div>
            {editingId && (
              <button className="ghost-button" type="button" onClick={resetForm}>
                Hủy sửa
              </button>
            )}
          </div>

          <div className="class-note-form-grid">
            <label>
              Tên bài
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Ví dụ: Gradient Descent"
              />
            </label>

            <label className="class-note-subject-field">
              Môn học
              <input
                list="class-note-subjects"
                value={form.subject}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
                placeholder="Chọn hoặc nhập môn học"
              />
              <span aria-hidden="true">⌄</span>
              <datalist id="class-note-subjects">
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.name} />
                ))}
              </datalist>
            </label>

            <label>
              Ngày học
              <input
                type="date"
                value={form.target_date}
                onChange={(event) => setForm({ ...form, target_date: event.target.value })}
              />
            </label>
          </div>

          <input
            ref={imageInputRef}
            className="class-note-image-input"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageToText}
          />

          <div className="class-note-doc-shell">
            <div className="class-note-toolbar" aria-label="Công cụ định dạng ghi bài">
              <button type="button" onMouseDown={handleToolbarMouseDown} onClick={() => runEditorCommand("justifyLeft")}>Trái</button>
              <button type="button" onMouseDown={handleToolbarMouseDown} onClick={() => runEditorCommand("justifyCenter")}>Giữa</button>
              <button type="button" onMouseDown={handleToolbarMouseDown} onClick={() => runEditorCommand("justifyRight")}>Phải</button>
              <span aria-hidden="true" />
              <button className={activeFormats.bold ? "active" : ""} type="button" onMouseDown={handleToolbarMouseDown} onClick={() => runEditorCommand("bold")}><strong>B</strong></button>
              <button className={activeFormats.italic ? "active" : ""} type="button" onMouseDown={handleToolbarMouseDown} onClick={() => runEditorCommand("italic")}><em>I</em></button>
              <button className={activeFormats.underline ? "active" : ""} type="button" onMouseDown={handleToolbarMouseDown} onClick={() => runEditorCommand("underline")}><u>U</u></button>
              <button className={activeFormats.strikeThrough ? "active" : ""} type="button" onMouseDown={handleToolbarMouseDown} onClick={() => runEditorCommand("strikeThrough")}><s>S</s></button>
              <select
                defaultValue="3"
                onChange={(event) => runEditorCommand("fontSize", event.target.value)}
                aria-label="Cỡ chữ"
              >
                <option value="2">Nhỏ</option>
                <option value="3">Vừa</option>
                <option value="4">Lớn</option>
                <option value="5">Rất lớn</option>
              </select>
              <label className="class-note-table-size">
                Hàng
                <input type="number" min="1" max="12" value={tableRows} onChange={(event) => setTableRows(event.target.value)} />
              </label>
              <label className="class-note-table-size">
                Cột
                <input type="number" min="1" max="8" value={tableCols} onChange={(event) => setTableCols(event.target.value)} />
              </label>
              <button type="button" onMouseDown={handleToolbarMouseDown} onClick={insertTable}>Thêm bảng</button>
              <button type="button" onMouseDown={handleToolbarMouseDown} onClick={() => imageInputRef.current?.click()} disabled={ocrLoading}>
                {ocrLoading ? "Đang đọc ảnh..." : "Ảnh thành chữ"}
              </button>
              <div className="class-note-color-group">
                <span>Giấy</span>
                {paperColors.map((color) => (
                  <button
                    className={`color-dot ${form.paperColor === color ? "active" : ""}`}
                    key={color}
                    type="button"
                    style={{ backgroundColor: color }}
                    onMouseDown={handleToolbarMouseDown}
                    onClick={() => setForm((current) => ({ ...current, paperColor: color }))}
                    title={color}
                  />
                ))}
              </div>
              <div className="class-note-color-group">
                <span>Mực</span>
                {inkColors.map((color) => (
                  <button
                    className={`color-dot ${form.inkColor === color ? "active" : ""}`}
                    key={color}
                    type="button"
                    style={{ backgroundColor: color }}
                    onMouseDown={handleToolbarMouseDown}
                    onClick={() => setForm((current) => ({ ...current, inkColor: color }))}
                    title={color}
                  />
                ))}
              </div>
              <strong className="class-note-page-count">Trang 1 / {pageCount}</strong>
            </div>

            <div
              ref={editorRef}
              className="class-note-paper"
              style={{
                "--note-paper": form.paperColor,
                "--note-ink": form.inkColor,
              }}
              contentEditable
              data-placeholder="Ghi ý chính, ví dụ, công thức, câu thầy cô nhấn mạnh..."
              onInput={syncEditorContent}
              onKeyUp={() => {
                saveEditorSelection();
                updateActiveFormats();
              }}
              onMouseUp={() => {
                saveEditorSelection();
                updateActiveFormats();
              }}
              suppressContentEditableWarning
            />
          </div>

          <div className="class-note-submit-row">
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu ghi bài"}
            </button>
            <button className="ghost-button" type="button" onClick={() => askAI("outline", form)}>
              AI rút ý từ bản nháp
            </button>
          </div>
        </form>
      </section>
      )}

      {activeTab === "library" && (
        <section className="class-notes-library-view">
          <section className="panel class-note-list-panel">
            <div className="panel-heading">
              <div>
                <p>Thư viện ghi bài</p>
                <h3>{notes.length} ghi bài</h3>
              </div>
            </div>

            {loading ? (
              <p className="empty">Đang tải ghi bài...</p>
            ) : notes.length === 0 ? (
              <p className="empty">Chưa có ghi bài nào. Hãy lưu một bài học đầu tiên.</p>
            ) : (
              <div className="class-note-list">
                {notes.map((note) => (
                  <article
                    className={`class-note-item ${selectedId === note.id ? "active" : ""}`}
                    key={note.id}
                    onClick={() => setSelectedId(note.id)}
                  >
                    <div>
                      <span>{note.subject || "Chưa có môn"}</span>
                      <h4>{note.title}</h4>
                      <p>{formatDate(note.target_date)}</p>
                    </div>
                    <button type="button" onClick={(event) => {
                      event.stopPropagation();
                      editNote(note);
                    }}>
                      Sửa
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          {selectedNote && (
        <section className="panel class-note-preview">
          <div className="panel-heading">
            <div>
              <p>{selectedNote.subject || "Ghi bài"}</p>
              <h3>{selectedNote.title}</h3>
            </div>
            <div className="class-note-preview-actions">
              <button className="ghost-button" type="button" onClick={() => askAI("summary")}>
                Tóm tắt
              </button>
              <button className="ghost-button" type="button" onClick={() => askAI("outline")}>
                Ý chính
              </button>
              <button className="ghost-button" type="button" onClick={() => askAI("quiz")}>
                Câu hỏi ôn
              </button>
              <button className="danger-button" type="button" onClick={() => removeNote(selectedNote)}>
                Xóa
              </button>
            </div>
          </div>

          <div
            className="class-note-preview-content"
            dangerouslySetInnerHTML={{ __html: selectedNote.content || "" }}
          />
        </section>
          )}
        </section>
      )}
    </div>
  );
}

export default ClassNotesPage;
