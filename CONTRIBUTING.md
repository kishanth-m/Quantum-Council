# Contributing to Quantum Council

Thank you for your interest in contributing to **Quantum Council — Five Minds. One Intelligence.**

Quantum Council is an open-source, local-first multi-agent collaborative intelligence platform. We welcome contributions that improve reliability, visual sophistication, model connectivity, and security.

---

## 1. Code of Conduct

* Be respectful, constructive, and collaborative.
* Respect user privacy: never submit code that phones home, collects telemetry without consent, or bypasses local isolation.

---

## 2. Development Setup

### Prerequisites
* Python 3.12+
* Node.js 18+ (Node 20+ recommended)
* Local [Ollama](https://ollama.com/) instance (e.g. `llama3.2:1b` or `qwen2.5:1.5b`)

### Quick Setup

```bash
# 1. Clone repository
git clone https://github.com/your-username/quantum-council.git
cd quantum-council

# 2. Setup Python backend virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r backend/requirements.txt  # or install via pyproject.toml

# 3. Setup environment file
cp .env.example .env

# 4. Setup React frontend
cd frontend
npm install
cd ..
```

### Running Locally

```bash
# Terminal 1: Run local Ollama
ollama serve

# Terminal 2: Run FastAPI backend
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Terminal 3: Run Vite frontend
cd frontend
npm run dev
```

Visit `http://localhost:5173` to open Quantum Council.

---

## 3. Strict Security & Clean Commits Rules

1. **NEVER commit secrets or API keys**:
   - Do not commit `.env` files, `.db` files, personal PDFs, or live cloud keys.
   - All tests must use mocks or local Ollama inference.
2. **Local Loopback Only**:
   - Backend calls must default to `127.0.0.1` and preserve `LocalSecurityMiddleware`.
3. **No Breaking Changes to Fault Tolerance**:
   - The 5-agent LangGraph orchestrator has circuit breakers, dynamic fallback substitution, and a mandatory 4-part synthesis guarantee. Maintain the test suite baseline.

---

## 4. Testing Your Changes

Before submitting a Pull Request, verify that all test suites pass cleanly:

```bash
# 1. Run Python Unit and Integration tests (52+ tests)
python -m pytest backend/tests/unit backend/tests/integration -v

# 2. Run Frontend Production TypeScript build
cd frontend
npm run build
```

Both commands must exit with code 0.

