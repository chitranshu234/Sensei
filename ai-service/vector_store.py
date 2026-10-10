"""
Vector store service using ChromaDB for code chunk storage and retrieval.
"""
import logging
from typing import Optional

import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Chroma

from config import settings

logger = logging.getLogger(__name__)


class VectorStoreService:
    """Manages per-repository ChromaDB collections for code chunk embeddings."""

    def __init__(self):
        self._embeddings: Optional[GoogleGenerativeAIEmbeddings] = None
        self._chroma_client: Optional[chromadb.ClientAPI] = None
        self._stores: dict[int, Chroma] = {}

    @property
    def embeddings(self) -> GoogleGenerativeAIEmbeddings:
        if self._embeddings is None:
            logger.info("Loading Google Generative AI embeddings to save RAM")
            self._embeddings = GoogleGenerativeAIEmbeddings(
                model="models/gemini-embedding-001",
                google_api_key=settings.google_api_key
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

        import time
        store = self.get_store(repo_id)
        
        # Batch to avoid Google Gemini 429 Rate Limits
        batch_size = 50
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i : i + batch_size]
            batch_metas = metadatas[i : i + batch_size]
            batch_ids = ids[i : i + batch_size]
            
            try:
                store.add_texts(texts=batch_texts, metadatas=batch_metas, ids=batch_ids)
                logger.info(f"Indexed batch {i//batch_size + 1} for repo {repo_id}")
            except Exception as e:
                if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                    logger.warning("Hit Google API rate limit! Sleeping for 15 seconds...")
                    time.sleep(15)
                    store.add_texts(texts=batch_texts, metadatas=batch_metas, ids=batch_ids)
                else:
                    raise e
            
            # Tiny sleep between batches to prevent spamming the API
            time.sleep(1.5)

        logger.info("Successfully indexed %d chunks for repo %d", len(texts), repo_id)
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
