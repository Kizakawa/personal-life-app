import { API_URL, apiFetch, notifySuccess } from "./config";
import { invalidateCache } from "./cache";
import useUserStore from "../stores/useUserStore";

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set("status", params.status);
  if (params.startDate) searchParams.set("start_date", params.startDate);
  if (params.endDate) searchParams.set("end_date", params.endDate);
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.offset) searchParams.set("offset", String(params.offset));
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function getTasks(params = {}) {
  const response = await apiFetch(`${API_URL}/tasks/${buildQuery(params)}`);

  if (!response.ok) {
    throw new Error("Cannot load tasks");
  }

  return response.json();
}

export async function getTodayTasks() {
  const response = await apiFetch(`${API_URL}/tasks/today`);

  if (!response.ok) {
    throw new Error("Cannot load today tasks");
  }

  return response.json();
}

export async function createTask(task) {
  const response = await apiFetch(`${API_URL}/tasks/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(task),
  });

  if (!response.ok) {
    throw new Error("Cannot create task");
  }

  invalidateCache("dashboard");
  invalidateCache("tasks");
  invalidateCache("student-hub");
  return response.json();
}

export async function updateTask(taskId, task) {
  const response = await apiFetch(`${API_URL}/tasks/${taskId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(task),
  });

  if (!response.ok) {
    throw new Error("Cannot update task");
  }

  invalidateCache("dashboard");
  invalidateCache("tasks");
  invalidateCache("student-hub");
  const data = await response.json();
  if (task?.status === "done") {
    useUserStore.getState().refreshGamification();
    notifySuccess("Đã hoàn thành task, EXP đã được cập nhật.");
  }
  return data;
}

export async function deleteTask(taskId) {
  const response = await apiFetch(`${API_URL}/tasks/${taskId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Cannot delete task");
  }

  invalidateCache("dashboard");
  invalidateCache("tasks");
  invalidateCache("student-hub");
  return response.json();
}

export async function markTaskDone(taskId) {
  const response = await apiFetch(`${API_URL}/tasks/${taskId}/done`, {
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error("Cannot mark task done");
  }

  invalidateCache("dashboard");
  invalidateCache("tasks");
  invalidateCache("student-hub");
  const data = await response.json();
  useUserStore.getState().refreshGamification();
  notifySuccess("Đã hoàn thành task, EXP đã được cập nhật.");
  return data;
}
