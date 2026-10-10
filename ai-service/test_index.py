import sys
sys.path.append('.')
from vector_store import vector_store_service

chunks = [{
    "filePath": "test.py",
    "entityName": "Test",
    "chunkType": "CLASS",
    "startLine": 1,
    "endLine": 10,
    "content": "class Test: pass",
    "summary": "A test class"
}]

try:
    print("Indexing...")
    vector_store_service.index_chunks(999, chunks)
    print("Success")
except Exception as e:
    print(f"Error: {e}")
