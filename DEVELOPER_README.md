# Sensei — Developer & Interview Guide (personal)

> This is the "explain it to me like I'm starting from zero" document. Plain language, the full
> architecture from scratch, every file and what it does, and a big interview Q&A so I can defend any
> part of this project in a conversation. The user-facing readme is [`README.md`](./README.md).

---

## 1. What is this project, in one breath?

You give it a GitHub link. It downloads the code, reads it, draws a map of how the code's pieces
connect, and lets you *chat* with the codebase — and every answer points at the exact lines it came
from. Think "Google Maps + ChatGPT, but for a code repository."

---

## 2. The three characters (and a simple analogy)

Imagine a **library**:

1. **Frontend (React)** = the *front desk*. It's what you see and click. It never touches the AI or
   the database directly — it only talks to the backend.
2. **Backend (Spring Boot, Java)** = the *librarian*. It does the heavy lifting: checks your library
   card (auth), fetches the book (clones the repo), reads and catalogues it (parses the code), and
   decides what to show you.
3. **AI service (Python, FastAPI)** = the *research assistant* in the back room. It's good at one
   thing: understanding meaning. It turns code into math (embeddings), remembers it, and when asked a
   question, finds the most relevant pages and writes the answer using an LLM.

They run as **three separate programs** on three ports: frontend `5173`, backend `8080`, AI `8000`.
Keeping them separate means each can be built, scaled, and reasoned about on its own.

---

## 3. The full journey — what happens when you use it

### A. You open the app and log in
1. The browser loads the React app. `AuthGate` checks: is there a saved token?
2. If yes, it calls `GET /api/auth/me` to ask the backend "is this token still good?" If the backend
   says yes, you're in. If not, you're sent to the login screen.
3. You click "Sign in with Google". The backend handles the OAuth2 flow with Google, creates an account on the fly, and hands back a
   **JWT** — a signed token that proves who you are. The frontend saves it in `localStorage`.
4. From now on, every request the frontend makes includes a header: `Authorization: Bearer <token>`.

### B. You submit a GitHub URL
1. Frontend → `POST /api/repositories` with the URL.
2. The backend saves a row with status `QUEUED` and **immediately returns** (it does NOT make you
   wait). The actual work happens on a background thread.
3. The frontend starts **polling** every 2.5 seconds: "is it ready yet?" The status moves through
   `QUEUED → CLONING → PARSING → INDEXING → READY` (or `FAILED`).

### C. The backend ingests the repo (background work)
1. **CLONING** — JGit does a shallow clone (just the latest snapshot) into `storage/repos/…`.
2. **PARSING** — it walks every file, skipping junk folders (`node_modules`, `target`, `.git`, …).
   Each file goes to a *language analyzer*:
   - **Java** → `JavaCodeAnalyzer` uses JavaParser to build a real AST. It finds classes, detects
     Spring stereotypes (`@RestController`, `@Service`, `@Repository`, `@Entity`, …), and records
     relationships: which class **injects** which (`@Autowired`/constructor), which **calls** which,
     and `extends`/`implements`.
   - **TS/JS, Python, C/C++** → `TypeScriptCodeAnalyzer`, `PythonCodeAnalyzer`, and `CCodeAnalyzer` use regex heuristics to find components, functions,
     classes, and imports/includes.
   - Everything becomes three lists: **entities** (classes/components), **relationships** (edges), and
     **chunks** (pieces of code with summaries, for the AI).
3. The whole result is saved **in one database transaction** (`IngestionPersistence`).
4. **INDEXING** — the chunks are POSTed to the Python AI service, which embeds them (turns them into
   vectors) and stores them in ChromaDB, one collection per repository.
5. **READY** — stats are saved (file/class/method/relationship counts).

### D. You explore
- **Architecture tab**: the frontend calls `GET /…/architecture`. The backend's `ArchitectureService`
  turns the stored entities + relationships into `{nodes, edges}`. React Flow + dagre lay it out as a
  graph. You can filter by layer, switch to a "Spring layers only" view, search, and click a node to
  see what injects/calls it.
- **Code tab**: the file tree comes from `GET /…/files`; clicking a file calls
  `GET /…/files/content?filePath=…` which safely reads the file off disk.
- **Chat tab**: you ask a question → `POST /…/chat`. The backend forwards it to the AI service, which
  retrieves the 4 most relevant chunks from ChromaDB, stuffs them into a prompt, and asks the LLM. The
  answer **streams back token-by-token** over SSE, through the backend, to the browser. Citations like
  `UserService.java:10-25` are rendered as clickable buttons that jump to that file and highlight
  those lines.

### E. Why streaming (SSE)?
LLM answers are slow to generate fully but fast to start. Streaming shows words as they're produced,
so it *feels* instant. We use Server-Sent Events (a one-way stream of text frames) rather than
WebSockets because the data only flows one direction (server → browser).

---

## 4. How authentication works (the security story)

- **OAuth2 Login**: We use Google OAuth2 instead of storing passwords. The backend creates a user record using the Google email, so no passwords are ever stored or hashed locally.
- **JWT (JSON Web Token)** = a signed statement of "who you are." It has three parts
  (header.payload.signature). The payload says your username, role, etc. The **signature** is made
  with a secret only the server knows, so nobody can forge or tamper with it. Anyone can *read* a JWT
  (it's not encrypted), so we never put secrets in it.
- **Stateless**: the server keeps **no session table**. Each request carries its token; the server
  re-checks the signature every time. This means we can run many copies of the backend without sharing
  session state — easy to scale.
- **The filter**: `JwtAuthenticationFilter` runs on each request, reads the `Authorization` header,
  validates the token, and tells Spring Security "this request belongs to user X with role Y."
- **Deny by default**: in `SecurityConfig`, the catch-all rule is `authenticated()`. Only login,
  register, health, and (in dev) the H2 console are public. So if someone adds a new endpoint later and
  forgets to secure it, it's protected automatically.
- **CSRF is disabled on purpose**: CSRF attacks abuse cookies the browser sends automatically. We
  don't use cookies for auth — we use an explicit header a cross-site form can't set — so there's
  nothing to attack. (If we'd used cookie auth, we'd need CSRF protection back on.)
- **First user = admin**: The first Google account to log in automatically becomes the administrator.

---

## 5. The data model (the database tables)

All tables are flat and linked by a plain `repoId` column (no JPA foreign-key relationships — simpler,
and ingestion saves in bulk). H2 by default; PostgreSQL via a profile.

| Table | Entity class | Holds | Key columns |
|-------|-------------|-------|-------------|
| `users` | `UserEntity` | accounts | username (unique), passwordHash, role, enabled |
| `repositories` | `RepositoryEntity` | one row per submitted repo | githubUrl, status, clonePath, stats |
| `code_files` | `CodeFileEntity` | one row per parsed file | filePath, language, lineCount |
| `code_entities` | `CodeEntity` | classes/components/etc. | name, qualifiedName, entityType, filePath |
| `code_relationships` | `CodeRelationshipEntity` | edges | sourceName, targetName, relationType |
| `code_chunks` | `CodeChunkEntity` | pieces of code for the AI | content, summary, startLine, endLine |

`EntityType` (enum): CLASS, INTERFACE, ENUM, RECORD, ANNOTATION, CONTROLLER, REST_CONTROLLER, SERVICE,
REPOSITORY, ENTITY, COMPONENT, CONFIGURATION, FUNCTION, METHOD.
`RelationType` (enum): CALLS, INJECTS, EXTENDS, IMPLEMENTS, IMPORTS, CONTAINS, USES_ANNOTATION.
`RepoStatus` (enum): QUEUED, CLONING, PARSING, INDEXING, READY, FAILED.

---

## 6. Every file and what it does

### Backend — `backend/src/main/java/com/sensei/`

**Entry point & config**
- `SenseiApplication.java` — the `main()`; starts Spring Boot. `@EnableAsync` turns on background
  threads.
- `config/AsyncConfig.java` — defines the `ingestionExecutor` thread pool (bounded, with a
  `CallerRunsPolicy` back-pressure strategy) so repo ingestion never runs on the web request thread.
- `config/WebClientConfig.java` — builds the `WebClient` used to call the Python AI service: 300-second
  timeout (LLMs are slow) and a 16 MB buffer (big responses).

**Security**
- `security/SecurityConfig.java` — the heart of auth: stateless sessions, CSRF off, CORS, BCrypt
  encoder, the authentication provider, which URLs are public vs protected, and JSON 401/403 responses.
- `security/JwtService.java` — mints and validates JWTs; refuses to start if the secret is < 32 bytes.
- `security/JwtAuthenticationFilter.java` — runs once per request, reads the bearer token, and
  populates the security context when it's valid. It never rejects — rejecting is the rules' job.
- `security/UserDetailsServiceImpl.java` — bridges our `users` table to Spring Security's `UserDetails`.

**Controllers (REST endpoints)**
- `controller/AuthController.java` — `/api/auth/me` (OAuth handles login via Security filters).
- `controller/RepositoryController.java` — submit/list/get/delete repositories.
- `controller/ArchitectureController.java` — architecture graph, Spring-layer graph, raw
  entities/relationships.
- `controller/AnalysisController.java` — file list, file content (with path-traversal protection),
  chunks, keyword search.
- `controller/ChatController.java` — streaming chat (SSE) + onboarding; wraps AI tokens into SSE frames.
- `controller/HealthController.java` — `/api/health` liveness probe.

**Services (business logic)**
- `service/RepositoryService.java` — repo lifecycle; submitting is idempotent (re-submitting a READY
  repo returns it; a FAILED one retries). Delete also removes the clone on disk.
- `service/IngestionService.java` — the async pipeline: clone → walk → parse → persist → index, with
  status updates and a skip-list of junk folders.
- `service/IngestionPersistence.java` — the **transactional** write boundary (separate bean on purpose —
  see Q&A on the self-invocation proxy pitfall).
- `service/GitCloneService.java` — JGit shallow clone; validates GitHub HTTPS URLs; safe delete that
  refuses to touch anything outside the storage root.
- `service/ArchitectureService.java` — builds the graph; the clever part is **name resolution**
  (matching a relationship's recorded name to the right entity) and de-duplication.
- `service/AiServiceClient.java` — calls the Python service: `indexChunks` (blocking), `chat`
  (streaming `Flux`), `generateOnboarding` (blocking).

**Analyzers**
- `analyzer/LanguageAnalyzer.java` — the interface (`supports(fileName)`, `analyzeFile(...)`). Spring
  injects *all* implementations as a `List`, and the walker picks the first that claims a file — this
  is the Strategy pattern, open for new languages.
- `analyzer/JavaCodeAnalyzer.java` — real AST parsing with JavaParser; Spring stereotype detection;
  injection/call/inheritance edges.
- `analyzer/TypeScriptCodeAnalyzer.java` — regex-based TS/JS/JSX/TSX parsing.

**Entities / Repositories / DTOs / Models / Exceptions**
- `entity/*` — the JPA tables listed in §5.
- `repository/*Repo.java` — Spring Data JPA interfaces (query methods like `findByRepoId`,
  `findByRepoIdAndEntityTypeIn`, and a custom `@Query` keyword search in `CodeChunkRepo`).
- `dto/*` — request/response shapes (`RepositoryRequest/Response`, `ChatRequest`, `AuthResponse`,
  `LoginRequest`, `RegisterRequest`) with Bean Validation annotations.
- `model/*` — the enums + `AnalysisResult` (a simple holder for the four parsed lists).
- `exception/GlobalExceptionHandler.java` — `@RestControllerAdvice` turning exceptions into consistent
  JSON `{timestamp, status, error, message}`; `ResourceNotFoundException` (404) and
  `BadRequestException` (400).
- `resources/application.yml` — H2 + security + AI-service config. `application-postgres.yml` — the
  Postgres profile.

### AI service — `ai-service/`
- `main.py` — the FastAPI app and endpoints (`/api/ai/index`, `/chat`, `/agent-chat`, `/onboarding`,
  `/health`). Chat/agent return a `StreamingResponse`.
- `config.py` — settings loaded from `.env` (provider, API keys, model list, embedding model, Chroma
  path).
- `vector_store.py` — the ChromaDB wrapper: lazy-loads the MiniLM embedding model, one collection per
  repo (`repo_<id>`), `index_chunks`, `search` (similarity), `delete_repo`.
- `rag_chain.py` — the RAG logic: retrieve top-k chunks → format into a context → prompt the LLM →
  stream the answer. Has **automatic model fallback**: if the primary model is rate-limited, it
  switches to the next model in the list. Also `generate_onboarding`.
- `agent_chain.py` — a LangGraph **ReAct agent** with a `search_codebase` tool; it decides for itself
  when to search before answering. (Exposed at `/api/ai/agent-chat`.)

### Frontend — `frontend/src/`
- `main.tsx` — mounts React with the router.
- `App.tsx` — wraps everything in `AuthGate` and defines routes (`/` dashboard, `/repo/:id`).
- `index.css` — the **design system**: Tailwind v4 `@theme` tokens (paper/ink/vermilion/teal/violet
  palette, Fraunces/Instrument Sans/JetBrains Mono fonts) and component classes (`.sheet`, `.btn`,
  `.field`, `.annotation`, `.tab`, `.md-body`).
- `components/AuthGate.tsx` — shows the app only when signed in; verifies the token on boot.
- `pages/LoginPage.tsx` — sign-in / register screen.
- `pages/Dashboard.tsx` — submit a repo + list of workspaces with live status polling.
- `pages/RepositoryPage.tsx` — the workspace: tabs for Architecture / Code / Chat + onboarding modal.
- `components/Navbar.tsx` — top bar + account menu.
- `components/RepoInput.tsx` — the GitHub URL form.
- `components/ArchitectureGraph.tsx` — the React Flow graph: custom nodes, dagre layout into layer
  clusters, filtering, search, and the node inspector drawer.
- `components/FileExplorer.tsx` — builds a tree from the flat file list.
- `components/CodeViewer.tsx` — syntax-highlighted file viewer with citation line-highlighting.
- `components/ChatPanel.tsx` — the chat UI; streams via `api.streamChat`; renders markdown + clickable
  citations.
- `components/LoadingState.tsx` — the pipeline progress stepper.
- `components/Icons.tsx` — hand-rolled SVG icon set (no icon library).
- `services/api.ts` — the single fetch client: injects the auth header, maps errors to `ApiError`,
  auto-signs-out on 401, and hand-parses the SSE stream (`streamChat`).
- `store/authStore.ts` — Zustand store for auth (bootstrap, login, register, logout).
- `store/appStore.ts` — Zustand store for repositories.
- `utils/tokenStorage.ts` — reads/writes the token + user in `localStorage`.
- `types/*` — TypeScript mirrors of the backend DTOs.

---

## 7. Interview Q&A

### Spring Security & JWT

**Q: Walk me through what happens on a login request.**
A: The user clicks login, triggering `/oauth2/authorization/google`. Spring Security redirects to Google. After the user approves, Google redirects back to `/login/oauth2/code/google`. Spring's `OAuth2SuccessHandler` intercepts this, loads the user's email, creates a `UserEntity` if one doesn't exist, and mints a signed JWT. This JWT is appended to a frontend redirect URL. The frontend extracts and stores the JWT, sending it on every later request.

**Q: Why JWT instead of server sessions?**
A: Statelessness. With sessions, the server stores session state and all requests from a user must hit
a server that has it (sticky sessions) or a shared session store. With JWT, the token itself carries
identity and is verified by signature on each request, so any backend instance can serve any request —
trivial horizontal scaling.

**Q: If JWTs aren't encrypted, isn't that insecure?**
A: A JWT is *signed, not secret*. Anyone can read the payload, so we never put sensitive data in it.
Security comes from the signature: without the server's secret key you can't forge or modify a token
without invalidating it.

**Q: Why is CSRF disabled? Isn't that a red flag?**
A: Not here. CSRF exploits credentials the browser attaches automatically — cookies. We authenticate
with an explicit `Authorization` header that a malicious cross-site page cannot set, so the CSRF attack
surface doesn't exist. If we switched to cookie-based auth, we'd re-enable CSRF.

**Q: Why use Google OAuth instead of storing passwords?**
A: It shifts the burden of credential security, MFA, and account recovery to Google. We never store passwords or hashes, completely eliminating the risk of a database password leak.

**Q: What does `JwtAuthenticationFilter` do, and why does it extend `OncePerRequestFilter`?**
A: It reads the bearer token and, if valid, sets the authentication in the `SecurityContext`.
`OncePerRequestFilter` guarantees it runs exactly once even if the request is internally
forwarded/dispatched, so we don't double-authenticate. It never rejects — authorization rules do that,
keeping "who are you" and "what are you allowed to do" separate.

**Q: Where's the authorization enforced?**
A: In `SecurityConfig`: `anyRequest().authenticated()` is the default (deny by default). Only
`/api/auth/login`, `/register`, `/health`, `/api/health`, and (dev only) the H2 console are public.

**Q: Why configure CORS inside the security chain and not just with `@CrossOrigin`?**
A: The security filter chain runs *before* Spring MVC. If CORS were only configured at the MVC layer,
preflight `OPTIONS` requests would be rejected with 401 before MVC saw them. So CORS is a bean the
security chain uses, and `OPTIONS` is explicitly permitted.

### Spring Boot patterns

**Q: Why is `IngestionPersistence` a separate bean instead of a `@Transactional` method on
`IngestionService`?**
A: The classic Spring self-invocation trap. `@Transactional` works via a proxy that wraps the bean. If
`IngestionService` called its own `@Transactional` method using `this`, the call bypasses the proxy and
the transaction never starts — a mid-save failure would leave half-written rows. Putting the
transactional method on a *different* injected bean means the call goes through its proxy, so the whole
save is atomic.

**Q: How is repo submission non-blocking?**
A: `RepositoryService` saves a `QUEUED` row and calls `ingestAsync`, annotated `@Async("ingestionExecutor")`.
That hands the work to a dedicated thread pool and returns immediately, so the HTTP request finishes in
milliseconds. The client polls for status.

**Q: Why a bounded thread pool with `CallerRunsPolicy`?**
A: Ingestion is heavy (clone + parse + embed). An unbounded pool under a burst would spawn a thread per
repo and exhaust memory. Bounded + `CallerRunsPolicy` means when the queue is full, the submitting
thread runs the task itself — natural back-pressure instead of dropping work.

**Q: How does the analyzer design allow new languages?**
A: `LanguageAnalyzer` is an interface; Spring injects every implementation as a `List`. The file walker
asks each `supports(fileName)` and uses the first match (Strategy pattern). Adding Python support = add
one `@Component` implementing the interface, no other code changes.

**Q: How do you handle errors consistently?**
A: A `@RestControllerAdvice` (`GlobalExceptionHandler`) maps each exception type to the right status and
a uniform JSON body. Ordering matters — specific handlers (404/400) before the catch-all, or everything
would become a 500.

### Streaming / SSE

**Q: Why SSE and not WebSockets for chat?**
A: The data is one-directional (server → client, token by token). SSE is simpler, works over plain
HTTP, and is exactly built for this. WebSockets would be overkill for one-way streaming.

**Q: Why does the frontend use `fetch` + a manual reader instead of the browser's `EventSource`?**
A: `EventSource` can only do GET and can't send a JSON body or an `Authorization` header. We need a POST
with a body and the token, so we read the stream manually and parse SSE frames ourselves (join
consecutive `data:` lines with newlines so code fences survive).

### The architecture graph (the "must" part)

**Q: The hardest problem in the graph — what is it?**
A: **Name resolution.** Analyzers record a relationship using whatever name appeared at the call site —
sometimes fully-qualified (`com.acme.UserService`), sometimes just `UserService`. To draw an edge we
must map that name back to the right stored entity. `ArchitectureService` builds a `NameIndex` that
tries: exact qualified name → exact simple name → last-segment match. Duplicate simple names
(two different `UserRepository`s) are handled by multi-valued maps with a deterministic tie-break
(shortest qualified name, then lowest id) so the graph is stable across requests.

**Q: Why resolve edges by name at all — why not store entity IDs?**
A: During parsing, an entity referenced from another file may not have a database ID yet (IDs are
assigned on save). IDs are backfilled best-effort, but names are the durable key, which makes graph
building order-independent.

**Q: How is the graph laid out visually?**
A: On the frontend, `dagre` computes a top-to-bottom layered layout, grouping nodes into compound
clusters (Adapters → Application → Domain). React Flow renders custom nodes and step edges; animated
dashed edges show dependency-injection flow.

**Q: What's the "Spring layers" view?**
A: A filtered graph showing only Controllers → Services → Repositories → Entities and only the wiring
relationships (INJECTS/EXTENDS/IMPLEMENTS), so the dependency direction is legible. If the repo has no
Spring stereotypes, the backend returns empty and the UI falls back to the full graph.

### AI / RAG

**Q: What is RAG, simply?**
A: Retrieval-Augmented Generation. Instead of hoping the LLM "knows" the code, we *retrieve* the most
relevant real code chunks from the repo and hand them to the LLM as context, telling it to answer only
from that. This grounds answers in truth and gives us citations.

**Q: How does retrieval work?**
A: Each chunk is embedded into a vector (a list of numbers capturing meaning) using the local MiniLM
model and stored in ChromaDB. A question is embedded the same way; ChromaDB returns the chunks whose
vectors are nearest (cosine similarity). The top 4 become the LLM's context.

**Q: Why embeddings instead of keyword search?**
A: Embeddings capture *meaning*, so "how do users log in?" can match an `AuthService` even if the word
"login" never appears. (The backend also has a plain keyword search endpoint for exact matches.)

**Q: Why run embeddings locally?**
A: `all-MiniLM-L6-v2` is small, fast on CPU, free, and keeps code from leaving the machine for the
embedding step — good for privacy and cost. Only the final LLM call goes to a provider.

**Q: What's the model-fallback logic?**
A: `rag_chain.py` keeps an ordered list (primary + fallbacks). If a call fails with a rate-limit /
quota / server error, it switches to the next model and continues, surfacing a small note to the user.
This keeps the demo working on free tiers.

**Q: What's the difference between the RAG chat and the agent chat?**
A: RAG chat always retrieves once, then answers. The **agent** (`agent_chain.py`, LangGraph ReAct)
decides *for itself* whether and how to use a `search_codebase` tool, can search up to twice, then
answers — more autonomous, more flexible, slightly less predictable.

### Database & data flow

**Q: Why no JPA relationships (`@OneToMany`) between entities?**
A: Simplicity and bulk-write performance. Everything is keyed by `repoId` and saved with `saveAll`. We
don't need lazy-loading graphs; the architecture graph is assembled in a service, not by JPA.

**Q: H2 vs PostgreSQL?**
A: H2 (file-based) for zero-setup local dev, including a SQL console. PostgreSQL via a Spring profile
for production. `ddl-auto: update` lets Hibernate create/evolve the schema in dev (you'd switch to
Flyway/Liquibase migrations for production).

**Q: How do you prevent reading arbitrary files via the "file content" endpoint?**
A: Path-traversal guard. The requested path is resolved against the repo's clone root, then
re-checked with `normalize().startsWith(base)`. That stops `../../etc/passwd` from escaping the clone
directory. It's checked *after* normalization, which is the only correct place.

### Frontend

**Q: Why Zustand over Redux?**
A: Much less boilerplate for this app's needs — a couple of small stores (auth, repos). Chat state is
deliberately local to `ChatPanel` because it should vanish when you leave the repo.

**Q: How does the frontend talk to the backend across different ports in dev?**
A: Vite proxies `/api/*` to `localhost:8080`, so the browser only sees one origin and there are no CORS
issues in development.

**Q: How does the design system work in Tailwind v4?**
A: No `tailwind.config.js`. `index.css` uses the `@theme` block to declare CSS custom properties
(colors, fonts) and Tailwind v4 generates utilities from them. Reusable component classes
(`.sheet`, `.btn`, `.field`) live in `@layer components`.

---

## 8. Bugs that existed in the codebase (and how they were fixed)

Good to be able to talk about debugging:

1. **`/api/auth/me` always 500'd (every refresh logged you out).** The JWT filter was skipping *all*
   `/api/auth/*` paths — including `/me`, which actually needs the token — and the controller bound
   `@AuthenticationPrincipal UserDetails` while the filter set the principal as a plain `String`. Fix:
   only skip the truly public auth endpoints, require auth on `/me`, and read the username from
   `Authentication.getName()`.
2. **Frontend didn't compile.** `api.ts` exported `chatStream` (which didn't exist — the function is
   `streamChat`), and `AuthGate` imported a `LoginPage` that was never created. Fix: corrected the
   export and built `LoginPage`.
3. **Chat crashed / 401'd.** `ChatPanel` read chat state from a store that didn't define it, and sent
   its request with no `Authorization` header. Fix: local component state + the shared authenticated
   `api.streamChat`.
4. **Half the UI was unstyled.** The design system had been migrated to a new palette
   (`paper/ink/vermilion`), but several screens still used the old, deleted classes
   (`surface-*/primary-*/glass-card`). Fix: migrated every component to the new system and made it
   responsive. Also loaded the correct fonts (Fraunces/Instrument Sans).
5. **Duplicate architecture nodes for TS/Python/C++.** The analyzers for these languages were extracting both the file itself and its exported functions/methods as full architecture graph `COMPONENT` entities, causing duplicate floating boxes. Fix: changed them to extract functions as `CodeChunkEntity` (for AI RAG) while reserving `CodeEntity` for the main file/class, keeping the architecture graph clean and correctly wired with `CONTAINS` relationships.

---

## 9. 30-second elevator pitch

"Sensei is a three-service app that makes any GitHub repo explorable. A Spring Boot backend clones and
parses the code into an AST, extracts a dependency graph, and secures everything with stateless JWT
auth. A Python FastAPI service embeds the code into a vector database and answers questions with RAG,
streaming grounded, citation-backed answers to a React frontend that renders an interactive
architecture graph. It's a clean example of microservice separation, async processing, retrieval-
augmented generation, and production-minded security."
