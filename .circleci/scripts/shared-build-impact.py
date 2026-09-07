#!/usr/bin/env python3
"""Recognize mobile-only edits without installing dependencies in setup.

Exit zero only when the shared build contract is unchanged. Unreadable revisions
or unknown JSON/YAML shapes retain the classifier's conservative fallback.
"""
import json
import re
import subprocess
import sys


def read(revision, path):
    return subprocess.check_output(["git", "show", f"{revision}:{path}"], text=True)


def mobile_scripts_only(before, after):
    before, after = json.loads(before), json.loads(after)
    old_scripts, new_scripts = before.pop("scripts", {}), after.pop("scripts", {})
    if before != after or not isinstance(old_scripts, dict) or not isinstance(new_scripts, dict):
        return False
    # Site uses test:changed/docs scripts. Install lifecycle scripts affect every
    # consumer. Only explicitly mobile/local commands are exempt.
    mobile = re.compile(r"^(?:boundaries:check|start(?::.*)?|android(?::.*)?|ios(?::.*)?|lucid:.*|typecheck:.*|lint(?::.*)?|test:(?:file|related|expo|node|perf|e2e.*))$")
    changed = {key for key in old_scripts.keys() | new_scripts.keys()
               if old_scripts.get(key) != new_scripts.get(key)}
    return all(mobile.fullmatch(key) for key in changed)


def without_mobile_jobs(text):
    # Narrow projection of our block-style continuation, not a YAML parser.
    # Shared anchors/aliases or unfamiliar layouts deliberately fail closed.
    if re.search(r"[&*][A-Za-z_]", text) or "\t" in text:
        raise ValueError("shared YAML aliases or tabs require full validation")
    in_jobs = skip = False
    found = set()
    output = []
    for line in text.splitlines(keepends=True):
        if re.match(r"^[A-Za-z][\w-]*:", line):
            in_jobs = line.strip() == "jobs:"
            skip = False
        match = re.match(r"^  ([A-Za-z][\w-]*):\s*$", line)
        if in_jobs and match:
            skip = match[1] in {"noctalia-quality", "meditation-quality"}
            if skip:
                if match[1] in found:
                    raise ValueError("duplicate mobile job")
                found.add(match[1])
        if not skip:
            output.append(line)
    if found != {"noctalia-quality", "meditation-quality"}:
        raise ValueError("unrecognized continuation jobs")
    return "".join(output)


def main():
    base, head, path = sys.argv[1:]
    before, after = read(base, path), read(head, path)
    if path == "package.json":
        unchanged = mobile_scripts_only(before, after)
    elif path == ".circleci/continue.yml":
        unchanged = without_mobile_jobs(before) == without_mobile_jobs(after)
    else:
        unchanged = False
    return 0 if unchanged else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError, subprocess.CalledProcessError):
        sys.exit(1)
