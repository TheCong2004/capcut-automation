"""
BE Python unified config (Phase 0).

Existing root `config.py` remains the source of truth for Mate service internals.
This module centralizes process-level settings used by `main.py` (port, CORS, draft path).
"""
from __future__ import annotations

import os
from pathlib import Path

# Project root = capcut-mate/ (parent of core/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# HTTP
HOST = os.getenv("BE_HOST", "0.0.0.0")
PORT = int(os.getenv("BE_PORT", "30000"))

# Draft storage (Mate engine default; same relative path as root config.DRAFT_DIR)
DRAFTS_DIR = Path(os.getenv("BE_DRAFTS_DIR", str(PROJECT_ROOT / "output" / "draft")))

# CORS — Vite / local / Tauri / App
CORS_ORIGINS: list[str] = ["*"]

# Allow any origin
CORS_ORIGIN_REGEX = r".*"
