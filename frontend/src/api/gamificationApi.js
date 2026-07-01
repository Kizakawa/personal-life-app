import { API_URL, apiFetch } from "./config";

async function parseResponse(response, fallbackMessage) {
  if (!response.ok) {
    throw new Error(fallbackMessage);
  }

  return response.json();
}

export async function getGamificationSummary() {
  const response = await apiFetch(`${API_URL}/gamification/summary`);
  return parseResponse(response, "Cannot load gamification summary");
}
