import { API_URL, apiFetch } from "./config";

export async function exportBackup() {
  const response = await apiFetch(`${API_URL}/backup/export`);

  if (!response.ok) {
    throw new Error("Cannot export backup");
  }

  return response.json();
}

export async function exportBackupZip() {
  const response = await apiFetch(`${API_URL}/backup/export/zip`);

  if (!response.ok) {
    throw new Error("Cannot export backup zip");
  }

  return response.blob();
}

export async function previewBackup(data) {
  const response = await apiFetch(`${API_URL}/backup/import/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Cannot preview backup");
  }

  return response.json();
}

export async function previewBackupZip(file) {
  const formData = new FormData();
  formData.append("backup_file", file);

  const response = await apiFetch(`${API_URL}/backup/import/zip/preview`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Cannot preview backup zip");
  }

  return response.json();
}

export async function importBackup(data) {
  const response = await apiFetch(`${API_URL}/backup/import?confirm=true`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Cannot import backup");
  }

  return response.json();
}

export async function importBackupZip(file) {
  const formData = new FormData();
  formData.append("backup_file", file);

  const response = await apiFetch(`${API_URL}/backup/import/zip?confirm=true`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Cannot import backup zip");
  }

  return response.json();
}