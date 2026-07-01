from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import JSONResponse

import app.models  # noqa: F401
from app.database import Base, SessionLocal, engine
from app.migrations import prepare_database_upgrade_backup, run_startup_migrations
from app.routers import ai, analytics, auth, backup, calendar_export, dashboard, deadlines, events, expense_budgets, expense_categories, expenses, files, focus, gamification, people, projects, reminders, schedules, search, settings, subjects, student_hub, tasks, workspace
from app.security import extract_bearer_token, get_user_by_token
from app.storage import resolve_frontend_dist_dir

prepare_database_upgrade_backup()
Base.metadata.create_all(bind=engine)

with SessionLocal() as startup_db:
    run_startup_migrations(startup_db)

app = FastAPI(title="Personal Life App API")

PUBLIC_PATHS = {
    "/",
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
}


@app.middleware("http")
async def require_authentication(request, call_next):
    path = request.url.path

    if (
        request.method == "OPTIONS"
        or path in PUBLIC_PATHS
        or path.startswith("/auth")
        or path.startswith("/app")
        or (path == "/calendar/export" and request.query_params.get("token"))
        or (path.startswith("/files/") and path.endswith("/inline") and request.query_params.get("token"))
    ):
        return await call_next(request)

    token = extract_bearer_token(request.headers.get("authorization"))

    if not token:
        token = request.query_params.get("access_token")

    db = SessionLocal()

    try:
        user = get_user_by_token(db, token)
    finally:
        db.close()

    if not user:
        return JSONResponse(
            status_code=401,
            content={"detail": "Cần đăng nhập để truy cập dữ liệu"},
        )

    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(ai.router)
app.include_router(events.router)
app.include_router(schedules.router)
app.include_router(expenses.router)
app.include_router(expense_categories.router)
app.include_router(expense_budgets.router)
app.include_router(people.router)
app.include_router(dashboard.router)
app.include_router(deadlines.router)
app.include_router(tasks.router)
app.include_router(backup.router)
app.include_router(calendar_export.router)
app.include_router(focus.router)
app.include_router(gamification.router)
app.include_router(workspace.router)
app.include_router(reminders.router)
app.include_router(analytics.router)
app.include_router(settings.router)
app.include_router(subjects.router)
app.include_router(student_hub.router)
app.include_router(projects.router)
app.include_router(files.router)
app.include_router(search.router)

frontend_dist_dir = resolve_frontend_dist_dir()

if frontend_dist_dir:
    app.mount(
        "/app",
        StaticFiles(directory=frontend_dist_dir, html=True),
        name="frontend",
    )

@app.get("/")
def root():
    return {
        "message": "Backend is running",
        "app": "Personal Life App",
    }


@app.get("/health")
def health_check():
    return {
        "status": "ok",
    }
