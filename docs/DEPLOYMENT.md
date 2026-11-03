# Public Deployment & Distribution Strategy

## Overview

Quantum Council is architected as a **Local-First AI Collaboration Platform**.

Unlike centralized SaaS AI tools that upload private prompts and documents to third-party databases, Quantum Council executes locally on the user's computer.

```
  ┌───────────────────────────────────────────────────────────────┐
  │                        USER'S MACHINE                         │
  │                                                               │
  │   React + Vite UI          FastAPI Backend     Ollama Engine  │
  │  (localhost:5173)   ◄───►  (127.0.0.1:8000) ◄─► (127.0.0.1)    │
  │           ▲                      ▲                            │
  │           │                      │                            │
  │      Liquid Glass       SQLite + Chunks Vault                 │
  │     Optical Tokens       (%LOCALAPPDATA%)                     │
  └───────────────────────────────────────────────────────────────┘
```

---

## 1. Distribution Channels

### Channel A: Public GitHub Repository (Source Code)
* Hosted on GitHub as an open-source repository.
* Contains clean audited source code, unit tests, and documentation.
* Excludes private `.env`, SQLite databases, user PDFs, and backups via comprehensive `.gitignore`.

### Channel B: GitHub Pages (Project Showcase & Landing Page)
* Hosts the static documentation, visual showcase, architectural diagrams, and installation guide.
* Does not execute backend logic or store user data.

### Channel C: Local Standalone Application
* Users clone or download the release archive.
* Runs via standard single-command launcher scripts:
  - **Windows**: `run.ps1`
  - **Linux / macOS**: `run.sh`
* All data is isolated in the user's OS application directory (`%LOCALAPPDATA%\QuantumCouncil`).

---

## 2. Desktop Packaging Roadmap

For non-developer distribution, Quantum Council can be packaged into a standalone desktop application:

1. **Option 1 — Tauri Desktop Shell (Recommended)**:
   - Uses native OS webview (lightweight ~15 MB installer vs ~120 MB Electron).
   - Bundles the React build with a lightweight background Python/FastAPI sidecar or standalone binary compiled via PyInstaller.
2. **Option 2 — Docker Compose Container**:
   - `docker-compose.yml` deploying FastAPI + React + Ollama on loopback `127.0.0.1` with named volumes for persistent SQLite storage.

---

## 3. Privacy & Compliance Guarantee

* **No Telemetry**: No user tracking, Google Analytics, or external metric pinging.
* **No Shared Cloud Database**: Every installation creates its own SQLite database.
* **Local Inference by Default**: Ollama models (`llama3.2:1b`, `qwen2.5`) execute on local CPU/GPU.
* **Hybrid Cloud Transparency**: Cloud providers (Groq, OpenAI) are only contacted when the user explicitly configures their own API key and selects Hybrid Mode.

