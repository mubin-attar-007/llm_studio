"""Light validators."""
VALID_ROLES = {"system", "user", "assistant"}


def is_valid_role(role: str) -> bool:
    return role in VALID_ROLES
