"""Prompt templates."""
TITLE_SYSTEM = ("You write a very short, specific chat title: "
                "3 to 6 words, plain text, no quotes, no trailing punctuation.")


def title_user(excerpt: str) -> str:
    return "Give a 3-6 word title for this conversation:\n\n" + excerpt
