# Sensei — AI Codebase Intelligence & Onboarding

Sensei turns any public GitHub repository into something you can *read like a drawing*. Point it at a
repo and it clones the code, parses the Abstract Syntax Tree (Java) or extracts structure (TS/JS, Python, C/C++), maps the layers into an
interactive architecture graph, and answers questions about the code — grounded in the actual source,
with clickable `file:line` citations.

> Built by **Chitranshu Pandey** · Spring Boot · FastAPI · React

---

## ✨ Features

- **🔐 Authentication** — Secure Google OAuth2 login and JWT-based sessions.
- **🗺️ Interactive architecture graph** — a layered dependency graph (Controllers → Services →
  Repositories → Entities for Java; intuitive path-based layers for TS, Python, C/C++) rendered with React Flow, with a dedicated "Spring Layers" view, search,
  filtering, and a node inspector that shows who injects/calls what.
- **📂 AST-aware code explorer** — browse the parsed file tree and read any file with syntax
  highlighting and citation line-highlighting.
- **🤖 Source-grounded AI chat** — ask questions and get streaming answers retrieved from the
  repository's own code (RAG), with citations you can click straight into the code viewer.
- **📖 Onboarding guide generator** — one click produces a developer onboarding walkthrough of the
  repository.
- **📱 Responsive** — a hand-built "drafting sheet" design system that works on phone, tablet, and
  desktop.

---

## 🏗️ Architecture at a glance

```
                        USER (browser)
                           │
                           ▼
                React Frontend  (Vite · :5173)
                           │   REST + JWT  /  SSE stream
                           ▼
             Spring Boot Backend  (:8080)
                           │
        ┌──────────────────┼───────────────────┐
        ▼                  ▼                   ▼
  H2 / PostgreSQL     GitHub (JGit clone)   Python AI Service (:8000)
                                                 │
                                   ┌─────────────┼──────────────┐
                                   ▼             ▼              ▼
                               ChromaDB   MiniLM embeddings   Groq / Gemini LLM
```

Three cooperating services:

| Service | Port | Responsibility |
|---------|------|----------------|
| **Frontend** (React) | 5173 | UI, auth, architecture graph, code viewer, chat |
| **Backend** (Spring Boot) | 8080 | Auth, repo lifecycle, Git clone, AST parsing, graph building, REST API, SSE relay |
| **AI service** (FastAPI) | 8000 | Embeddings, ChromaDB vector store, RAG + agent chat, onboarding generation |

---

## 🧰 Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, React Flow (`@xyflow/react`), dagre |
| Backend | Spring Boot 3.3.5, Java 21, Spring Security OAuth2 + JWT (jjwt), Spring Data JPA, WebFlux (`WebClient`), JavaParser, JGit, Regex Analyzers (TS/Python/C) |
| Database | H2 (file-based, default) or PostgreSQL (profile) |
| AI service | Python 3.10+, FastAPI, LangChain, LangGraph, ChromaDB |
| LLM | **Groq** (default: Llama 3.3 70B, with automatic fallback chain) or **Google Gemini** |
| Embeddings | `sentence-transformers` / `all-MiniLM-L6-v2` (runs locally on CPU) |

---

## 🚀 Getting started

### Prerequisites

- **Java 21+** and **Maven** (backend)
- **Node.js 18+** (frontend)
- **Python 3.10+** (AI service)
- A **Groq API key** (default — get one at <https://console.groq.com>) *or* a **Google Gemini API
  key** (<https://aistudio.google.com/apikey>)

### 1. Backend — Spring Boot (`:8080`)

```bash
cd backend
mvn spring-boot:run
```

- API on <http://localhost:8080>, H2 console (dev only) on <http://localhost:8080/h2-console>.
- **Create a `.env` file** in `backend/` with your Google OAuth credentials:

```env
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
```

### 2. AI service — FastAPI (`:8000`)

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate         # Windows  (use: source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
```

Create a `.env` file in `ai-service/`:

```env
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_key_here
# Optional — only needed if LLM_PROVIDER=google
GOOGLE_API_KEY=your_gemini_key_here
```

Then run:

```bash
python main.py          # serves on http://localhost:8000
```

> The first chat request downloads the local embedding model (`all-MiniLM-L6-v2`), which may take a
> moment the very first time.

### 3. Frontend — React (`:5173`)

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api/*` to the backend on `:8080`, so you only need one
URL in the browser. Sign in using your Google account to get started.

---

## 🔑 Configuration

### Backend (`backend/src/main/resources/application.yml`)

| Setting / env var | Default | Purpose |
|-------------------|---------|---------|
| `GOOGLE_CLIENT_ID` / `SECRET` | — | Google OAuth2 credentials (via `.env`) |
| `app.security.jwt.expiration-minutes` | `120` | Token lifetime |
| `app.security.allowed-origins` | `http://localhost:5173,…` | CORS allow-list |
| `app.security.h2-console-enabled` | `true` | Toggle the raw H2 SQL console — **set `false` in production** |
| `app.ai-service.base-url` | `http://localhost:8000` | Where the Python AI service lives |
| `app.storage.repo-dir` | `./storage/repos` | Where repositories are cloned |

**PostgreSQL** instead of H2: run with `--spring.profiles.active=postgres` and set `DB_HOST`,
`DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (see `application-postgres.yml`).

### AI service (`ai-service/.env`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `LLM_PROVIDER` | `groq` | `groq` or `google` |
| `GROQ_API_KEY` | — | Required when provider is `groq` |
| `GOOGLE_API_KEY` | — | Required when provider is `google` |
| `EMBEDDING_PROVIDER` | `google` | `google` for memory-constrained deployments, or cached `local` MiniLM for offline workspaces |
| `EMBEDDING_LOCAL_FILES_ONLY` | `true` | Prevent local workspaces from making a Hugging Face metadata request; set `false` once to download MiniLM on a new machine |
| `LLM_MODEL` | `llama-3.3-70b-versatile` | Primary model |
| `LLM_FALLBACK_MODELS` | `llama-3.1-8b-instant,…` | Comma-separated fallback chain used on rate limits |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Local embedding model |
| `CHROMA_PERSIST_DIR` | `./data/chroma` | ChromaDB storage path |

---

## 🔄 How it works

1. **Submit a GitHub URL** → the backend stores a `QUEUED` row and returns immediately; ingestion runs
   on a background thread pool.
2. **Clone** (`CLONING`) → a shallow clone via JGit (GitHub HTTPS only).
3. **Parse** (`PARSING`) → each file is walked and handed to a language analyzer: JavaParser builds a
   real Java AST (classes, Spring stereotypes, injections, calls, inheritance); regex analyzers
   handle TS/JS/JSX, Python, and C/C++ structures. Classes, relationships, and code chunks are persisted in one transaction.
4. **Index** (`INDEXING`) → chunks are sent to the AI service, embedded locally with MiniLM, and
   stored per-repository in ChromaDB.
5. **Ready** (`READY`) → the frontend renders the architecture graph and enables code search + chat.
6. **Ask** → a question is embedded, the most relevant chunks are retrieved, and the LLM streams a
   grounded answer with `file:line` citations back through the backend to the browser (SSE).

---

## 🌐 REST API

### Backend (`:8080`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/oauth2/authorization/google` | public | Google OAuth2 login redirect |
| GET | `/login/oauth2/code/google` | public | Google OAuth2 callback |
| GET | `/api/auth/me` | 🔒 | Current user's profile |
| GET | `/api/health` | public | Liveness probe |
| POST | `/api/repositories` | 🔒 | Submit a GitHub URL for analysis |
| GET | `/api/repositories` | 🔒 | List repositories |
| GET | `/api/repositories/{id}` | 🔒 | Repository details |
| DELETE | `/api/repositories/{id}` | 🔒 | Delete a repository and its data |
| GET | `/api/repositories/{id}/architecture` | 🔒 | Full architecture graph |
| GET | `/api/repositories/{id}/architecture/spring-layers` | 🔒 | Spring-layer graph |
| GET | `/api/repositories/{id}/files` | 🔒 | Parsed file list |
| GET | `/api/repositories/{id}/files/content?filePath=…` | 🔒 | File contents (path-traversal guarded) |
| GET | `/api/repositories/{id}/entities` · `/relationships` · `/chunks` | 🔒 | Raw parsed artefacts |
| GET | `/api/repositories/{id}/search?query=…` | 🔒 | Keyword search over chunks |
| POST | `/api/repositories/{id}/chat` | 🔒 | Streaming RAG chat (SSE) |
| POST | `/api/repositories/{id}/onboarding` | 🔒 | Generate onboarding guide |

All 🔒 endpoints require `Authorization: Bearer <token>`.

### AI service (`:8000`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ai/index` | Index code chunks into ChromaDB |
| POST | `/api/ai/chat` | RAG streaming chat |
| POST | `/api/ai/agent-chat` | Autonomous ReAct agent chat (tool-using) |
| POST | `/api/ai/onboarding` | Generate onboarding guide |
| GET | `/health` | Health check |

---

## 📁 Project structure

```
Project_1/
├── frontend/            # React 19 + Vite + Tailwind v4
│   └── src/
│       ├── components/     # Navbar, RepoInput, ArchitectureGraph, FileExplorer, CodeViewer, ChatPanel, AuthGate, …
│       ├── pages/          # LoginPage, Dashboard, RepositoryPage
│       ├── services/       # api.ts (fetch client + SSE + auth header)
│       ├── store/          # Zustand stores (auth, app)
│       ├── types/          # TypeScript types
│       └── utils/          # tokenStorage
├── backend/             # Spring Boot 3.3.5 (Java 21)
│   └── src/main/java/com/sensei/
│       ├── security/       # JWT filter, SecurityConfig, UserDetailsService
│       ├── controller/     # REST + SSE endpoints
│       ├── service/        # Repo lifecycle, ingestion, Git clone, AI client
│       ├── analyzer/       # JavaParser + TS/JS analyzers
│       ├── entity/ repository/ dto/ model/ exception/ config/
│       └── resources/      # application*.yml
└── ai-service/          # Python FastAPI
    ├── main.py             # endpoints
    ├── rag_chain.py        # RAG chains + prompts + model fallback
    ├── agent_chain.py      # LangGraph ReAct agent
    ├── vector_store.py     # ChromaDB + embeddings
    └── config.py           # settings from .env
```

> A deeper, from-scratch walkthrough (plus an interview-style Q&A and a file-by-file reference) lives
> in [`DEVELOPER_README.md`](./DEVELOPER_README.md).

---

## 🛠️ Troubleshooting

- **Chat says the AI service is unavailable** → make sure the FastAPI service is running on `:8000`
  and your `GROQ_API_KEY` (or `GOOGLE_API_KEY`) is set in `ai-service/.env`.
- **Every refresh signs me out** → ensure the backend is running and reachable through the Vite proxy;
  the app verifies the stored token against `GET /api/auth/me` on load.
- **"Only public GitHub repository URLs are supported"** → the clone step accepts only
  `https://github.com/owner/repo` URLs.
- **Graph is empty** → non-Java repos won't have Spring layers; switch to "Full architecture".

---

## 📜 License

Provided as-is for educational and portfolio use.
