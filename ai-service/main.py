"""
FastAPI application for the AI Codebase Intelligence service.
Provides endpoints for code chunk indexing, RAG-powered chat, and onboarding generation.
"""
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from vector_store import vector_store_service
from rag_chain import stream_chat, generate_onboarding
from agent_chain import stream_agent_chat

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Codebase Intelligence Service",
    description="RAG-powered code understanding with LangChain + ChromaDB",
    version="0.1.0",
)

# CORS — allow Spring Boot backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request/Response Models ─────────────────────────────────

class ChunkData(BaseModel):
    filePath: str = ""
    entityName: str = ""
    chunkType: str = ""
    startLine: int = 0
    endLine: int = 0
    content: str = ""
    summary: str = ""


class IndexRequest(BaseModel):
    repoId: int
    chunks: list[ChunkData]


class ChatRequest(BaseModel):
    repoId: int
    message: str
    sessionId: str | None = None


class OnboardingRequest(BaseModel):
    repoId: int


# ─── Health Check ─────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "ai-codebase-intelligence"}


@app.get("/")
async def root():
    return {"status": "ok", "message": "Render health check passed"}


# ─── Index Endpoint ───────────────────────────────────────────

@app.post("/api/ai/index")
async def index_chunks(request: IndexRequest):
    """Receive code chunks from Spring Boot and index them into ChromaDB."""
    logger.info(
        "Indexing %d chunks for repo %d",
        len(request.chunks),
        request.repoId,
    )

    chunks_data = [chunk.model_dump() for chunk in request.chunks]
    count = vector_store_service.index_chunks(request.repoId, chunks_data)

    return {
        "status": "ok",
        "indexed": count,
        "repoId": request.repoId,
    }


@app.delete("/api/ai/index/{repo_id}")
async def delete_repo(repo_id: int):
    """Delete a repository's vector store collection."""
    logger.info("Deleting vector store for repo %d", repo_id)
    vector_store_service.delete_repo(repo_id)
    return {"status": "ok", "repoId": repo_id}


@app.get("/api/ai/index/{repo_id}/status")
async def index_status(repo_id: int):
    """Report whether this running AI instance has a usable repository index.

    Chroma is deliberately treated as a rebuildable cache: Render can replace the
    instance or its local disk during a deploy.  The Spring service keeps the
    source chunks in Postgres and uses this lightweight check to restore a
    missing cache before answering a question.
    """
    return {
        "status": "ok",
        "repoId": repo_id,
        "indexed": vector_store_service.count_repo_chunks(repo_id),
    }


# ─── Chat Endpoint (SSE Streaming) ───────────────────────────

@app.post("/api/ai/chat")
async def chat(request: ChatRequest):
    """Stream a RAG-powered response about the codebase."""
    logger.info(
        "Chat request for repo %d: %s",
        request.repoId,
        request.message[:100],
    )

    async def event_generator():
        async for chunk in stream_chat(request.repoId, request.message):
            yield chunk

    return StreamingResponse(
        event_generator(),
        media_type="text/plain",
    )


# ─── Agent Chat Endpoint (Autonomous AI) ─────────────────────

@app.post("/api/ai/agent-chat")
async def agent_chat(request: ChatRequest):
    """Stream an Agent-powered response with autonomous tool execution."""
    logger.info(
        "Agent chat request for repo %d: %s",
        request.repoId,
        request.message[:100],
    )

    async def event_generator():
        async for chunk in stream_agent_chat(request.repoId, request.message):
            yield chunk

    return StreamingResponse(
        event_generator(),
        media_type="text/plain",
    )


# ─── Onboarding Endpoint ─────────────────────────────────────

@app.post("/api/ai/onboarding")
async def onboarding(request: OnboardingRequest):
    """Generate a comprehensive onboarding guide for a repository."""
    logger.info("Generating onboarding guide for repo %d", request.repoId)

    result = await generate_onboarding(request.repoId)

    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    return result


# ─── Entry point ──────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
