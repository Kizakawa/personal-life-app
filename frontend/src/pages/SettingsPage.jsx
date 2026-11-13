import { useEffect, useState } from "react";
import {
  createSetting,
  deleteSetting,
  getSettings,
  initDefaultSettings,
  updateSetting,
} from "../api/settingsApi";
import {
  changePassword,
  getCurrentUser,
  getRecoveryKey,
  getSecurityQuestion,
  logout,
  regenerateRecoveryKey,
  updateSecurityQuestion,
} from "../api/authApi";
import { getAISettings, updateAISettings } from "../api/aiApi";

const initialForm = {
  key: "",
  value: "",
  note: "",
};

const initialPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const initialAISettings = {
  gemini_api_key: "",
  ai_model: "gemini-3.5-flash",
  ai_allow_tasks: true,
  ai_allow_deadlines: true,
  ai_allow_schedule: true,
  ai_allow_study: true,
  ai_allow_grades: true,
  ai_allow_finance: false,
  ai_allow_journal: false,
  ai_allow_people: false,
  ai_allow_class_notes: false,
};

const aiToggleLabels = [
  ["ai_allow_tasks", "Task/kế hoạch ngày", "AI được xem việc cần làm hôm nay."],
  ["ai_allow_deadlines", "Deadline", "AI được xem deadline sắp tới."],
  ["ai_allow_schedule", "Thời khóa biểu", "AI được xem lịch trong ngày."],
  ["ai_allow_study", "Môn học", "AI được xem tổng quan môn học."],
  ["ai_allow_grades", "Điểm/chuyên cần", "AI được xem điểm và rủi ro chuyên cần."],
  ["ai_allow_finance", "Tài chính", "AI được xem tổng chi tiêu và danh mục chi."],
  ["ai_allow_journal", "Nhật ký", "AI được xem ghi chú cá nhân không riêng tư."],
  ["ai_allow_people", "Người quan trọng", "AI được xem dữ liệu quan hệ cá nhân."],
  ["ai_allow_class_notes", "Ghi chú học tập", "AI được xem trích đoạn ghi chú/kho tri thức."],
];

function SettingsPage() {
  const [settings, setSettings] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [passwordForm, setPasswordForm] = useState(initialPasswordForm);
  const [editingKey, setEditingKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [aiSettings, setAISettings] = useState(initialAISettings);
  const [aiKeyInput, setAIKeyInput] = useState("");

  const [securityQuestion, setSecurityQuestion] = useState("");
  const [hasSecurityQuestion, setHasSecurityQuestion] = useState(false);
  const [questionPreset, setQuestionPreset] = useState("Tên trường cấp 3 của bạn là gì?");
  const [customQuestion, setCustomQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [recoveryPath, setRecoveryPath] = useState("");
  const [copiedRecovery, setCopiedRecovery] = useState(false);

  async function loadSettings() {
    try {
      setLoading(true);
      const data = await getSettings();
      setSettings(data);
    } catch (err) {
      console.error(err);
      alert("Không tải được cài đặt.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
    loadCurrentUser();
    loadAISettings();
    loadSecuritySettings();
  }, []);

  async function loadCurrentUser() {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadSecuritySettings() {
    try {
      const qData = await getSecurityQuestion();
      setSecurityQuestion(qData.security_question || "");
      setHasSecurityQuestion(qData.has_security_question);
      if (qData.security_question) {
        setCustomQuestion(qData.security_question);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleLoadRecoveryKey() {
    try {
      const data = await getRecoveryKey();
      setRecoveryKey(data.recovery_key);
      setRecoveryPath(data.recovery_file_path);
    } catch (err) {
      console.error(err);
      alert("Không tải được mã khôi phục.");
    }
  }

  async function handleRegenerateRecoveryKey() {
    if (!window.confirm("Bạn có chắc muốn tạo mã khôi phục mới? Mã cũ sẽ mất hiệu lực.")) return;
    try {
      const data = await regenerateRecoveryKey();
      setRecoveryKey(data.recovery_key);
      setRecoveryPath(data.recovery_file_path);
      alert("Đã tạo mã khôi phục mới thành công!");
    } catch (err) {
      console.error(err);
      alert("Tạo mã khôi phục thất bại.");
    }
  }

  function handleCopyRecoveryKey() {
    if (recoveryKey && navigator.clipboard) {
      navigator.clipboard.writeText(recoveryKey);
      setCopiedRecovery(true);
      setTimeout(() => setCopiedRecovery(false), 2000);
    }
  }

  async function handleUpdateSecurityQuestion(event) {
    event.preventDefault();
    const finalQuestion = questionPreset === "Tự nhập câu hỏi khác..." ? customQuestion.trim() : questionPreset;
    if (!finalQuestion) {
      alert("Vui lòng chọn hoặc nhập câu hỏi bảo mật.");
      return;
    }
    if (!securityAnswer.trim()) {
      alert("Vui lòng nhập câu trả lời bảo mật.");
      return;
    }
    try {
      await updateSecurityQuestion({
        security_question: finalQuestion,
        security_answer: securityAnswer.trim(),
      });
      setSecurityQuestion(finalQuestion);
      setHasSecurityQuestion(true);
      setSecurityAnswer("");
      alert("Đã lưu câu hỏi bảo mật thành công!");
    } catch (err) {
      console.error(err);
      alert(err.message || "Không lưu được câu hỏi bảo mật.");
    }
  }

  async function loadAISettings() {
    try {
      const data = await getAISettings();
      setAISettings((current) => ({
        ...current,
        ...data,
        gemini_api_key: "",
      }));
    } catch (err) {
      console.error(err);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handlePasswordChange(event) {
    const { name, value } = event.target;

    setPasswordForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm(initialForm);
    setEditingKey(null);
  }

  function resetPasswordForm() {
    setPasswordForm(initialPasswordForm);
  }

  async function handleInitDefault() {
    try {
      await initDefaultSettings();
      await loadSettings();
    } catch (err) {
      console.error(err);
      alert("Không thể tạo cài đặt mặc định.");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.key.trim()) {
      alert("Vui lòng nhập key.");
      return;
    }

    try {
      if (editingKey) {
        await updateSetting(editingKey, {
          value: form.value,
          note: form.note,
        });
      } else {
        await createSetting(form);
      }

      resetForm();
      await loadSettings();
    } catch (err) {
      console.error(err);
      alert("Lưu cài đặt thất bại. Có thể key đã tồn tại.");
    }
  }

  function handleEdit(setting) {
    setEditingKey(setting.key);

    setForm({
      key: setting.key || "",
      value: setting.value || "",
      note: setting.note || "",
    });
  }

  async function handleDelete(key) {
    const confirmDelete = window.confirm("Bạn có chắc muốn xóa cài đặt này?");

    if (!confirmDelete) {
      return;
    }

    try {
      await deleteSetting(key);
      await loadSettings();
    } catch (err) {
      console.error(err);
      alert("Xóa cài đặt thất bại.");
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault();

    if (!passwordForm.currentPassword) {
      alert("Vui lòng nhập mật khẩu hiện tại.");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      alert("Mật khẩu mới nên có ít nhất 6 ký tự.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert("Mật khẩu mới nhập lại không khớp.");
      return;
    }

    try {
      await changePassword({
        current_password: passwordForm.currentPassword,
        new_password: passwordForm.newPassword,
      });

      resetPasswordForm();
      alert("Đã đổi mật khẩu tài khoản.");
    } catch (err) {
      console.error(err);
      alert(err.message || "Đổi mật khẩu thất bại.");
    }
  }

  async function handleLogout() {
    try {
      await logout();
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Đăng xuất thất bại.");
    }
  }

  function handleAIChange(event) {
    const { name, value, checked, type } = event.target;

    if (name === "gemini_api_key") {
      setAIKeyInput(value);
      return;
    }

    setAISettings((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  async function handleAISubmit(event) {
    event.preventDefault();

    try {
      const payload = {
        ...aiSettings,
      };

      if (aiKeyInput.trim()) {
        payload.gemini_api_key = aiKeyInput.trim();
      }

      const data = await updateAISettings(payload);
      setAISettings((current) => ({
        ...current,
        ...data,
        gemini_api_key: "",
      }));
      setAIKeyInput("");
      alert("Đã lưu cài đặt Trợ lý AI.");
    } catch (err) {
      console.error(err);
      alert(err.message || "Không lưu được cài đặt AI.");
    }
  }

  return (
    <>
      <header className="page-header">
        <h2>Cài đặt</h2>
        <p>
          Quản lý cấu hình ứng dụng, cài đặt bảo mật, tên app, ngân sách, mốc
          nhắc deadline và các giá trị hệ thống.
        </p>
      </header>

      <div className="layout">
        <section className="panel">
          <h3>Bảo mật tài khoản</h3>

          <p className="empty">
            Tài khoản đang đăng nhập:{" "}
            {currentUser?.display_name || currentUser?.username || "Không rõ"}
          </p>

          <form onSubmit={handleChangePassword}>
            <label>
              Mật khẩu hiện tại
              <input
                type="password"
                name="currentPassword"
                value={passwordForm.currentPassword}
                onChange={handlePasswordChange}
                placeholder="Nhập mật khẩu hiện tại"
              />
            </label>

            <label>
              Mật khẩu mới
              <input
                type="password"
                name="newPassword"
                value={passwordForm.newPassword}
                onChange={handlePasswordChange}
                placeholder="Nhập mật khẩu mới"
              />
            </label>

            <label>
              Nhập lại mật khẩu mới
              <input
                type="password"
                name="confirmPassword"
                value={passwordForm.confirmPassword}
                onChange={handlePasswordChange}
                placeholder="Nhập lại mật khẩu mới"
              />
            </label>

            <button className="primary-button" type="submit">
              Đổi mật khẩu
            </button>

            <button
              className="secondary-button"
              type="button"
              onClick={handleLogout}
            >
              Đăng xuất
            </button>
          </form>

          <hr style={{ margin: "24px 0", borderColor: "#e5e7eb" }} />

          <h4>Câu hỏi bảo mật (Khôi phục mật khẩu)</h4>
          <p className="empty" style={{ margin: "6px 0 14px" }}>
            {hasSecurityQuestion
              ? `Câu hỏi hiện tại: "${securityQuestion}"`
              : "Chưa thiết lập câu hỏi bảo mật. Nên cài đặt để khôi phục khi quên mật khẩu."}
          </p>

          <form onSubmit={handleUpdateSecurityQuestion}>
            <label>
              Chọn câu hỏi
              <select
                value={questionPreset}
                onChange={(e) => setQuestionPreset(e.target.value)}
              >
                <option value="Tên trường cấp 3 của bạn là gì?">Tên trường cấp 3 của bạn là gì?</option>
                <option value="Thú cưng đầu tiên của bạn tên gì?">Thú cưng đầu tiên của bạn tên gì?</option>
                <option value="Món ăn yêu thích nhất của bạn là gì?">Món ăn yêu thích nhất của bạn là gì?</option>
                <option value="Tên người bạn thân thời thơ ấu?">Tên người bạn thân thời thơ ấu?</option>
                <option value="Nơi bạn sinh ra hoặc lớn lên?">Nơi bạn sinh ra hoặc lớn lên?</option>
                <option value="Tự nhập câu hỏi khác...">Tự nhập câu hỏi khác...</option>
              </select>
            </label>

            {questionPreset === "Tự nhập câu hỏi khác..." && (
              <label>
                Câu hỏi tùy chỉnh
                <input
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  placeholder="Nhập câu hỏi của riêng bạn"
                />
              </label>
            )}

            <label>
              Câu trả lời bảo mật
              <input
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                placeholder="Nhập câu trả lời mới..."
                autoComplete="off"
              />
            </label>

            <button className="primary-button" type="submit">
              Lưu câu hỏi bảo mật
            </button>
          </form>

          <hr style={{ margin: "24px 0", borderColor: "#e5e7eb" }} />

          <h4>Mã khôi phục dự phòng (Recovery Key)</h4>
          <p className="empty" style={{ margin: "6px 0 14px" }}>
            Dùng mã này để đặt lại mật khẩu khẩn cấp khi bạn quên mật khẩu và câu hỏi bảo mật.
          </p>

          {recoveryKey ? (
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 14, marginBottom: 14 }}>
              <small style={{ color: "#64748b", display: "block", marginBottom: 4 }}>MÃ KHÔI PHỤC HIỆN TẠI:</small>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <code style={{ fontSize: 18, fontWeight: 700, color: "#166534", letterSpacing: 1.5, background: "#dcfce7", padding: "6px 12px", borderRadius: 6 }}>
                  {recoveryKey}
                </code>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ padding: "6px 12px", fontSize: 13 }}
                  onClick={handleCopyRecoveryKey}
                >
                  {copiedRecovery ? "✓ Đã copy" : "Sao chép"}
                </button>
              </div>
              {recoveryPath && (
                <small style={{ color: "#64748b", display: "block", fontSize: 12 }}>
                  File dự phòng: <code>{recoveryPath}</code>
                </small>
              )}
            </div>
          ) : (
            <button
              className="secondary-button"
              type="button"
              onClick={handleLoadRecoveryKey}
              style={{ marginBottom: 14 }}
            >
              👁️ Xem mã khôi phục dự phòng
            </button>
          )}

          <button
            className="secondary-button"
            type="button"
            onClick={handleRegenerateRecoveryKey}
          >
            🔄 Tạo lại mã khôi phục mới
          </button>
        </section>

        <section className="panel">
          <h3>Trợ lý AI</h3>
          <p className="empty">
            API key chỉ xử lý ở backend. Các nhóm dữ liệu nhạy cảm mặc định nên tắt
            và chỉ bật khi bạn thật sự muốn AI dùng.
          </p>

          <form onSubmit={handleAISubmit}>
            <label>
              Gemini API Key
              <input
                type="password"
                name="gemini_api_key"
                value={aiKeyInput}
                onChange={handleAIChange}
                placeholder={aiSettings.has_api_key ? "Đã có key, nhập key mới để thay đổi" : "Dán Gemini API Key"}
              />
            </label>

            <label>
              Model
              <input
                name="ai_model"
                value={aiSettings.ai_model}
                onChange={handleAIChange}
                placeholder="gemini-3.5-flash"
              />
            </label>

            <div className="ai-settings-grid">
              {aiToggleLabels.map(([key, label, description]) => (
                <label className="ai-toggle-row" key={key}>
                  <input
                    type="checkbox"
                    name={key}
                    checked={Boolean(aiSettings[key])}
                    onChange={handleAIChange}
                  />
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                </label>
              ))}
            </div>

            <button className="primary-button" type="submit">
              Lưu cài đặt AI
            </button>
          </form>
        </section>

        <section className="panel">
          <h3>{editingKey ? "Cập nhật cài đặt" : "Thêm cài đặt"}</h3>

          <button
            className="secondary-button"
            type="button"
            onClick={handleInitDefault}
            style={{ marginBottom: 16 }}
          >
            Tạo cài đặt mặc định
          </button>

          <form onSubmit={handleSubmit}>
            <label>
              Key
              <input
                name="key"
                value={form.key}
                onChange={handleChange}
                placeholder="Ví dụ: app_name"
                disabled={Boolean(editingKey)}
              />
            </label>

            <label>
              Giá trị
              <input
                name="value"
                value={form.value}
                onChange={handleChange}
                placeholder="Ví dụ: Personal Life App"
              />
            </label>

            <label>
              Ghi chú
              <textarea
                name="note"
                value={form.note}
                onChange={handleChange}
                placeholder="Cài đặt này dùng để làm gì?"
              />
            </label>

            <button className="primary-button" type="submit">
              {editingKey ? "Cập nhật" : "Thêm cài đặt"}
            </button>

            {editingKey && (
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
            <h3>Danh sách cài đặt</h3>
          </div>

          {loading ? (
            <p className="empty">Đang tải dữ liệu...</p>
          ) : settings.length === 0 ? (
            <p className="empty">Chưa có cài đặt nào.</p>
          ) : (
            <div className="event-list">
              {settings.map((setting) => (
                <article className="event-card" key={setting.id}>
                  <div>
                    <h4>{setting.key}</h4>
                    <p>{setting.value || "Chưa có giá trị"}</p>
                    {setting.note && <small>{setting.note}</small>}
                  </div>

                  <div className="card-actions">
                    <button
                      className="edit-button"
                      type="button"
                      onClick={() => handleEdit(setting)}
                    >
                      Sửa
                    </button>

                    <button
                      className="danger-button"
                      type="button"
                      onClick={() => handleDelete(setting.key)}
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

export default SettingsPage;
