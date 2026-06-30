"""HTTP routes (a thin layer over the services). Every route requires auth."""
from fastapi import APIRouter, Body, Depends, File, UploadFile
from fastapi.responses import JSONResponse

from app.api.dependencies import rate_limit, require_user
from app.api.streaming import sse_response
from app.llm import client as llm
from app.schemas.chat import ChatRequest, TitleRequest
from app.services import chat_service, document_service, history_service, quota_service

router = APIRouter(prefix="/api", dependencies=[Depends(require_user)])


@router.get("/models")
def models():
    items, default = llm.list_models()
    return {"models": items, "default": default}


@router.post("/chat")
def chat(req: ChatRequest, user: dict = Depends(require_user)):
    q = quota_service.consume(user)
    if not q["allowed"]:
        return JSONResponse(
            {"error": f"Daily message limit reached ({q['limit']}/day). Your quota resets at midnight UTC.",
             "quota": q},
            status_code=429)
    messages = [m.model_dump() for m in req.messages]
    return sse_response(chat_service.stream_chat(messages, req.model, req.max_tokens, req.temperature))


@router.post("/extract", dependencies=[Depends(rate_limit("extract", 20, 60))])
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
def get_chats(user: dict = Depends(require_user)):
    return {"chats": history_service.all_chats(user["id"])}


@router.post("/chats")
def save_chats(chats: list[dict] = Body(...), user: dict = Depends(require_user)):
    return {"saved": history_service.save_chats(user["id"], chats)}


@router.delete("/chats/{chat_id}")
def remove_chat(chat_id: str, user: dict = Depends(require_user)):
    history_service.remove_chat(user["id"], chat_id)
    return {"deleted": chat_id}
