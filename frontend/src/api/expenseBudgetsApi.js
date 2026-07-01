import { API_URL, apiFetch } from "./config";

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();

  if (params.month) {
    searchParams.set("month", params.month);
  }

  if (params.year) {
    searchParams.set("year", params.year);
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

export async function getExpenseBudgets(params = {}) {
  const response = await apiFetch(`${API_URL}/expense-budgets/${buildQuery(params)}`);

  if (!response.ok) {
    throw new Error("Cannot load expense budgets");
  }

  return response.json();
}

export async function saveExpenseBudget(budget) {
  const response = await apiFetch(`${API_URL}/expense-budgets/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(budget),
  });

  if (!response.ok) {
    throw new Error("Cannot save expense budget");
  }

  return response.json();
}

export async function updateExpenseBudget(budgetId, budget) {
  const response = await apiFetch(`${API_URL}/expense-budgets/${budgetId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(budget),
  });

  if (!response.ok) {
    throw new Error("Cannot update expense budget");
  }

  return response.json();
}

export async function deleteExpenseBudget(budgetId) {
  const response = await apiFetch(`${API_URL}/expense-budgets/${budgetId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Cannot delete expense budget");
  }

  return response.json();
}
