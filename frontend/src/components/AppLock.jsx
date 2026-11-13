import { useEffect, useState } from "react";
import {
  getAuthStatus,
  getCurrentUser,
  getRecoveryInfo,
  login,
  resetPassword,
  setupAccount,
} from "../api/authApi";
import { clearAuthToken, getAuthToken } from "../api/config";
import "./AppLock.css";

const PRESET_QUESTIONS = [
  "Tên trường cấp 3 của bạn là gì?",
  "Thú cưng đầu tiên của bạn tên gì?",
  "Món ăn yêu thích nhất của bạn là gì?",
  "Tên người bạn thân thời thơ ấu?",
  "Nơi bạn sinh ra hoặc lớn lên?",
  "Tự nhập câu hỏi khác...",
];

const initialForm = {
  username: "",
  displayName: "",
  password: "",
  confirmPassword: "",
  securityQuestionPreset: PRESET_QUESTIONS[0],
  customQuestion: "",
  securityAnswer: "",
  // Dùng cho quên mật khẩu
  forgotMethod: "question", // "question" | "key"
  recoveryKey: "",
  newPassword: "",
  confirmNewPassword: "",
};

function AppLock({ children }) {
  const [authReady, setAuthReady] = useState(false);
  const [hasAccount, setHasAccount] = useState(true);
  const [defaultUsername, setDefaultUsername] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Chế độ quên mật khẩu
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [recoveryInfo, setRecoveryInfo] = useState(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  // Hiển thị mã khôi phục khi tạo tài khoản xong
  const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const isSetupMode = !hasAccount;

  useEffect(() => {
    checkAuthState();

    function handleExpiredSession() {
      clearAuthToken();
      setUnlocked(false);
      setCurrentUser(null);
      setError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }

    window.addEventListener("auth:expired", handleExpiredSession);

    return () => {
      window.removeEventListener("auth:expired", handleExpiredSession);
    };
  }, []);

  async function checkAuthState() {
    try {
      setAuthReady(false);
      const status = await getAuthStatus();
      setHasAccount(status.has_account);

      if (status.default_username) {
        setDefaultUsername(status.default_username);
        setForm((current) => ({
          ...current,
          username: current.username || status.default_username,
        }));
      }

      if (status.has_account && getAuthToken()) {
        const user = await getCurrentUser();
        setCurrentUser(user);
        setUnlocked(true);
      }
    } catch (err) {
      console.error(err);
      setError("Không kết nối được backend. Hãy kiểm tra server API đã chạy.");
    } finally {
      setAuthReady(true);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  // Khi bấm "Quên mật khẩu?"
  async function handleOpenForgotPassword() {
    setError("");
    setSuccessMsg("");
    setIsForgotPassword(true);
    const targetUsername = form.username.trim() || defaultUsername;

    if (targetUsername) {
      loadRecoveryInfo(targetUsername);
    }
  }

  async function loadRecoveryInfo(usernameToFetch) {
    try {
      setRecoveryLoading(true);
      const info = await getRecoveryInfo(usernameToFetch);
      setRecoveryInfo(info);
      setForm((current) => ({
        ...current,
        username: info.username || current.username,
        forgotMethod: info.has_security_question ? "question" : "key",
      }));
    } catch (err) {
      console.error(err);
      // Vẫn cho phép nhập mã khôi phục
      setRecoveryInfo(null);
      setForm((current) => ({
        ...current,
        forgotMethod: "key",
      }));
    } finally {
      setRecoveryLoading(false);
    }
  }

  function handleUsernameBlur() {
    if (isForgotPassword && form.username.trim()) {
      loadRecoveryInfo(form.username.trim());
    }
  }

  function handleCopyKey(keyToCopy) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(keyToCopy);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    }
  }

  function validateForm() {
    if (!form.username.trim()) {
      return "Vui lòng nhập tài khoản.";
    }

    if (isSetupMode && form.username.trim().length < 3) {
      return "Tài khoản nên có ít nhất 3 ký tự.";
    }

    if (!form.password) {
      return "Vui lòng nhập mật khẩu.";
    }

    if (isSetupMode && form.password.length < 6) {
      return "Mật khẩu nên có ít nhất 6 ký tự.";
    }

    if (isSetupMode && form.password !== form.confirmPassword) {
      return "Mật khẩu nhập lại không khớp.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError("");

      if (isSetupMode) {
        const chosenQuestion =
          form.securityQuestionPreset === "Tự nhập câu hỏi khác..."
            ? form.customQuestion.trim()
            : form.securityQuestionPreset;

        const result = await setupAccount({
          username: form.username,
          display_name: form.displayName,
          password: form.password,
          security_question: chosenQuestion || null,
          security_answer: form.securityAnswer.trim() || null,
        });

        setCurrentUser(result.user);
        setHasAccount(true);

        if (result.recovery_key) {
          setNewlyCreatedKey(result.recovery_key);
        } else {
          setUnlocked(true);
          setForm(initialForm);
        }
      } else {
        const result = await login({
          username: form.username,
          password: form.password,
        });

        setCurrentUser(result.user);
        setUnlocked(true);
        setHasAccount(true);
        setForm(initialForm);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Xác thực thất bại.");
    } finally {
      setLoading(false);
    }
  }

  // Xử lý gửi form Đặt lại mật khẩu
  async function handleResetPasswordSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!form.username.trim()) {
      setError("Vui lòng nhập tên tài khoản cần khôi phục.");
      return;
    }

    if (form.forgotMethod === "question") {
      if (!form.securityAnswer.trim()) {
        setError("Vui lòng nhập câu trả lời bảo mật.");
        return;
      }
    } else {
      if (!form.recoveryKey.trim()) {
        setError("Vui lòng nhập mã khôi phục dự phòng.");
        return;
      }
    }

    if (!form.newPassword) {
      setError("Vui lòng nhập mật khẩu mới.");
      return;
    }

    if (form.newPassword.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }

    if (form.newPassword !== form.confirmNewPassword) {
      setError("Mật khẩu nhập lại không khớp.");
      return;
    }

    try {
      setLoading(true);

      const result = await resetPassword({
        username: form.username,
        method: form.forgotMethod,
        security_answer: form.forgotMethod === "question" ? form.securityAnswer : null,
        recovery_key: form.forgotMethod === "key" ? form.recoveryKey : null,
        new_password: form.newPassword,
      });

      setSuccessMsg("Đặt lại mật khẩu thành công! Đang vào ứng dụng...");
      setCurrentUser(result.user);

      setTimeout(() => {
        setUnlocked(true);
        setIsForgotPassword(false);
        setForm(initialForm);
      }, 1000);
    } catch (err) {
      console.error(err);
      setError(err.message || "Đặt lại mật khẩu thất bại.");
    } finally {
      setLoading(false);
    }
  }

  if (!authReady) {
    return (
      <main className="lock-page">
        <section className="lock-card">
          <p className="lock-kicker">Personal Life App</p>
          <h1>Đang kiểm tra bảo mật</h1>
          <p className="lock-description">Kết nối backend và xác thực phiên đăng nhập.</p>
        </section>
      </main>
    );
  }

  // Màn hình thông báo mã khôi phục sau khi vừa setup tài khoản thành công
  if (newlyCreatedKey) {
    return (
      <main className="lock-page">
        <section className="lock-card">
          <p className="lock-kicker">Tạo tài khoản thành công</p>
          <h1>Mã khôi phục của bạn</h1>
          <p className="lock-description">
            Hãy sao chép và lưu giữ mã này cẩn thận. Bạn sẽ cần nó để đặt lại mật khẩu nếu lỡ quên sau này!
          </p>

          <div className="lock-recovery-display">
            <small style={{ color: "#166534", fontWeight: 600 }}>MÃ KHÔI PHỤC DỰ PHÒNG</small>
            <code>{newlyCreatedKey}</code>
            <button
              type="button"
              className="lock-copy-button"
              onClick={() => handleCopyKey(newlyCreatedKey)}
            >
              {copiedKey ? "✓ Đã sao chép!" : "Sao chép mã khôi phục"}
            </button>
          </div>

          <div className="lock-tip">
            💡 Hệ thống cũng đã lưu một bản sao tại file:
            <br />
            <code>%APPDATA%\PersonalLifeApp\recovery_key.txt</code>
          </div>

          <button
            type="button"
            style={{ marginTop: 18 }}
            onClick={() => {
              setNewlyCreatedKey(null);
              setUnlocked(true);
              setForm(initialForm);
            }}
          >
            Vào ứng dụng ngay →
          </button>
        </section>
      </main>
    );
  }

  if (unlocked) {
    return children;
  }

  // GIAO DIỆN QUÊN MẬT KHẨU
  if (isForgotPassword) {
    return (
      <main className="lock-page">
        <section className="lock-card">
          <p className="lock-kicker">Khôi phục tài khoản</p>
          <h1>Quên mật khẩu</h1>
          <p className="lock-description">
            Đặt lại mật khẩu bằng Câu hỏi bảo mật hoặc Mã khôi phục dự phòng.
          </p>

          <div className="lock-tabs">
            <button
              type="button"
              className={`lock-tab ${form.forgotMethod === "question" ? "active" : ""}`}
              onClick={() => setForm((curr) => ({ ...curr, forgotMethod: "question" }))}
            >
              Câu hỏi bảo mật
            </button>
            <button
              type="button"
              className={`lock-tab ${form.forgotMethod === "key" ? "active" : ""}`}
              onClick={() => setForm((curr) => ({ ...curr, forgotMethod: "key" }))}
            >
              Mã khôi phục
            </button>
          </div>

          <form onSubmit={handleResetPasswordSubmit}>
            <label>
              Tài khoản
              <input
                name="username"
                value={form.username}
                onChange={handleChange}
                onBlur={handleUsernameBlur}
                placeholder="Ví dụ: bao"
                autoComplete="username"
                autoFocus
              />
            </label>

            {recoveryLoading && (
              <small style={{ color: "#2563eb" }}>Đang tải thông tin tài khoản...</small>
            )}

            {form.forgotMethod === "question" ? (
              <>
                {recoveryInfo?.has_security_question ? (
                  <div className="lock-question-box">
                    <small style={{ color: "#64748b" }}>Câu hỏi bảo mật của bạn:</small>
                    <strong>{recoveryInfo.security_question}</strong>
                  </div>
                ) : (
                  <div className="lock-tip">
                    ℹ️ Tài khoản chưa có câu hỏi bảo mật. Bạn hãy chuyển sang tab <strong>Mã khôi phục</strong> bên trên.
                  </div>
                )}

                <label>
                  Câu trả lời bảo mật
                  <input
                    name="securityAnswer"
                    value={form.securityAnswer}
                    onChange={handleChange}
                    placeholder="Nhập câu trả lời bí mật của bạn"
                    autoComplete="off"
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  Mã khôi phục dự phòng
                  <input
                    name="recoveryKey"
                    value={form.recoveryKey}
                    onChange={handleChange}
                    placeholder="Ví dụ: PLA-XXXX-XXXX-XXXX"
                    autoComplete="off"
                  />
                </label>

                <div className="lock-tip">
                  💡 Bạn có thể mở file mã khôi phục đã lưu trên máy tại:
                  <br />
                  <code>%APPDATA%\PersonalLifeApp\recovery_key.txt</code>
                </div>
              </>
            )}

            <label>
              Mật khẩu mới
              <input
                type="password"
                name="newPassword"
                value={form.newPassword}
                onChange={handleChange}
                placeholder="Tối thiểu 6 ký tự"
                autoComplete="new-password"
              />
            </label>

            <label>
              Nhập lại mật khẩu mới
              <input
                type="password"
                name="confirmNewPassword"
                value={form.confirmNewPassword}
                onChange={handleChange}
                placeholder="Nhập lại mật khẩu mới"
                autoComplete="new-password"
              />
            </label>

            {error && <p className="lock-error">{error}</p>}
            {successMsg && <p className="lock-success">{successMsg}</p>}

            <button type="submit" disabled={loading}>
              {loading ? "Đang xử lý..." : "Đặt lại mật khẩu & Đăng nhập"}
            </button>

            <button
              type="button"
              className="lock-secondary-button"
              onClick={() => {
                setIsForgotPassword(false);
                setError("");
                setSuccessMsg("");
              }}
            >
              ← Quay lại đăng nhập
            </button>
          </form>
        </section>
      </main>
    );
  }

  // GIAO DIỆN ĐĂNG NHẬP / THIẾT LẬP BAN ĐẦU
  return (
    <main className="lock-page">
      <section className="lock-card">
        <p className="lock-kicker">Personal Life App</p>

        <h1>{isSetupMode ? "Tạo tài khoản đầu tiên" : "Đăng nhập"}</h1>

        <p className="lock-description">
          {isSetupMode
            ? "Thiết lập tài khoản quản trị và phương thức khôi phục bảo vệ dữ liệu."
            : "Nhập tài khoản và mật khẩu để truy cập dữ liệu cá nhân."}
        </p>

        <form onSubmit={handleSubmit}>
          <label>
            Tài khoản
            <input
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="Ví dụ: bao"
              autoComplete="username"
              autoFocus
            />
          </label>

          {isSetupMode && (
            <label>
              Tên hiển thị
              <input
                name="displayName"
                value={form.displayName}
                onChange={handleChange}
                placeholder="Ví dụ: Bảo"
                autoComplete="name"
              />
            </label>
          )}

          <label>
            Mật khẩu
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Nhập mật khẩu"
              autoComplete={isSetupMode ? "new-password" : "current-password"}
            />
          </label>

          {isSetupMode && (
            <label>
              Nhập lại mật khẩu
              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Nhập lại mật khẩu"
                autoComplete="new-password"
              />
            </label>
          )}

          {/* Thiết lập câu hỏi bảo mật trong chế độ Setup */}
          {isSetupMode && (
            <>
              <label>
                Câu hỏi bảo mật (dùng khôi phục khi quên mật khẩu)
                <select
                  name="securityQuestionPreset"
                  value={form.securityQuestionPreset}
                  onChange={handleChange}
                >
                  {PRESET_QUESTIONS.map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                </select>
              </label>

              {form.securityQuestionPreset === "Tự nhập câu hỏi khác..." && (
                <label>
                  Câu hỏi tùy chỉnh
                  <input
                    name="customQuestion"
                    value={form.customQuestion}
                    onChange={handleChange}
                    placeholder="Nhập câu hỏi bảo mật của riêng bạn"
                  />
                </label>
              )}

              <label>
                Câu trả lời bảo mật
                <input
                  name="securityAnswer"
                  value={form.securityAnswer}
                  onChange={handleChange}
                  placeholder="Nhập câu trả lời bí mật (không dấu hoặc có dấu đều được)"
                  autoComplete="off"
                />
              </label>
            </>
          )}

          {/* NÚT QUÊN MẬT KHẨU Ở CHẾ ĐỘ ĐĂNG NHẬP */}
          {!isSetupMode && (
            <div className="lock-sub-actions">
              <button
                type="button"
                className="lock-link-button"
                onClick={handleOpenForgotPassword}
              >
                Quên mật khẩu?
              </button>
            </div>
          )}

          {currentUser && (
            <p className="lock-note">Tài khoản hiện tại: {currentUser.username}</p>
          )}

          {error && <p className="lock-error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading
              ? "Đang xử lý..."
              : isSetupMode
                ? "Tạo tài khoản"
                : "Đăng nhập"}
          </button>
        </form>

        <p className="lock-note">
          Mật khẩu được mã hóa an toàn ở backend. Bạn có thể đặt lại mật khẩu bất cứ lúc nào qua tính năng Quên mật khẩu.
        </p>
      </section>
    </main>
  );
}

export default AppLock;

