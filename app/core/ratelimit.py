"""Tiny in-memory sliding-window rate limiter (single process).

Good enough for a single-worker deployment (one uvicorn worker on an HF Space /
Render instance). For multi-worker setups, swap the backing store for Redis.
"""
import threading
import time

_lock = threading.Lock()
_hits: dict[str, list[float]] = {}
_last_sweep = [0.0]


def _sweep(now: float) -> None:
    """Drop keys that have gone quiet, so memory does not grow unbounded."""
    if now - _last_sweep[0] < 300:
        return
    _last_sweep[0] = now
    cutoff = now - 3600
    for k in list(_hits.keys()):
        b = _hits.get(k)
        if not b or b[-1] < cutoff:
            _hits.pop(k, None)


def allow(key: str, limit: int, window_s: float) -> bool:
    """Return True if this hit is within `limit` events per `window_s` for `key`."""
    now = time.time()
    cutoff = now - window_s
    with _lock:
        _sweep(now)
        bucket = _hits.setdefault(key, [])
        # drop timestamps older than the window
        drop = 0
        for t in bucket:
            if t > cutoff:
                break
            drop += 1
        if drop:
            del bucket[:drop]
        if len(bucket) >= limit:
            return False
        bucket.append(now)
        return True


def reset() -> None:
    """Clear all counters (used by tests)."""
    with _lock:
        _hits.clear()
        _last_sweep[0] = 0.0
