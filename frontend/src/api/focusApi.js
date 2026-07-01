import { API_URL, apiFetch } from "./config";
import { invalidateCache } from "./cache";
import useUserStore from "../stores/useUserStore";
import { notifySuccess } from "./config";

async function parseResponse(response, fallbackMessage) {
  if (!response.ok) {
    throw new Error(fallbackMessage);
  }

  return response.json();
}

export async function getFocusSummary() {
  const response = await apiFetch(`${API_URL}/focus/summary`);
  return parseResponse(response, "Cannot load focus summary");
}

export async function createFocusSession(payload) {
  const response = await apiFetch(`${API_URL}/focus/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  invalidateCache("student-hub");
  const data = await parseResponse(response, "Cannot create focus session");
  useUserStore.getState().refreshGamification();
  notifySuccess("Đã lưu phiên tập trung, EXP đã được cập nhật.");
  return data;
}
