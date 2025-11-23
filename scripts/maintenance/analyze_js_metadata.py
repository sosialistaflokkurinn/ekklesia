#!/usr/bin/env python3
import os
import json
import re
import datetime
from pathlib import Path

# Configuration
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
JS_DIR = ROOT_DIR / "apps" / "members-portal" / "js"
METADATA_DIR = ROOT_DIR / ".metadata_store"
METADATA_FILE = METADATA_DIR / "js_inventory.json"

# Regex Patterns
CONSOLE_LOG_PATTERN = re.compile(r"console\.log\s*\(")
TODO_PATTERN = re.compile(r"//\s*(TODO|FIXME)|/\*\s*(TODO|FIXME)")
ASYNC_PATTERN = re.compile(r"async\s+function|async\s*\(")
AWAIT_PATTERN = re.compile(r"\bawait\s+")
IMPORT_PATTERN = re.compile(r"import\s+.*from\s+['\"]|import\s*\(")

def analyze_file(filepath):
    """Analyzes a single JS file and returns metrics."""
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
    console_log_count = len(CONSOLE_LOG_PATTERN.findall(content))
    todo_count = len(TODO_PATTERN.findall(content))
    uses_async = bool(ASYNC_PATTERN.search(content)) or bool(AWAIT_PATTERN.search(content))
    uses_modules = bool(IMPORT_PATTERN.search(content))
    
    # Dependencies (Imports)
    # Simple regex to capture import paths
    imports = []
    # Matches: import ... from "path"; or import("path")
    # This is a basic approximation
    import_from_pattern = re.compile(r"from\s+['\"]([^'\"]+)['\"]")
    dynamic_import_pattern = re.compile(r"import\s*\(\s*['\"]([^'\"]+)['\"]\s*\)")
    
    for line in lines:
        match_from = import_from_pattern.search(line)
        if match_from:
            imports.append(match_from.group(1))
        
        match_dynamic = dynamic_import_pattern.search(line)
        if match_dynamic:
            imports.append(match_dynamic.group(1))

    # Categorize based on folder structure
    rel_path = filepath.relative_to(JS_DIR)
    category = rel_path.parts[0] if len(rel_path.parts) > 1 else "root"

    return {
        "filepath": str(filepath.relative_to(ROOT_DIR)),
        "filename": filepath.name,
        "category": category,
        "stats": {
            "size_bytes": stat.st_size,
            "line_count": len(lines),
            "last_modified": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat()
        },
        "consistency": {
            "console_log_count": console_log_count,
            "todo_count": todo_count,
            "uses_async": uses_async,
            "uses_modules": uses_modules
        },
        "dependencies": imports
    }

def main():
    print(f"🔍 Scanning JS files in {JS_DIR}...")
    
    if not JS_DIR.exists():
        print(f"❌ Directory not found: {JS_DIR}")
        return

    inventory = []

    for root, _, files in os.walk(JS_DIR):
        for file in files:
            if file.endswith(".js"):
                filepath = Path(root) / file
                data = analyze_file(filepath)
                if data:
                    inventory.append(data)

    # Ensure metadata directory exists
    METADATA_DIR.mkdir(exist_ok=True)

    # Save to JSON
    with open(METADATA_FILE, "w", encoding="utf-8") as f:
        json.dump(inventory, f, indent=2, ensure_ascii=False)

    print(f"✅ Analysis complete. Found {len(inventory)} JS files.")
    print(f"💾 Metadata saved to: {METADATA_FILE}")

if __name__ == "__main__":
    main()
