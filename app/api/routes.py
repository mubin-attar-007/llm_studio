"""HTTP routes (a thin layer over the services)."""
from fastapi import APIRouter, Body, File, UploadFile
from fastapi.responses import JSONResponse

from app.api.streaming import sse_response
from app.llm import client as llm
from app.schemas.chat import ChatRequest, TitleRequest
from app.services import chat_service, document_service, history_service

router = APIRouter(prefix="/api")


@router.get("/models")
def models():
    items, default = llm.list_models()
    return {"models": items, "default": default}


@router.post("/chat")
def chat(req: ChatRequest):
    messages = [m.model_dump() for m in req.messages]
    return sse_response(chat_service.stream_chat(messages, req.model, req.max_tokens, req.temperature))


@router.post("/extract")
async def extract(file: UploadFile = File(...)):
    try:
        name, text = await document_service.extract_upload(file)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    return {"text": text, "name": name, "chars": len(text)}


@router.post("/title")
def title(req: TitleRequest):
    messages = [m.model_dump() for m in req.messages]
    try:
        return {"title": chat_service.make_title(messages, req.model)}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=400)


@router.get("/chats")
def get_chats():
    return {"chats": history_service.all_chats()}


@router.post("/chats")
def save_chats(chats: list[dict] = Body(...)):
    return {"saved": history_service.save_chats(chats)}


@router.delete("/chats/{chat_id}")
def remove_chat(chat_id: str):
    history_service.remove_chat(chat_id)
    return {"deleted": chat_id}
