# FLOWORD RUNTIME BOOTSTRAP DOCUMENTATION

This document defines the audited runtime launch parameters, ports, health endpoints, and start commands for all services in the NEODONUT ENGINE workspace.

## System Architecture & Service Audit

| Service | Source path | Start command | Port | Health endpoint | Required env | Runtime type |
|---|---|---|---|---|---|---|
| **OmniRoute LLM Router** | `frontend/apps/artcraft/app/src/pages/OmniRoute` | `npm run dev` / `node scripts/dev/run-next.mjs dev` | `20128` | `http://127.0.0.1:20128/v1/models` | `PORT=20128`, `NODE_ENV=development` | Node.js / Next.js Server |
| **MediaCrawler API** | `MediaCrawler-be` | `uvicorn api.main:app --port 8080` / `python -m api.main` | `8080` | `http://127.0.0.1:8080/api/health` | `MEDIACRAWLER_PORT=8080` | Python FastAPI Service |
| **be-youwee** | `be-youwee` | `cargo run` | N/A (Tauri IPC) | N/A (Tauri Command) | `TAURI_ENV=development` | Rust / Tauri App |
| **OpenMontage Engine** | `OpenMontage` | `python render_demo.py` | N/A (CLI / Direct Exec) | N/A (Script Exec) | `PYTHONPATH=.` | Python CLI Engine |
| **CapCut Mate** | `capcut-mate` | `uvicorn main:app --port 30000` / `python main.py` | `30000` | `http://127.0.0.1:30000/health` | `PORT=30000` | Python FastAPI Service |
| **Playwright CDP Sidecar** | `tools/playwright-sidecar` | `npm start` / `node index.js` | `9223` | `http://127.0.0.1:9223/health` | `PLAYWRIGHT_SIDECAR_PORT=9223` | Node.js Express Service |
| **Chrome Remote Debugging** | `system` | `chrome.exe --remote-debugging-port=9222 --user-data-dir=.runtime/chrome-cdp-profile` | `9222` | `http://127.0.0.1:9222/json/version` | N/A | Browser Daemon |
| **ArtCraft Engine** | `crates/desktop/artcraft` | `cargo run --package artcraft` | N/A (Tauri IPC) | N/A (Tauri Command) | `RUST_LOG=info` | Rust / Tauri Desktop App |

---

## Detailed Service Endpoints

### 1. OmniRoute LLM Gateway
- **Base URL**: `http://127.0.0.1:20128`
- **Models Endpoint**: `GET /v1/models`
- **Completions Endpoint**: `POST /v1/chat/completions`

### 2. MediaCrawler WebUI API
- **Base URL**: `http://127.0.0.1:8080`
- **Health Endpoint**: `GET /api/health`
- **Start Crawler Endpoint**: `POST /api/crawler/start`

### 3. CapCut Mate Automation Backend
- **Base URL**: `http://127.0.0.1:30000`
- **Health Endpoint**: `GET /health`
- **Create Draft Endpoint**: `POST /openapi/capcut-mate/v1/create_draft`
- **Add Captions Endpoint**: `POST /openapi/capcut-mate/v1/add_captions`
- **Save Draft Endpoint**: `POST /openapi/capcut-mate/v1/save_draft`
- **Get Draft Endpoint**: `GET /openapi/capcut-mate/v1/get_draft`

### 4. Playwright CDP Sidecar
- **Base URL**: `http://127.0.0.1:9223`
- **Health Endpoint**: `GET /health`
- **Connect CDP Endpoint**: `POST /connect`
- **Screenshot Endpoint**: `POST /screenshot`
- **Trace Stop Endpoint**: `POST /trace/stop`
