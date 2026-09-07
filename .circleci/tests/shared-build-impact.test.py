#!/usr/bin/env python3
"""Behavioral regression tests for cheap, dependency-free setup classification."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("impact", ROOT / ".circleci/scripts/shared-build-impact.py")
impact = importlib.util.module_from_spec(spec)
spec.loader.exec_module(impact)
CONTINUATION = (ROOT / ".circleci/continue.yml").read_text()


class BuildImpact(unittest.TestCase):
    def test_only_mobile_scripts_are_exempt(self):
        before = {"dependencies": {"expo": "57"}, "scripts": {"docs:build": "node scripts/docs-build.js"}}
        for command in ["boundaries:check", "android", "start:lucid", "lint", "test:file"]:
            after = json.loads(json.dumps(before))
            after["scripts"][command] = "node mobile-tool.js"
            self.assertTrue(impact.mobile_scripts_only(json.dumps(before), json.dumps(after)))
        for command in ["docs:build", "test:changed", "postinstall", "prepare", "unknown"]:
            after = json.loads(json.dumps(before))
            after["scripts"][command] = "changed"
            self.assertFalse(impact.mobile_scripts_only(json.dumps(before), json.dumps(after)))

    def test_dependency_engine_or_other_metadata_changes_keep_shared_checks(self):
        before = {"scripts": {"android": "old"}, "dependencies": {"expo": "57"}}
        for key, value in [("dependencies", {"expo": "58"}), ("engines", {"node": "25"}), ("overrides", {"x": "2"})]:
            after = dict(before, **{key: value})
            self.assertFalse(impact.mobile_scripts_only(json.dumps(before), json.dumps(after)))

    def test_only_mobile_jobs_are_exempt(self):
        old = impact.without_mobile_jobs(CONTINUATION)
        mobile = CONTINUATION.replace("name: Typecheck Noctalia application", "name: Different mobile check")
        self.assertEqual(old, impact.without_mobile_jobs(mobile))
        for source, replacement in [("npm run docs:build", "npm run docs:release-check"),
                                    ("command: npm ci", "command: npm install"),
                                    ("image: cimg/node:24.19.0", "image: cimg/node:25.0.0"),
                                    ("when: << pipeline.parameters.run_site >>", "when: true")]:
            self.assertIn(source, CONTINUATION)
            self.assertNotEqual(old, impact.without_mobile_jobs(CONTINUATION.replace(source, replacement)))

    def test_unknown_yaml_structure_is_not_exempt(self):
        for text in ["jobs: {}", CONTINUATION + "extra: &shared x\n", CONTINUATION.replace("noctalia-quality:", "other-job:")]:
            with self.assertRaises(ValueError):
                impact.without_mobile_jobs(text)

    def test_vercel_skips_previews_and_preserves_other_environments(self):
        command = json.loads((ROOT / "vercel.json").read_text())["ignoreCommand"]
        for value, expected in [("production", 1), ("preview", 0), ("", 1), ("development", 1)]:
            result = subprocess.run(["bash", "-c", command], env={**os.environ, "VERCEL_ENV": value})
            self.assertEqual(result.returncode, expected)


class ClassificationIntegration(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name)
        self.git("init", "-q", "-b", "master")
        self.git("config", "user.email", "ci-test@noctalia.invalid")
        self.git("config", "user.name", "CI fixture")
        (self.repo / ".circleci").mkdir()
        (self.repo / ".circleci/continue.yml").write_text(CONTINUATION)
        self.package = {"scripts": {"docs:build": "node scripts/docs-build.js"}, "dependencies": {"expo": "57"}}
        (self.repo / "package.json").write_text(json.dumps(self.package))
        self.git("add", ".")
        self.git("commit", "-qm", "baseline")
        self.base = self.git("rev-parse", "HEAD").strip()

    def git(self, *args):
        return subprocess.check_output(["git", *args], cwd=self.repo, text=True)

    def classify(self, expected):
        self.git("add", ".")
        self.git("commit", "-qm", "fixture")
        head = self.git("rev-parse", "HEAD").strip()
        output = self.repo / "result.json"
        subprocess.run(["bash", str(ROOT / ".circleci/scripts/classify-changes.sh"), "pr", self.base, head, str(output)], cwd=self.repo, check=True, capture_output=True)
        result = json.loads(output.read_text())
        for key, value in expected.items():
            self.assertEqual(result[key], value, key)

    def test_mobile_job_and_script_do_not_run_site_or_backend(self):
        self.package["scripts"]["boundaries:check"] = "node scripts/check-monorepo-boundaries.js"
        (self.repo / "package.json").write_text(json.dumps(self.package))
        (self.repo / ".circleci/continue.yml").write_text(CONTINUATION.replace("name: Typecheck Noctalia application", "name: Mobile contract"))
        self.classify({"run_noctalia": True, "run_meditation": True, "run_site": False, "run_edge_functions": False, "run_edge_contracts": False})

    def test_shared_dependency_still_checks_site_and_contracts(self):
        self.package["dependencies"]["expo"] = "58"
        (self.repo / "package.json").write_text(json.dumps(self.package))
        self.classify({"run_noctalia": True, "run_site": True, "run_edge_contracts": True})

    def test_site_job_change_is_not_skipped(self):
        (self.repo / ".circleci/continue.yml").write_text(CONTINUATION.replace("npm run docs:build", "npm run docs:release-check"))
        self.classify({"run_site": True})

    def test_unreadable_package_is_not_skipped(self):
        (self.repo / "package.json").write_text("malformed")
        self.classify({"run_site": True, "run_edge_contracts": True})

    def test_routing_tests_alone_do_not_build_products_unnecessarily(self):
        (self.repo / ".circleci/tests").mkdir()
        (self.repo / ".circleci/tests/routing.test.sh").write_text("echo fixture")
        self.classify({"run_noctalia": True, "run_meditation": False, "run_site": False, "run_edge_functions": False, "run_edge_contracts": False})


if __name__ == "__main__":
    unittest.main()
