import { useEffect, useMemo, useState } from "react";

import {
  createExpenseCategory,
  deleteExpenseCategory,
  getExpenseCategories,
  updateExpenseCategory,
} from "../api/expenseCategoriesApi";
import { getExpenseBudgets, saveExpenseBudget } from "../api/expenseBudgetsApi";
import {
  createExpense,
  createSurvivalPlan,
  deleteExpense,
  getExpenseSummary,
  getExpenses,
  updateExpense,
} from "../api/expensesApi";
import "./ExpensesPage.css";

const transactionTypes = [
  { value: "expense", label: "Chi tiêu" },
  { value: "income", label: "Thu nhập" },
];

const fallbackCategories = [
  { value: "food", name: "Ăn uống", type: "expense", icon: "AU", color: "#f97316", default_budget: 1500000 },
  { value: "study", name: "Học tập", type: "expense", icon: "HT", color: "#7c3aed", default_budget: 900000 },
  { value: "transport", name: "Đi lại", type: "expense", icon: "DL", color: "#0ea5e9", default_budget: 700000 },
  { value: "entertainment", name: "Giải trí", type: "expense", icon: "GT", color: "#ec4899", default_budget: 600000 },
  { value: "health", name: "Sức khỏe", type: "expense", icon: "SK", color: "#10b981", default_budget: 800000 },
  { value: "salary", name: "Lương / trợ cấp", type: "income", icon: "LT", color: "#16a34a", default_budget: 0 },
  { value: "other", name: "Khác", type: "expense", icon: "KH", color: "#64748b", default_budget: 500000 },
];

const paymentMethods = [
  { value: "cash", label: "Tiền mặt" },
  { value: "bank", label: "Ngân hàng" },
  { value: "ewallet", label: "Ví điện tử" },
];

const initialExpenseForm = {
  transaction_type: "expense",
  amount: "",
  category: "food",
  transaction_date: new Date().toISOString().slice(0, 10),
  payment_method: "cash",
  note: "",
};

const initialSurvivalForm = {
  total_money: "",
  days: "",
  fixed_costs: "0",
  city_level: "medium",
  cooking_available: true,
};

const initialCategoryForm = {
  name: "",
  type: "expense",
  icon: "DM",
  color: "#db2777",
  default_budget: "",
};

const initialBudgetForm = {
  category: "food",
  limit_amount: "",
  note: "",
};

const EXPENSE_PAGE_SIZE = 50;

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
}

function formatCompactMoney(value) {
  const number = Number(value || 0);

  if (Math.abs(number) >= 1000000) {
    return `${(number / 1000000).toFixed(number % 1000000 === 0 ? 0 : 1)}tr`;
  }

  if (Math.abs(number) >= 1000) {
    return `${Math.round(number / 1000)}k`;
  }

  return String(number);
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleDateString("vi-VN");
}

function getCategoryMeta(categories, value) {
  return categories.find((category) => category.value === value) || fallbackCategories.at(-1);
}

function getPaymentLabel(value) {
  return paymentMethods.find((method) => method.value === value)?.label || value;
}

function getTrendMessage(summary, previousMonthExpense) {
  const currentExpense = Number(summary.total_expense || 0);

  if (previousMonthExpense <= 0 && currentExpense > 0) {
    return "Tháng này đã phát sinh chi tiêu, nên bắt đầu theo dõi theo danh mục.";
  }

  if (previousMonthExpense <= 0) {
    return "Chưa đủ dữ liệu tháng trước để so sánh biến động.";
  }

  const diff = currentExpense - previousMonthExpense;
  const percent = Math.abs((diff / previousMonthExpense) * 100).toFixed(0);

  if (diff > 0) {
    return `Chi tiêu tăng ${formatCurrency(diff)} so với tháng trước, tương đương ${percent}%.`;
  }

  if (diff < 0) {
    return `Chi tiêu giảm ${formatCurrency(Math.abs(diff))} so với tháng trước, tương đương ${percent}%.`;
  }

  return "Chi tiêu đang ngang bằng tháng trước.";
}

function buildCategoryBreakdown(expenses, categories) {
  const expenseOnly = expenses.filter((item) => item.transaction_type === "expense");
  const total = expenseOnly.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const map = new Map();

  for (const item of expenseOnly) {
    const current = map.get(item.category) || 0;
    map.set(item.category, current + Number(item.amount || 0));
  }

  return Array.from(map.entries())
    .map(([category, amount]) => {
      const meta = getCategoryMeta(categories, category);

      return {
        category,
        amount,
        label: meta.name,
        icon: meta.icon,
        color: meta.color,
        percent: total > 0 ? Math.round((amount / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

function buildMonthlyTrend(yearExpenses) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const items = yearExpenses.filter((item) => {
      const date = new Date(item.transaction_date);
      return date.getMonth() + 1 === month;
    });

    return {
      month,
      income: items
        .filter((item) => item.transaction_type === "income")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
      expense: items
        .filter((item) => item.transaction_type === "expense")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    };
  });
}

function buildDonutGradient(items) {
  if (items.length === 0) {
    return "conic-gradient(#e5e7eb 0 100%)";
  }

  let current = 0;
  const segments = items.map((item) => {
    const start = current;
    const end = current + item.percent;
    current = end;
    return `${item.color} ${start}% ${end}%`;
  });

  if (current < 100) {
    segments.push(`#e5e7eb ${current}% 100%`);
  }

  return `conic-gradient(${segments.join(", ")})`;
}

function ExpensesPage() {
  const now = new Date();

  const [activeTab, setActiveTab] = useState("overview");
  const [expenses, setExpenses] = useState([]);
  const [yearExpenses, setYearExpenses] = useState([]);
  const [categories, setCategories] = useState(fallbackCategories);
  const [budgets, setBudgets] = useState([]);
  const [summary, setSummary] = useState({
    total_income: 0,
    total_expense: 0,
    balance: 0,
  });
  const [filter, setFilter] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  const [expenseForm, setExpenseForm] = useState(initialExpenseForm);
  const [editingId, setEditingId] = useState(null);
  const [categoryForm, setCategoryForm] = useState(initialCategoryForm);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [budgetForm, setBudgetForm] = useState(initialBudgetForm);
  const [survivalForm, setSurvivalForm] = useState(initialSurvivalForm);
  const [survivalPlan, setSurvivalPlan] = useState(null);
  const [error, setError] = useState("");
  const [hasMoreExpenses, setHasMoreExpenses] = useState(false);
  const [loadingMoreExpenses, setLoadingMoreExpenses] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  const filterParams = useMemo(
    () => ({
      month: Number(filter.month),
      year: Number(filter.year),
    }),
    [filter],
  );

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === "expense"),
    [categories],
  );
  const incomeCategories = useMemo(
    () => categories.filter((category) => category.type === "income"),
    [categories],
  );
  const categoryBreakdown = useMemo(
    () => buildCategoryBreakdown(expenses, categories),
    [expenses, categories],
  );
  const monthlyTrend = useMemo(() => buildMonthlyTrend(yearExpenses), [yearExpenses]);
  const visibleTrend = monthlyTrend;
  const previousMonthExpense = monthlyTrend[Number(filter.month) - 2]?.expense || 0;
  const maxTrendValue = Math.max(...visibleTrend.map((item) => item.expense), 1);
  const biggestExpense = expenses
    .filter((item) => item.transaction_type === "expense")
    .sort((a, b) => Number(b.amount) - Number(a.amount))[0];
  const savingsRate =
    Number(summary.total_income || 0) > 0
      ? Math.round((Number(summary.balance || 0) / Number(summary.total_income || 0)) * 100)
      : 0;

  function getBudgetForCategory(categoryValue) {
    return budgets.find((budget) => budget.category === categoryValue);
  }

  function getLimitForCategory(category) {
    const budget = getBudgetForCategory(category.value);
    return budget ? Number(budget.limit_amount || 0) : Number(category.default_budget || 0);
  }

  async function loadExpenseData() {
    try {
      const [expenseData, summaryData, yearData, categoryData, budgetData] =
        await Promise.all([
          getExpenses({ ...filterParams, limit: EXPENSE_PAGE_SIZE, offset: 0 }),
          getExpenseSummary(filterParams),
          getExpenses({ year: filterParams.year }),
          getExpenseCategories(),
          getExpenseBudgets(filterParams),
        ]);

      setExpenses(expenseData);
      setHasMoreExpenses(expenseData.length === EXPENSE_PAGE_SIZE);
      setSummary(summaryData);
      setYearExpenses(yearData);
      setCategories(categoryData.length > 0 ? categoryData : fallbackCategories);
      setBudgets(budgetData);
      setError("");
    } catch {
      setError("Không tải được dữ liệu chi tiêu.");
    }
  }

  async function handleLoadMoreExpenses() {
    try {
      setLoadingMoreExpenses(true);
      const moreData = await getExpenses({
        ...filterParams,
        limit: EXPENSE_PAGE_SIZE,
        offset: expenses.length,
      });
      setExpenses((current) => [...current, ...moreData]);
      setHasMoreExpenses(moreData.length === EXPENSE_PAGE_SIZE);
    } catch {
      setError("Không tải thêm được giao dịch.");
    } finally {
      setLoadingMoreExpenses(false);
    }
  }

  async function handleExpenseSubmit(e) {
    e.preventDefault();

    const payload = {
      transaction_type: expenseForm.transaction_type,
      amount: Number(expenseForm.amount),
      category: expenseForm.category,
      transaction_date: expenseForm.transaction_date,
      payment_method: expenseForm.payment_method,
      note: expenseForm.note || null,
    };

    try {
      if (editingId) {
        await updateExpense(editingId, payload);
      } else {
        await createExpense(payload);
      }

      setExpenseForm(initialExpenseForm);
      setEditingId(null);
      setShowTransactionForm(false);
      setActiveTab("overview");
      loadExpenseData();
    } catch {
      setError("Không lưu được giao dịch.");
    }
  }

  function handleEditExpense(expense) {
    setEditingId(expense.id);
    setExpenseForm({
      transaction_type: expense.transaction_type,
      amount: String(expense.amount),
      category: expense.category,
      transaction_date: expense.transaction_date,
      payment_method: expense.payment_method,
      note: expense.note || "",
    });
    setActiveTab("transactions");
    setShowTransactionForm(true);
  }

  async function handleDeleteExpense(expenseId) {
    const confirmed = window.confirm("Bạn có chắc muốn xóa giao dịch này?");

    if (!confirmed) {
      return;
    }

    try {
      await deleteExpense(expenseId);
      loadExpenseData();
    } catch {
      setError("Không xóa được giao dịch.");
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setExpenseForm(initialExpenseForm);
    setShowTransactionForm(false);
  }

  async function handleCategorySubmit(e) {
    e.preventDefault();

    const payload = {
      name: categoryForm.name.trim(),
      type: categoryForm.type,
      icon: categoryForm.icon.trim().slice(0, 3).toUpperCase() || "DM",
      color: categoryForm.color,
      default_budget: Number(categoryForm.default_budget || 0),
    };

    try {
      if (editingCategoryId) {
        await updateExpenseCategory(editingCategoryId, payload);
      } else {
        await createExpenseCategory(payload);
      }

      setCategoryForm(initialCategoryForm);
      setEditingCategoryId(null);
      setShowCategoryForm(false);
      loadExpenseData();
    } catch {
      setError("Không lưu được danh mục.");
    }
  }

  function handleEditCategory(category) {
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name,
      type: category.type,
      icon: category.icon,
      color: category.color,
      default_budget: String(category.default_budget || 0),
    });
    setActiveTab("budgets");
    setShowCategoryForm(true);
  }

  async function handleDeleteCategory(categoryId) {
    const confirmed = window.confirm("Bạn có chắc muốn xóa danh mục này?");

    if (!confirmed) {
      return;
    }

    try {
      await deleteExpenseCategory(categoryId);
      loadExpenseData();
    } catch {
      setError("Không xóa được danh mục mặc định hoặc danh mục đã có giao dịch.");
    }
  }

  function handleEditBudget(category) {
    const budget = getBudgetForCategory(category.value);

    setBudgetForm({
      category: category.value,
      limit_amount: String(budget?.limit_amount ?? category.default_budget ?? 0),
      note: budget?.note || "",
    });
    setActiveTab("budgets");
    setShowBudgetForm(true);
  }

  async function handleBudgetSubmit(e) {
    e.preventDefault();

    const payload = {
      category: budgetForm.category,
      month: Number(filter.month),
      year: Number(filter.year),
      limit_amount: Number(budgetForm.limit_amount || 0),
      note: budgetForm.note || null,
    };

    try {
      await saveExpenseBudget(payload);
      setBudgetForm({ ...initialBudgetForm, category: payload.category });
      setShowBudgetForm(false);
      loadExpenseData();
    } catch {
      setError("Không lưu được hạn mức.");
    }
  }

  async function handleSurvivalSubmit(e) {
    e.preventDefault();

    const payload = {
      total_money: Number(survivalForm.total_money),
      days: Number(survivalForm.days),
      fixed_costs: Number(survivalForm.fixed_costs || 0),
      city_level: survivalForm.city_level,
      cooking_available: survivalForm.cooking_available,
    };

    try {
      const data = await createSurvivalPlan(payload);
      setSurvivalPlan(data);
      setError("");
    } catch {
      setError("Không tạo được kế hoạch sinh tồn tài chính.");
    }
  }

  function openTransactionForm() {
    setEditingId(null);
    setExpenseForm(initialExpenseForm);
    setShowTransactionForm(true);
    setActiveTab("transactions");
  }

  function openCategoryForm() {
    setEditingCategoryId(null);
    setCategoryForm(initialCategoryForm);
    setShowCategoryForm(true);
    setActiveTab("budgets");
  }

  function openBudgetForm() {
    const firstCategory = expenseCategories[0] || fallbackCategories[0];
    const budget = getBudgetForCategory(firstCategory.value);

    setBudgetForm({
      category: firstCategory.value,
      limit_amount: String(budget?.limit_amount ?? firstCategory.default_budget ?? 0),
      note: budget?.note || "",
    });
    setShowBudgetForm(true);
    setActiveTab("budgets");
  }

  useEffect(() => {
    loadExpenseData();
  }, [filterParams]);

  useEffect(() => {
    function handleExpensesChanged() {
      loadExpenseData();
    }

    window.addEventListener("personal-life:expenses-changed", handleExpensesChanged);

    return () => {
      window.removeEventListener("personal-life:expenses-changed", handleExpensesChanged);
    };
  }, [filterParams]);

  return (
    <div className="expenses-page">
      <header className="expense-hero">
        <div>
          <p className="expense-eyebrow">Finance Center</p>
          <h2>Quản lý chi tiêu</h2>
          <p>
            Theo dõi dòng tiền, phân loại khoản chi và kiểm soát ngân sách tháng
            theo cách rõ ràng hơn.
          </p>
        </div>

        <div className="month-switcher">
          <button
            type="button"
            onClick={() =>
              setFilter((current) => ({
                ...current,
                month: Math.max(Number(current.month) - 1, 1),
              }))
            }
          >
            {"<"}
          </button>

          <div>
            <span>Tháng đang xem</span>
            <strong>
              Tháng {filter.month}/{filter.year}
            </strong>
          </div>

          <button
            type="button"
            onClick={() =>
              setFilter((current) => ({
                ...current,
                month: Math.min(Number(current.month) + 1, 12),
              }))
            }
          >
            {">"}
          </button>
        </div>
      </header>

      {error && <p className="error-message">{error}</p>}

      <nav className="expense-tabs">
        {[
          { id: "overview", label: "Tổng quan" },
          { id: "transactions", label: "Giao dịch" },
          { id: "trends", label: "Biến động" },
          { id: "budgets", label: "Ngân sách & danh mục" },
          { id: "survival", label: "Sinh tồn" },
        ].map((tab) => (
          <button
            className={activeTab === tab.id ? "active" : ""}
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" && (
        <>
          <section className="finance-kpi-grid">
            <article className="finance-kpi expense">
              <span>Tổng chi</span>
              <strong>{formatCurrency(summary.total_expense)}</strong>
              <small>{getTrendMessage(summary, previousMonthExpense)}</small>
            </article>

            <article className="finance-kpi income">
              <span>Tổng thu</span>
              <strong>{formatCurrency(summary.total_income)}</strong>
              <small>Thu nhập ghi nhận trong tháng đang xem.</small>
            </article>

            <article className="finance-kpi balance">
              <span>Số dư</span>
              <strong>{formatCurrency(summary.balance)}</strong>
              <small>Tỷ lệ giữ lại: {savingsRate}%</small>
            </article>
          </section>

          <section className="expense-overview-grid">
            <article className="expense-panel category-panel">
              <div className="expense-panel-title">
                <div>
                  <p>Tình hình thu chi</p>
                  <h3>Phân bổ chi tiêu</h3>
                </div>
                <span>{categoryBreakdown.length} danh mục</span>
              </div>

              <div className="donut-layout">
                <div
                  className="expense-donut"
                  style={{ background: buildDonutGradient(categoryBreakdown) }}
                >
                  <div>
                    <span>Tổng chi</span>
                    <strong>{formatCompactMoney(summary.total_expense)}</strong>
                  </div>
                </div>

                <div className="category-breakdown">
                  {categoryBreakdown.length === 0 ? (
                    <p className="empty">Chưa có dữ liệu phân bổ.</p>
                  ) : (
                    categoryBreakdown.map((item) => (
                      <div className="category-row" key={item.category}>
                        <span className="category-dot" style={{ background: item.color }} />
                        <div>
                          <strong>{item.label}</strong>
                          <small>{item.percent}% tổng chi</small>
                        </div>
                        <b>{formatCurrency(item.amount)}</b>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </article>

            <article className="expense-panel insight-panel">
              <div className="expense-panel-title">
                <div>
                  <p>Điểm cần chú ý</p>
                  <h3>Nhận xét tháng này</h3>
                </div>
              </div>

              <div className="insight-list">
                <article>
                  <span>Biến động</span>
                  <strong>{getTrendMessage(summary, previousMonthExpense)}</strong>
                </article>

                <article>
                  <span>Khoản chi lớn nhất</span>
                  <strong>
                    {biggestExpense
                      ? `${getCategoryMeta(categories, biggestExpense.category).name} - ${formatCurrency(biggestExpense.amount)}`
                      : "Chưa có khoản chi"}
                  </strong>
                </article>

                <article>
                  <span>Danh mục chi nhiều nhất</span>
                  <strong>
                    {categoryBreakdown[0]
                      ? `${categoryBreakdown[0].label} chiếm ${categoryBreakdown[0].percent}%`
                      : "Chưa có dữ liệu"}
                  </strong>
                </article>
              </div>
            </article>
          </section>

          <section className="expense-panel budget-panel">
            <div className="expense-panel-title">
              <div>
                <p>Ngân sách chi tiêu</p>
                <h3>Theo dõi hạn mức danh mục</h3>
              </div>
              <button type="button" onClick={openBudgetForm}>
                Chỉnh hạn mức
              </button>
            </div>

            <div className="budget-card-row">
              {expenseCategories.slice(0, 4).map((category) => {
                const spent =
                  categoryBreakdown.find((item) => item.category === category.value)?.amount || 0;
                const limit = getLimitForCategory(category);
                const percent = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
                const remaining = limit - spent;
                const overBudget = limit > 0 && remaining < 0;

                return (
                  <article className={overBudget ? "budget-card over" : "budget-card"} key={category.value}>
                    <span className="budget-icon" style={{ color: category.color }}>
                      {category.icon}
                    </span>
                    <h4>{category.name}</h4>
                    <div className="budget-ring">
                      <span style={{ width: `${percent}%`, background: category.color }} />
                    </div>
                    <p>{limit > 0 ? (overBudget ? "Đã vượt" : "Còn lại") : "Chưa đặt hạn mức"}</p>
                    <strong>{limit > 0 ? formatCurrency(Math.abs(remaining)) : "Thiết lập"}</strong>
                  </article>
                );
              })}
              {expenseCategories.length > 4 && (
                <button className="budget-more-card" type="button" onClick={() => setActiveTab("budgets")}>
                  <span>+{expenseCategories.length - 4}</span>
                  Xem tất cả danh mục
                </button>
              )}
            </div>
          </section>
        </>
      )}

      {activeTab === "transactions" && (
        <section className={`transaction-layout transaction-workspace ${showTransactionForm ? "with-form" : "list-only"}`}>
          {showTransactionForm && (
          <form className="expense-form-panel" onSubmit={handleExpenseSubmit}>
            <div className="expense-panel-title">
              <div>
                <p>Ghi chép giao dịch</p>
                <h3>{editingId ? "Sửa giao dịch" : "Nhập giao dịch mới"}</h3>
              </div>
            </div>

            <div className="type-toggle">
              {transactionTypes.map((type) => (
                <button
                  className={expenseForm.transaction_type === type.value ? "active" : ""}
                  key={type.value}
                  type="button"
                  onClick={() =>
                    setExpenseForm({
                      ...expenseForm,
                      transaction_type: type.value,
                      category:
                        type.value === "income"
                          ? incomeCategories[0]?.value || "salary"
                          : expenseCategories[0]?.value || "food",
                    })
                  }
                >
                  {type.label}
                </button>
              ))}
            </div>

            <label>
              Số tiền
              <input
                type="number"
                min="1"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                placeholder="Ví dụ: 35000"
                required
              />
            </label>

            <label>
              Danh mục
              <select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
              >
                {(expenseForm.transaction_type === "income" ? incomeCategories : expenseCategories).map(
                  (category) => (
                    <option key={category.value} value={category.value}>
                      {category.name}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              Ngày giao dịch
              <input
                type="date"
                value={expenseForm.transaction_date}
                onChange={(e) =>
                  setExpenseForm({
                    ...expenseForm,
                    transaction_date: e.target.value,
                  })
                }
                required
              />
            </label>

            <label>
              Phương thức
              <select
                value={expenseForm.payment_method}
                onChange={(e) =>
                  setExpenseForm({
                    ...expenseForm,
                    payment_method: e.target.value,
                  })
                }
              >
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Ghi chú
              <textarea
                value={expenseForm.note}
                onChange={(e) => setExpenseForm({ ...expenseForm, note: e.target.value })}
                placeholder="Ví dụ: ăn trưa, mua giáo trình, tiền xe..."
              />
            </label>

            <div className="form-actions">
              <button className="primary-button" type="submit">
                {editingId ? "Cập nhật giao dịch" : "Lưu giao dịch"}
              </button>

              {editingId && (
                <button className="secondary-button" type="button" onClick={cancelEdit}>
                  Hủy sửa
                </button>
              )}
              {!editingId && (
                <button className="secondary-button" type="button" onClick={() => setShowTransactionForm(false)}>
                  Đóng
                </button>
              )}
            </div>
          </form>
          )}

          <section className="expense-panel">
            <div className="expense-panel-title">
              <div>
                <p>Lịch sử</p>
                <h3>Danh sách giao dịch</h3>
              </div>

              <div className="filter-row">
                <button className="expense-inline-add" type="button" onClick={openTransactionForm}>
                  + Thêm
                </button>
                <select
                  value={filter.month}
                  onChange={(e) => setFilter({ ...filter, month: Number(e.target.value) })}
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                    <option key={month} value={month}>
                      Tháng {month}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  value={filter.year}
                  onChange={(e) => setFilter({ ...filter, year: Number(e.target.value) })}
                />
              </div>
            </div>

            {expenses.length === 0 ? (
              <p className="empty">Chưa có giao dịch trong tháng này.</p>
            ) : (
              <div className="modern-transaction-list">
                {expenses.map((expense) => {
                  const meta = getCategoryMeta(categories, expense.category);

                  return (
                    <article className="modern-transaction-card" key={expense.id}>
                      <div className="transaction-icon" style={{ color: meta.color }}>
                        {meta.icon}
                      </div>

                      <div className="transaction-main">
                        <h4>{meta.name}</h4>
                        <p>
                          {formatDate(expense.transaction_date)} - {getPaymentLabel(expense.payment_method)}
                        </p>
                        {expense.note && <small>{expense.note}</small>}
                      </div>

                      <div className="transaction-side">
                        <strong
                          className={
                            expense.transaction_type === "income" ? "money-income" : "money-expense"
                          }
                        >
                          {expense.transaction_type === "income" ? "+" : "-"}
                          {formatCurrency(expense.amount)}
                        </strong>

                        <div className="transaction-actions">
                          <button type="button" onClick={() => handleEditExpense(expense)}>
                            Sửa
                          </button>
                          <button type="button" onClick={() => handleDeleteExpense(expense.id)}>
                            Xóa
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            {hasMoreExpenses && (
              <button
                className="secondary-button expense-load-more-button"
                type="button"
                onClick={handleLoadMoreExpenses}
                disabled={loadingMoreExpenses}
              >
                {loadingMoreExpenses ? "Đang tải..." : `Tải thêm ${EXPENSE_PAGE_SIZE} giao dịch`}
              </button>
            )}
          </section>
        </section>
      )}

      {activeTab === "trends" && (
        <section className="expense-panel trend-panel">
          <div className="expense-panel-title">
            <div>
              <p>Biến động thu chi</p>
              <h3>Chi tiêu theo tháng trong năm {filter.year}</h3>
            </div>

            <input
              type="number"
              value={filter.year}
              onChange={(e) => setFilter({ ...filter, year: Number(e.target.value) })}
            />
          </div>

          <div className="trend-chart">
            {visibleTrend.map((item) => (
              <div
                className={`trend-column ${item.month === Number(filter.month) ? "active" : ""}`}
                key={item.month}
              >
                <span>{formatCompactMoney(item.expense)}</span>
                <div>
                  <b
                    style={{
                      height: `${Math.max((item.expense / maxTrendValue) * 100, item.expense > 0 ? 8 : 0)}%`,
                    }}
                  />
                </div>
                <small>T{item.month}</small>
              </div>
            ))}
          </div>

          <div className="trend-summary-grid">
            <article>
              <span>Tổng chi năm đang xem</span>
              <strong>
                {formatCurrency(monthlyTrend.reduce((sum, item) => sum + item.expense, 0))}
              </strong>
            </article>
            <article>
              <span>Tổng thu năm đang xem</span>
              <strong>
                {formatCurrency(monthlyTrend.reduce((sum, item) => sum + item.income, 0))}
              </strong>
            </article>
            <article>
              <span>Tháng chi cao nhất</span>
              <strong>
                T
                {
                  monthlyTrend.reduce(
                    (highest, item) => (item.expense > highest.expense ? item : highest),
                    monthlyTrend[0],
                  ).month
                }
              </strong>
            </article>
          </div>
        </section>
      )}

      {activeTab === "budgets" && (
        <section className={`transaction-layout budget-workspace ${showBudgetForm || showCategoryForm ? "with-form" : "list-only"}`}>
          <section className="expense-panel">
            <div className="expense-panel-title">
              <div>
                <p>Danh sách hạn mức</p>
                <h3>Tháng {filter.month}/{filter.year}</h3>
              </div>
              <div className="expense-title-actions">
                <button type="button" onClick={openBudgetForm}>
                  Chỉnh hạn mức
                </button>
                <button type="button" onClick={openCategoryForm}>
                  + Danh mục
                </button>
              </div>
            </div>

            <div className="budget-management-list">
              {expenseCategories.map((category) => {
                const spent =
                  categoryBreakdown.find((item) => item.category === category.value)?.amount || 0;
                const limit = getLimitForCategory(category);
                const budget = getBudgetForCategory(category.value);
                const remaining = limit - spent;
                const percent = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;

                return (
                  <article className="budget-management-card" key={category.value}>
                    <span className="budget-icon" style={{ color: category.color }}>
                      {category.icon}
                    </span>
                    <div>
                      <h4>{category.name}</h4>
                      <p>
                        {budget ? "Hạn mức đã lưu" : "Đang dùng hạn mức đề xuất"} - đã chi{" "}
                        {formatCurrency(spent)}
                      </p>
                      <div className="budget-ring">
                        <span style={{ width: `${percent}%`, background: category.color }} />
                      </div>
                    </div>
                    <strong className={remaining < 0 ? "money-expense" : ""}>
                      {limit > 0 ? formatCurrency(Math.abs(remaining)) : "Chưa đặt"}
                    </strong>
                    <button type="button" onClick={() => handleEditBudget(category)}>
                      Chỉnh
                    </button>
                    <button type="button" onClick={() => handleEditCategory(category)}>
                      Danh mục
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          {(showBudgetForm || showCategoryForm) && (
          <aside className="budget-side-stack">
            {showBudgetForm && (
            <form className="expense-form-panel compact-form" onSubmit={handleBudgetSubmit}>
              <div className="expense-panel-title">
                <div>
                  <p>Hạn mức</p>
                  <h3>Chỉnh ngân sách</h3>
                </div>
              </div>

              <label>
                Danh mục
                <select
                  value={budgetForm.category}
                  onChange={(e) => {
                    const category = getCategoryMeta(categories, e.target.value);
                    const budget = getBudgetForCategory(e.target.value);

                    setBudgetForm({
                      category: e.target.value,
                      limit_amount: String(budget?.limit_amount ?? category.default_budget ?? 0),
                      note: budget?.note || "",
                    });
                  }}
                >
                  {expenseCategories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Hạn mức tháng {filter.month}/{filter.year}
                <input
                  type="number"
                  min="0"
                  value={budgetForm.limit_amount}
                  onChange={(e) => setBudgetForm({ ...budgetForm, limit_amount: e.target.value })}
                  placeholder="Ví dụ: 1500000"
                />
              </label>

              <label>
                Ghi chú ngân sách
                <textarea
                  value={budgetForm.note}
                  onChange={(e) => setBudgetForm({ ...budgetForm, note: e.target.value })}
                  placeholder="Ví dụ: giảm ăn ngoài..."
                />
              </label>

              <button className="primary-button" type="submit">
                Lưu hạn mức
              </button>
              <button className="secondary-button" type="button" onClick={() => setShowBudgetForm(false)}>
                Đóng
              </button>
            </form>
            )}

            {showCategoryForm && (
            <form className="expense-form-panel compact-form" onSubmit={handleCategorySubmit}>
              <div className="expense-panel-title">
                <div>
                  <p>Danh mục</p>
                  <h3>{editingCategoryId ? "Sửa danh mục" : "Thêm danh mục"}</h3>
                </div>
              </div>

              <label>
                Tên danh mục
                <input
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="Ví dụ: Ăn vặt"
                  required
                />
              </label>

              <label>
                Loại danh mục
                <select
                  value={categoryForm.type}
                  onChange={(e) => setCategoryForm({ ...categoryForm, type: e.target.value })}
                >
                  <option value="expense">Chi tiêu</option>
                  <option value="income">Thu nhập</option>
                </select>
              </label>

              <div className="form-two-columns">
                <label>
                  Ký hiệu
                  <input
                    value={categoryForm.icon}
                    maxLength="3"
                    onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                    placeholder="AV"
                  />
                </label>

                <label>
                  Màu
                  <input
                    type="color"
                    value={categoryForm.color}
                    onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                  />
                </label>
              </div>

              <label>
                Hạn mức đề xuất
                <input
                  type="number"
                  min="0"
                  value={categoryForm.default_budget}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, default_budget: e.target.value })
                  }
                  placeholder="Ví dụ: 500000"
                />
              </label>

              <div className="form-actions">
                <button className="primary-button" type="submit">
                  {editingCategoryId ? "Cập nhật" : "Thêm danh mục"}
                </button>

                {editingCategoryId && (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setEditingCategoryId(null);
                      setCategoryForm(initialCategoryForm);
                      setShowCategoryForm(false);
                    }}
                  >
                    Hủy
                  </button>
                )}
                {!editingCategoryId && (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setShowCategoryForm(false)}
                  >
                    Đóng
                  </button>
                )}
              </div>
            </form>
            )}

            <section className="expense-panel compact-category-panel">
              <div className="expense-panel-title">
                <div>
                  <p>Phân loại</p>
                  <h3>Danh mục hiện có</h3>
                </div>
              </div>

              <div className="category-management-list compact">
                {categories.map((category) => (
                  <article className="category-management-card" key={category.value}>
                    <span style={{ color: category.color }}>{category.icon}</span>
                    <div>
                      <h4>{category.name}</h4>
                      <p>
                        {category.type === "income" ? "Thu nhập" : "Chi tiêu"} - đề xuất{" "}
                        {formatCurrency(category.default_budget)}
                      </p>
                    </div>
                    <button type="button" onClick={() => handleEditCategory(category)}>
                      Sửa
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(category.is_default)}
                      onClick={() => handleDeleteCategory(category.id)}
                    >
                      Xóa
                    </button>
                  </article>
                ))}
              </div>
            </section>
          </aside>
          )}
        </section>
      )}

      {activeTab === "survival" && (
        <section className="transaction-layout">
          <form className="expense-form-panel" onSubmit={handleSurvivalSubmit}>
            <div className="expense-panel-title">
              <div>
                <p>Sinh tồn tài chính</p>
                <h3>Lập kế hoạch cơ bản</h3>
              </div>
            </div>

            <label>
              Số tiền hiện có
              <input
                type="number"
                min="1"
                value={survivalForm.total_money}
                onChange={(e) =>
                  setSurvivalForm({
                    ...survivalForm,
                    total_money: e.target.value,
                  })
                }
                placeholder="Ví dụ: 500000"
                required
              />
            </label>

            <label>
              Số ngày cần sống
              <input
                type="number"
                min="1"
                value={survivalForm.days}
                onChange={(e) => setSurvivalForm({ ...survivalForm, days: e.target.value })}
                placeholder="Ví dụ: 7"
                required
              />
            </label>

            <label>
              Chi phí cố định cần trừ trước
              <input
                type="number"
                min="0"
                value={survivalForm.fixed_costs}
                onChange={(e) =>
                  setSurvivalForm({
                    ...survivalForm,
                    fixed_costs: e.target.value,
                  })
                }
                placeholder="Ví dụ: tiền xe, tiền phòng..."
              />
            </label>

            <label>
              Mức chi phí khu vực
              <select
                value={survivalForm.city_level}
                onChange={(e) =>
                  setSurvivalForm({
                    ...survivalForm,
                    city_level: e.target.value,
                  })
                }
              >
                <option value="low">Thấp</option>
                <option value="medium">Trung bình</option>
                <option value="high">Cao</option>
              </select>
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={survivalForm.cooking_available}
                onChange={(e) =>
                  setSurvivalForm({
                    ...survivalForm,
                    cooking_available: e.target.checked,
                  })
                }
              />
              Có thể tự nấu ăn
            </label>

            <button className="primary-button" type="submit">
              Tạo kế hoạch
            </button>
          </form>

          <section className="expense-panel">
            <div className="expense-panel-title">
              <div>
                <p>Kết quả</p>
                <h3>Phân bổ sinh tồn</h3>
              </div>
              <span>AI sẽ nâng cấp sau</span>
            </div>

            {!survivalPlan ? (
              <p className="empty">
                Nhập số tiền và số ngày để hệ thống tính kế hoạch sinh tồn.
              </p>
            ) : (
              <div className="survival-result">
                <div className="survival-overview">
                  <article>
                    <span>Tiền dùng được</span>
                    <strong>{formatCurrency(survivalPlan.available_money)}</strong>
                  </article>

                  <article>
                    <span>Ngân sách/ngày</span>
                    <strong>{formatCurrency(survivalPlan.daily_budget)}</strong>
                  </article>

                  <article>
                    <span>Mức rủi ro</span>
                    <strong>{survivalPlan.risk_level}</strong>
                  </article>
                </div>

                <p className="risk-message">{survivalPlan.risk_message}</p>

                <div className="survival-category-list">
                  {survivalPlan.categories.map((category) => (
                    <article className="survival-category" key={category.name}>
                      <div>
                        <h5>{category.name}</h5>
                        <p>{category.note}</p>
                      </div>

                      <div>
                        <strong>{formatCurrency(category.daily_amount)}/ngày</strong>
                        <small>Tổng: {formatCurrency(category.total_amount)}</small>
                      </div>
                    </article>
                  ))}
                </div>

                <ul className="suggestion-list">
                  {survivalPlan.suggestions.map((suggestion) => (
                    <li key={suggestion}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </section>
      )}
    </div>
  );
}

export default ExpensesPage;
