# Security Policy — Quantum Council

Quantum Council is designed from the ground up as a **Local-First, Privacy-Preserving Multi-Agent Collaborative Intelligence Platform**.

We consider user privacy, credential safety, and local isolation to be primary engineering requirements.

---

## 1. Supported Versions

| Version | Supported | Security Updates |
| :--- | :--- | :--- |
| `0.1.x` | :white_check_mark: | Active support |

---

## 2. Local-First Security Architecture

Quantum Council operates on your local machine with strict boundaries:

1. **Loopback Binding Only**:
   - The FastAPI backend binds exclusively to `127.0.0.1` (loopback). It does not listen on public or LAN network interfaces (`0.0.0.0`).
   - `LocalSecurityMiddleware` enforces Host header checks against `ALLOWED_HOSTS` (`127.0.0.1`, `localhost`, `[::1]`), defeating DNS rebinding attacks.

2. **Cross-Origin Request Protection (CSRF)**:
   - All state-changing endpoints (`POST`, `PUT`, `DELETE`, `PATCH`) validate the HTTP `Origin` and `Referer` headers.
   - Any request initiated from third-party websites or untrusted origins is immediately rejected with `403 Forbidden`.

3. **Per-User Isolated Storage**:
   - Each operating system user account stores its SQLite database, uploaded files, and vector embeddings in an isolated per-user application directory:
     - **Windows**: `%LOCALAPPDATA%\QuantumCouncil`
     - **Linux**: `~/.local/share/quantum_council`
     - **macOS**: `~/Library/Application Support/QuantumCouncil`
   - Multi-user workstations cannot access or read another user's database without OS administrator privileges.

4. **Multi-Tier Credential Encryption**:
   - On Windows, API keys (Groq, OpenAI) are encrypted using **Windows DPAPI** (`CryptProtectData`), binding the ciphertext to the user's Windows login account credentials.
   - On non-Windows platforms, keys are encrypted using Fernet symmetric encryption with a dedicated 256-bit master key stored with POSIX `0600` permissions.
   - API keys are **never** returned in API responses (only masked previews e.g. `gsk_...3a2f` are sent to the UI).
   - Sensitive tokens are scrubbed from application logs, error messages, and saved debate transcripts via `redact_sensitive_text()`.

5. **Knowledge Vault Defense-in-Depth**:
   - Uploaded files are restricted to safe document extensions (`.pdf`, `.txt`, `.md`, `.json`, `.csv`). Executable extensions (`.exe`, `.bat`, `.cmd`, `.sh`, `.html`, `.js`) are rejected with `400 Bad Request`.
   - Filenames are sanitized with `os.path.basename` and regex whitelisting to eliminate directory traversal sequences (`..`, `/`, `\`).
   - File uploads are capped at `50MB` (`max_upload_size_mb`).
   - Uploaded documents are never mounted as public static directory files.

6. **Strict Local-Only Enforcement**:
   - In `local_only` mode, the orchestrator and individual agent chat run solely against local Ollama (`127.0.0.1:11434`). Outbound calls to cloud providers are blocked at the engine layer (`ProviderAuthError`).

---

## 3. Reporting a Vulnerability

If you discover a potential security vulnerability in Quantum Council:

1. **Do not open a public GitHub issue.**
2. Please send a confidential advisory to the project maintainers with:
   - A description of the vulnerability and potential impact.
   - Step-by-step instructions or proof-of-concept to reproduce the issue.
   - Affected version or commit hash.
3. We will acknowledge receipt within 48 hours and work with you on a coordinated disclosure timeline.

