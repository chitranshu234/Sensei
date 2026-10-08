# Sensei-AI Codebase Intelligence & Onboarding

An AI-powered platform that analyzes GitHub repositories, extracts architecture patterns, and provides source-grounded answers through RAG-powered chat.

## Architecture

```
                    USER
                     │
                     ▼
              React Frontend (:5173)
                     │
                REST / SSE
                     │
                     ▼
             Spring Boot Backend (:8080)
                     │
        ┌────────────┼────────────┐
        │            │            │
        ▼            ▼            ▼
   H2/PostgreSQL  GitHub API  Python AI Service (:8000)
                                  │
                          ┌───────┼───────┐
                          │       │       │
                          ▼       ▼       ▼
                      ChromaDB LangChain Gemini LLM
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS v4 |
| Backend | Spring Boot 3.4 + JPA + H2/PostgreSQL |
| AI Service | Python FastAPI + LangChain + ChromaDB |
| LLM | Google Gemini (via langchain-google-genai) |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2, local) |
| Graph UI | React Flow (@xyflow/react) |

## Project Structure

```
Project_1/
├── frontend/          # React + Vite + Tailwind v4
│   └── src/
│       ├── components/   # Navbar, RepoInput, ChatPanel, etc.
│       ├── pages/        # Dashboard, RepositoryPage
│       ├── services/     # API client
│       ├── store/        # Zustand state management
│       └── types/        # TypeScript type definitions
├── backend/           # Spring Boot
│   └── src/main/java/com/codeintel/
│       ├── analyzer/     # Java AST parser (Tree-sitter style)
│       ├── config/       # CORS, Async, WebClient configs
│       ├── controller/   # REST endpoints
│       ├── dto/          # Request/Response DTOs
│       ├── entity/       # JPA entities
│       ├── model/        # Enums (RepoStatus, EntityType, etc.)
│       ├── repository/   # Spring Data JPA repos
│       └── service/      # Business logic + AI client
└── ai-service/        # Python FastAPI
    ├── main.py           # FastAPI app + endpoints
    ├── config.py         # Settings (from .env)
    ├── vector_store.py   # ChromaDB vector store
    └── rag_chain.py      # LangChain RAG chain + prompts
```

## Getting Started

### Prerequisites

- **Java 21+** (for Spring Boot backend)
- **Node.js 18+** (for React frontend)
- **Python 3.10+** (for AI service)
- **Google Gemini API key** (get one at https://aistudio.google.com/apikey)

### 1. Backend (Spring Boot)

```bash
cd backend
./mvnw spring-boot:run
# Runs on http://localhost:8080
# H2 Console at http://localhost:8080/h2-console
```

### 2. AI Service (Python)

```bash
cd ai-service
cp .env.example .env
# Edit .env and add your GROQ_API_KEY

# Option A: Using pip
python -m venv venv
venv\Scripts\activate    # Windows
pip install -r requirements.txt
python main.py

# Option B: Using uv
uv run main.py

# Runs on http://localhost:8000
```

### 3. Frontend (React)

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
# Proxies /api/* to http://localhost:8080
```

## How It Works

1. **Submit a GitHub URL** → Spring Boot clones the repository
2. **Java Code Parser** → Extracts classes, methods, relationships, annotations using AST analysis
3. **Code Chunking** → Splits code into meaningful chunks with summaries
4. **Vector Indexing** → Sends chunks to Python AI service → embedded via sentence-transformers → stored in ChromaDB
5. **Architecture Graph** → Builds a layered dependency graph (Controllers → Services → Repositories → Entities)
6. **RAG Chat** → User asks a question → retrieves relevant chunks from ChromaDB → sends to Gemini LLM → streams grounded answer with file:line citations

## API Endpoints

### Spring Boot Backend (`:8080`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/repositories` | Submit a GitHub URL for analysis |
| GET | `/api/repositories` | List all repositories |
| GET | `/api/repositories/{id}` | Get repository details |
| GET | `/api/repositories/{id}/architecture` | Get architecture graph |
| GET | `/api/repositories/{id}/files` | List parsed files |
| GET | `/api/repositories/{id}/files/content` | Get file content |
| POST | `/api/repositories/{id}/chat` | Chat with AI (SSE stream) |
| POST | `/api/repositories/{id}/onboarding` | Generate onboarding guide |

### Python AI Service (`:8000`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ai/index` | Index code chunks into ChromaDB |
| POST | `/api/ai/chat` | RAG-powered streaming chat |
| POST | `/api/ai/onboarding` | Generate onboarding guide |
| GET | `/health` | Health check |
