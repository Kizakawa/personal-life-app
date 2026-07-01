import { API_URL, apiFetch } from "./config";
import { invalidateCache } from "./cache";
import useUserStore from "../stores/useUserStore";
import { notifySuccess } from "./config";

export async function getWorkspaceItems(module, keyword = "", filters = {}) {
  const params = new URLSearchParams();

  if (module) params.set("module", module);
  if (keyword) params.set("keyword", keyword);
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);
  if (filters.subject) params.set("subject", filters.subject);
  if (filters.limit) params.set("limit", filters.limit);
  if (filters.offset) params.set("offset", filters.offset);

  const query = params.toString();
  const url = query
    ? `${API_URL}/workspace-items/?${query}`
    : `${API_URL}/workspace-items/`;

  const response = await apiFetch(url);

  if (!response.ok) {
    throw new Error("Cannot load workspace items");
  }

  return response.json();
}

export async function createWorkspaceItem(item) {
  const response = await apiFetch(`${API_URL}/workspace-items/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });

  if (!response.ok) {
    throw new Error("Cannot create workspace item");
  }

  invalidateCache("student-hub");
  return response.json();
}

export async function updateWorkspaceItem(itemId, item) {
  const response = await apiFetch(`${API_URL}/workspace-items/${itemId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });

  if (!response.ok) {
    throw new Error("Cannot update workspace item");
  }

  invalidateCache("student-hub");
  const data = await response.json();
  if (item?.status === "done") {
    useUserStore.getState().refreshGamification();
    notifySuccess("Đã hoàn thành mục học tập, EXP đã được cập nhật.");
  }
  return data;
}

export async function deleteWorkspaceItem(itemId) {
  const response = await apiFetch(`${API_URL}/workspace-items/${itemId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Cannot delete workspace item");
  }

  invalidateCache("student-hub");
  return response.json();
}
