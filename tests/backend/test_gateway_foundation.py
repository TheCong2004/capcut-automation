from __future__ import annotations

import unittest
import os
from unittest.mock import AsyncMock, patch

from backend.clients import omniroute_client
from backend.services.service_registry import (
    SERVICE_RUNTIME_STATUS,
    build_service_registry,
    set_service_runtime_status,
)


class OmniRouteClientTests(unittest.IsolatedAsyncioTestCase):
    def test_endpoint_key_never_falls_back_to_legacy_llm_example_key(self):
        with patch.dict(
            os.environ,
            {"OMNIROUTE_ENDPOINT_KEY": "", "OMNIROUTE_API_KEY": "", "LLM_API_KEY": "known-example"},
        ):
            self.assertEqual(omniroute_client.endpoint_key(), "")

    def test_plain_http_omniroute_must_be_loopback(self):
        with patch.dict(os.environ, {"OMNIROUTE_BASE_URL": "http://192.0.2.10:20128"}):
            with self.assertRaises(RuntimeError):
                omniroute_client.base_url()

    async def test_health_returns_structured_offline_status_without_raw_exception(self):
        with patch(
            "backend.clients.omniroute_client.httpx.AsyncClient.get",
            new=AsyncMock(side_effect=RuntimeError("secret upstream detail")),
        ):
            result = await omniroute_client.health()

        self.assertEqual(result["status"], "offline")
        self.assertEqual(result["error"]["code"], "OMNIROUTE_UNAVAILABLE")
        self.assertNotIn("secret upstream detail", str(result))


class ServiceRegistryTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.original_status = {key: value.copy() for key, value in SERVICE_RUNTIME_STATUS.items()}

    def tearDown(self):
        SERVICE_RUNTIME_STATUS.clear()
        SERVICE_RUNTIME_STATUS.update(self.original_status)

    async def test_registry_uses_real_probe_status_and_marks_capcut_ui_separate(self):
        set_service_runtime_status("capcut", "ready")
        set_service_runtime_status("mediacrawler", "offline", "not mounted")

        with patch(
            "backend.services.service_registry.omniroute_health",
            new=AsyncMock(return_value={"status": "ready", "status_code": 200}),
        ), patch("backend.services.service_registry.shutil.which", return_value=None):
            services = await build_service_registry()

        by_id = {service["id"]: service for service in services}
        self.assertEqual(by_id["omniroute"]["status"], "ready")
        self.assertEqual(by_id["capcut"]["status"], "ready")
        self.assertEqual(by_id["capcut"]["uiMode"], "separate")
        self.assertEqual(by_id["ffmpeg"]["status"], "offline")
        self.assertEqual(by_id["tts"]["status"], "not_configured")
        self.assertEqual(by_id["mediacrawler"]["status"], "offline")


if __name__ == "__main__":
    unittest.main()
