import { useState } from "react";
import {
  exportBackup,
  exportBackupZip,
  importBackup,
  importBackupZip,
  previewBackup,
  previewBackupZip,
} from "../api/backupApi";

function BackupPage() {
  const [loading, setLoading] = useState(false);
  const [selectedJsonBackup, setSelectedJsonBackup] = useState(null);
  const [selectedZipBackup, setSelectedZipBackup] = useState(null);
  const [preview, setPreview] = useState(null);
  const [lastExport, setLastExport] = useState(null);

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.click();

    URL.revokeObjectURL(url);
  }

  async function handleExportZip() {
    try {
      setLoading(true);

      const blob = await exportBackupZip();
      const today = new Date().toISOString().slice(0, 10);
      const fileName = `personal-life-app-backup-${today}.zip`;

      downloadBlob(blob, fileName);

      setLastExport({
        fileName,
        type: "ZIP gồm backup.json và uploads",
      });
    } catch (err) {
      console.error(err);
      alert("Xuất backup ZIP thất bại.");
    } finally {
      setLoading(false);
    }
  }

  async function handleExportJson() {
    try {
      setLoading(true);

      const data = await exportBackup();
      const jsonString = JSON.stringify(data, null, 2);

      const blob = new Blob([jsonString], {
        type: "application/json",
      });

      const today = new Date().toISOString().slice(0, 10);
      const fileName = `personal-life-app-backup-${today}.json`;

      downloadBlob(blob, fileName);

      setLastExport({
        fileName,
        type: "JSON chỉ gồm dữ liệu database",
        events: data.events?.length || 0,
        schedules: data.schedules?.length || 0,
        expenses: data.expenses?.length || 0,
        people: data.people?.length || 0,
        deadlines: data.deadlines?.length || 0,
        tasks: data.tasks?.length || 0,
        subjects: data.subjects?.length || 0,
        projects: data.projects?.length || 0,
        workspaceItems: data.workspaceItems?.length || 0,
        fileItems: data.fileItems?.length || 0,
        settings: data.settings?.length || 0,
      });
    } catch (err) {
      console.error(err);
      alert("Xuất backup JSON thất bại.");
    } finally {
      setLoading(false);
    }
  }

  async function handleJsonFileChange(event) {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    const text = await file.text();

    try {
      const data = JSON.parse(text);
      const previewData = await previewBackup(data);

      setSelectedJsonBackup(data);
      setSelectedZipBackup(null);
      setPreview({
        ...previewData,
        sourceType: "json",
      });
    } catch (err) {
      console.error(err);
      alert("File backup JSON không hợp lệ.");
      setSelectedJsonBackup(null);
      setPreview(null);
    }
  }

  async function handleZipFileChange(event) {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    try {
      const previewData = await previewBackupZip(file);

      setSelectedZipBackup(file);
      setSelectedJsonBackup(null);
      setPreview({
        ...previewData,
        sourceType: "zip",
      });
    } catch (err) {
      console.error(err);
      alert("File backup ZIP không hợp lệ.");
      setSelectedZipBackup(null);
      setPreview(null);
    }
  }

  async function handleImport() {
    if (!selectedJsonBackup && !selectedZipBackup) {
      alert("Vui lòng chọn file backup trước.");
      return;
    }

    const confirmRestore = window.confirm(
      "Khôi phục backup sẽ thay thế dữ liệu hiện tại. Nếu dùng ZIP, thư mục uploads hiện tại cũng sẽ bị thay thế. Bạn có chắc muốn tiếp tục?"
    );

    if (!confirmRestore) {
      return;
    }

    try {
      setLoading(true);

      if (selectedZipBackup) {
        await importBackupZip(selectedZipBackup);
      } else {
        await importBackup(selectedJsonBackup);
      }

      alert("Khôi phục dữ liệu thành công. Hãy tải lại trang frontend.");
      setSelectedJsonBackup(null);
      setSelectedZipBackup(null);
      setPreview(null);
    } catch (err) {
      console.error(err);
      alert("Khôi phục dữ liệu thất bại.");
    } finally {
      setLoading(false);
    }
  }

  function renderCount(label, value) {
    return (
      <article>
        <span>{label}</span>
        <strong>{value || 0}</strong>
      </article>
    );
  }

  return (
    <>
      <header className="page-header">
        <h2>Sao lưu và khôi phục</h2>
        <p>
          Xuất backup dạng ZIP để lưu cả dữ liệu database và các file đã upload
          trong thư mục uploads.
        </p>
      </header>

      <div className="layout">
        <section className="panel">
          <h3>Xuất backup</h3>

          <p className="empty">
            Khuyến nghị dùng ZIP. File ZIP gồm backup.json và toàn bộ file trong
            backend/uploads.
          </p>

          <button
            className="primary-button"
            type="button"
            onClick={handleExportZip}
            disabled={loading}
          >
            {loading ? "Đang xử lý..." : "Xuất backup ZIP"}
          </button>

          <button
            className="secondary-button"
            type="button"
            onClick={handleExportJson}
            disabled={loading}
          >
            Xuất JSON dữ liệu
          </button>

          {lastExport && (
            <div className="survival-result" style={{ marginTop: 20 }}>
              <p className="risk-message">Đã xuất: {lastExport.fileName}</p>
              <p className="empty">{lastExport.type}</p>

              {lastExport.type?.includes("JSON") && (
                <div className="survival-overview">
                  {renderCount("Sự kiện", lastExport.events)}
                  {renderCount("Thời khóa biểu", lastExport.schedules)}
                  {renderCount("Chi tiêu", lastExport.expenses)}
                  {renderCount("Người quan trọng", lastExport.people)}
                  {renderCount("Deadline", lastExport.deadlines)}
                  {renderCount("Kế hoạch ngày", lastExport.tasks)}
                  {renderCount("Môn học", lastExport.subjects)}
                  {renderCount("Dự án", lastExport.projects)}
                  {renderCount("Dữ liệu mở rộng", lastExport.workspaceItems)}
                  {renderCount("File metadata", lastExport.fileItems)}
                  {renderCount("Cài đặt", lastExport.settings)}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="panel">
          <h3>Khôi phục backup</h3>

          <p className="error-message">
            Lưu ý: Khôi phục sẽ thay thế dữ liệu hiện tại. Với file ZIP, thư mục
            backend/uploads hiện tại cũng sẽ bị thay thế bằng uploads trong backup.
          </p>

          <label>
            Chọn file backup ZIP
            <input type="file" accept=".zip" onChange={handleZipFileChange} />
          </label>

          <label>
            Hoặc chọn file backup JSON cũ
            <input type="file" accept=".json" onChange={handleJsonFileChange} />
          </label>

          {preview && (
            <div className="survival-result">
              <p className="risk-message">
                File backup: {preview.exportedAt || "Không rõ thời điểm xuất"}
              </p>

              <p className="empty">
                Loại backup: {preview.sourceType === "zip" ? "ZIP" : "JSON"}
              </p>

              <div className="survival-overview">
                {renderCount("Sự kiện", preview.events)}
                {renderCount("Thời khóa biểu", preview.schedules)}
                {renderCount("Chi tiêu", preview.expenses)}
                {renderCount("Người quan trọng", preview.people)}
                {renderCount("Deadline", preview.deadlines)}
                {renderCount("Kế hoạch ngày", preview.tasks)}
                {renderCount("Môn học", preview.subjects)}
                {renderCount("Dự án", preview.projects)}
                {renderCount("Dữ liệu mở rộng", preview.workspaceItems)}
                {renderCount("File metadata", preview.fileItems)}
                {renderCount("File upload", preview.uploadFiles)}
                {renderCount("Cài đặt", preview.settings)}
              </div>

              <button
                className="danger-button"
                type="button"
                onClick={handleImport}
                disabled={loading}
                style={{ marginTop: 16 }}
              >
                {loading ? "Đang khôi phục..." : "Khôi phục dữ liệu"}
              </button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export default BackupPage;