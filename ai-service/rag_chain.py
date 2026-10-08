"""
RAG chain using LangChain + Groq (or Google Gemini) for code-grounded Q&A.
"""
import logging
from typing import AsyncIterator

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

from config import settings
from vector_store import vector_store_service

logger = logging.getLogger(__name__)

# System prompt for code Q&A
CODE_QA_SYSTEM_PROMPT = """You are an expert code analyst AI assistant. Your role is to answer questions about a codebase using ONLY the provided source code context.

RULES:
1. Base your answers ONLY on the provided code context. Never fabricate code or APIs.
2. When referencing code, use citation format: `FileName.java:startLine-endLine`
3. Explain code clearly with proper technical terminology.
4. If the context doesn't contain enough information, say so honestly.
5. Structure your answers with headings and bullet points for readability. DO NOT use raw 4-space indentation for regular text as it breaks markdown parsing.
6. When explaining architecture, describe the flow between components.
7. Always format code snippets using triple backticks with the language tag (e.g., ```java). NEVER wrap regular text inside code blocks.

CONTEXT (source code from the repository):
{context}
"""

CODE_QA_PROMPT = ChatPromptTemplate.from_messages([
    ("system", CODE_QA_SYSTEM_PROMPT),
    ("human", "{question}"),
])

ONBOARDING_SYSTEM_PROMPT = """You are an expert code analyst creating an onboarding guide for a new developer joining a project. Using ONLY the provided source code context, create a comprehensive onboarding document.

Include the following sections:
1. **Project Overview** - What does this project do?
2. **Architecture** - How is the code organized? What are the main layers/modules?
3. **Key Components** - List the most important classes/services and their roles.
4. **Request Flow** - How does a typical request flow through the system?
5. **Getting Started** - Key files a new developer should read first.
6. **Important Patterns** - Design patterns, conventions, and coding standards used.

IMPORTANT: Always format code snippets using triple backticks with a language tag. DO NOT use 4-space indentation for regular text.
Use `FileName.java:startLine-endLine` citations when referencing specific code.

CONTEXT (source code from the repository):
{context}
"""

ONBOARDING_PROMPT = ChatPromptTemplate.from_messages([
    ("system", ONBOARDING_SYSTEM_PROMPT),
    ("human", "Generate a comprehensive onboarding guide for this codebase."),
])




RATE_LIMIT_ERRORS = (Exception,)  # broad catch; filtered by _is_rate_limit


def _make_llm(model: str):
    """Create an LLM instance using the configured provider."""
    if settings.llm_provider == "groq":
        return ChatGroq(
            model=model,
            groq_api_key=settings.groq_api_key,
            temperature=settings.llm_temperature,
            max_tokens=settings.llm_max_tokens,
        )
    else:
        return ChatGoogleGenerativeAI(
            model=model,
            google_api_key=settings.google_api_key,
            temperature=settings.llm_temperature,
            max_output_tokens=settings.llm_max_tokens,
        )


def _is_rate_limit(exc: Exception) -> bool:
    """Return True if error should trigger fallback (rate limits, quota, server errors, deprecated models)."""
    msg = str(exc).lower()
    return any(k in msg for k in (
        "429", "resource_exhausted", "quota", "rate limit", "ratelimit", "ratequota",
        "500", "503", "internal error", "service unavailable", "unavailable", "high demand",
        "404", "not found", "no longer available", "deprecated",
    ))


def _build_llm_chain(prompt: ChatPromptTemplate):
    """
    Build a LangChain chain that falls back through the model list automatically
    when a rate-limit error is encountered.
    """
    models = settings.get_model_list()
    llms = [_make_llm(m) for m in models]

    if len(llms) == 1:
        return prompt | llms[0] | StrOutputParser()

    # LangChain's .with_fallbacks lets us chain alternatives
    primary = llms[0]
    fallbacks = llms[1:]
    llm_with_fallbacks = primary.with_fallbacks(
        fallbacks,
        exceptions_to_handle=RATE_LIMIT_ERRORS,
    )
    return prompt | llm_with_fallbacks | StrOutputParser()


async def _stream_with_fallback(prompt: ChatPromptTemplate, inputs: dict) -> AsyncIterator[str]:
    """
    Stream from the primary model; if a rate-limit error is raised mid-stream,
    fall back to the next model and restart (non-streaming fallback to complete).
    """
    models = settings.get_model_list()
    last_exc: Exception | None = None

    for i, model_name in enumerate(models):
        llm = _make_llm(model_name)
        chain = prompt | llm | StrOutputParser()
        try:
            logger.info("Using LLM model: %s", model_name)
            async for chunk in chain.astream(inputs):
                yield chunk
            return  # success — done
        except Exception as e:
            last_exc = e
            if _is_rate_limit(e) and i < len(models) - 1:
                next_model = models[i + 1]
                logger.warning(
                    "Rate limit hit on %s, falling back to %s. Error: %s",
                    model_name, next_model, e,
                )
                yield f"\n\n> ⚠️ Rate limit on **{model_name}** — switching to **{next_model}**…\n\n"
                continue  # try next model
            else:
                logger.error("LLM error on %s (no more fallbacks): %s", model_name, e)
                raise

    if last_exc:
        raise last_exc


def _format_context(docs: list[dict]) -> str:
    """Format retrieved documents into a context string."""
    parts = []
    for i, doc in enumerate(docs):
        meta = doc.get("metadata", {})
        file_path = meta.get("filePath", "unknown")
        entity = meta.get("entityName", "")
        chunk_type = meta.get("chunkType", "")
        start = meta.get("startLine", "?")
        end = meta.get("endLine", "?")

        content = doc.get('content', '')
        # Truncate overly massive file chunks (common for JS/TS single files)
        # 3000 chars is roughly 750 tokens. 4 chunks = 3000 tokens (well under 8k limit)
        if len(content) > 3000:
            content = content[:3000] + "\n\n...[Code truncated due to length limits]..."

        header = f"--- [{file_path}:{start}-{end}] {chunk_type} {entity} ---"
        parts.append(f"{header}\n{content}\n")

    return "\n".join(parts)


async def stream_chat(repo_id: int, question: str) -> AsyncIterator[str]:
    """Stream a RAG-powered answer about the codebase, with auto model fallback."""
    # 1. Retrieve relevant code chunks
    docs = vector_store_service.search(repo_id, question, k=4)

    if not docs:
        yield "I don't have any indexed code for this repository yet. Please make sure the repository has been fully processed and indexed."
        return

    context = _format_context(docs)

    # 2. Stream with automatic fallback on rate-limit errors
    try:
        async for chunk in _stream_with_fallback(
            CODE_QA_PROMPT,
            {"context": context, "question": question},
        ):
            yield chunk
    except Exception as e:
        logger.error("LLM streaming error (all models exhausted): %s", e)
        yield f"\n\n---\n⚠️ *All models are currently rate-limited or unavailable. Please try again later.*\n\n*Details: {str(e)}*"


async def generate_onboarding(repo_id: int) -> dict:
    """Generate a comprehensive onboarding guide for a repository."""
    # Retrieve a broad set of code chunks
    overview_docs = vector_store_service.search(repo_id, "project overview architecture main components", k=12)
    service_docs = vector_store_service.search(repo_id, "service business logic controller", k=8)
    config_docs = vector_store_service.search(repo_id, "configuration security setup", k=6)

    # Deduplicate by content
    seen = set()
    all_docs = []
    for doc in overview_docs + service_docs + config_docs:
        key = doc["content"][:200]
        if key not in seen:
            seen.add(key)
            all_docs.append(doc)

    if not all_docs:
        return {
            "guide": "No code has been indexed for this repository yet.",
            "sections": [],
        }

    # Limit to 8 chunks to avoid blowing past 8k token limit
    context = _format_context(all_docs[:8])  

    chain = _build_llm_chain(ONBOARDING_PROMPT)

    try:
        guide = await chain.ainvoke({"context": context})
        return {
            "guide": guide,
            "chunksUsed": len(all_docs[:8]),
        }
    except Exception as e:
        logger.error("Onboarding generation error (all models exhausted): %s", e)
        return {
            "error": f"Failed to generate onboarding guide: {str(e)}",
        }
