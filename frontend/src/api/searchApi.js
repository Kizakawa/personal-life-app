import { API_URL, apiFetch } from "./config";

export async function globalSearch(keyword) {
  const params = new URLSearchParams();

  if (keyword) {
    params.set("keyword", keyword);
  }

  const response = await apiFetch(`${API_URL}/search/?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Cannot search");
  }

  return response.json();
}

export function buildBackendUrl(path) {
  if (!path) {
    return "";
  }

  return `${API_URL}${path}`;
}