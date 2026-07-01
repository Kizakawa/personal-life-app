import { API_URL, apiFetch } from "./config";

export async function getSchedules() {
  const response = await apiFetch(`${API_URL}/schedules`);

  if (!response.ok) {
    throw new Error("Cannot load schedules");
  }

  return response.json();
}

export async function createSchedule(schedule) {
  const response = await apiFetch(`${API_URL}/schedules`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(schedule),
  });

  if (!response.ok) {
    throw new Error("Cannot create schedule");
  }

  return response.json();
}

export async function updateSchedule(scheduleId, schedule) {
  const response = await apiFetch(`${API_URL}/schedules/${scheduleId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(schedule),
  });

  if (!response.ok) {
    throw new Error("Cannot update schedule");
  }

  return response.json();
}

export async function deleteSchedule(scheduleId) {
  const response = await apiFetch(`${API_URL}/schedules/${scheduleId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Cannot delete schedule");
  }

  return response.json();
}