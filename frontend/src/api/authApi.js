import { API_URL, apiFetch, clearAuthToken, setAuthToken } from "./config";

async function parseAuthResponse(response) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "Không thể xác thực tài khoản");
  }

  const data = await response.json();

  if (data.token) {
    setAuthToken(data.token);
  }

  return data;
}

export async function getAuthStatus() {
  const response = await fetch(`${API_URL}/auth/status`);

  if (!response.ok) {
    throw new Error("Không kiểm tra được trạng thái tài khoản");
  }

  return response.json();
}

export async function setupAccount(account) {
  const response = await fetch(`${API_URL}/auth/setup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(account),
  });

  return parseAuthResponse(response);
}

export async function login(account) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(account),
  });

  return parseAuthResponse(response);
}

export async function getCurrentUser() {
  const response = await apiFetch(`${API_URL}/auth/me`);

  if (!response.ok) {
    throw new Error("Phiên đăng nhập không hợp lệ");
  }

  return response.json();
}

export async function changePassword(data) {
  const response = await apiFetch(`${API_URL}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Đổi mật khẩu thất bại");
  }

  return response.json();
}

export async function logout() {
  await apiFetch(`${API_URL}/auth/logout`, {
    method: "POST",
  }).catch(() => null);

  clearAuthToken();
}

export async function getRecoveryInfo(username) {
  const url = username
    ? `${API_URL}/auth/recovery-info?username=${encodeURIComponent(username.trim())}`
    : `${API_URL}/auth/recovery-info`;

  const response = await fetch(url);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Không tìm thấy thông tin tài khoản.");
  }

  return response.json();
}

export async function resetPassword(payload) {
  const response = await fetch(`${API_URL}/auth/forgot-password/reset`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseAuthResponse(response);
}

export async function getSecurityQuestion() {
  const response = await apiFetch(`${API_URL}/auth/security-question`);

  if (!response.ok) {
    throw new Error("Không tải được câu hỏi bảo mật.");
  }

  return response.json();
}

export async function updateSecurityQuestion(data) {
  const response = await apiFetch(`${API_URL}/auth/security-question`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Cập nhật câu hỏi bảo mật thất bại.");
  }

  return response.json();
}

export async function getRecoveryKey() {
  const response = await apiFetch(`${API_URL}/auth/recovery-key`);

  if (!response.ok) {
    throw new Error("Không tải được mã khôi phục.");
  }

  return response.json();
}

export async function regenerateRecoveryKey() {
  const response = await apiFetch(`${API_URL}/auth/recovery-key/regenerate`, {
    method: "POST",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || "Tạo lại mã khôi phục thất bại.");
  }

  return response.json();
}
