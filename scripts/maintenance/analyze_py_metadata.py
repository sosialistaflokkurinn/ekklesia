#!/usr/bin/env python3
import os
import json
import re
import datetime
from pathlib import Path

# Configuration
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
# Directories to scan for Python code
SCAN_DIRS = [
    ROOT_DIR / "services" / "members",
    ROOT_DIR / "scripts"
]
METADATA_DIR = ROOT_DIR / ".metadata_store"
METADATA_FILE = METADATA_DIR / "py_inventory.json"

# Ignore patterns (directories)
IGNORE_DIRS = {".venv", "venv", "env", "__pycache__", ".git", "node_modules"}

# Regex Patterns
DOCSTRING_PATTERN = re.compile(r'"""[\s\S]*?"""|\'\'\'[\s\S]*?\'\'\'')
TYPE_HINT_PATTERN = re.compile(r':\s*[a-zA-Z0-9_\[\], ]+|->')
PRINT_PATTERN = re.compile(r'\bprint\s*\(')
LOGGING_PATTERN = re.compile(r'\blogging\.|logger\.')
TODO_PATTERN = re.compile(r'#\s*(TODO|FIXME)')
IMPORT_PATTERN = re.compile(r'^\s*(?:import|from)\s+([a-zA-Z0-9_.]+)', re.MULTILINE)

def analyze_file(filepath):
    """Analyzes a single Python file and returns metrics."""
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            lines = content.splitlines()
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return None

    # Basic Stats
    stat = os.stat(filepath)
    
    # Consistency Checks
    has_docstrings = bool(DOCSTRING_PATTERN.search(content))
    has_type_hints = bool(TYPE_HINT_PATTERN.search(content))
    print_count = len(PRINT_PATTERN.findall(content))
    logging_count = len(LOGGING_PATTERN.findall(content))
    todo_count = len(TODO_PATTERN.findall(content))

    # Dependencies (Imports)
    imports = sorted(list(set(IMPORT_PATTERN.findall(content))))

    # Categorize based on folder structure
    try:
        rel_path = filepath.relative_to(ROOT_DIR)
        category = rel_path.parts[0] if len(rel_path.parts) > 1 else "root"
    except ValueError:
        category = "unknown"

    return {
        "filepath": str(rel_path),
        "filename": filepath.name,
        "category": category,
        "stats": {
            "size_bytes": stat.st_size,
            "line_count": len(lines),
            "last_modified": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat()
        },
        "consistency": {
            "has_docstrings": has_docstrings,
            "has_type_hints": has_type_hints,
            "print_count": print_count,
            "logging_count": logging_count,
            "todo_count": todo_count
        },
        "dependencies": imports
    }

def main():
    print(f"🔍 Scanning Python files in: {[str(d.relative_to(ROOT_DIR)) for d in SCAN_DIRS]}...")
    
    inventory = []

    for scan_dir in SCAN_DIRS:
        if not scan_dir.exists():
            print(f"⚠️ Directory not found: {scan_dir}")
            continue

        for root, dirs, files in os.walk(scan_dir):
            # Modify dirs in-place to skip ignored directories
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
            
            for file in files:
                if file.endswith(".py"):
                    filepath = Path(root) / file
                    data = analyze_file(filepath)
                    if data:
                        inventory.append(data)

    # Ensure metadata directory exists
    METADATA_DIR.mkdir(exist_ok=True)

    # Save to JSON
    with open(METADATA_FILE, "w", encoding="utf-8") as f:
        json.dump(inventory, f, indent=2, ensure_ascii=False)

    print(f"✅ Analysis complete. Found {len(inventory)} Python files.")
    print(f"💾 Metadata saved to: {METADATA_FILE}")

if __name__ == "__main__":
    main()
