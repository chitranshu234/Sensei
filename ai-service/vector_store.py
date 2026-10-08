"""
Vector store service using ChromaDB for code chunk storage and retrieval.
"""
import logging
from typing import Optional

import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma

from config import settings

logger = logging.getLogger(__name__)


class VectorStoreService:
    """Manages per-repository ChromaDB collections for code chunk embeddings."""

    def __init__(self):
        self._embeddings: Optional[HuggingFaceEmbeddings] = None
        self._chroma_client: Optional[chromadb.ClientAPI] = None
        self._stores: dict[int, Chroma] = {}

    @property
    def embeddings(self) -> HuggingFaceEmbeddings:
        if self._embeddings is None:
            logger.info("Loading embedding model: %s", settings.embedding_model)
            self._embeddings = HuggingFaceEmbeddings(
                model_name=settings.embedding_model,
                model_kwargs={"device": "cpu"},
                encode_kwargs={"normalize_embeddings": True},
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
        store.add_texts(texts=texts, metadatas=metadatas, ids=ids)

        logger.info("Indexed %d chunks for repo %d", len(texts), repo_id)
        return len(texts)

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
