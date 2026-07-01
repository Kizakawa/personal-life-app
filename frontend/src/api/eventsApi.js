import { API_URL, apiFetch } from "./config";

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.append(key, value);
    }
  });

  const queryString = query.toString();

  return queryString ? `?${queryString}` : "";
}

export async function getEvents(params = {}) {
  const response = await apiFetch(`${API_URL}/events${buildQuery(params)}`);

  if (!response.ok) {
    throw new Error("Cannot load events");
  }

  return response.json();
}

export async function createEvent(event) {
  const response = await apiFetch(`${API_URL}/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    throw new Error("Cannot create event");
  }

  return response.json();
}

export async function updateEvent(eventId, event) {
  const response = await apiFetch(`${API_URL}/events/${eventId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    throw new Error("Cannot update event");
  }

  return response.json();
}

export async function deleteEvent(eventId) {
  const response = await apiFetch(`${API_URL}/events/${eventId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Cannot delete event");
  }

  return response.json();
}
