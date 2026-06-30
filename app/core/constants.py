"""App-wide constants."""
SERVICE_NAME = "glm-studio"

# user-facing error/status messages
ERR_NO_TEXT = "The model returned no text. Please try again or pick another model."
ERR_NEEDS_CREDIT = "This model needs account credit. Pick a free model."
ERR_INTERRUPTED = "Connection interrupted — partial answer shown above."

# provider error classification
BALANCE_ERROR = "1113"
TRANSIENT_MARKERS = ("1305", "429", "500", "502", "503", "overload",
                     "timeout", "Connection", "temporarily")
