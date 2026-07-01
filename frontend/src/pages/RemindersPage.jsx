import { useEffect, useState } from "react";
import { getRemindersSummary } from "../api/remindersApi";

function RemindersPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadReminders() {
    try {
      setLoading(true);
      const result = await getRemindersSummary();
      setData(result);
    } catch (err) {
      console.error(err);
      alert("Không tải được trung tâm nhắc nhở.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReminders();
  }, []);

  function renderPriority(priority) {
    const map = {
      low: "Thấp",
      medium: "Trung bình",
      high: "Cao",
    };

    return map[priority] || "Không rõ";
  }

  if (loading) {
    return (
      <header className="page-header">
        <h2>Nhắc nhở</h2>
        <p>Đang tải dữ liệu...</p>
      </header>
    );
  }

  if (!data) {
    return (
      <header className="page-header">
        <h2>Nhắc nhở</h2>
        <p>Không có dữ liệu.</p>
      </header>
    );
  }

  return (
    <>
      <header className="page-header">
        <h2>Trung tâm nhắc nhở</h2>
        <p>
          Gom các việc quan trọng từ deadline, dự án, kế hoạch ngày, sự kiện và
          thời khóa biểu để bạn không bị sót việc.
        </p>
      </header>

      <div className="summary-grid">
        <article className="summary-card">
          <span>Tổng nhắc nhở</span>
          <strong>{data.totalCount}</strong>
        </article>

        <article className="summary-card expense">
          <span>Deadline quá hạn</span>
          <strong>{data.overdueDeadlines.length}</strong>
        </article>

        <article className="summary-card balance">
          <span>Dự án gần hạn</span>
          <strong>{data.upcomingProjects.length}</strong>
        </article>
      </div>

      <div className="layout">
        <section className="panel">
          <div className="panel-heading">
            <h3>Deadline quá hạn</h3>
          </div>

          {data.overdueDeadlines.length === 0 ? (
            <p className="empty">Không có deadline quá hạn.</p>
          ) : (
            <div className="event-list">
              {data.overdueDeadlines.map((item) => (
                <article className="event-card" key={item.id}>
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.subject || "Không có môn"}</p>
                    <small>
                      Quá hạn {Math.abs(item.daysLeft)} ngày · Ưu tiên:{" "}
                      {renderPriority(item.priority)}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h3>Deadline trong 7 ngày tới</h3>
          </div>

          {data.upcomingDeadlines.length === 0 ? (
            <p className="empty">Không có deadline gần.</p>
          ) : (
            <div className="event-list">
              {data.upcomingDeadlines.map((item) => (
                <article className="event-card" key={item.id}>
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.subject || "Không có môn"}</p>
                    <small>
                      Hạn: {item.dueDate} · Còn {item.daysLeft} ngày · Ưu tiên:{" "}
                      {renderPriority(item.priority)}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="layout" style={{ marginTop: 20 }}>
        <section className="panel">
          <div className="panel-heading">
            <h3>Dự án quá hạn</h3>
          </div>

          {data.overdueProjects.length === 0 ? (
            <p className="empty">Không có dự án quá hạn.</p>
          ) : (
            <div className="event-list">
              {data.overdueProjects.map((item) => (
                <article className="event-card" key={item.id}>
                  <div>
                    <h4>{item.title}</h4>
                    {item.goal && <p>{item.goal}</p>}
                    <small>
                      Quá hạn {Math.abs(item.daysLeft)} ngày · Ưu tiên:{" "}
                      {renderPriority(item.priority)}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h3>Dự án trong 7 ngày tới</h3>
          </div>

          {data.upcomingProjects.length === 0 ? (
            <p className="empty">Không có dự án gần hạn.</p>
          ) : (
            <div className="event-list">
              {data.upcomingProjects.map((item) => (
                <article className="event-card" key={item.id}>
                  <div>
                    <h4>{item.title}</h4>
                    {item.goal && <p>{item.goal}</p>}
                    <small>
                      Hạn: {item.deadlineDate} · Còn {item.daysLeft} ngày · Ưu
                      tiên: {renderPriority(item.priority)}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="layout" style={{ marginTop: 20 }}>
        <section className="panel">
          <div className="panel-heading">
            <h3>Việc cần làm hôm nay</h3>
          </div>

          {data.todayTasks.length === 0 ? (
            <p className="empty">Hôm nay chưa có việc cần làm.</p>
          ) : (
            <div className="event-list">
              {data.todayTasks.map((item) => (
                <article className="event-card" key={item.id}>
                  <div>
                    <h4>{item.title}</h4>
                    <p>
                      {item.startTime || "--:--"} - {item.endTime || "--:--"}
                    </p>
                    <small>Ưu tiên: {renderPriority(item.priority)}</small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <h3>Sự kiện sắp tới</h3>
          </div>

          {data.upcomingEvents.length === 0 ? (
            <p className="empty">Không có sự kiện trong 7 ngày tới.</p>
          ) : (
            <div className="event-list">
              {data.upcomingEvents.map((item) => (
                <article className="event-card" key={item.id}>
                  <div>
                    <h4>{item.title}</h4>
                    <p>
                      {item.eventDate}
                      {item.eventTime && ` · ${item.eventTime.slice(0, 5)}`}
                    </p>
                    <small>Còn {item.daysLeft} ngày</small>
                    {item.note && <small>{item.note}</small>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="panel" style={{ marginTop: 20 }}>
        <div className="panel-heading">
          <h3>Lịch hôm nay</h3>
        </div>

        {data.todaySchedules.length === 0 ? (
          <p className="empty">Hôm nay chưa có lịch.</p>
        ) : (
          <div className="event-list">
            {data.todaySchedules.map((item) => (
              <article className="event-card" key={item.id}>
                <div>
                  <h4>{item.title}</h4>
                  <p>
                    {item.startTime || "--:--"} - {item.endTime || "--:--"}
                  </p>
                  {item.location && <small>Địa điểm: {item.location}</small>}
                  {item.note && <small>{item.note}</small>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default RemindersPage;