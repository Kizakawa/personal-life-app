import { API_URL, apiFetch } from "./config";

export async function getPeople() {
  const response = await apiFetch(`${API_URL}/people`);

  if (!response.ok) {
    throw new Error("Cannot load people");
  }

  return response.json();
}

export async function createPerson(person) {
  const response = await apiFetch(`${API_URL}/people`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(person),
  });

  if (!response.ok) {
    throw new Error("Cannot create person");
  }

  return response.json();
}

export async function updatePerson(personId, person) {
  const response = await apiFetch(`${API_URL}/people/${personId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(person),
  });

  if (!response.ok) {
    throw new Error("Cannot update person");
  }

  return response.json();
}

export async function deletePerson(personId) {
  const response = await apiFetch(`${API_URL}/people/${personId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Cannot delete person");
  }

  return response.json();
}

export async function markPersonContactToday(personId) {
  const response = await apiFetch(`${API_URL}/people/${personId}/contact-today`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Cannot mark contact today");
  }

  return response.json();
}

export async function getPersonNotes(personId) {
  const response = await apiFetch(`${API_URL}/people/${personId}/notes`);

  if (!response.ok) {
    throw new Error("Cannot load person notes");
  }

  return response.json();
}

export async function createPersonNote(personId, note) {
  const response = await apiFetch(`${API_URL}/people/${personId}/notes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(note),
  });

  if (!response.ok) {
    throw new Error("Cannot create person note");
  }

  return response.json();
}

export async function updatePersonNote(personId, noteId, note) {
  const response = await apiFetch(`${API_URL}/people/${personId}/notes/${noteId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(note),
  });

  if (!response.ok) {
    throw new Error("Cannot update person note");
  }

  return response.json();
}

export async function deletePersonNote(personId, noteId) {
  const response = await apiFetch(`${API_URL}/people/${personId}/notes/${noteId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Cannot delete person note");
  }

  return response.json();
}
