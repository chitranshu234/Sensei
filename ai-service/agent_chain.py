import logging
from typing import AsyncIterator
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

from config import settings
from vector_store import vector_store_service

logger = logging.getLogger(__name__)

# --- 1. Define the Agent's Tools ---

@tool
def search_codebase(repo_id: int, query: str) -> str:
    """
    Searches the repository's codebase for specific concepts, functions, or files.
    Always use this tool if you need to know how something is implemented in the repository.
    """
    logger.info(f"Agent is searching codebase for repo {repo_id}: {query}")
    docs = vector_store_service.search(repo_id, query, k=5)
    
    if not docs:
        return "No relevant code found in the repository."
    
    parts = []
    for doc in docs:
        meta = doc.get("metadata", {})
        file_path = meta.get("filePath", "unknown")
        start = meta.get("startLine", "?")
        end = meta.get("endLine", "?")
        parts.append(f"--- File: {file_path} (Lines {start}-{end}) ---\n{doc['content']}\n")
        
    return "\n".join(parts)


# --- 2. Build the Agent ---

def _make_agent_llm(model: str):
    if settings.llm_provider == "groq":
        return ChatGroq(
            model=model,
            groq_api_key=settings.groq_api_key,
            temperature=settings.llm_temperature,
            max_retries=1
        )
    else:
        return ChatGoogleGenerativeAI(
            model=model,
            google_api_key=settings.google_api_key,
            temperature=settings.llm_temperature,
            max_retries=1
        )

# --- 3. Stream the Agent's thought process and final response ---

async def stream_agent_chat(repo_id: int, question: str) -> AsyncIterator[str]:
    """
    Streams the agent's intermediate steps (tool calls) and its final answer
    back to the client in real-time SSE format.
    """
    model_name = settings.get_model_list()[0]
    llm = _make_agent_llm(model_name)
    tools = [search_codebase]
    
    system_prompt = f"""You are a brilliant, autonomous Senior Software Engineer AI.
You have access to a tool called `search_codebase` which lets you search the repository's codebase.

RULES:
1. ALWAYS use the `search_codebase` tool to look up code before answering technical questions.
2. The user is asking about the repository with ID: {repo_id}. YOU MUST pass this exact `repo_id` integer ({repo_id}) to the tool.
3. DO NOT use the tool more than TWO times. Collect the context you find and formulate your final answer immediately.
4. Format your final answers beautifully using markdown, and cite the file names you find.
5. Do not guess how the code works; use the tool to verify.
"""

    agent = create_react_agent(llm, tools)
    
    inputs = {
        "messages": [
            ("system", system_prompt),
            ("human", question)
        ]
    }
    
    try:
        # We use astream_events to intercept both tool executions and token streaming
        async for event in agent.astream_events(inputs, version="v2"):
            kind = event["event"]
            
            # 1. When the agent decides to use a tool
            if kind == "on_tool_start":
                tool_name = event["name"]
                query_args = event["data"].get("input", {}).get("query", "...")
                yield f"\n\n> 🤖 **Agent Thought:** *I need to use my `{tool_name}` tool to search for `{query_args}`...*\n\n"
            
            # 2. When the agent streams its final response text
            elif kind == "on_chat_model_stream":
                chunk = event["data"]["chunk"]
                if hasattr(chunk, "content") and chunk.content:
                    # Filter out internal tool call tokens
                    if isinstance(chunk.content, str):
                        yield chunk.content
                    elif isinstance(chunk.content, list):
                        for item in chunk.content:
                            if isinstance(item, dict) and "text" in item:
                                yield item["text"]
                    
    except Exception as e:
        logger.error(f"Agent streaming error: {e}")
        yield f"\n\n⚠️ Agent encountered an error: {str(e)}"
