import { API_URL, apiFetch } from "./config";
import { cachedJson, invalidateCache } from "./cache";

async function parseResponse(response, fallbackMessage) {
  if (!response.ok) {
    throw new Error(fallbackMessage);
  }

  return response.json();
}

function invalidateStudentHub() {
  invalidateCache("student-hub");
}

export async function getStudentHubSummary(days = 21) {
  return cachedJson(`student-hub:summary:${days}`, async () => {
    const response = await apiFetch(`${API_URL}/student-hub/summary?days=${days}`);
    return parseResponse(response, "Cannot load student hub summary");
  }, 20_000);
}

export async function getSubjectCenter(subjectId, options = {}) {
  const params = new URLSearchParams();
  if (options.notesLimit) params.set("notes_limit", String(options.notesLimit));
  if (options.notesOffset) params.set("notes_offset", String(options.notesOffset));
  const query = params.toString();
  const cacheKey = `student-hub:subject:${subjectId}:${query}`;

  return cachedJson(cacheKey, async () => {
    const response = await apiFetch(`${API_URL}/student-hub/subjects/${subjectId}${query ? `?${query}` : ""}`);
    return parseResponse(response, "Cannot load subject center");
  }, 20_000);
}

export async function createGradeItem(payload) {
  const response = await apiFetch(`${API_URL}/student-hub/grades`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  invalidateStudentHub();
  return parseResponse(response, "Cannot create grade item");
}

export async function updateGradeItem(gradeId, payload) {
  const response = await apiFetch(`${API_URL}/student-hub/grades/${gradeId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  invalidateStudentHub();
  return parseResponse(response, "Cannot update grade item");
}

export async function deleteGradeItem(gradeId) {
  const response = await apiFetch(`${API_URL}/student-hub/grades/${gradeId}`, {
    method: "DELETE",
  });

  invalidateStudentHub();
  return parseResponse(response, "Cannot delete grade item");
}

export async function createAttendanceRecord(payload) {
  const response = await apiFetch(`${API_URL}/student-hub/attendance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  invalidateStudentHub();
  return parseResponse(response, "Cannot create attendance record");
}

export async function updateAttendanceRecord(recordId, payload) {
  const response = await apiFetch(`${API_URL}/student-hub/attendance/${recordId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  invalidateStudentHub();
  return parseResponse(response, "Cannot update attendance record");
}

export async function deleteAttendanceRecord(recordId) {
  const response = await apiFetch(`${API_URL}/student-hub/attendance/${recordId}`, {
    method: "DELETE",
  });

  invalidateStudentHub();
  return parseResponse(response, "Cannot delete attendance record");
}

export async function createClassNote(subjectId, payload) {
  const response = await apiFetch(`${API_URL}/student-hub/subjects/${subjectId}/class-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  invalidateStudentHub();
  return parseResponse(response, "Cannot create class note");
}

export async function updateClassNote(noteId, payload) {
  const response = await apiFetch(`${API_URL}/student-hub/class-notes/${noteId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  invalidateStudentHub();
  return parseResponse(response, "Cannot update class note");
}

export async function deleteClassNote(noteId) {
  const response = await apiFetch(`${API_URL}/student-hub/class-notes/${noteId}`, {
    method: "DELETE",
  });

  invalidateStudentHub();
  return parseResponse(response, "Cannot delete class note");
}
