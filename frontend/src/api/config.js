import toast from "react-hot-toast";

export const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const TOKEN_KEY = "personal_life_app_auth_token";

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(input, options = {}) {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    const response = await fetch(input, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      clearAuthToken();
      window.dispatchEvent(new Event("auth:expired"));
      toast.error("Phiên đăng nhập đã hết hạn hoặc link không hợp lệ.");
    }

    return response;
  } catch (error) {
    toast.error("Không kết nối được backend. Kiểm tra server đang chạy chưa.");
    throw error;
  }
}

export function notifySuccess(message) {
  toast.success(message);
}

export function notifyError(message) {
  toast.error(message);
}
