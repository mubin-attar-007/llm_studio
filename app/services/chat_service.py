"""Chat orchestration — streaming completions and title generation."""
import time

from openai import APITimeoutError

from app.core.config import settings
from app.core.constants import (
    BALANCE_ERROR,
    ERR_INTERRUPTED,
    ERR_NEEDS_CREDIT,
    ERR_NO_TEXT,
    ERR_RATE_LIMITED,
    ERR_TIMEOUT,
)
from app.llm import client as llm
from app.llm import prompts


def stream_chat(messages, model=None, max_tokens=None, temperature=None):
    """Yield SSE event dicts: {'token'}, {'thinking'}, {'error'}, {'done'}.

    Retries once on an empty/dropped response; surfaces clear errors.
    """
    model = model or llm.DEFAULT_MODEL
    max_tokens = max_tokens or settings.MAX_TOKENS
    for attempt in range(2):
        produced = False
        try:
            client, supports_thinking = llm.client_for(model)
            kwargs = dict(model=model, messages=messages, stream=True, max_tokens=max_tokens)
            if temperature is not None:
                try:
                    kwargs["temperature"] = float(temperature)
                except Exception:
                    pass
            if supports_thinking:
                kwargs["extra_body"] = {"thinking": {"type": "disabled"}}
            stream = None
            for a in range(3):
                try:
                    stream = client.chat.completions.create(**kwargs)
                    break
                except Exception as e:
                    if llm.is_transient(e) and a < 2:
                        time.sleep(1.0 * (a + 1))
                        continue
                    raise
            finish = None
            chars = 0
            for chunk in stream:
                if not chunk.choices:
                    continue
                choice = chunk.choices[0]
                if choice.finish_reason:
                    finish = choice.finish_reason  # "stop" | "length" | ...
                delta = choice.delta
                rc = getattr(delta, "reasoning_content", None)
                if rc is None:
                    me = getattr(delta, "model_extra", None) or {}
                    rc = me.get("reasoning_content") or me.get("reasoning")
                if rc:
                    yield {"thinking": rc}
                if getattr(delta, "content", None):
                    produced = True
                    chars += len(delta.content)
                    yield {"token": delta.content}
            if produced:
                # Some providers (e.g. Cloudflare) report finish_reason "stop" even when the
                # reply was cut off at max_tokens, so fall back to a length heuristic (~4 chars/token).
                truncated = finish == "length" or (chars / 4) >= max_tokens * 0.9
                yield {"done": True, "reason": "length" if truncated else (finish or "stop")}
                return
            if attempt == 0:
                time.sleep(0.8)
                continue
            yield {"error": ERR_NO_TEXT}
            yield {"done": True}
            return
        except Exception as e:
            msg = str(e)
            if llm.is_quota_error(e):
                yield {"error": ERR_RATE_LIMITED}
                yield {"done": True}
                return
            if BALANCE_ERROR in msg:
                yield {"error": ERR_NEEDS_CREDIT}
                yield {"done": True}
                return
            if produced:
                yield {"error": ERR_INTERRUPTED}
                yield {"done": True}
                return
            if isinstance(e, APITimeoutError):
                if attempt == 0:
                    time.sleep(1.0)
                    continue
                yield {"error": ERR_TIMEOUT}
                yield {"done": True}
                return
            if attempt == 0 and llm.is_transient(e):
                time.sleep(1.0)
                continue
            yield {"error": msg}
            yield {"done": True}
            return


def make_title(messages, model=None) -> str:
    model = model or llm.DEFAULT_MODEL
    excerpt = "\n".join(f"{m['role']}: {m['content']}" for m in messages if m.get("content"))[:1500]
    prompt = [
        {"role": "system", "content": prompts.TITLE_SYSTEM},
        {"role": "user", "content": prompts.title_user(excerpt)},
    ]
    client, supports_thinking = llm.client_for(model)
    kwargs = dict(model=model, messages=prompt, max_tokens=1024)
    if supports_thinking:
        kwargs["extra_body"] = {"thinking": {"type": "disabled"}}
    resp = client.chat.completions.create(**kwargs)
    title = (resp.choices[0].message.content or "").strip()
    if not title:
        return ""
    return title.splitlines()[0].strip().strip('"').strip("'").rstrip(".").strip()[:60]
