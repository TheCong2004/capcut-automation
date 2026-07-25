# BE Structure (capcut-mate → unified Python BE)

Phase 0 scaffold. Repo **capcut-mate** is the BE process (port **30000**).  
CLI port / FE path changes come in later phases.

## Layout

```
capcut-mate/
  main.py                 # FastAPI app, CORS, lifespan, GET /health
  core/
    config.py             # PORT, CORS origins, drafts path
  engines/
    mate/                 # (P1) logic Mate — currently placeholder
    cli_bridge/           # (P2) subprocess capcut-cli — placeholder
    local/                # (P4) pure Python local draft — placeholder
  src/                    # existing Mate routers/services (unchanged in P0)
  config.py               # legacy Mate constants (still used by src/)
  BE_STRUCTURE.md         # this file
```

## Run

```bash
cd capcut-mate
uv run main.py
# → http://0.0.0.0:30000
# → docs: http://127.0.0.1:30000/docs
# → health: http://127.0.0.1:30000/health
```

Or:

```bash
uv run uvicorn main:app --host 0.0.0.0 --port 30000
```

## Engines (roles)

| Package | Phase | Role |
|---------|-------|------|
| `engines/mate` | P1 | In-process Mate (draft_url HTTP model, pyJianYingDraft) |
| `engines/cli_bridge` | P2 | Subprocess `capcut` for CLI parity |
| `engines/local` | P4 | Pure Python local draft files |

## CORS (P0)

From `core/config.py`: Vite `5173`/`5174`, `127.0.0.1`, Tauri origins, plus localhost regex.

## API notes

- Phase 0: `GET /health` only new public route.
- Mate APIs stay under `/openapi/capcut-mate/v1/*` (no breaking rename in P0).
