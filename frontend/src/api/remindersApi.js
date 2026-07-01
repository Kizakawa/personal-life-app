import { API_URL, apiFetch } from "./config";

export async function getRemindersSummary() {
  const response = await apiFetch(`${API_URL}/reminders/summary`);

  if (!response.ok) {
    throw new Error("Cannot load reminders summary");
  }

  return response.json();
}