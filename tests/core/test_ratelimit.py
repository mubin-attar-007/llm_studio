"""Unit tests for the in-memory rate limiter."""
from app.core import ratelimit


def test_allow_within_then_blocks():
    ratelimit.reset()
    key = "unit:test"
    assert all(ratelimit.allow(key, 3, 60) for _ in range(3))
    assert ratelimit.allow(key, 3, 60) is False   # 4th within the window is blocked


def test_separate_keys_are_independent():
    ratelimit.reset()
    assert ratelimit.allow("a", 1, 60) is True
    assert ratelimit.allow("a", 1, 60) is False
    assert ratelimit.allow("b", 1, 60) is True     # different key has its own budget
