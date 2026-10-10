"""
Vector store service using ChromaDB for code chunk storage and retrieval.
"""
import logging
import time
from typing import Optional

import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.embeddings import Embeddings
from langchain_huggingface import HuggingFaceEmbeddings

from config import settings

logger = logging.getLogger(__name__)


class VectorStoreService:
    """Manages per-repository ChromaDB collections for code chunk embeddings."""

    def __init__(self):
        self._embeddings: Optional[Embeddings] = None
        self._chroma_client: Optional[chromadb.ClientAPI] = None
        self._stores: dict[int, Chroma] = {}

    @property
    def embeddings(self) -> Embeddings:
        if self._embeddings is None:
            if settings.embedding_provider == "local":
                logger.info("Loading local embedding model: %s", settings.embedding_model)
                self._embeddings = HuggingFaceEmbeddings(
                    model_name=settings.embedding_model,
                    # Do not make repository ingestion wait on Hugging Face metadata requests.
                    # A new local machine can set EMBEDDING_LOCAL_FILES_ONLY=false once to
                    # download the model, then return to offline mode.
                    model_kwargs={
                        "device": "cpu",
                        "local_files_only": settings.embedding_local_files_only,
                    },
                    encode_kwargs={"normalize_embeddings": True},
                )
            elif settings.embedding_provider == "google":
                if not settings.google_api_key:
                    raise RuntimeError(
                        "GOOGLE_API_KEY is required when EMBEDDING_PROVIDER=google"
                    )
                logger.info("Loading Google embedding model: %s", settings.google_embedding_model)
                self._embeddings = GoogleGenerativeAIEmbeddings(
                    model=settings.google_embedding_model,
                    google_api_key=settings.google_api_key,
                )
            else:
                raise RuntimeError(
                    "Unsupported EMBEDDING_PROVIDER=%r. Use 'local' or 'google'."
                    % settings.embedding_provider
                )
        return self._embeddings

    @property
    def chroma_client(self) -> chromadb.ClientAPI:
        if self._chroma_client is None:
            self._chroma_client = chromadb.PersistentClient(
                path=settings.chroma_persist_dir,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
        return self._chroma_client

    def _collection_name(self, repo_id: int) -> str:
        return f"repo_{repo_id}"

    def get_store(self, repo_id: int) -> Chroma:
        """Get or create a Chroma vector store for a repository."""
        if repo_id not in self._stores:
            self._stores[repo_id] = Chroma(
                client=self.chroma_client,
                collection_name=self._collection_name(repo_id),
                embedding_function=self.embeddings,
            )
        return self._stores[repo_id]

    def index_chunks(self, repo_id: int, chunks: list[dict]) -> int:
        """Index code chunks into the vector store for a repository."""
        if not chunks:
            return 0

        store = self.get_store(repo_id)

        texts = []
        metadatas = []
        ids = []

        for i, chunk in enumerate(chunks):
            # Build a rich text representation for embedding
            text_parts = []
            if chunk.get("entityName"):
                text_parts.append(f"Entity: {chunk['entityName']}")
            if chunk.get("chunkType"):
                text_parts.append(f"Type: {chunk['chunkType']}")
            if chunk.get("filePath"):
                text_parts.append(f"File: {chunk['filePath']}")
            if chunk.get("summary"):
                text_parts.append(f"Summary: {chunk['summary']}")
            if chunk.get("content"):
                text_parts.append(f"Code:\n{chunk['content']}")

            text = "\n".join(text_parts)
            texts.append(text)

            metadatas.append({
                "filePath": chunk.get("filePath", ""),
                "entityName": chunk.get("entityName", ""),
                "chunkType": chunk.get("chunkType", ""),
                "startLine": chunk.get("startLine", 0),
                "endLine": chunk.get("endLine", 0),
                "repoId": repo_id,
            })

            ids.append(f"repo{repo_id}_chunk{i}_{chunk.get('entityName', 'unknown')}")

        # Delete existing collection data and re-index
        try:
            self.chroma_client.delete_collection(self._collection_name(repo_id))
            self._stores.pop(repo_id, None)
        except Exception:
            pass

        store = self.get_store(repo_id)

        # Keep batches modest so large repositories do not create a large intermediate tensor.
        # Only Google's remote API needs quota backoff; local workspaces should continue directly.
        batch_size = 50
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i : i + batch_size]
            batch_metas = metadatas[i : i + batch_size]
            batch_ids = ids[i : i + batch_size]
            if settings.embedding_provider == "google":
                self._add_google_batch(store, batch_texts, batch_metas, batch_ids, repo_id, i)
            else:
                store.add_texts(texts=batch_texts, metadatas=batch_metas, ids=batch_ids)
            logger.info("Indexed batch %d for repo %d", i // batch_size + 1, repo_id)

        logger.info("Successfully indexed %d chunks for repo %d", len(texts), repo_id)
        return len(texts)

    def _add_google_batch(
        self,
        store: Chroma,
        texts: list[str],
        metadatas: list[dict],
        ids: list[str],
        repo_id: int,
        offset: int,
    ) -> None:
        """Index one Google batch, backing off only for a documented quota response."""
        for attempt in range(1, 5):
            try:
                store.add_texts(texts=texts, metadatas=metadatas, ids=ids)
                return
            except Exception as exc:
                is_rate_limited = "429" in str(exc) or "RESOURCE_EXHAUSTED" in str(exc)
                if not is_rate_limited or attempt == 4:
                    raise
                delay_seconds = 60
                logger.warning(
                    "Google embedding quota reached for repo %d batch %d; retrying in %d seconds "
                    "(%d/4)",
                    repo_id,
                    offset // 50 + 1,
                    delay_seconds,
                    attempt,
                )
                time.sleep(delay_seconds)

    def search(self, repo_id: int, query: str, k: int = 6) -> list[dict]:
        """Search for relevant code chunks using similarity search."""
        store = self.get_store(repo_id)

        try:
            results = store.similarity_search_with_score(query, k=k)
        except Exception as e:
            logger.warning("Search failed for repo %d: %s", repo_id, e)
            return []

        docs = []
        for doc, score in results:
            docs.append({
                "content": doc.page_content,
                "metadata": doc.metadata,
                "score": float(score),
            })
        return docs

    def count_repo_chunks(self, repo_id: int) -> int:
        """Return the number of indexed chunks without creating an empty collection."""
        try:
            collection = self.chroma_client.get_collection(self._collection_name(repo_id))
            return collection.count()
        except Exception as e:
            # A missing collection is normal after a restart on ephemeral storage.
            logger.debug("No vector store found for repo %d: %s", repo_id, e)
            return 0

    def delete_repo(self, repo_id: int):
        """Delete all indexed data for a repository."""
        try:
            self.chroma_client.delete_collection(self._collection_name(repo_id))
            self._stores.pop(repo_id, None)
            logger.info("Deleted vector store for repo %d", repo_id)
        except Exception as e:
            logger.warning("Failed to delete store for repo %d: %s", repo_id, e)


# Singleton
vector_store_service = VectorStoreService()
