import { Suspense, lazy, useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import "./App.css";

import AIFloatingDrawer from "./components/AIFloatingDrawer";
import AppLayout from "./components/AppLayout";
import AppLock from "./components/AppLock";

const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const BackupPage = lazy(() => import("./pages/BackupPage"));
const ClassNotesPage = lazy(() => import("./pages/ClassNotesPage"));
const CommandsPage = lazy(() => import("./pages/CommandsPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const DeadlinesPage = lazy(() => import("./pages/DeadlinesPage"));
const DocumentsPage = lazy(() => import("./pages/DocumentsPage"));
const EventsPage = lazy(() => import("./pages/EventsPage"));
const ExamModePage = lazy(() => import("./pages/ExamModePage"));
const ExpensesPage = lazy(() => import("./pages/ExpensesPage"));
const JournalPage = lazy(() => import("./pages/JournalPage"));
const KnowledgePage = lazy(() => import("./pages/KnowledgePage"));
const PeoplePage = lazy(() => import("./pages/PeoplePage"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const RemindersPage = lazy(() => import("./pages/RemindersPage"));
const SchedulesPage = lazy(() => import("./pages/SchedulesPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const StudentHubPage = lazy(() => import("./pages/StudentHubPage"));
const StudyPage = lazy(() => import("./pages/StudyPage"));
const SubjectsPage = lazy(() => import("./pages/SubjectsPage"));
const TasksPage = lazy(() => import("./pages/TasksPage"));

const pageComponents = {
  analytics: AnalyticsPage,
  backup: BackupPage,
  "class-notes": ClassNotesPage,
  commands: CommandsPage,
  dashboard: DashboardPage,
  deadlines: DeadlinesPage,
  documents: DocumentsPage,
  events: EventsPage,
  exam: ExamModePage,
  expenses: ExpensesPage,
  journal: JournalPage,
  knowledge: KnowledgePage,
  people: PeoplePage,
  projects: ProjectsPage,
  reminders: RemindersPage,
  schedules: SchedulesPage,
  search: SearchPage,
  settings: SettingsPage,
  "student-hub": StudentHubPage,
  study: StudyPage,
  subjects: SubjectsPage,
  tasks: TasksPage,
};

function UnknownPage() {
  return (
    <div className="panel">
      <h2>Không tìm thấy module</h2>
      <p className="empty">Mục này chưa được đăng ký trong ứng dụng hiện tại.</p>
    </div>
  );
}

function App() {
  const [activePage, setActivePage] = useState("dashboard");
  const PageComponent = pageComponents[activePage] || UnknownPage;

  useEffect(() => {
    function handleNavigate(event) {
      const page = event.detail;
      if (page && pageComponents[page]) {
        setActivePage(page);
      }
    }
    window.addEventListener("personal-life:navigate", handleNavigate);
    return () => window.removeEventListener("personal-life:navigate", handleNavigate);
  }, []);

  return (
    <AppLock>
      <Toaster position="top-right" toastOptions={{ duration: 2600 }} />
      <AppLayout activePage={activePage} onNavigate={setActivePage}>
        <Suspense fallback={<div className="panel app-loading-panel">Đang tải module...</div>}>
          <PageComponent onNavigate={setActivePage} />
        </Suspense>
      </AppLayout>
      <AIFloatingDrawer activePage={activePage} onNavigate={setActivePage} />
    </AppLock>
  );
}

export default App;
