#!/usr/bin/env python3
"""Validate DOCUMENTATION_MAP.md against the filesystem.

This script performs two checks:
1. Verifies that every inline code reference in DOCUMENTATION_MAP.md that
   looks like a file path actually exists on disk.
2. Lists documentation files from key directories that are not mentioned in
   the map (currently limited to Markdown and shell scripts).

Run from the repository root:
    ./validate_documentation_map.py
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path
from typing import Iterable, Set

# By default we look for documentation assets in these directories.
# Note: Archived directories (Oct 7-9, 2025):
#   - gcp/ → archive/gcp-infrastructure/ (Oct 8, 2025)
#   - portal/ → archive/ekklesia-platform-evaluation/portal/
#   - voting/ → archive/ekklesia-platform-evaluation/voting/
#   - auth/ → archive/zitadel-legacy/auth/
# Current active directories:
#   - docs/ - All documentation
#   - members/ - Members service (Firebase-based, production)
#   - events/ - Events service (Node.js, production Oct 9-10, 2025)
#   - elections/ - Elections service (Node.js, production Oct 9-10, 2025)
#   - archive/ - Historical implementations and evaluations
DEFAULT_SCAN_DIRS = (
    "docs",
    "members",
    "events",
    "elections",
    "archive",
)

# File suffixes that we consider part of documentation for the purposes of
# coverage. Extend this tuple if you need to track additional formats.
DOC_SUFFIXES = (".md", ".markdown", ".mdx", ".rst", ".txt", ".sh")

INLINE_CODE_PATTERN = re.compile(r"`([^`]+)`")
PATH_PATTERN = re.compile(r"(?<![\w./-])(docs|members|events|elections|archive)/[\w./-]+")

EXCLUDE_PARTS = {"node_modules", "venv", ".venv", "__pycache__", "site-packages"}


def extract_paths(markdown: str) -> Set[Path]:
    """Extract potential file paths from the markdown content."""

    candidates: Set[Path] = set()

    # First collect inline code references (when the markdown is well-formed).
    for match in INLINE_CODE_PATTERN.finditer(markdown):
        raw = match.group(1).strip()
        if "\n" in raw or "\r" in raw:
            continue
        # Skip obvious non-path entries (e.g., command snippets, environment names).
        if raw.startswith("./"):
            continue
        if "/" not in raw:
            continue
        # Strip anchor fragments (e.g., #section-name)
        if "#" in raw:
            raw = raw.split("#")[0]
        path = Path(raw)
        if not path.suffix:
            continue
        candidates.add(path)

    # Fall back to direct path pattern matching to cope with malformed code spans.
    for match in PATH_PATTERN.finditer(markdown):
        raw = match.group(0).strip().rstrip('`.,;:!)')
        # Strip anchor fragments (e.g., #section-name)
        if "#" in raw:
            raw = raw.split("#")[0]
        path = Path(raw)
        if not path.suffix:
            continue
        candidates.add(path)

    return candidates


def collect_repository_docs(root: Path, directories: Iterable[str]) -> Set[Path]:
    """Return all documentation files under the given directories."""

    discovered: Set[Path] = set()
    for relative_dir in directories:
        base = root / relative_dir
        if not base.exists():
            continue
        for path in base.rglob("*"):
            parts = path.parts
            if any(part in EXCLUDE_PARTS or part.endswith(".dist-info") for part in parts):
                continue
            if path.is_file() and path.suffix in DOC_SUFFIXES:
                discovered.add(path.relative_to(root))
    return discovered


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--map",
        default="DOCUMENTATION_MAP.md",
        help="Path to the documentation map file (default: DOCUMENTATION_MAP.md)",
    )
    parser.add_argument(
        "--scan",
        nargs="*",
        default=DEFAULT_SCAN_DIRS,
        help="Directories to scan for documentation coverage",
    )
    args = parser.parse_args()

    repo_root = Path.cwd()
    map_path = repo_root / args.map
    if not map_path.exists():
        raise SystemExit(f"Map file not found: {map_path}")

    markdown = map_path.read_text(encoding="utf-8")
    referenced_paths = extract_paths(markdown)

    missing = sorted(path for path in referenced_paths if not (repo_root / path).exists())

    discovered_docs = collect_repository_docs(repo_root, args.scan)
    unlisted = sorted(discovered_docs - referenced_paths)

    print("=== Documentation Map Validation ===")
    print(f"Map file: {map_path}")
    print(f"Referenced paths found: {len(referenced_paths)}")

    if missing:
        print("\nMissing files referenced in the map:")
        for path in missing:
            print(f"  - {path}")
    else:
        print("\nAll referenced files were found.")

    if unlisted:
        print("\nDocumentation files not referenced in the map:")
        for path in unlisted:
            print(f"  - {path}")
    else:
        print("\nNo unlisted documentation files detected in the scanned directories.")


if __name__ == "__main__":
    main()
