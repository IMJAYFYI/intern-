from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, AIMessage
from medrag import router as rag_router
import os
import base64
import tempfile
import threading
import speech_recognition as sr
import pyttsx3
from gtts import gTTS

# Load env variables
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

app = FastAPI(
    title="Gemini Chatbot API",
    description="FastAPI backend for LangChain Gemini Chatbot with Memory",
    version="1.0.0"
)

# Add CORS Middleware to support frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

app.include_router(rag_router)

# Gemini Model
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=os.getenv("GEMINI_API_KEY")
)

# Store conversation memory
chat_memory = []

# Speech recognizer instance
recognizer = sr.Recognizer()

# Thread lock for pyttsx3 engine since it is not thread safe
tts_lock = threading.Lock()

def text_to_speech(text: str) -> str:
    """
    Synthesizes the text to an audio file and returns the base64 encoded audio.
    Prioritizes gTTS (MP3) for maximum browser compatibility, falling back to pyttsx3.
    """
    # Try gTTS (MP3) first
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_mp3:
        mp3_path = temp_mp3.name
    try:
        tts = gTTS(text=text, lang="en")
        tts.save(mp3_path)
        with open(mp3_path, "rb") as audio_file:
            audio_data = audio_file.read()
        base64_audio = base64.b64encode(audio_data).decode("utf-8")
        return f"data:audio/mp3;base64,{base64_audio}"
    except Exception as e:
        print(f"gTTS failed: {e}. Falling back to pyttsx3...")
        # Fallback to local pyttsx3 (AIFC/WAV depending on OS)
        with tts_lock:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_wav:
                wav_path = temp_wav.name
            try:
                engine = pyttsx3.init()
                engine.save_to_file(text, wav_path)
                engine.runAndWait()
                with open(wav_path, "rb") as audio_file:
                    audio_data = audio_file.read()
                base64_audio = base64.b64encode(audio_data).decode("utf-8")
                return f"data:audio/wav;base64,{base64_audio}"
            finally:
                if os.path.exists(wav_path):
                    os.remove(wav_path)
    finally:
        if os.path.exists(mp3_path):
            os.remove(mp3_path)

# Request Body
class ChatRequest(BaseModel):
    message: str

# Chat API with Memory
@app.post("/chat")
def chat(req: ChatRequest):
    try:
        # Add user message to memory
        chat_memory.append(
            HumanMessage(content=req.message)
        )

        # Send full history to AI
        response = llm.invoke(chat_memory)

        # Add AI response to memory
        chat_memory.append(
            AIMessage(content=response.content)
        )

        return {"response": response.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Voice Chat API
@app.post("/chat/voice")
async def chat_voice(file: UploadFile = File(...)):
    try:
        # Save uploaded file contents to a temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_wav:
            contents = await file.read()
            temp_wav.write(contents)
            temp_wav_path = temp_wav.name
            
        try:
            # Transcribe audio using SpeechRecognition
            with sr.AudioFile(temp_wav_path) as source:
                audio_data = recognizer.record(source)
            
            # Recognizing using Google Speech API
            user_text = recognizer.recognize_google(audio_data)
        except sr.UnknownValueError:
            raise HTTPException(status_code=400, detail="Could not understand audio")
        except sr.RequestError as e:
            raise HTTPException(status_code=500, detail=f"Google Speech Recognition service error: {e}")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Audio decoding error. Make sure you send a valid WAV file: {e}")
        finally:
            if os.path.exists(temp_wav_path):
                os.remove(temp_wav_path)
                
        # Add user message to memory
        chat_memory.append(HumanMessage(content=user_text))
        
        # Send history to Gemini
        response = llm.invoke(chat_memory)
        
        # Add AI response to memory
        chat_memory.append(AIMessage(content=response.content))
        ai_reply = response.content
        
        # Synthesize reply back to audio (base64)
        audio_base64 = None
        try:
            audio_base64 = text_to_speech(ai_reply)
        except Exception as tts_err:
            print(f"TTS Synthesis error: {tts_err}")
            
            #vgg
        return {
            "user_text": user_text,
            "response": ai_reply,
            "audio": audio_base64
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Clear history endpoint
@app.post("/chat/clear")
def clear_chat():
    global chat_memory
    chat_memory = []
    return {"message": "Chat history cleared"}

@app.get("/")
def frontend():
    return FileResponse(os.path.join(BASE_DIR, "static", "index.html"))

# Root endpoint for health check
@app.get("/health")
def root():
    return {"message": "Chat API is running!"}


