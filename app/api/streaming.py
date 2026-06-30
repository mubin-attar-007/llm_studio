"""SSE helpers for streaming responses."""
import json

from fastapi.responses import StreamingResponse


def sse(obj) -> str:
    return "data: " + json.dumps(obj) + "\n\n"


def sse_response(events):
    """Wrap a generator of event dicts as an SSE StreamingResponse."""
    def gen():
        for ev in events:
            yield sse(ev)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
