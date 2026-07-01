import { useEffect, useState } from "react";
import {
  getAuthStatus,
  getCurrentUser,
  login,
  setupAccount,
} from "../api/authApi";
import { clearAuthToken, getAuthToken } from "../api/config";
import "./AppLock.css";

const initialForm = {
  username: "",
  displayName: "",
  password: "",
  confirmPassword: "",
};

function AppLock({ children }) {
  const [authReady, setAuthReady] = useState(false);
  const [hasAccount, setHasAccount] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

      const result = isSetupMode
        ? await setupAccount({
            username: form.username,
            display_name: form.displayName,
            password: form.password,
          })
        : await login({
            username: form.username,
            password: form.password,
          });

      setCurrentUser(result.user);
      setUnlocked(true);
      setHasAccount(true);
      setForm(initialForm);
    } catch (err) {
      console.error(err);
      setError(err.message || "Xác thực thất bại.");
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

  if (unlocked) {
    return children;
  }

  return (
    <main className="lock-page">
      <section className="lock-card">
        <p className="lock-kicker">Personal Life App</p>

        <h1>{isSetupMode ? "Tạo tài khoản đầu tiên" : "Đăng nhập"}</h1>

        <p className="lock-description">
          {isSetupMode
            ? "Thiết lập tài khoản quản trị đầu tiên để bảo vệ dữ liệu backend."
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
          Mật khẩu được hash ở backend. Không còn dùng khóa localStorage đơn giản như trước.
        </p>
      </section>
    </main>
  );
}

export default AppLock;
