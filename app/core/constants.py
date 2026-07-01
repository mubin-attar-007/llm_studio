"""App-wide constants."""
SERVICE_NAME = "llm-studio"

# user-facing error/status messages
ERR_NO_TEXT = "The model returned no text. Please try again or pick another model."
ERR_NEEDS_CREDIT = "This model needs account credit. Pick a free model."
ERR_INTERRUPTED = "Connection interrupted — partial answer shown above."
ERR_RATE_LIMITED = ("The shared model key has reached its provider's free limit for now. "
                    "Please try a different model, or check back later.")
ERR_TIMEOUT = "The model took too long to respond. Please try again or pick a faster model."

# provider error classification
BALANCE_ERROR = "1113"
TRANSIENT_MARKERS = ("1305", "500", "502", "503", "overload",
                     "Connection", "temporarily")
# quota/rate-limit exhaustion — NOT worth retrying; surface a clear message instead
QUOTA_MARKERS = ("neurons", "daily free allocation", "used up", "insufficient_quota",
                 "exceeded your current quota", "out of credit", "rate limit",
                 "rate_limit", "too many requests", "429")
