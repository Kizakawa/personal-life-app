<div align="center">

# ⚡ Personal Life App
### Full-Stack AI Personal Productivity & Student Life Assistant

![React 19](https://img.shields.io/badge/Frontend-React_19_%2B_Vite_8-61DAFB?logo=react&logoColor=black)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI_%2B_SQLAlchemy_2.0-009688?logo=fastapi&logoColor=white)
![Google GenAI](https://img.shields.io/badge/AI-Google_Gemini_SDK-4285F4?logo=google&logoColor=white)
![Portable](https://img.shields.io/badge/Packaging-Windows_Zero--Install_Portable-0078D6?logo=windows&logoColor=white)

*A modern full-stack personal productivity workspace combining task/schedule management, persistent local SQL database storage, and an integrated Google Gemini AI assistant — deployable as both a web app and a zero-install portable Windows desktop bundle.*

</div>

---

## 🌟 Key Highlights | Điểm Nhấn Kỹ Thuật

- **Modern Reactive Frontend (`frontend/`):** Built with **React 19**, **Vite 8**, **Zustand 5** lightweight state management, GitHub-Flavored Markdown rendering (`react-markdown` + `remark-gfm`), and strict XSS sanitization (`DOMPurify`), linted at native speed with `oxlint`.
- **Typed Async Python Backend (`backend/`):** Powered by **FastAPI**, **Pydantic v2**, and **SQLAlchemy 2.0** for reliable local-first persistence and clean RESTful API contracts.
- **Integrated Google GenAI Assistant:** Connects directly to the official `google-genai` SDK to assist students and professionals with planning, summarization, and daily study/work routines.
- **1-Click Windows Portable Packaging (`tools/`):** Includes automated build scripts (`build_portable_windows.bat`) that compile frontend assets and package the FastAPI desktop server into a standalone `.zip` bundle runnable without manual setup.

---

## 📁 Project Structure

```text
personal-life-app/
├── frontend/                   # React 19 + Vite 8 + Zustand SPA
│   ├── src/                    # UI components, state stores & API client
│   ├── package.json            # Frontend dependencies & oxlint/vite scripts
│   └── vite.config.js          # Vite bundler configuration
├── backend/                    # FastAPI + SQLAlchemy 2.0 + Google GenAI server
│   ├── app/                    # API routers, models, schemas & AI services
│   ├── desktop_server.py       # Local desktop launcher & static SPA host
│   └── requirements.txt        # Pinned Python dependencies
├── database/                   # Local database schema & initialization assets
├── docs/                       # Technical & user documentation
├── tools/                      # Automated Windows portable packaging scripts
└── BUILD_PORTABLE_ON_WINDOWS.md
```

---

## 🚀 Quickstart

### 1. Backend Setup
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Development
```bash
cd frontend
npm install
npm run dev
```

### 3. Build Zero-Install Windows Portable Package
See [BUILD_PORTABLE_ON_WINDOWS.md](BUILD_PORTABLE_ON_WINDOWS.md) or run `tools/build_portable_windows.bat` to generate a self-contained `PersonalLifeApp_HSSV_Portable.zip`.

---

## 📫 Author
- **Kizakawa** — [vivyngocnghech@gmail.com](mailto:vivyngocnghech@gmail.com) • [github.com/Kizakawa](https://github.com/Kizakawa)
