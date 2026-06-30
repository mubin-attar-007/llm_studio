"""GLM / Z.ai provider specifics."""


def is_glm_base(base_url: str) -> bool:
    return "z.ai" in base_url or "bigmodel" in base_url


def thinking_disabled_extra() -> dict:
    """extra_body that turns off GLM's hidden 'thinking' phase (faster replies)."""
    return {"thinking": {"type": "disabled"}}
