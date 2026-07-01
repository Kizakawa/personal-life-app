import { API_URL, apiFetch } from "./config";

export async function getDeadlines() {
  const response = await apiFetch(`${API_URL}/deadlines/`);

  if (!response.ok) {
    throw new Error("Cannot load deadlines");
  }

  return response.json();
}

export async function getUpcomingDeadlines() {
  const response = await apiFetch(`${API_URL}/deadlines/upcoming`);

  if (!response.ok) {
    throw new Error("Cannot load upcoming deadlines");
  }

  return response.json();
}

export async function createDeadline(deadline) {
  const response = await apiFetch(`${API_URL}/deadlines/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(deadline),
  });

  if (!response.ok) {
    throw new Error("Cannot create deadline");
  }

  return response.json();
}

export async function updateDeadline(deadlineId, deadline) {
  const response = await apiFetch(`${API_URL}/deadlines/${deadlineId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(deadline),
  });

  if (!response.ok) {
    throw new Error("Cannot update deadline");
  }

  return response.json();
}

export async function markDeadlineDone(deadlineId) {
  const response = await apiFetch(`${API_URL}/deadlines/${deadlineId}/done`, {
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error("Cannot mark deadline as done");
  }

  return response.json();
}

export async function deleteDeadline(deadlineId) {
  const response = await apiFetch(`${API_URL}/deadlines/${deadlineId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Cannot delete deadline");
  }

  return response.json();
}
