import { API_URL, apiFetch } from "./config";
import { invalidateCache } from "./cache";

function buildQuery(params) {
  const searchParams = new URLSearchParams();

  if (params?.year) {
    searchParams.set("year", params.year);
  }

  if (params?.month) {
    searchParams.set("month", params.month);
  }

  if (params?.limit) {
    searchParams.set("limit", params.limit);
  }

  if (params?.offset) {
    searchParams.set("offset", params.offset);
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

export async function getExpenses(params = {}) {
  const response = await apiFetch(`${API_URL}/expenses${buildQuery(params)}`);

  if (!response.ok) {
    throw new Error("Cannot load expenses");
  }

  return response.json();
}

export async function getExpenseSummary(params = {}) {
  const response = await apiFetch(`${API_URL}/expenses/summary${buildQuery(params)}`);

  if (!response.ok) {
    throw new Error("Cannot load expense summary");
  }

  return response.json();
}

export async function createExpense(expense) {
  const response = await apiFetch(`${API_URL}/expenses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(expense),
  });

  if (!response.ok) {
    throw new Error("Cannot create expense");
  }

  invalidateCache("dashboard");
  invalidateCache("expenses");
  invalidateCache("student-hub");
  return response.json();
}

export async function updateExpense(expenseId, expense) {
  const response = await apiFetch(`${API_URL}/expenses/${expenseId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(expense),
  });

  if (!response.ok) {
    throw new Error("Cannot update expense");
  }

  invalidateCache("dashboard");
  invalidateCache("expenses");
  invalidateCache("student-hub");
  return response.json();
}

export async function deleteExpense(expenseId) {
  const response = await apiFetch(`${API_URL}/expenses/${expenseId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Cannot delete expense");
  }

  invalidateCache("dashboard");
  invalidateCache("expenses");
  invalidateCache("student-hub");
  return response.json();
}

export async function createSurvivalPlan(data) {
  const response = await apiFetch(`${API_URL}/expenses/survival-plan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Cannot create survival plan");
  }

  return response.json();
}
