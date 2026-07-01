"""LLM routing + document-loading tests."""
import pytest

from app.llm import client as llm
from app.llm.document_loader import read_document


def test_is_transient():
    assert llm.is_transient("Error code 1305 overloaded") is True
    assert llm.is_transient("500 internal server error") is True
    assert llm.is_transient("error 1113 insufficient balance") is False
    assert llm.is_transient("429 Too Many Requests") is False   # rate-limit, not transient


def test_is_quota_error():
    assert llm.is_quota_error("you have used up your daily free allocation of 10,000 neurons") is True
    assert llm.is_quota_error("429 Too Many Requests") is True
    assert llm.is_quota_error("insufficient_quota: exceeded your current quota") is True
    assert llm.is_quota_error("500 internal server error") is False


def test_client_for_local_routes_to_ollama():
    client, supports_thinking = llm.client_for("some-local-model:latest")
    assert "11434" in str(client.base_url)
    assert supports_thinking is False


def test_list_models_shape():
    models, default = llm.list_models()
    assert isinstance(models, list) and isinstance(default, str)
    for m in models:
        assert set(m.keys()) >= {"id", "kind"}


def test_read_document_txt(tmp_path):
    p = tmp_path / "note.txt"
    p.write_text("hello world", encoding="utf-8")
    assert "hello world" in read_document(str(p))


def test_read_document_unsupported(tmp_path):
    p = tmp_path / "x.xyz"
    p.write_text("x", encoding="utf-8")
    with pytest.raises(ValueError):
        read_document(str(p))
