"""Verify Compose configuration without starting services or reading local .env files.

Run from the repository root: python scripts/test_delivery_config.py
Requires Python 3 and Docker Compose, but not a running Docker daemon.
"""
import json
import os
from pathlib import Path
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]


def backend_environment(overrides: dict[str, str]) -> dict[str, str]:
    environment = os.environ.copy()
    for name in ("COOKIE_SECURE", "SESSION_TTL", "TASK_DISPATCH_INTERVAL_MS"):
        environment.pop(name, None)
    environment.update(overrides)
    result = subprocess.run(
        [
            "docker", "compose", "--env-file", str(ROOT / ".env.example"),
            "--project-directory", str(ROOT), "-f", str(ROOT / "docker-compose.yml"),
            "config", "--format", "json",
        ],
        cwd=ROOT,
        env=environment,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return json.loads(result.stdout)["services"]["backend"]["environment"]


class DeliveryConfigTest(unittest.TestCase):
    def test_backend_defaults(self):
        environment = backend_environment({})
        expected = {
            "COOKIE_SECURE": "false",
            "SESSION_TTL": "P7D",
            "TASK_DISPATCH_INTERVAL_MS": "500",
        }
        for name, value in expected.items():
            with self.subTest(variable=name):
                self.assertEqual(environment.get(name), value)

    def test_backend_overrides_are_forwarded(self):
        expected = {
            "COOKIE_SECURE": "true",
            "SESSION_TTL": "PT2H",
            "TASK_DISPATCH_INTERVAL_MS": "1234",
        }
        environment = backend_environment(expected)
        for name, value in expected.items():
            with self.subTest(variable=name):
                self.assertEqual(environment.get(name), value)


if __name__ == "__main__":
    unittest.main(verbosity=2)
