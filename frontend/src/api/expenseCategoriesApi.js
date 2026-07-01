import { API_URL, apiFetch } from "./config";

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();

  if (params.type) {
    searchParams.set("type", params.type);
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

export async function getExpenseCategories(params = {}) {
  const response = await apiFetch(`${API_URL}/expense-categories/${buildQuery(params)}`);

  if (!response.ok) {
    throw new Error("Cannot load expense categories");
  }

  return response.json();
}

export async function createExpenseCategory(category) {
  const response = await apiFetch(`${API_URL}/expense-categories/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(category),
  });

  if (!response.ok) {
    throw new Error("Cannot create expense category");
  }

  return response.json();
}

export async function updateExpenseCategory(categoryId, category) {
  const response = await apiFetch(`${API_URL}/expense-categories/${categoryId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(category),
  });

  if (!response.ok) {
    throw new Error("Cannot update expense category");
  }

  return response.json();
}

export async function deleteExpenseCategory(categoryId) {
  const response = await apiFetch(`${API_URL}/expense-categories/${categoryId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Cannot delete expense category");
  }

  return response.json();
}
