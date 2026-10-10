import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    # Google Gemini (kept for backward compat)
    google_api_key: str = os.getenv("GOOGLE_API_KEY", "")

    # Groq
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")

    # Embedding
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

    # ChromaDB
    chroma_persist_dir: str = os.getenv("CHROMA_PERSIST_DIR", "./data/chroma")

    # LLM
    llm_provider: str = os.getenv("LLM_PROVIDER", "groq")  # "groq" or "google"
    llm_model: str = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")
    llm_fallback_models: str = os.getenv(
        "LLM_FALLBACK_MODELS", "llama-3.1-8b-instant,llama3-8b-8192,gemma2-9b-it"
    )
    llm_temperature: float = float(os.getenv("LLM_TEMPERATURE", "0.2"))
    llm_max_tokens: int = int(os.getenv("LLM_MAX_TOKENS", "4096"))

    def get_model_list(self) -> list[str]:
        """Returns [primary] + fallbacks as an ordered list."""
        fallbacks = [m.strip() for m in self.llm_fallback_models.split(",") if m.strip()]
        return [self.llm_model] + fallbacks

    class Config:
        env_file = ".env"


settings = Settings()
