import { useEffect, useRef, useState } from "react";
import { notifyError } from "../api/config";
import { uploadEditorImage } from "../api/filesApi";
import sanitizeHtml from "../utils/sanitizeHtml";
import "./RichTextEditor.css";

const textColors = ["#0f172a", "#2563eb", "#0f766e", "#b45309", "#dc2626", "#7c3aed"];
const backgroundColors = ["#ffffff", "#eff6ff", "#ecfdf5", "#fffbeb", "#fff1f2", "#f5f3ff"];

function getImageFilesFromClipboard(event) {
  const items = Array.from(event.clipboardData?.items || []);
  return items
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean);
}

function getImageFilesFromDrop(event) {
  return Array.from(event.dataTransfer?.files || []).filter((file) => file.type.startsWith("image/"));
}

function RichTextEditor({
  value = "",
  onChange,
  placeholder = "Viết nội dung...",
  minHeight = 220,
  imageMetadata = {},
  autosaveState = "idle",
}) {
  const editorRef = useRef(null);
  const [lastValue, setLastValue] = useState(sanitizeHtml(value || ""));
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (!editorRef.current) return;
    const nextValue = sanitizeHtml(value || "");

    if (nextValue !== lastValue && nextValue !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = nextValue;
      setLastValue(nextValue);
    }
  }, [lastValue, value]);

  function emitChange() {
    const html = sanitizeHtml(editorRef.current?.innerHTML || "");
    if (editorRef.current && editorRef.current.innerHTML !== html) {
      editorRef.current.innerHTML = html;
    }
    setLastValue(html);
    onChange?.(html);
  }

  function runCommand(command, commandValue = null) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    emitChange();
  }

  function insertImage(src, fileId = null) {
    editorRef.current?.focus();
    const img = `<img src="${src}"${fileId ? ` data-file-id="${fileId}"` : ""} alt="Ảnh ghi chép" />`;
    document.execCommand("insertHTML", false, img);
    emitChange();
  }

  async function uploadAndInsertImage(file) {
    if (!file?.type?.startsWith("image/")) return;

    try {
      setUploadingImage(true);
      const result = await uploadEditorImage(file, imageMetadata);
      insertImage(result.inlineUrl, result.id);
    } catch (error) {
      console.error(error);
      notifyError("Không tải được ảnh lên backend. Ảnh Base64 đã bị chặn để bảo vệ database.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleImageUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadAndInsertImage(file);
    event.target.value = "";
  }

  async function handlePaste(event) {
    const imageFiles = getImageFilesFromClipboard(event);
    if (imageFiles.length > 0) {
      event.preventDefault();
      for (const file of imageFiles) {
        // eslint-disable-next-line no-await-in-loop
        await uploadAndInsertImage(file);
      }
      return;
    }

    window.setTimeout(emitChange, 0);
  }

  async function handleDrop(event) {
    const imageFiles = getImageFilesFromDrop(event);
    if (imageFiles.length > 0) {
      event.preventDefault();
      for (const file of imageFiles) {
        // eslint-disable-next-line no-await-in-loop
        await uploadAndInsertImage(file);
      }
    }
  }

  function clearFormatting() {
    runCommand("removeFormat");
  }

  const autosaveLabel = {
    saving: "Đang lưu...",
    saved: "Đã lưu",
    error: "Lưu tự động lỗi",
    dirty: "Có thay đổi chưa lưu",
  }[autosaveState];

  return (
    <div className="rich-editor-shell">
      <div className="rich-editor-toolbar">
        <button type="button" onClick={() => runCommand("bold")}>B</button>
        <button type="button" onClick={() => runCommand("italic")}>I</button>
        <button type="button" onClick={() => runCommand("underline")}>U</button>
        <button type="button" onClick={() => runCommand("insertUnorderedList")}>• List</button>
        <button type="button" onClick={() => runCommand("formatBlock", "H3")}>Tiêu đề</button>
        <button type="button" onClick={() => runCommand("hiliteColor", "#fef3c7")}>Highlight</button>
        <button type="button" onClick={clearFormatting}>Xóa định dạng</button>

        <label className="rich-editor-color-picker">
          Chữ
          <select onChange={(event) => runCommand("foreColor", event.target.value)} defaultValue="">
            <option value="" disabled>Màu</option>
            {textColors.map((color) => (
              <option value={color} key={color}>{color}</option>
            ))}
          </select>
        </label>

        <label className="rich-editor-color-picker">
          Nền
          <select onChange={(event) => runCommand("backColor", event.target.value)} defaultValue="">
            <option value="" disabled>Màu</option>
            {backgroundColors.map((color) => (
              <option value={color} key={color}>{color}</option>
            ))}
          </select>
        </label>

        <label className="rich-editor-upload-button">
          {uploadingImage ? "Đang tải ảnh..." : "Ảnh"}
          <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} />
        </label>

        {autosaveLabel && <span className={`rich-editor-save-state ${autosaveState}`}>{autosaveLabel}</span>}
      </div>

      <div
        ref={editorRef}
        className="rich-editor-area"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        style={{ minHeight }}
        onInput={emitChange}
        onBlur={emitChange}
        onPaste={handlePaste}
        onDrop={handleDrop}
      />
    </div>
  );
}

export default RichTextEditor;
