import { API_URL, apiFetch } from "./config";

export async function getDashboardSummary() {
  const response = await apiFetch(`${API_URL}/dashboard/summary`);

  if (!response.ok) {
    throw new Error("Cannot load dashboard summary");
  }

  return response.json();
}