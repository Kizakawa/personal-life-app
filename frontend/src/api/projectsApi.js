import { API_URL, apiFetch } from "./config";

export async function getProjects() {
  const response = await apiFetch(`${API_URL}/projects/`);

  if (!response.ok) {
    throw new Error("Cannot load projects");
  }

  return response.json();
}

export async function createProject(project) {
  const response = await apiFetch(`${API_URL}/projects/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(project),
  });

  if (!response.ok) {
    throw new Error("Cannot create project");
  }

  return response.json();
}

export async function updateProject(projectId, project) {
  const response = await apiFetch(`${API_URL}/projects/${projectId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(project),
  });

  if (!response.ok) {
    throw new Error("Cannot update project");
  }

  return response.json();
}

export async function deleteProject(projectId) {
  const response = await apiFetch(`${API_URL}/projects/${projectId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Cannot delete project");
  }

  return response.json();
}