"""LLM routing + document-loading tests."""
import pytest

from app.llm import client as llm
from app.llm.document_loader import read_document


def test_is_transient():
    assert llm.is_transient("Error code 1305 overloaded") is True
    assert llm.is_transient("429 Too Many Requests") is True
    assert llm.is_transient("error 1113 insufficient balance") is False


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
