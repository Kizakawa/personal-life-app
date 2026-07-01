import { API_URL, apiFetch } from "./config";

async function parseResponse(response, fallbackMessage) {
  if (!response.ok) {
    throw new Error(fallbackMessage);
  }

  return response.json();
}

export async function getCalendarExportLink(days = 90) {
  const params = new URLSearchParams({ days: String(days) });
  const response = await apiFetch(`${API_URL}/calendar/link?${params.toString()}`);
  return parseResponse(response, "Cannot create calendar export link");
}

export async function regenerateCalendarExportToken(days = 90) {
  const params = new URLSearchParams({ days: String(days) });
  const response = await apiFetch(`${API_URL}/calendar/token/regenerate?${params.toString()}`, {
    method: "POST",
  });
  return parseResponse(response, "Cannot regenerate calendar export token");
}
