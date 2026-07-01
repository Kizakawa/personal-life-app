import { API_URL, apiFetch } from "./config";

export async function getAnalyticsSummary() {
  const response = await apiFetch(`${API_URL}/analytics/summary`);

  if (!response.ok) {
    throw new Error("Cannot load analytics summary");
  }

  return response.json();
}