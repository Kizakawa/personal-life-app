import { useEffect, useState } from "react";
import { getAnalyticsSummary } from "../api/analyticsApi";

const workspaceLabels = {
  study: "Học tập",
  knowledge: "Kho tri thức",
  exam: "Ôn thi",
  documents: "Tài liệu",
  journal: "Nhật ký",
  commands: "Lệnh thường dùng",
};

function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadAnalytics() {
    try {
      setLoading(true);
      const result = await getAnalyticsSummary();
      setData(result);
    } catch (err) {
      console.error(err);
      alert("Không tải được thống kê.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, []);

  function formatMoney(value) {
    return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
  }

  if (loading) {
    return (
      <header className="page-header">
        <h2>Thống kê</h2>
        <p>Đang tải dữ liệu...</p>
      </header>
    );
  }

  if (!data) {
    return (
      <header className="page-header">
        <h2>Thống kê</h2>
        <p>Không có dữ liệu.</p>
      </header>
    );
  }

  return (
    <>
      <header className="page-header">
        <h2>Thống kê tổng quan</h2>
        <p>
          Theo dõi số lượng dữ liệu, tiến độ học tập, dự án, deadline, việc cần
          làm và tài chính ở mức tổng quát.
        </p>
      </header>

      <div className="summary-grid">
        <article className="summary-card">
          <span>Sự kiện</span>
          <strong>{data.events}</strong>
        </article>

        <article className="summary-card">
          <span>Thời khóa biểu</span>
          <strong>{data.schedules}</strong>
        </article>

        <article className="summary-card">
          <span>Người quan trọng</span>
          <strong>{data.people}</strong>
        </article>
      </div>

      <div className="layout">
        <section className="panel">
          <div className="panel-heading">
            <h3>Môn học</h3>
          </div>

          <div className="survival-overview">
            <article>
              <span>Tổng môn</span>
              <strong>{data.subjects.total}</strong>
            </article>

            <article>
              <span>Chưa học</span>
              <strong>{data.subjects.notStarted}</strong>
            </article>

            <article>
              <span>Đang học</span>
              <strong>{data.subjects.studying}</strong>
            </article>

            <article>
              <span>Đã ôn</span>
              <strong>{data.subjects.reviewed}</strong>
            </article>

            <article>
              <span>Cần xem lại</span>
              <strong>{data.subjects.needsReview}</strong>
            </article>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h3>Dự án cá nhân</h3>
          </div>

          <div className="survival-overview">
            <article>
              <span>Tổng dự án</span>
              <strong>{data.projects.total}</strong>
            </article>

            <article>
              <span>Đang làm</span>
              <strong>{data.projects.doing}</strong>
            </article>

            <article>
              <span>Gần xong</span>
              <strong>{data.projects.almostDone}</strong>
            </article>

            <article>
              <span>Đã xong</span>
              <strong>{data.projects.done}</strong>
            </article>

            <article>
              <span>Quá hạn</span>
              <strong>{data.projects.overdue}</strong>
            </article>
          </div>
        </section>
      </div>

      <div className="layout" style={{ marginTop: 20 }}>
        <section className="panel">
          <div className="panel-heading">
            <h3>Kế hoạch ngày</h3>
          </div>

          <div className="survival-overview">
            <article>
              <span>Tổng việc</span>
              <strong>{data.tasks.total}</strong>
            </article>

            <article>
              <span>Hôm nay</span>
              <strong>{data.tasks.today}</strong>
            </article>

            <article>
              <span>Đã xong</span>
              <strong>{data.tasks.done}</strong>
            </article>

            <article>
              <span>Chưa làm</span>
              <strong>{data.tasks.pending}</strong>
            </article>

            <article>
              <span>Đang làm</span>
              <strong>{data.tasks.doing}</strong>
            </article>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h3>Deadline</h3>
          </div>

          <div className="survival-overview">
            <article>
              <span>Tổng deadline</span>
              <strong>{data.deadlines.total}</strong>
            </article>

            <article>
              <span>Quá hạn</span>
              <strong>{data.deadlines.overdue}</strong>
            </article>

            <article>
              <span>Đã xong</span>
              <strong>{data.deadlines.done}</strong>
            </article>

            <article>
              <span>Chưa làm</span>
              <strong>{data.deadlines.pending}</strong>
            </article>

            <article>
              <span>Đang làm</span>
              <strong>{data.deadlines.doing}</strong>
            </article>
          </div>
        </section>
      </div>

      <div className="layout" style={{ marginTop: 20 }}>
        <section className="panel">
          <div className="panel-heading">
            <h3>Tài chính trong năm</h3>
          </div>

          <div className="survival-overview">
            <article>
              <span>Tổng thu</span>
              <strong>{formatMoney(data.expenses.totalIncome)}</strong>
            </article>

            <article>
              <span>Tổng chi</span>
              <strong>{formatMoney(data.expenses.totalExpense)}</strong>
            </article>

            <article>
              <span>Số dư</span>
              <strong>{formatMoney(data.expenses.balance)}</strong>
            </article>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h3>Dữ liệu mở rộng</h3>
          </div>

          <div className="event-list">
            {Object.entries(data.workspace).map(([key, value]) => (
              <article className="event-card" key={key}>
                <div>
                  <h4>{workspaceLabels[key] || key}</h4>
                  <small>{value} mục dữ liệu</small>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

export default AnalyticsPage;