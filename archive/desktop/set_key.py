"""Store your LLM API key securely in the OS credential manager (keyring).

Run once:   .venv\\Scripts\\python.exe set_key.py
After that you can delete LLM_API_KEY from .env — the app reads it from the
Windows Credential Manager (encrypted, tied to your login) instead of plaintext.
"""
import getpass

import keyring

SERVICE, NAME = "glm-studio", "LLM_API_KEY"


def main():
    key = getpass.getpass("Paste your LLM API key (input hidden): ").strip()
    if not key:
        print("No key entered — nothing changed.")
        return
    keyring.set_password(SERVICE, NAME, key)
    print("✓ Saved to the OS credential manager. You can remove LLM_API_KEY from .env now.")


if __name__ == "__main__":
    main()
