import { useEffect, useMemo, useRef, useState } from "react";

import {
  createWorkspaceItem,
  deleteWorkspaceItem,
  getWorkspaceItems,
  updateWorkspaceItem,
} from "../api/workspaceApi";
import { uploadEditorImage } from "../api/filesApi";
import sanitizeHtml from "../utils/sanitizeHtml";
import "./JournalPage.css";

const moods = [
  { id: "happy", label: "Vui vẻ", icon: "☺", score: 95, tone: "Tươi sáng" },
  { id: "excited", label: "Phấn khởi", icon: "✦", score: 90, tone: "Đầy năng lượng" },
  { id: "proud", label: "Tự hào", icon: "★", score: 86, tone: "Tiến bộ rõ rệt" },
  { id: "peaceful", label: "Bình yên", icon: "◡", score: 78, tone: "Nhẹ lòng" },
  { id: "normal", label: "Bình thường", icon: "•", score: 62, tone: "Ổn định" },
  { id: "tired", label: "Mệt mỏi", icon: "◌", score: 42, tone: "Cần nghỉ" },
  { id: "worried", label: "Lo lắng", icon: "?", score: 38, tone: "Nhiều suy nghĩ" },
  { id: "sad", label: "Buồn", icon: "⌢", score: 30, tone: "Cần được lắng nghe" },
  { id: "bored", label: "Chán nản", icon: "–", score: 26, tone: "Thiếu động lực" },
  { id: "angry", label: "Tức giận", icon: "!", score: 22, tone: "Dễ quá tải" },
  { id: "unknown", label: "Không rõ", icon: "~", score: 50, tone: "Chưa gọi tên được" },
];

const backgrounds = [
  { id: "midnight", label: "Đêm trầm", className: "journal-bg-midnight", text: "light" },
  { id: "warm", label: "Ấm trà", className: "journal-bg-warm", text: "light" },
  { id: "paper", label: "Giấy kem", className: "journal-bg-paper", text: "dark" },
  { id: "forest", label: "Rừng sâu", className: "journal-bg-forest", text: "light" },
  { id: "sky", label: "Trời xanh", className: "journal-bg-sky", text: "dark" },
  { id: "rose", label: "Hồng phấn", className: "journal-bg-rose", text: "dark" },
  { id: "lavender", label: "Oải hương", className: "journal-bg-lavender", text: "dark" },
  { id: "mint", label: "Bạc hà", className: "journal-bg-mint", text: "dark" },
  { id: "custom", label: "Ảnh của bạn", className: "journal-bg-custom", text: "light" },
];

const weekDays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const textColors = [
  "#fff8f1",
  "#1f1714",
  "#ffb39a",
  "#f97373",
  "#f59e0b",
  "#22c55e",
  "#38bdf8",
  "#a78bfa",
  "#f472b6",
];

const emoteGroups = [
  {
    title: "Cảm xúc",
    items: ["☺", "✦", "★", "◡", "•", "◌", "?", "⌢", "!", "~"],
  },
  {
    title: "Gần gũi",
    items: ["♡", "☕", "☁", "☀", "☾", "✿", "❀", "♬", "✓", "…"],
  },
  {
    title: "Ngày thường",
    items: ["📌", "📚", "💭", "✨", "🌧", "🌙", "🍀", "🍵", "🎧", "📝"],
  },
];

function toDateInputValue(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function formatMonth(date) {
  return `Tháng ${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function formatFullDate(dateText) {
  const date = new Date(`${dateText}T00:00:00`);
  return date.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function parseMeta(item) {
  if (!item?.tags) {
    return {};
  }

  try {
    return JSON.parse(item.tags);
  } catch {
    return {};
  }
}

function stripHtml(value) {
  if (!value) {
    return "";
  }

  return value
    .replace(/<img[^>]*alt="([^"]*)"[^>]*>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createBackgroundStyle(image, crop = {}) {
  if (!image) {
    return undefined;
  }

  return {
    "--journal-custom-image": `url("${image}")`,
    "--journal-custom-size": `${crop.zoom || 135}%`,
    "--journal-custom-position": `${crop.x ?? 50}% ${crop.y ?? 50}%`,
  };
}

function getMood(moodId) {
  return moods.find((mood) => mood.id === moodId) || moods[moods.length - 1];
}

function getBackground(backgroundId) {
  return (
    backgrounds.find((background) => background.id === backgroundId) ||
    backgrounds[0]
  );
}

function getEntryDate(item) {
  return item.target_date || item.created_at?.slice(0, 10) || toDateInputValue(new Date());
}

function buildCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDate = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstDate.getDay();
  const days = [];

  for (let index = 0; index < leadingBlanks; index += 1) {
    days.push(null);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    days.push(new Date(year, month, day));
  }

  return days;
}

function createInitialForm(dateText) {
  return {
    id: null,
    title: "",
    content: "",
    moodId: "peaceful",
    backgroundId: "midnight",
    backgroundImage: "",
    backgroundCrop: { zoom: 135, x: 50, y: 50 },
    customEmotes: [],
    targetDate: dateText,
  };
}

function JournalPage() {
  const todayText = toDateInputValue(new Date());
  const editorRef = useRef(null);
  const editorSelectionRef = useRef(null);
  const backgroundInputRef = useRef(null);
  const emoteInputRef = useRef(null);

  const [entries, setEntries] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(todayText);
  const [view, setView] = useState("home");
  const [reportMode, setReportMode] = useState("month");
  const [form, setForm] = useState(createInitialForm(todayText));
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [showEmotePanel, setShowEmotePanel] = useState(false);
  const [cropDraft, setCropDraft] = useState(null);
  const [editorEmpty, setEditorEmpty] = useState(true);
  const [activeTextColor, setActiveTextColor] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadEntries() {
    try {
      setLoading(true);
      setError("");
      const data = await getWorkspaceItems("journal");
      setEntries(data);
    } catch (err) {
      console.error(err);
      setError("Không tải được nhật ký. Kiểm tra backend đã chạy chưa.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEntries();
  }, []);

  useEffect(() => {
    if (view !== "editor" || !editorRef.current) {
      return;
    }

    const nextContent = sanitizeHtml(form.content || "");
    editorRef.current.innerHTML = nextContent;
    setEditorEmpty(!stripHtml(nextContent));
    editorSelectionRef.current = null;
  }, [form.id, form.targetDate, view]);

  const entriesWithMeta = useMemo(
    () =>
      entries.map((item) => {
        const meta = parseMeta(item);
        const moodId = meta.moodId || item.category || "unknown";
        const backgroundId = meta.backgroundId || "midnight";

        return {
          ...item,
          entryDate: getEntryDate(item),
          mood: getMood(moodId),
          background: getBackground(backgroundId),
          backgroundImage: meta.backgroundImage || "",
          backgroundCrop: meta.backgroundCrop || { zoom: 135, x: 50, y: 50 },
        };
      }),
    [entries],
  );

  const monthEntries = useMemo(() => {
    const month = selectedMonth.getMonth();
    const year = selectedMonth.getFullYear();

    return entriesWithMeta
      .filter((item) => {
        const date = new Date(`${item.entryDate}T00:00:00`);
        return date.getMonth() === month && date.getFullYear() === year;
      })
      .sort((a, b) => b.entryDate.localeCompare(a.entryDate));
  }, [entriesWithMeta, selectedMonth]);

  const entriesByDate = useMemo(() => {
    const map = new Map();

    for (const item of entriesWithMeta) {
      if (!map.has(item.entryDate)) {
        map.set(item.entryDate, []);
      }

      map.get(item.entryDate).push(item);
    }

    return map;
  }, [entriesWithMeta]);

  const selectedEntry = entriesByDate.get(selectedDate)?.[0] || null;
  const selectedBackground = getBackground(form.backgroundId);
  const defaultJournalTextColor = selectedBackground.text === "dark" ? "#1f1714" : "#fff8f1";

  const calendarDays = useMemo(
    () => buildCalendarDays(selectedMonth),
    [selectedMonth],
  );

  const reportEntries = useMemo(() => {
    if (reportMode === "year") {
      const year = selectedMonth.getFullYear();
      return entriesWithMeta.filter((item) => {
        const date = new Date(`${item.entryDate}T00:00:00`);
        return date.getFullYear() === year;
      });
    }

    return monthEntries;
  }, [entriesWithMeta, monthEntries, reportMode, selectedMonth]);

  const moodReport = useMemo(
    () =>
      moods.map((mood) => {
        const count = reportEntries.filter((item) => item.mood.id === mood.id).length;
        const percent = reportEntries.length
          ? Math.round((count / reportEntries.length) * 100)
          : 0;

        return { ...mood, count, percent };
      }),
    [reportEntries],
  );

  const averageScore = reportEntries.length
    ? Math.round(
        reportEntries.reduce((total, item) => total + item.mood.score, 0) /
          reportEntries.length,
      )
    : 0;

  function changeMonth(direction) {
    setSelectedMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + direction, 1),
    );
  }

  function openEditor(dateText = selectedDate, item = null) {
    if (item) {
      const meta = parseMeta(item);
      setForm({
        id: item.id,
        title: item.title || "",
        content: sanitizeHtml(item.content || ""),
        moodId: meta.moodId || item.category || "unknown",
        backgroundId: meta.backgroundId || "midnight",
        backgroundImage: meta.backgroundImage || "",
        backgroundCrop: meta.backgroundCrop || { zoom: 135, x: 50, y: 50 },
        customEmotes: meta.customEmotes || [],
        targetDate: getEntryDate(item),
      });
      setEditorEmpty(!stripHtml(item.content || ""));
    } else {
      setForm(createInitialForm(dateText));
      setEditorEmpty(true);
    }

    setSelectedDate(dateText);
    setShowMoodPicker(false);
    setShowStylePanel(false);
    setShowEmotePanel(false);
    setActiveTextColor("");
    setView("editor");
  }

  async function handleSave() {
    const content = editorRef.current?.innerHTML || form.content;
    const plainContent = stripHtml(content);

    if (!form.title.trim() && !plainContent) {
      setError("Nhật ký cần có tiêu đề hoặc nội dung.");
      return;
    }

    const title =
      form.title.trim() ||
      `Nhật ký ngày ${new Date(`${form.targetDate}T00:00:00`).toLocaleDateString(
        "vi-VN",
      )}`;

    const payload = {
      module: "journal",
      title,
      category: form.moodId,
      status: "active",
      priority: "medium",
      subject: "",
      project_name: "",
      target_date: form.targetDate,
      file_path: "",
      url: "",
      tags: JSON.stringify({
        moodId: form.moodId,
        backgroundId: form.backgroundId,
        backgroundImage: form.backgroundImage,
        backgroundCrop: form.backgroundCrop,
        customEmotes: form.customEmotes,
        savedAt: new Date().toISOString(),
      }),
      content: sanitizeHtml(content),
    };

    try {
      setSaving(true);
      setError("");

      if (form.id) {
        await updateWorkspaceItem(form.id, payload);
      } else {
        await createWorkspaceItem(payload);
      }

      await loadEntries();
      setSelectedDate(form.targetDate);
      setView("home");
    } catch (err) {
      console.error(err);
      setError("Lưu nhật ký thất bại.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemId) {
    const confirmed = window.confirm("Bạn có chắc muốn xóa nhật ký này?");

    if (!confirmed) {
      return;
    }

    try {
      await deleteWorkspaceItem(itemId);
      await loadEntries();
      setView("home");
    } catch (err) {
      console.error(err);
      setError("Xóa nhật ký thất bại.");
    }
  }

  function handleEditorInput() {
    const cleanContent = sanitizeHtml(editorRef.current?.innerHTML || "");
    if (editorRef.current && editorRef.current.innerHTML !== cleanContent) {
      editorRef.current.innerHTML = cleanContent;
    }
    setForm((current) => ({
      ...current,
      content: cleanContent,
    }));
    setEditorEmpty(!stripHtml(cleanContent));
  }

  function saveEditorSelection() {
    const editor = editorRef.current;
    const selection = window.getSelection?.();

    if (!editor || !selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);

    if (editor.contains(range.commonAncestorContainer)) {
      editorSelectionRef.current = range.cloneRange();
    }
  }

  function placeCaretAtEnd() {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);

    const selection = window.getSelection?.();
    selection?.removeAllRanges();
    selection?.addRange(range);
    editorSelectionRef.current = range.cloneRange();
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

    placeCaretAtEnd();
  }

  function preserveEditorContent() {
    if (!editorRef.current) {
      return;
    }

    const cleanContent = sanitizeHtml(editorRef.current.innerHTML || "");
    setForm((current) => ({
      ...current,
      content: cleanContent,
    }));
  }

  function handleEditorMouseUp() {
    saveEditorSelection();
  }

  function handleEditorKeyUp() {
    saveEditorSelection();
    handleEditorInput();
  }

  function applyTextColor(color) {
    const nextColor = activeTextColor === color ? defaultJournalTextColor : color;
    restoreEditorSelection();
    document.execCommand("styleWithCSS", false, true);
    document.execCommand("foreColor", false, nextColor);
    handleEditorInput();
    saveEditorSelection();
    setActiveTextColor(activeTextColor === color ? "" : color);
  }

  function insertTextEmote(emote) {
    restoreEditorSelection();
    document.execCommand("insertText", false, emote);
    handleEditorInput();
    saveEditorSelection();
    setShowEmotePanel(false);
  }

  function insertImageEmote(src) {
    restoreEditorSelection();
    document.execCommand(
      "insertHTML",
      false,
      `<img class="journal-inline-emote" src="${src}" alt="emote" />`,
    );
    handleEditorInput();
    saveEditorSelection();
    setShowEmotePanel(false);
  }

  function getEditorImageFilesFromPaste(event) {
    return Array.from(event.clipboardData?.items || [])
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter(Boolean);
  }

  function getEditorImageFilesFromDrop(event) {
    return Array.from(event.dataTransfer?.files || []).filter((file) => file.type.startsWith("image/"));
  }

  async function uploadAndInsertJournalImage(file) {
    try {
      const result = await uploadEditorImage(file, {
        module: "journal",
        tags: "#anh-nhat-ky",
        note: "Ảnh chèn trong nhật ký",
      });
      insertImageEmote(result.inlineUrl);
    } catch (error) {
      console.error(error);
      setError("Không tải được ảnh. App đã chặn ảnh Base64 để tránh phình database.");
    }
  }

  async function handleEditorPaste(event) {
    const imageFiles = getEditorImageFilesFromPaste(event);
    if (imageFiles.length > 0) {
      event.preventDefault();
      for (const file of imageFiles) {
        // eslint-disable-next-line no-await-in-loop
        await uploadAndInsertJournalImage(file);
      }
      return;
    }

    window.setTimeout(handleEditorInput, 0);
  }

  async function handleEditorDrop(event) {
    const imageFiles = getEditorImageFilesFromDrop(event);
    if (imageFiles.length > 0) {
      event.preventDefault();
      for (const file of imageFiles) {
        // eslint-disable-next-line no-await-in-loop
        await uploadAndInsertJournalImage(file);
      }
    }
  }

  function handleBackgroundUpload(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      setCropDraft({
        image: String(reader.result || ""),
        zoom: 135,
        x: 50,
        y: 50,
      });
      setShowStylePanel(false);
    };

    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function applyCroppedBackground() {
    if (!cropDraft?.image) {
      return;
    }

    setForm((current) => ({
      ...current,
      backgroundId: "custom",
      backgroundImage: cropDraft.image,
      backgroundCrop: {
        zoom: cropDraft.zoom,
        x: cropDraft.x,
        y: cropDraft.y,
      },
    }));
    setCropDraft(null);
  }

  async function handleEmoteUpload(event) {
    const files = Array.from(event.target.files || []).slice(0, 12);

    if (files.length === 0) {
      return;
    }

    try {
      const images = [];

      for (const file of files) {
        // eslint-disable-next-line no-await-in-loop
        const result = await uploadEditorImage(file, {
          module: "journal",
          tags: "#emote-nhat-ky",
          note: "Emote ảnh trong nhật ký",
        });
        images.push(result.inlineUrl);
      }

      setForm((current) => ({
        ...current,
        customEmotes: [...current.customEmotes, ...images].slice(-24),
      }));
      setShowEmotePanel(false);
    } catch (err) {
      console.error(err);
      setError("Không tải được emote ảnh lên backend.");
    }

    event.target.value = "";
  }

  const editorStyle = createBackgroundStyle(form.backgroundImage, form.backgroundCrop);

  return (
    <div className="journal-page">
      {view !== "editor" && (
        <header className="journal-topbar">
          <div>
            <p className="journal-kicker">Daily journal</p>
            <h2>Nhật ký ngày</h2>
          </div>

          <div className="journal-actions">
            <button
              className={view === "home" ? "active" : ""}
              type="button"
              onClick={() => setView("home")}
            >
              Lịch
            </button>
            <button
              className={view === "list" ? "active" : ""}
              type="button"
              onClick={() => setView("list")}
            >
              Danh sách
            </button>
            <button
              className={view === "report" ? "active" : ""}
              type="button"
              onClick={() => setView("report")}
            >
              Cảm xúc
            </button>
          </div>
        </header>
      )}

      {error && <p className="journal-error">{error}</p>}

      {view === "home" && (
        <section className="journal-home">
          <div className="journal-calendar-panel">
            <div className="journal-month-control">
              <button type="button" onClick={() => changeMonth(-1)}>
                ‹
              </button>
              <strong>{formatMonth(selectedMonth)}</strong>
              <button type="button" onClick={() => changeMonth(1)}>
                ›
              </button>
            </div>

            <div className="journal-weekdays">
              {weekDays.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="journal-calendar-grid">
              {calendarDays.map((date, index) => {
                if (!date) {
                  return <span className="journal-day blank" key={`blank-${index}`} />;
                }

                const dateText = toDateInputValue(date);
                const dayEntries = entriesByDate.get(dateText) || [];
                const mood = dayEntries[0]?.mood;

                return (
                  <button
                    className={`journal-day ${
                      selectedDate === dateText ? "selected" : ""
                    } ${dateText === todayText ? "today" : ""}`}
                    key={dateText}
                    type="button"
                    onClick={() => setSelectedDate(dateText)}
                    onDoubleClick={() => openEditor(dateText, dayEntries[0])}
                  >
                    <span>{date.getDate()}</span>
                    {mood && <small>{mood.icon}</small>}
                  </button>
                );
              })}
            </div>
          </div>

          <aside className="journal-side-panel">
            <article className="journal-luck-card">
              <span>Chỉ số cân bằng hôm nay</span>
              <div>
                <b>{selectedEntry ? selectedEntry.mood.score : 70}</b>
                <small>{selectedEntry ? selectedEntry.mood.tone : "Sẵn sàng ghi lại"}</small>
              </div>
              <p>
                {selectedEntry
                  ? stripHtml(selectedEntry.content) || "Ngày này đã được ghi lại."
                  : "Chọn một ngày rồi bắt đầu viết để lưu lại cảm xúc, suy nghĩ và chuyện đáng nhớ."}
              </p>
            </article>

            <article className="journal-today-card">
              <div>
                <span>{formatFullDate(selectedDate)}</span>
                <h3>{selectedEntry?.title || "Chưa có nhật ký"}</h3>
              </div>
              <button
                type="button"
                onClick={() => openEditor(selectedDate, selectedEntry)}
              >
                {selectedEntry ? "Sửa" : "Viết"}
              </button>
            </article>
          </aside>

          <section className="journal-list-preview">
            <div className="journal-section-heading">
              <h3>Danh sách nhật ký</h3>
              <span>{formatMonth(selectedMonth)}</span>
            </div>

            {loading ? (
              <p className="journal-empty">Đang tải nhật ký...</p>
            ) : monthEntries.length === 0 ? (
              <p className="journal-empty">Chưa có nhật ký nào trong tháng này.</p>
            ) : (
              <div className="journal-entry-grid">
                {monthEntries.slice(0, 4).map((entry) => (
                  <button
                    className={`journal-entry-card ${entry.background.className}`}
                    style={createBackgroundStyle(
                      entry.backgroundImage,
                      entry.backgroundCrop,
                    )}
                    key={entry.id}
                    type="button"
                    onClick={() => openEditor(entry.entryDate, entry)}
                  >
                    <span>{entry.entryDate}</span>
                    <strong>{entry.title}</strong>
                    <p>{stripHtml(entry.content) || "Không có nội dung."}</p>
                    <small>
                      {entry.mood.icon} {entry.mood.label}
                    </small>
                  </button>
                ))}
              </div>
            )}
          </section>

          <button
            className="journal-floating-button"
            type="button"
            onClick={() => openEditor(selectedDate, selectedEntry)}
          >
            ✎
          </button>
        </section>
      )}

      {view === "list" && (
        <section className="journal-list-view">
          <div className="journal-month-control">
            <button type="button" onClick={() => changeMonth(-1)}>
              ‹
            </button>
            <strong>{formatMonth(selectedMonth)}</strong>
            <button type="button" onClick={() => changeMonth(1)}>
              ›
            </button>
          </div>

          {monthEntries.length === 0 ? (
            <p className="journal-empty tall">Chưa có nhật ký nào cả.</p>
          ) : (
            <div className="journal-timeline">
              {monthEntries.map((entry) => (
                <article className="journal-timeline-item" key={entry.id}>
                  <div className="journal-date-badge">
                    <strong>{new Date(`${entry.entryDate}T00:00:00`).getDate()}</strong>
                    <span>{entry.mood.icon}</span>
                  </div>

                  <button type="button" onClick={() => openEditor(entry.entryDate, entry)}>
                    <span>{formatFullDate(entry.entryDate)}</span>
                    <h3>{entry.title}</h3>
                    <p>{stripHtml(entry.content) || "Không có nội dung."}</p>
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {view === "report" && (
        <section className="journal-report-view">
          <div className="journal-report-header">
            <button type="button" onClick={() => setView("home")}>
              ‹
            </button>
            <h2>Báo cáo cảm xúc</h2>
          </div>

          <div className="journal-report-tabs">
            <button
              className={reportMode === "month" ? "active" : ""}
              type="button"
              onClick={() => setReportMode("month")}
            >
              Theo tháng
            </button>
            <button
              className={reportMode === "year" ? "active" : ""}
              type="button"
              onClick={() => setReportMode("year")}
            >
              Theo năm
            </button>
          </div>

          <div className="journal-report-score">
            <span>{reportMode === "month" ? formatMonth(selectedMonth) : selectedMonth.getFullYear()}</span>
            <strong>{averageScore || "--"}</strong>
            <p>
              {reportEntries.length
                ? `Đã ghi ${reportEntries.length} nhật ký trong khoảng thời gian này.`
                : "Không có nhật ký trong khoảng thời gian này."}
            </p>
          </div>

          <div className="journal-mood-bars">
            {moodReport
              .filter((item) => item.count > 0 || reportEntries.length === 0)
              .map((item) => (
                <article className="journal-mood-row" key={item.id}>
                  <span>
                    {item.icon} {item.label}
                  </span>
                  <div>
                    <i style={{ width: `${item.percent}%` }} />
                  </div>
                  <b>{item.count}</b>
                </article>
              ))}
          </div>
        </section>
      )}

      {view === "editor" && (
        <section
          className={`journal-editor ${selectedBackground.className} journal-text-${selectedBackground.text}`}
          style={editorStyle}
        >
          <div className="journal-editor-toolbar">
            <button
              type="button"
              onClick={() => {
                preserveEditorContent();
                setView("home");
              }}
            >
              ‹
            </button>

            <div className="journal-editor-switches">
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  preserveEditorContent();
                  saveEditorSelection();
                }}
                onClick={() => {
                  setShowStylePanel((current) => !current);
                  setShowEmotePanel(false);
                }}
              >
                Aa / Nền
              </button>
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  preserveEditorContent();
                  saveEditorSelection();
                }}
                onClick={() => {
                  setShowEmotePanel((current) => !current);
                  setShowStylePanel(false);
                }}
              >
                Emote
              </button>
              <button
                type="button"
                onClick={() => {
                  preserveEditorContent();
                  setShowMoodPicker(true);
                }}
              >
                {getMood(form.moodId).icon}
              </button>
            </div>

            <button
              className="journal-save-button"
              type="button"
              onClick={() => {
                preserveEditorContent();
                handleSave();
              }}
            >
              {saving ? "Đang lưu" : "Lưu"}
            </button>
          </div>

          {showStylePanel && (
            <div className="journal-popover journal-style-popover">
              <div className="journal-popover-heading">
                <strong>Tùy chỉnh nét viết</strong>
                <button type="button" onClick={() => setShowStylePanel(false)}>
                  ×
                </button>
              </div>

              <div className="journal-tool-group">
                <span>Màu chữ</span>
                <div className="journal-color-row">
                  {textColors.map((color) => (
                    <button
                      key={color}
                      className={activeTextColor === color ? "active" : ""}
                      type="button"
                      style={{ backgroundColor: color }}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applyTextColor(color)}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <div className="journal-tool-group">
                <span>Nền viết</span>
                <div className="journal-background-picker">
                  {backgrounds
                    .filter((background) => background.id !== "custom")
                    .map((background) => (
                      <button
                        className={`${background.className} ${
                          form.backgroundId === background.id ? "active" : ""
                        }`}
                        key={background.id}
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          preserveEditorContent();
                          saveEditorSelection();
                        }}
                        onClick={() => {
                          setForm((current) => ({
                            ...current,
                            backgroundId: background.id,
                          }));
                          setShowStylePanel(false);
                        }}
                        title={background.label}
                      />
                    ))}

                  <button
                    className={`journal-bg-custom ${
                      form.backgroundId === "custom" ? "active" : ""
                    }`}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      preserveEditorContent();
                      saveEditorSelection();
                    }}
                    onClick={() => {
                      if (form.backgroundImage) {
                        setForm((current) => ({
                          ...current,
                          backgroundId: "custom",
                        }));
                        setShowStylePanel(false);
                        return;
                      }

                      backgroundInputRef.current?.click();
                    }}
                    title="Ảnh của bạn"
                  >
                    Ảnh
                  </button>
                </div>
              </div>

              <button
                className="journal-upload-button"
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  preserveEditorContent();
                  saveEditorSelection();
                }}
                onClick={() => backgroundInputRef.current?.click()}
              >
                Tải ảnh nền và chỉnh khung
              </button>
            </div>
          )}

          {showEmotePanel && (
            <div className="journal-popover journal-emote-popover">
              <div className="journal-popover-heading">
                <strong>Kho emote</strong>
                <button type="button" onClick={() => setShowEmotePanel(false)}>
                  ×
                </button>
              </div>

              {emoteGroups.map((group) => (
                <div className="journal-emote-group" key={group.title}>
                  <strong>{group.title}</strong>
                  <div>
                    {group.items.map((emote) => (
                      <button
                        key={emote}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => insertTextEmote(emote)}
                      >
                        {emote}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {form.customEmotes.length > 0 && (
                <div className="journal-emote-group">
                  <strong>Emote ảnh của bạn</strong>
                  <div>
                    {form.customEmotes.map((src, index) => (
                      <button
                        className="journal-image-emote-button"
                        key={`${src.slice(0, 28)}-${index}`}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => insertImageEmote(src)}
                      >
                        <img alt="emote" src={src} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                className="journal-upload-button"
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  preserveEditorContent();
                  saveEditorSelection();
                }}
                onClick={() => emoteInputRef.current?.click()}
              >
                Thêm emote ảnh
              </button>
            </div>
          )}

          <div className="journal-editor-date">
            <strong>{new Date(`${form.targetDate}T00:00:00`).getDate()}</strong>
            <span>{formatFullDate(form.targetDate).replace(/^[^,]+, /, "")}</span>
          </div>

          <button
            className="journal-mood-badge"
            type="button"
            onClick={() => {
              preserveEditorContent();
              setShowMoodPicker(true);
            }}
          >
            {getMood(form.moodId).icon}
          </button>

          <input
            className="journal-title-input"
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="Tiêu đề"
          />

          <div
            className={`journal-content-input ${
              editorEmpty ? "is-empty" : ""
            }`}
            contentEditable
            data-placeholder="Ghi lại ngày hôm nay của bạn..."
            key={`${form.id || "new"}-${form.targetDate}`}
            onInput={handleEditorInput}
            onKeyUp={handleEditorKeyUp}
            onMouseUp={handleEditorMouseUp}
            onBlur={handleEditorInput}
            onPaste={handleEditorPaste}
            onDrop={handleEditorDrop}
            ref={editorRef}
            suppressContentEditableWarning
          />

          <input
            accept="image/*"
            className="journal-hidden-input"
            onChange={handleBackgroundUpload}
            ref={backgroundInputRef}
            type="file"
          />

          <input
            accept="image/*"
            className="journal-hidden-input"
            multiple
            onChange={handleEmoteUpload}
            ref={emoteInputRef}
            type="file"
          />

          <div className="journal-editor-footer">
            <span>Đã chọn: {getMood(form.moodId).label}</span>
            {form.id && (
              <button type="button" onClick={() => handleDelete(form.id)}>
                Xóa nhật ký
              </button>
            )}
          </div>

          {cropDraft && (
            <div className="journal-crop-backdrop">
              <section className="journal-crop-modal">
                <div className="journal-popover-heading">
                  <strong>Chỉnh ảnh nền</strong>
                  <button type="button" onClick={() => setCropDraft(null)}>
                    ×
                  </button>
                </div>

                <div className="journal-crop-body">
                  <div
                    className="journal-crop-preview"
                    style={createBackgroundStyle(cropDraft.image, cropDraft)}
                  >
                    <span>Khung nền nhật ký</span>
                  </div>

                  <div className="journal-crop-controls">
                    <label>
                      Phóng to / thu nhỏ
                      <input
                        max="240"
                        min="100"
                        onChange={(event) =>
                          setCropDraft((current) => ({
                            ...current,
                            zoom: Number(event.target.value),
                          }))
                        }
                        type="range"
                        value={cropDraft.zoom}
                      />
                    </label>

                    <label>
                      Dịch ngang
                      <input
                        max="100"
                        min="0"
                        onChange={(event) =>
                          setCropDraft((current) => ({
                            ...current,
                            x: Number(event.target.value),
                          }))
                        }
                        type="range"
                        value={cropDraft.x}
                      />
                    </label>

                    <label>
                      Dịch dọc
                      <input
                        max="100"
                        min="0"
                        onChange={(event) =>
                          setCropDraft((current) => ({
                            ...current,
                            y: Number(event.target.value),
                          }))
                        }
                        type="range"
                        value={cropDraft.y}
                      />
                    </label>
                  </div>
                </div>

                <div className="journal-crop-actions">
                  <button type="button" onClick={() => setCropDraft(null)}>
                    Hủy
                  </button>
                  <button type="button" onClick={applyCroppedBackground}>
                    Hoàn thành
                  </button>
                </div>
              </section>
            </div>
          )}

          {showMoodPicker && (
            <div className="journal-mood-sheet">
              <div className="journal-sheet-handle" />
              <h3>Hôm nay là một ngày như thế nào?</h3>

              <div className="journal-mood-grid">
                {moods.map((mood) => (
                  <button
                    className={form.moodId === mood.id ? "active" : ""}
                    key={mood.id}
                    type="button"
                    onClick={() => {
                      preserveEditorContent();
                      setForm((current) => ({ ...current, moodId: mood.id }));
                    }}
                  >
                    <span>{mood.icon}</span>
                    <strong>{mood.label}</strong>
                  </button>
                ))}
              </div>

              <button
                className="journal-done-button"
                type="button"
                onClick={() => {
                  preserveEditorContent();
                  setShowMoodPicker(false);
                }}
              >
                Xong
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default JournalPage;
