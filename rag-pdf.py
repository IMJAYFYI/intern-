import os
import shutil
import tempfile
import json
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Dict, Any

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain_community.vectorstores import FAISS

router = APIRouter(
    prefix="/rag",
    tags=["RAG"]
)

INDEX_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "db", "faiss_index")

# Global status tracker
rag_state = {
    "filename": None,
    "total_pages": 0,
    "total_chunks": 0,
    "is_loaded": False
}

def update_state_from_disk():
    global rag_state
    meta_path = os.path.join(INDEX_DIR, "metadata.json")
    faiss_path = os.path.join(INDEX_DIR, "index.faiss")
    
    if os.path.exists(faiss_path) and os.path.exists(meta_path):
        try:
            with open(meta_path, "r") as f:
                meta = json.load(f)
                rag_state.update(meta)
                rag_state["is_loaded"] = True
        except Exception:
            rag_state["is_loaded"] = True
    else:
        rag_state.update({
            "filename": None,
            "total_pages": 0,
            "total_chunks": 0,
            "is_loaded": False
        })

# Initialize state on load
try:
    update_state_from_disk()
except Exception:
    pass


@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    global rag_state
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    # Save UploadFile to a temp file
    temp_dir = tempfile.mkdtemp()
    temp_file_path = os.path.join(temp_dir, file.filename)
    try:
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Load PDF using PyPDFLoader
        loader = PyPDFLoader(temp_file_path)
        docs = loader.load()
        total_pages = len(docs)
        
        if total_pages == 0:
            raise ValueError("The uploaded PDF has no pages or couldn't be read.")
        
        # Split documents
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        splits = text_splitter.split_documents(docs)
        total_chunks = len(splits)
        
        # Embeddings
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured on the server.")
        
        embeddings = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=api_key
        )
        
        # Create FAISS Vector Store
        vector_store = FAISS.from_documents(splits, embeddings)
        
        # Clean existing index directory if it exists
        if os.path.exists(INDEX_DIR):
            shutil.rmtree(INDEX_DIR, ignore_errors=True)
        os.makedirs(INDEX_DIR, exist_ok=True)
        
        # Save FAISS index
        vector_store.save_local(INDEX_DIR)
        
        # Save metadata
        meta = {
            "filename": file.filename,
            "total_pages": total_pages,
            "total_chunks": total_chunks
        }
        with open(os.path.join(INDEX_DIR, "metadata.json"), "w") as f:
            json.dump(meta, f)
            
        rag_state.update(meta)
        rag_state["is_loaded"] = True
        
        return {
            "message": "PDF successfully processed and indexed.",
            "filename": file.filename,
            "total_pages": total_pages,
            "total_chunks": total_chunks
        }
        
    except Exception as e:
        # Reset state on failure
        if os.path.exists(INDEX_DIR):
            shutil.rmtree(INDEX_DIR, ignore_errors=True)
        rag_state.update({
            "filename": None,
            "total_pages": 0,
            "total_chunks": 0,
            "is_loaded": False
        })
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")
    finally:
        # Clean up temp file
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)


class QueryRequest(BaseModel):
    question: str


@router.post("/query")
def query_pdf(req: QueryRequest):
    global rag_state
    if not rag_state["is_loaded"]:
        # Try updating state from disk
        update_state_from_disk()
        if not rag_state["is_loaded"]:
            raise HTTPException(status_code=400, detail="No PDF has been uploaded and indexed yet.")
            
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured on the server.")
        
    try:
        # Load embeddings
        embeddings = GoogleGenerativeAIEmbeddings(
            model="models/gemini-embedding-001",
            google_api_key=api_key
        )
        
        # Load FAISS index
        vector_store = FAISS.load_local(INDEX_DIR, embeddings, allow_dangerous_deserialization=True)
        
        # Similarity search
        docs = vector_store.similarity_search(req.question, k=4)
        
        # Format context
        context_parts = []
        sources = []
        for i, doc in enumerate(docs):
            page_num = doc.metadata.get("page", 0) + 1  # 0-indexed to 1-indexed
            context_parts.append(f"[Chunk {i+1} - Page {page_num}]:\n{doc.page_content}")
            sources.append({
                "chunk_id": i + 1,
                "page": page_num,
                "content": doc.page_content
            })
            
        context = "\n\n".join(context_parts)
        
        # Initialize Gemini LLM
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=api_key
        )
        
        # Create prompt
        prompt = f"""You are an expert AI assistant that answers questions based ONLY on the provided PDF context.
If the context doesn't contain the answer, say exactly: "I cannot find the answer in the provided document."
Do not try to make up answers outside the context.

Format the answer clearly in plain text:
- Start with a short direct answer under the heading "Answer:".
- Use bullet points for supporting details.
- Add a "Page references:" section when the context contains relevant page numbers.
- Keep paragraphs short and easy to scan.
- Do not return one long paragraph.

For any facts or quotes you state, include the page number from the chunks, such as "Page 3".

Context:
{context}

Question: {req.question}

Answer:"""
        
        response = llm.invoke(prompt)
        
        return {
            "answer": response.content,
            "sources": sources
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")


@router.get("/status")
def get_status():
    update_state_from_disk()
    return rag_state


@router.post("/clear")
def clear_rag():
    global rag_state
    if os.path.exists(INDEX_DIR):
        try:
            shutil.rmtree(INDEX_DIR)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to clear RAG index from disk: {str(e)}")
            
    rag_state.update({
        "filename": None,
        "total_pages": 0,
        "total_chunks": 0,
        "is_loaded": False
    })
    return {"message": "RAG index and state successfully cleared."}

