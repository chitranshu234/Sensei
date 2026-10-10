# Sensei

Sensei is an AI-assisted codebase intelligence platform for exploring unfamiliar public GitHub repositories. It clones a repository, extracts source-level structure, persists the resulting code model, renders architecture views, and supports source-grounded chat and onboarding guidance.

The application is organized as three collaborating services:

| Service | Technology | Default port | Responsibility |
|---|---|---:|---|
| Frontend | React, TypeScript, Vite | 5173 | Repository workspace, architecture graph, code explorer, and streamed chat UI |
| Backend | Java 21, Spring Boot | 8080 | Authentication, repository lifecycle, cloning, analysis, persistence, REST API, and stream relay |
| AI service | Python, FastAPI, LangChain, ChromaDB | 8000 | Embeddings, vector indexing, retrieval, chat, agent chat, and onboarding generation |

## Capabilities

- Submit a public GitHub repository and process it asynchronously.
- Build architecture graphs from code entities and their relationships.
- Parse Java with JavaParser AST analysis, including Spring stereotypes, injection, inheritance, method calls, and imports.
- Extract structural information from TypeScript, JavaScript, JSX, Python, C, and C++ source files.
- Browse indexed files and source code with path-traversal protections on file reads.
- Search persisted code chunks by keyword.
- Ask source-grounded questions with streamed responses and file/line citations.
- Generate repository onboarding guides and provide an optional tool-using agent chat mode.
- Restore a missing Chroma vector index from persisted code chunks after a service restart or an ephemeral-disk deployment.

## Architecture

```text
Browser
  |
  | React workspace, REST requests, streamed chat
  v
Frontend (Vite :5173)
  |
  | /api proxy
  v
Spring Boot backend (:8080)
  |-- Google OAuth2, JWT authentication, local login and registration
  |-- Repository lifecycle and asynchronous ingestion
  |-- H2 or PostgreSQL persistence
  |-- JGit clone and source analysis
  |
  | HTTP
  v
FastAPI AI service (:8000)
  |-- Local MiniLM, lexical fallback, ONNX, or Google embeddings
  |-- Per-repository Chroma collections
  |-- Retrieval-augmented chat, agent chat, onboarding
  v
ChromaDB
```

### Repository ingestion lifecycle

Repository processing moves through the following states:

```text
QUEUED -> CLONING -> PARSING -> INDEXING -> READY
                                      |
                                      v
                                    FAILED
```

1. The backend validates a public GitHub HTTPS URL and queues ingestion on a bounded background executor.
2. JGit shallow-clones the selected branch into the managed repository storage directory.
3. The backend walks supported source files while skipping dependency, build, cache, VCS, and generated-output directories.
4. Language analyzers produce files, entities, relationships, and source chunks. Java analysis is AST-based; the non-Java analyzers extract supported patterns from source text.
5. The backend saves the analysis model to H2 or PostgreSQL.
6. Chunks are sent to the AI service, embedded in batches, and stored in a Chroma collection scoped to the repository ID.
7. The workspace polls the repository status and enables architecture, code, and chat features when processing reaches `READY`.

The relational database is the durable source of truth for code chunks. ChromaDB is treated as a rebuildable retrieval cache: before chat, the backend checks the collection status and reconstructs a missing index under a per-repository lock.

## Source analysis coverage

| Language | File types | Analysis approach |
|---|---|---|
| Java | `.java` | JavaParser AST extraction for types, methods, Spring annotations, imports, injection, inheritance, and calls |
| TypeScript and JavaScript | `.ts`, `.tsx`, `.js`, `.jsx` | Classes, functions, components, imports, and requires |
| Python | `.py` | Classes, functions, imports, and from-imports |
| C and C++ | `.c`, `.cpp`, `.h`, `.hpp` | Structures/classes, functions, and includes |

The Spring-layer graph is most useful for Java repositories that use conventional Spring annotations. The full architecture graph is available for every supported language.

## Prerequisites

- Java 21 or later
- Maven 3.9 or later
- Node.js 18 or later
- Python 3.10 or later
- A Groq API key or a Google Gemini API key for chat
- Google OAuth client credentials if Google sign-in is enabled

## Local setup

Run the services in separate terminals, in the order shown below.

### 1. Configure the backend

Create `backend/.env` with your Google OAuth credentials:

```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
APP_JWT_SECRET=replace-with-a-unique-secret-of-at-least-32-bytes
```

Start the backend:

```powershell
cd backend
mvn spring-boot:run
```

The backend starts on `http://localhost:8080`. Local development uses an H2 file database by default.

### 2. Configure and start the AI service

Create a virtual environment and install dependencies:

```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Create `ai-service/.env`. The following configuration is appropriate for a local workspace with a cached MiniLM model:

```env
LLM_PROVIDER=groq
GROQ_API_KEY=your-groq-api-key

EMBEDDING_PROVIDER=local
EMBEDDING_MODEL=all-MiniLM-L6-v2
EMBEDDING_LOCAL_FILES_ONLY=true
CHROMA_PERSIST_DIR=./data/chroma
```

For a new machine, set `EMBEDDING_LOCAL_FILES_ONLY=false` once while online so that the MiniLM model can download. Set it back to `true` afterwards to keep local indexing independent of Hugging Face metadata requests.

Start the AI service:

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

The first repository indexing request loads the local embedding model.

### 3. Start the frontend

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite forwards `/api/*` requests to the backend at port 8080.

## Deployment configuration

The PyTorch-based local embedding model can exceed the memory available on small hosting plans. On Render's memory-constrained plans, configure the AI service to use the zero-model lexical provider:

```env
EMBEDDING_PROVIDER=lexical
```

This provider uses deterministic hashed tokens rather than a downloaded machine-learning model. It has no embedding API quota and a very small memory footprint. Retrieval is strongest for code identifiers, file names, symbols, and related technical vocabulary; use a semantic provider on plans with sufficient resources when higher-quality conceptual matching is required.

Each embedding provider uses its own Chroma collection namespace. After changing providers, submit the failed repository again so its persisted chunks are indexed with the selected provider.

The CPU-only ONNX MiniLM provider remains available for deployments with enough memory for its model initialization:

```env
EMBEDDING_PROVIDER=onnx
```

The ONNX model is downloaded to the AI service's local cache on first use. On ephemeral infrastructure, it is downloaded again after an instance replacement.

Google embeddings remain available when the deployment has sufficient quota and a configured billing plan:

```env
EMBEDDING_PROVIDER=google
GOOGLE_API_KEY=your-google-api-key
GOOGLE_EMBEDDING_MODEL=models/gemini-embedding-001
```

Configure the backend with the AI service URL and a production database as needed:

```env
AI_SERVICE_URL=https://your-ai-service.example
APP_JWT_SECRET=replace-with-a-unique-production-secret
APP_ALLOWED_ORIGINS=https://your-frontend.example

DB_HOST=database-host
DB_PORT=5432
DB_NAME=sensei
DB_USER=sensei
DB_PASSWORD=replace-with-a-secure-password
```

Start the backend with the PostgreSQL profile:

```powershell
cd backend
mvn spring-boot:run "-Dspring-boot.run.profiles=postgres"
```

On ephemeral infrastructure, do not rely on the AI service disk for durable data. Persist database records in PostgreSQL; Sensei rebuilds its Chroma cache from stored chunks when required.

## Configuration reference

### Backend

| Variable or setting | Default | Purpose |
|---|---|---|
| `AI_SERVICE_URL` | `http://localhost:8000` | Base URL for the FastAPI service |
| `APP_JWT_SECRET` | Development-only fallback | JWT signing secret; set a unique value in every real environment |
| `APP_ALLOWED_ORIGINS` | Local Vite origins | Allowed browser origins for CORS |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — | Google OAuth2 credentials |
| `app.storage.repo-dir` | `./storage/repos` | Managed clone storage location |
| `spring.profiles.active` | — | Set to `postgres` to use PostgreSQL instead of H2 |

### AI service

| Variable | Default | Purpose |
|---|---|---|
| `LLM_PROVIDER` | `groq` | Chat provider: `groq` or `google` |
| `GROQ_API_KEY` | — | Required for the Groq provider |
| `GOOGLE_API_KEY` | — | Required for Google chat or Google embeddings |
| `LLM_MODEL` | `llama-3.3-70b-versatile` | Primary chat model |
| `LLM_FALLBACK_MODELS` | Groq fallback list | Ordered fallback models for rate-limit or availability failures |
| `EMBEDDING_PROVIDER` | `google` | `local` for PyTorch MiniLM, `lexical` for zero-model constrained deployments, `onnx` for CPU MiniLM, or `google` for managed embeddings |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Local SentenceTransformer model |
| `EMBEDDING_LOCAL_FILES_ONLY` | `true` | Keep local MiniLM loading offline after the initial download |
| `GOOGLE_EMBEDDING_MODEL` | `models/gemini-embedding-001` | Managed embedding model |
| `CHROMA_PERSIST_DIR` | `./data/chroma` | ChromaDB persistence path |

## API overview

Unless noted otherwise, backend endpoints require an `Authorization: Bearer <token>` header.

### Authentication and health

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Create a local account |
| `POST` | `/api/auth/login` | Public | Authenticate a local account and receive a JWT |
| `GET` | `/api/auth/me` | Authenticated | Retrieve the current user |
| `GET` | `/oauth2/authorization/google` | Public | Begin Google OAuth2 sign-in |
| `GET` | `/api/health` | Public | Backend liveness check |
| `GET` | `/health` | Public | AI service liveness check |

### Repository lifecycle and analysis

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/repositories` | Submit a public GitHub repository and optional branch |
| `GET` | `/api/repositories` | List repositories visible to the current user |
| `GET` | `/api/repositories/{id}` | Get repository status and summary |
| `DELETE` | `/api/repositories/{id}` | Remove a repository, its derived data, index, and managed clone |
| `GET` | `/api/repositories/{repoId}/architecture` | Return the full architecture graph |
| `GET` | `/api/repositories/{repoId}/architecture/spring-layers` | Return the Spring-layer architecture graph |
| `GET` | `/api/repositories/{repoId}/entities` | Return extracted code entities |
| `GET` | `/api/repositories/{repoId}/relationships` | Return extracted relationships |
| `GET` | `/api/repositories/{repoId}/files` | Return indexed files |
| `GET` | `/api/repositories/{repoId}/files/content?filePath=...` | Read a source file within the managed clone |
| `GET` | `/api/repositories/{repoId}/chunks` | Return persisted code chunks |
| `GET` | `/api/repositories/{repoId}/search?query=...` | Keyword-search code chunks |

### AI features

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/repositories/{repoId}/chat` | Stream a source-grounded answer as plain UTF-8 text |
| `POST` | `/api/repositories/{repoId}/onboarding` | Generate an onboarding guide |
| `POST` | `/api/ai/index` | Index chunks in ChromaDB; used by the backend |
| `DELETE` | `/api/ai/index/{repoId}` | Delete a repository vector collection |
| `GET` | `/api/ai/index/{repoId}/status` | Return index availability and chunk count |
| `POST` | `/api/ai/chat` | Stream a retrieval-augmented answer; used by the backend |
| `POST` | `/api/ai/agent-chat` | Stream a tool-using agent answer |
| `POST` | `/api/ai/onboarding` | Generate an onboarding guide; used by the backend |

## Security and operational notes

- Repository submission accepts public `https://github.com/owner/repository` URLs only.
- Repository work is asynchronous so clone, parse, and embedding operations do not occupy the request thread that accepted the submission.
- The ingestion executor is bounded to apply back-pressure under load.
- The API is stateless and protects authenticated routes with JWT bearer tokens.
- File-content requests resolve and normalize paths under the managed clone root before reading them.
- Source walking skips dependency, VCS, build, cache, and generated-output directories, and ignores excessively large files.
- ChromaDB holds derived vectors; code chunks in H2 or PostgreSQL support index reconstruction after a service restart.
- Google embedding batches retry quota-related failures with a backoff. Chat uses the configured model fallback list for supported rate-limit and availability failures.

## Project structure

```text
Project_1/
├── frontend/                         React workspace and Vite configuration
│   └── src/
│       ├── components/               Graph, code, chat, navigation, and setup UI
│       ├── pages/                    Login, dashboard, repository, and OAuth callback pages
│       ├── services/                 Authenticated API and stream client
│       ├── store/                    Zustand application and auth state
│       └── types/                    Shared frontend type definitions
├── backend/                          Spring Boot service
│   └── src/main/java/com/sensei/
│       ├── analyzer/                 Java, TypeScript, Python, and C/C++ analyzers
│       ├── controller/               REST and streaming endpoints
│       ├── security/                 OAuth2, JWT, CORS, and authorization configuration
│       ├── service/                  Ingestion, cloning, persistence, AI client, and graph services
│       ├── entity/ repository/       JPA data model and repositories
│       └── config/                   Web client and asynchronous executor configuration
└── ai-service/                       FastAPI service
    ├── main.py                       HTTP endpoints
    ├── vector_store.py               ChromaDB and embedding providers
    ├── rag_chain.py                  Retrieval and streamed chat chain
    ├── agent_chain.py                Tool-using agent chat
    └── config.py                     Environment-based AI service settings
```

## Troubleshooting

| Symptom | Likely cause | Resolution |
|---|---|---|
| Repository reaches `FAILED` during indexing | The AI service is unavailable or its embedding provider is misconfigured | Confirm the AI service is reachable at `AI_SERVICE_URL` and verify its embedding variables |
| Local MiniLM cannot load | The model has not been cached yet while offline-only mode is active | Temporarily set `EMBEDDING_LOCAL_FILES_ONLY=false`, start the AI service while online, then restore it to `true` |
| Chat reports no indexed code | The repository is not ready or its vector collection was removed | Wait for `READY`; the backend rebuilds a missing vector collection from persisted chunks on the next chat request |
| Google embedding requests are rate-limited | Provider quota is exhausted | Use `EMBEDDING_PROVIDER=lexical` in the deployed AI service or configure a Google project with adequate billed quota |
| Deployed AI service returns 502 while indexing | The container restarted while initializing its embedding model | Set `EMBEDDING_PROVIDER=lexical`, redeploy the AI service, then submit the repository again |
| Re-submission fails after deleting a repository | A prior cleanup task overlapped with the new ingestion | Deploy the backend update; deletion and re-submission are serialized and ingestion begins only after its database transaction commits |
| Browser requests fail with CORS errors | The frontend origin is not allowed by the backend | Set `APP_ALLOWED_ORIGINS` to include the deployed frontend URL |
| Google OAuth sign-in fails locally | The authorized redirect URI or client credentials are missing | Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the matching local redirect URI in Google Cloud |

## License

Provided as-is for educational and portfolio use.
