import { useEffect, useMemo, useState } from "react";
import { getDashboardSummary } from "../api/dashboardApi";
import "./DashboardPage.css";

const chartColors = ["#2563eb", "#0f766e", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];

function formatMoney(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "0đ";
  }

  return `${Math.round(Number(value)).toLocaleString("vi-VN")}đ`;
}

function formatTime(value) {
  if (!value) return "--:--";
  return String(value).slice(0, 5);
}

function renderPriority(priority) {
  const map = {
    high: "Cao",
    medium: "Trung bình",
    low: "Thấp",
  };

  return map[priority] || priority || "Không rõ";
}

function renderStatus(status) {
  const map = {
    pending: "Chưa làm",
    doing: "Đang làm",
    almost_done: "Gần xong",
    done: "Đã xong",
    active: "Đang theo dõi",
    review: "Cần xem lại",
  };

  return map[status] || status || "Không rõ";
}

function renderProgressStatus(status) {
  const map = {
    not_started: "Chưa học",
    studying: "Đang học",
    reviewed: "Đã ôn",
    needs_review: "Cần xem lại",
  };

  return map[status] || status || "Không rõ";
}

function renderDaysLeft(daysLeft) {
  if (daysLeft === null || daysLeft === undefined) return "Chưa có hạn";
  if (daysLeft < 0) return `Quá hạn ${Math.abs(daysLeft)} ngày`;
  if (daysLeft === 0) return "Hạn hôm nay";
  return `Còn ${daysLeft} ngày`;
}

function getPriorityClass(priority) {
  if (priority === "high") return "danger";
  if (priority === "medium") return "warning";
  return "neutral";
}

function getCompletionPercent(stats) {
  if (!stats?.total) return 0;
  return Math.round(((stats.done || 0) / stats.total) * 100);
}

function getPrimaryFocus({
  todayTasks,
  upcomingDeadlines,
  todaySchedules,
  activeProjects,
  finance,
}) {
  const urgentDeadline = upcomingDeadlines.find((item) => item.daysLeft <= 1);

  if (urgentDeadline) {
    return {
      tone: "danger",
      label: "Ưu tiên khẩn",
      title: urgentDeadline.title,
      detail: `${urgentDeadline.subject || "Deadline"} - ${renderDaysLeft(urgentDeadline.daysLeft)}`,
    };
  }

  if (Number(finance.summary?.balance || 0) < 0) {
    return {
      tone: "danger",
      label: "Cảnh báo tài chính",
      title: "Số dư tháng đang âm",
      detail: "Nên khóa chi tiêu không thiết yếu trong vài ngày tới.",
    };
  }

  if (todayTasks.length > 0) {
    return {
      tone: "blue",
      label: "Việc nên làm trước",
      title: todayTasks[0].title,
      detail: `${renderStatus(todayTasks[0].status)} - Ưu tiên ${renderPriority(todayTasks[0].priority)}`,
    };
  }

  if (todaySchedules.length > 0) {
    return {
      tone: "blue",
      label: "Lịch gần nhất",
      title: todaySchedules[0].title,
      detail: `${formatTime(todaySchedules[0].startTime)} - ${formatTime(todaySchedules[0].endTime)}`,
    };
  }

  if (activeProjects.length > 0) {
    return {
      tone: "neutral",
      label: "Dự án nên kiểm tra",
      title: activeProjects[0].name,
      detail: renderDaysLeft(activeProjects[0].daysLeft),
    };
  }

  return {
    tone: "stable",
    label: "Trạng thái ổn",
    title: "Hôm nay chưa có việc gấp",
    detail: "Có thể dùng thời gian để ôn tập, dọn tài liệu hoặc lên kế hoạch.",
  };
}

function getTrendActivity(data) {
  return data.filter((item) => Number(item.income || 0) > 0 || Number(item.expense || 0) > 0);
}

function StatCard({ icon, label, value, hint, tone = "blue" }) {
  return (
    <article className={`dash-stat ${tone}`}>
      <div className="stat-heading">
        <span className="stat-icon">{icon}</span>
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <small>{hint}</small>
    </article>
  );
}

function Panel({ title, subtitle, children, className = "" }) {
  return (
    <section className={`dash-panel ${className}`}>
      <div className="panel-title-row">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ children }) {
  return <div className="dash-empty">{children}</div>;
}

function MonthlyBarChart({ data }) {
  const activeMonths = getTrendActivity(data);
  const maxValue = Math.max(
    1,
    ...data.map((item) => Math.max(Number(item.income || 0), Number(item.expense || 0))),
  );

  if (activeMonths.length < 2) {
    const totalIncome = data.reduce((sum, item) => sum + Number(item.income || 0), 0);
    const totalExpense = data.reduce((sum, item) => sum + Number(item.expense || 0), 0);

    return (
      <div className="trend-empty">
        <div>
          <span>Thu trong năm</span>
          <strong className="money-income">{formatMoney(totalIncome)}</strong>
        </div>
        <div>
          <span>Chi trong năm</span>
          <strong className="money-expense">{formatMoney(totalExpense)}</strong>
        </div>
        <p>Cần thêm giao dịch ở nhiều tháng hơn để biểu đồ xu hướng có ý nghĩa.</p>
      </div>
    );
  }

  return (
    <div className="bar-chart">
      {data.map((item) => (
        <div className="bar-group" key={item.month}>
          <div className="bar-pair">
            <span
              className="bar income"
              style={{ height: `${Math.max((Number(item.income || 0) / maxValue) * 100, 4)}%` }}
              title={`Thu: ${formatMoney(item.income)}`}
            />
            <span
              className="bar expense"
              style={{ height: `${Math.max((Number(item.expense || 0) / maxValue) * 100, 4)}%` }}
              title={`Chi: ${formatMoney(item.expense)}`}
            />
          </div>
          <small>{item.label}</small>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data }) {
  const total = data.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  let current = 0;

  const gradient = data
    .map((item, index) => {
      const value = total > 0 ? (Number(item.amount || 0) / total) * 100 : 0;
      const start = current;
      const end = current + value;
      current = end;

      return `${chartColors[index % chartColors.length]} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className="donut-wrap">
      <div
        className="donut-chart"
        style={{
          background: total > 0 ? `conic-gradient(${gradient})` : "#e5e7eb",
        }}
      >
        <div>
          <strong>{formatMoney(total)}</strong>
          <span>Tổng chi</span>
        </div>
      </div>

      <div className="donut-legend">
        {data.length === 0 ? (
          <EmptyState>Chưa có chi tiêu trong tháng.</EmptyState>
        ) : (
          data.slice(0, 5).map((item, index) => (
            <div className="legend-row" key={item.key || item.label}>
              <span
                className="legend-dot"
                style={{ background: chartColors[index % chartColors.length] }}
              />
              <span>{item.label}</span>
              <strong>{formatMoney(item.amount)}</strong>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ExpenseBreakdown({ data, summary }) {
  if (data.length <= 1) {
    const onlyCategory = data[0];

    return (
      <div className="expense-summary-card">
        <div>
          <span>Chi tháng này</span>
          <strong className="money-expense">{formatMoney(summary?.totalExpense)}</strong>
          <p>
            {onlyCategory
              ? `${onlyCategory.label} chiếm toàn bộ dữ liệu hiện tại.`
              : "Chưa có khoản chi nào trong tháng."}
          </p>
        </div>
        <div className="expense-meter">
          <span style={{ width: Number(summary?.totalExpense || 0) > 0 ? "100%" : "0%" }} />
        </div>
      </div>
    );
  }

  return <DonutChart data={data} />;
}

function ProgressRing({ value, label, caption }) {
  const safeValue = Math.max(0, Math.min(Number(value || 0), 100));

  return (
    <div className="progress-ring-card">
      <div
        className="progress-ring"
        style={{ background: `conic-gradient(#2563eb ${safeValue}%, #e5e7eb 0)` }}
      >
        <div>
          <strong>{safeValue}%</strong>
          <span>{label}</span>
        </div>
      </div>
      <p>{caption}</p>
    </div>
  );
}

function WorkloadChart({ data }) {
  const maxValue = Math.max(1, ...data.map((item) => Number(item.total || 0)));

  return (
    <div className="workload-chart">
      {data.map((item) => (
        <div className="workload-day" key={item.date}>
          <div className="workload-bar-track">
            <span
              className={item.total > 0 ? "workload-bar active" : "workload-bar"}
              style={{ height: `${Math.max((Number(item.total || 0) / maxValue) * 100, 8)}%` }}
            />
          </div>
          <strong>{item.total}</strong>
          <small>{item.label}</small>
        </div>
      ))}
    </div>
  );
}

function DashboardPage({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showStarter, setShowStarter] = useState(() => {
    return localStorage.getItem("personal-life:v14-starter-hidden") !== "1";
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    function handleRefreshNeeded() {
      loadDashboard();
    }

    window.addEventListener("personal-life:tasks-changed", handleRefreshNeeded);
    window.addEventListener("personal-life:expenses-changed", handleRefreshNeeded);

    return () => {
      window.removeEventListener("personal-life:tasks-changed", handleRefreshNeeded);
      window.removeEventListener("personal-life:expenses-changed", handleRefreshNeeded);
    };
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const result = await getDashboardSummary();
      setData(result);
    } catch (error) {
      console.error("Lỗi tải dashboard:", error);
      alert("Không tải được Dashboard. Kiểm tra backend đã chạy chưa.");
    } finally {
      setLoading(false);
    }
  };

  const dashboardData = useMemo(() => {
    const fallbackFinance = {
      summary: { totalIncome: 0, totalExpense: 0, balance: 0 },
      survival: { availableMoney: 0, days: 0, safeDailyBudget: 0, riskLevel: "stable" },
      monthlyTrend: [],
      categoryBreakdown: [],
      recentTransactions: [],
    };

    return {
      overview: data?.overview || {},
      todaySchedules: data?.todaySchedules || data?.today?.schedules || [],
      todayTasks: data?.todayTasks || data?.today?.tasks || [],
      upcomingDeadlines: data?.upcomingDeadlines || [],
      activeProjects: data?.activeProjects || [],
      subjectsNeedReview: data?.subjectsNeedReview || [],
      recentFiles: data?.recentFiles || [],
      reminders: data?.importantReminders || [],
      studentActions: data?.studentActions || [],
      finance: data?.finance || {
        ...fallbackFinance,
        summary: data?.expenseSummary || fallbackFinance.summary,
        survival: data?.survivalSummary || fallbackFinance.survival,
      },
      productivity: data?.productivity || {},
      weekWorkload: data?.weekWorkload || [],
      focus: data?.focus || {},
      gamification: data?.gamification || {},
    };
  }, [data]);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-skeleton">Đang tải Dashboard...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="dashboard-page">
        <EmptyState>Không có dữ liệu dashboard.</EmptyState>
      </div>
    );
  }

  const {
    overview,
    todaySchedules,
    todayTasks,
    upcomingDeadlines,
    activeProjects,
    subjectsNeedReview,
    recentFiles,
    reminders,
    studentActions,
    finance,
    productivity,
    weekWorkload,
    focus,
    gamification,
  } = dashboardData;

  const taskPercent = getCompletionPercent(productivity.tasks);
  const deadlinePercent = getCompletionPercent(productivity.deadlines);
  const projectPercent = getCompletionPercent(productivity.projects);
  const monthlyTrend = finance.monthlyTrend || [];
  const hasTrendData = getTrendActivity(monthlyTrend).length >= 2;
  const todayText = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const primaryFocus = getPrimaryFocus({
    todayTasks,
    upcomingDeadlines,
    todaySchedules,
    activeProjects,
    finance,
  });

  function hideStarter() {
    localStorage.setItem("personal-life:v14-starter-hidden", "1");
    setShowStarter(false);
  }

  const starterActions = [
    {
      page: "subjects",
      title: "Thêm môn học",
      detail: "Tạo 1-2 môn đang học để các phần điểm, ôn thi và ghi chú có chỗ bám.",
    },
    {
      page: "deadlines",
      title: "Tạo deadline gần nhất",
      detail: "Nhập việc sắp tới trước, app sẽ tự đưa nó lên Dashboard.",
    },
    {
      page: "expenses",
      title: "Ghi khoản chi đầu tiên",
      detail: "Chỉ cần nhập vài giao dịch gần đây để phần tài chính bắt đầu có ý nghĩa.",
    },
    {
      page: "settings",
      title: "Cài AI sau",
      detail: "Có thể bỏ qua API key lúc đầu. Khi cần trợ lý, quay lại bật trong Cài đặt.",
    },
  ];

  return (
    <div className="dashboard-page">
      <header className="dashboard-hero">
        <div className="hero-main">
          <p className="page-kicker">Tổng quan cá nhân</p>
          <h2>Dashboard</h2>
          <p>
            Hôm nay là {todayText}. Tập trung vào việc gần hạn, lịch trong ngày và dòng tiền tháng này.
          </p>

          <div className={`hero-focus ${primaryFocus.tone}`}>
            <span>{primaryFocus.label}</span>
            <strong>{primaryFocus.title}</strong>
            <small>{primaryFocus.detail}</small>
          </div>
        </div>

        <div className="hero-actions">
          <div className={`focus-score ${Number(overview.focusScore || 0) < 55 ? "low" : ""}`}>
            <span>Điểm ổn định</span>
            <strong>{overview.focusScore ?? 0}/100</strong>
          </div>
          <button className="refresh-button" type="button" onClick={loadDashboard}>
            Làm mới dữ liệu
          </button>
        </div>
      </header>

      {showStarter && (
        <section className="starter-panel" aria-label="Hướng dẫn bắt đầu">
          <div>
            <p className="page-kicker">Bắt đầu nhẹ nhàng</p>
            <h3>Chỉ cần làm 3 việc trước, phần còn lại để sau.</h3>
            <span>
              Bản V14 ưu tiên giảm cảm giác rối: chưa cần nhập hết mọi thứ ngay lần đầu.
            </span>
          </div>

          <div className="starter-actions">
            {starterActions.map((action) => (
              <button
                key={action.page}
                type="button"
                onClick={() => onNavigate?.(action.page)}
              >
                <strong>{action.title}</strong>
                <small>{action.detail}</small>
              </button>
            ))}
          </div>

          <button className="starter-dismiss" type="button" onClick={hideStarter}>
            Đã hiểu, ẩn hướng dẫn
          </button>
        </section>
      )}

      <section className="dash-stats-grid">
        <StatCard
          icon="TB"
          label="Lịch hôm nay"
          value={todaySchedules.length}
          hint="Lịch học và sinh hoạt"
          tone="blue"
        />
        <StatCard
          icon="CV"
          label="Việc hôm nay"
          value={todayTasks.length}
          hint="Task cần xử lý"
          tone="green"
        />
        <StatCard
          icon="DL"
          label="Deadline gần"
          value={upcomingDeadlines.length}
          hint="Trong 7 ngày tới"
          tone={upcomingDeadlines.length > 0 ? "orange" : "green"}
        />
        <StatCard
          icon="FC"
          label="Focus hôm nay"
          value={`${focus.todayMinutes || 0} phút`}
          hint={`${focus.weekSessions || 0} phiên trong tuần`}
          tone={(focus.todayMinutes || 0) > 0 ? "green" : "orange"}
        />
        <StatCard
          icon="EXP"
          label="EXP học tập"
          value={gamification.totalPoints || 0}
          hint={`Level ${gamification.level || 1} · chuỗi ${gamification.streakDays || 0} ngày`}
          tone="purple"
        />
        <StatCard
          icon="DA"
          label="Dự án đang làm"
          value={activeProjects.length}
          hint="Cần theo dõi"
          tone="purple"
        />
        <StatCard
          icon="TC"
          label="Số dư tháng"
          value={formatMoney(finance.summary?.balance)}
          hint="Thu trừ chi"
          tone={Number(finance.summary?.balance || 0) < 0 ? "red" : "green"}
        />
      </section>

      {studentActions.length > 0 && (
        <section className="dashboard-student-actions">
          {studentActions.slice(0, 4).map((action, index) => (
            <article className={`dashboard-student-action ${action.tone || "neutral"}`} key={`${action.title}-${index}`}>
              <span>{action.label || "Gợi ý hôm nay"}</span>
              <strong>{action.title}</strong>
              <p>{action.detail}</p>
            </article>
          ))}
        </section>
      )}

      <section className="dashboard-command-grid">
        <Panel title="Trung tâm hôm nay" subtitle="Màn hình hành động chính" className="today-command-panel">
          <div className="today-board">
            <div>
              <h4>Lịch hôm nay</h4>
              {todaySchedules.length === 0 ? (
                <EmptyState>Hôm nay chưa có lịch.</EmptyState>
              ) : (
                <div className="timeline-list">
                  {todaySchedules.map((item) => (
                    <article className="timeline-item" key={item.id}>
                      <span>{formatTime(item.startTime)}</span>
                      <div>
                        <strong>{item.title}</strong>
                        <p>
                          {formatTime(item.startTime)} - {formatTime(item.endTime)}
                          {item.location ? ` tại ${item.location}` : ""}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4>Việc cần làm</h4>
              {todayTasks.length === 0 ? (
                <EmptyState>Chưa có việc cần làm hôm nay.</EmptyState>
              ) : (
                <div className="compact-list">
                  {todayTasks.map((task) => (
                    <article className="compact-item" key={task.id}>
                      <div>
                        <strong>{task.title}</strong>
                        <p>{renderStatus(task.status)}</p>
                      </div>
                      <span className={`pill ${getPriorityClass(task.priority)}`}>
                        {renderPriority(task.priority)}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Panel>

        <Panel title="Deadline sắp tới" subtitle="Ưu tiên theo hạn gần nhất" className="urgent-panel">
          {upcomingDeadlines.length === 0 ? (
            <EmptyState>Không có deadline trong 7 ngày tới.</EmptyState>
          ) : (
            <div className="compact-list">
              {upcomingDeadlines.map((deadline) => (
                <article className="compact-item" key={deadline.id}>
                  <div>
                    <strong>{deadline.title}</strong>
                    <p>{deadline.subject || "Không có môn"} - {renderDaysLeft(deadline.daysLeft)}</p>
                  </div>
                  <span className={`pill ${deadline.daysLeft <= 1 ? "danger" : "warning"}`}>
                    {renderPriority(deadline.priority)}
                  </span>
                </article>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Tài chính sinh tồn" subtitle={finance.survival?.riskMessage} className="finance-panel">
          <div className="finance-stack">
            <div className="money-row">
              <span>Tổng thu</span>
              <strong className="money-income">{formatMoney(finance.summary?.totalIncome)}</strong>
            </div>
            <div className="money-row">
              <span>Tổng chi</span>
              <strong className="money-expense">{formatMoney(finance.summary?.totalExpense)}</strong>
            </div>
            <div className="money-row balance-row">
              <span>Mức chi an toàn</span>
              <strong>{formatMoney(finance.survival?.safeDailyBudget)}/ngày</strong>
            </div>
          </div>
        </Panel>
      </section>

      <section className="dashboard-analysis-grid">
        <Panel
          title={hasTrendData ? "Thu chi theo tháng" : "Tổng quan thu chi"}
          subtitle={
            hasTrendData
              ? "So sánh thu nhập và chi tiêu trong năm"
              : "Dữ liệu hiện tại còn ít, ưu tiên đọc tổng số trước"
          }
        >
          <MonthlyBarChart data={monthlyTrend} />
          {hasTrendData && (
            <div className="chart-note">
              <span className="income-dot">Thu</span>
              <span className="expense-dot">Chi</span>
            </div>
          )}
        </Panel>

        <Panel title="Phân bổ chi tiêu" subtitle="Cơ cấu chi tiêu tháng hiện tại">
          <ExpenseBreakdown
            data={finance.categoryBreakdown || []}
            summary={finance.summary}
          />
        </Panel>

        <Panel title="Tiến độ công việc" subtitle="Tỷ lệ hoàn thành theo nhóm">
          <div className="progress-grid">
            <ProgressRing
              value={taskPercent}
              label="Task"
              caption={`${productivity.tasks?.done || 0}/${productivity.tasks?.total || 0} việc đã xong`}
            />
            <ProgressRing
              value={deadlinePercent}
              label="Deadline"
              caption={`${productivity.deadlines?.overdue || 0} quá hạn`}
            />
            <ProgressRing
              value={projectPercent}
              label="Dự án"
              caption={`${activeProjects.length} dự án đang theo dõi`}
            />
          </div>
        </Panel>

        <Panel title="Tải trong tuần" subtitle="Tổng lịch và task theo từng ngày">
          <WorkloadChart data={weekWorkload || []} />
        </Panel>
      </section>

      <section className="dashboard-support-grid">
        <Panel title="Dự án ưu tiên" subtitle="Các đầu việc lớn chưa hoàn thành">
          {activeProjects.length === 0 ? (
            <EmptyState>Chưa có dự án đang theo dõi.</EmptyState>
          ) : (
            <div className="compact-list">
              {activeProjects.map((project) => (
                <article className="compact-item" key={project.id}>
                  <div>
                    <strong>{project.name}</strong>
                    <p>{renderStatus(project.status)} - {renderDaysLeft(project.daysLeft)}</p>
                    {project.currentBug && <small>Lỗi: {project.currentBug}</small>}
                  </div>
                  <span className={`pill ${getPriorityClass(project.priority)}`}>
                    {renderPriority(project.priority)}
                  </span>
                </article>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Học tập và tài liệu" subtitle="Môn cần xem lại, tài liệu mới thêm">
          <div className="study-grid">
            <div>
              <h4>Môn cần xem lại</h4>
              {subjectsNeedReview.length === 0 ? (
                <EmptyState>Chưa có môn cần xem lại.</EmptyState>
              ) : (
                <div className="mini-list">
                  {subjectsNeedReview.slice(0, 4).map((subject) => (
                    <article key={subject.id}>
                      <strong>{subject.name}</strong>
                      <span>{renderProgressStatus(subject.progressStatus)}</span>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4>Tài liệu mới</h4>
              {recentFiles.length === 0 ? (
                <EmptyState>Chưa có tài liệu mới.</EmptyState>
              ) : (
                <div className="mini-list">
                  {recentFiles.slice(0, 4).map((file) => (
                    <article key={file.id}>
                      <strong>{file.name}</strong>
                      <span>{file.subject || file.projectName || "Chưa gắn ngữ cảnh"}</span>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Panel>

        <Panel title="Động lực học tập" subtitle="EXP, chuỗi ngày và huy hiệu đang mở khóa">
          <div className="mini-list">
            <article>
              <strong>Level {gamification.level || 1}</strong>
              <span>{gamification.pointsInLevel || 0}/100 EXP trong cấp hiện tại</span>
            </article>
            <article>
              <strong>{gamification.streakDays || 0} ngày liên tiếp</strong>
              <span>{gamification.achievementCount || 0} huy hiệu đã mở khóa</span>
            </article>
            {(gamification.recentEvents || []).slice(0, 3).map((event) => (
              <article key={event.id}>
                <strong>+{event.points} EXP · {event.title}</strong>
                <span>{event.reason || event.eventDate}</span>
              </article>
            ))}
          </div>
        </Panel>

        <Panel title="Nhắc nhở thông minh" subtitle="Các cảnh báo được tổng hợp từ toàn bộ app">
          {reminders.length === 0 ? (
            <EmptyState>Chưa có nhắc nhở.</EmptyState>
          ) : (
            <div className="reminder-list">
              {reminders.map((reminder, index) => (
                <div className="reminder-item" key={`${reminder}-${index}`}>
                  {reminder}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}

export default DashboardPage;
