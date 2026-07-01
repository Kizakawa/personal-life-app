import { API_URL, apiFetch } from "./config";

export async function getSubjects() {
  const response = await apiFetch(`${API_URL}/subjects/`);

  if (!response.ok) {
    throw new Error("Cannot load subjects");
  }

  return response.json();
}

export async function createSubject(subject) {
  const response = await apiFetch(`${API_URL}/subjects/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(subject),
  });

  if (!response.ok) {
    throw new Error("Cannot create subject");
  }

  return response.json();
}

export async function updateSubject(subjectId, subject) {
  const response = await apiFetch(`${API_URL}/subjects/${subjectId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(subject),
  });

  if (!response.ok) {
    throw new Error("Cannot update subject");
  }

  return response.json();
}

export async function deleteSubject(subjectId) {
  const response = await apiFetch(`${API_URL}/subjects/${subjectId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Cannot delete subject");
  }

  return response.json();
}
