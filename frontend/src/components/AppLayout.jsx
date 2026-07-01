import { useEffect, useState } from "react";
import useUserStore from "../stores/useUserStore";

const navGroups = [
  {
    title: "Tổng quan",
    items: [
      { id: "dashboard", label: "Dashboard", icon: "DB" },
      { id: "student-hub", label: "Sinh viên 360", icon: "SV" },
      { id: "reminders", label: "Nhắc nhở", icon: "NH", advanced: true },
      { id: "analytics", label: "Thống kê", icon: "TK", advanced: true },
      { id: "search", label: "Tìm kiếm", icon: "SR", advanced: true },
    ],
  },
  {
    title: "Lịch và học tập",
    items: [
      { id: "events", label: "Sự kiện", icon: "SK" },
      { id: "subjects", label: "Môn học", icon: "MH" },
      { id: "schedules", label: "Thời khóa biểu", icon: "TB" },
      { id: "tasks", label: "Kế hoạch ngày", icon: "CV" },
      { id: "study", label: "Học tập", icon: "HT" },
      { id: "exam", label: "Ôn thi", icon: "OT" },
    ],
  },
  {
    title: "Dữ liệu cá nhân",
    items: [
      { id: "projects", label: "Dự án cá nhân", icon: "DA", advanced: true },
      { id: "knowledge", label: "Kho tri thức", icon: "KT", advanced: true },
      { id: "documents", label: "Tài liệu", icon: "TL", advanced: true },
      { id: "journal", label: "Nhật ký ngày", icon: "NK", advanced: true },
      { id: "commands", label: "Lệnh thường dùng", icon: "CMD", advanced: true },
    ],
  },
  {
    title: "Quản lý",
    items: [
      { id: "expenses", label: "Chi tiêu", icon: "TC" },
      { id: "deadlines", label: "Deadline", icon: "DL" },
      { id: "people", label: "Người quan trọng", icon: "NQ", advanced: true },
      { id: "backup", label: "Sao lưu", icon: "BK" },
      { id: "settings", label: "Cài đặt", icon: "CD" },
    ],
  },
];

function AppLayout({ activePage, onNavigate, children }) {
  const gamification = useUserStore((state) => state.gamification);
  const refreshGamification = useUserStore((state) => state.refreshGamification);
  const [showAdvanced, setShowAdvanced] = useState(() => {
    return localStorage.getItem("personal-life:v14-show-advanced") === "1";
  });

  useEffect(() => {
    refreshGamification();
  }, [refreshGamification]);

  function toggleAdvanced() {
    const nextValue = !showAdvanced;
    localStorage.setItem("personal-life:v14-show-advanced", nextValue ? "1" : "0");
    setShowAdvanced(nextValue);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="eyebrow">Personal Life App</p>
          <h1>Trung tâm quản lý cá nhân</h1>
          <span>Workspace sinh viên, học tập và đời sống.</span>
          <div className="sidebar-xp-card" aria-label="Kinh nghiệm học tập">
            <div>
              <strong>Level {gamification.level || 1}</strong>
              <span>{gamification.pointsInLevel || 0}/100 EXP</span>
            </div>
            <b>{gamification.totalPoints || 0}</b>
          </div>
          <button className="sidebar-mode-toggle" type="button" onClick={toggleAdvanced}>
            {showAdvanced ? "Ẩn bớt mục nâng cao" : "Hiện tất cả mục"}
          </button>
        </div>

        <nav className="nav-list">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) => showAdvanced || !item.advanced);

            if (visibleItems.length === 0) {
              return null;
            }

            return (
              <section className="nav-group" key={group.title}>
                <p className="nav-group-title">{group.title}</p>

                <div className="nav-group-items">
                  {visibleItems.map((item) => (
                    <button
                      className={`nav-item ${activePage === item.id ? "active" : ""}`}
                      key={item.id}
                      type="button"
                      onClick={() => onNavigate(item.id)}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </nav>
      </aside>

      <section className="content">{children}</section>
    </main>
  );
}

export default AppLayout;
