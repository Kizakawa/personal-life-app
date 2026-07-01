import { API_URL, apiFetch } from "./config";

export async function initDefaultSettings() {
  const response = await apiFetch(`${API_URL}/settings/init`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Cannot init default settings");
  }

  return response.json();
}

export async function getSettings() {
  const response = await apiFetch(`${API_URL}/settings/`);

  if (!response.ok) {
    throw new Error("Cannot load settings");
  }

  return response.json();
}

export async function createSetting(setting) {
  const response = await apiFetch(`${API_URL}/settings/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(setting),
  });

  if (!response.ok) {
    throw new Error("Cannot create setting");
  }

  return response.json();
}

export async function updateSetting(key, setting) {
  const response = await apiFetch(`${API_URL}/settings/${key}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(setting),
  });

  if (!response.ok) {
    throw new Error("Cannot update setting");
  }

  return response.json();
}

export async function deleteSetting(key) {
  const response = await apiFetch(`${API_URL}/settings/${key}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Cannot delete setting");
  }

  return response.json();
}