"""Packaged MediaCrawler API and crawler worker entry point."""

import os
import runpy
import sys

import uvicorn


if __name__ == "__main__":
    if "--crawler-worker" in sys.argv:
        sys.argv.remove("--crawler-worker")
        runpy.run_module("main", run_name="__main__")
    else:
        from api.main import app

        uvicorn.run(
            app,
            host="127.0.0.1",
            port=int(os.environ.get("MEDIACRAWLER_PORT", "8080")),
        )
