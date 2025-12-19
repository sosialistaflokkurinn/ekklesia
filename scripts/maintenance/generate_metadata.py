#!/usr/bin/env python3
"""
Unified Metadata Generator

Scans the codebase for JS, Python, HTML, CSS, and Markdown files.
Generates detailed inventory JSON files in .metadata_store.
Optimized for performance using parallel processing.
"""

import os
import json
import re
import datetime
import concurrent.futures
from pathlib import Path
from typing import Dict, List, Any, Optional

# Configuration
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
METADATA_DIR = ROOT_DIR / ".metadata_store"
IGNORE_DIRS = {".venv", "venv", "env", "__pycache__", ".git", "node_modules", "dist", "build", ".firebase", ".metadata_store"}

# Ensure metadata directory exists
METADATA_DIR.mkdir(exist_ok=True)

# --- Regex Patterns ---

# JavaScript
JS_CONSOLE_LOG = re.compile(r"console\.log\s*\(")
JS_TODO = re.compile(r"//\s*(TODO|FIXME)|/\*\s*(TODO|FIXME)")
JS_ASYNC = re.compile(r"async\s+function|async\s*\(")
JS_AWAIT = re.compile(r"\bawait\s+")
JS_IMPORT = re.compile(r"import\s+.*from\s+['\"]|import\s*\(")
JS_IMPORT_FROM = re.compile(r"from\s+['\"]([^'\"]+)['\"]")
JS_DYNAMIC_IMPORT = re.compile(r"import\s*\(\s*['\"]([^'\"]+)['\"]\s*\)")

# Python
PY_DOCSTRING = re.compile(r'"""[\s\S]*?"""|\'\'\'[\s\S]*?\'\'\'')
PY_TYPE_HINT = re.compile(r':\s*[a-zA-Z0-9_\[\], ]+|->')
PY_PRINT = re.compile(r'\bprint\s*\(')
PY_LOGGING = re.compile(r'\blogging\.|logger\.')
PY_TODO = re.compile(r'#\s*(TODO|FIXME)')
PY_IMPORT = re.compile(r'^\s*(?:import|from)\s+([a-zA-Z0-9_.]+)', re.MULTILINE)

# HTML
HTML_DOCTYPE = re.compile(r"<!DOCTYPE\s+html>", re.IGNORECASE)
HTML_LANG = re.compile(r"<html[^>]+lang=['\"]([^'\"]+)['\"]", re.IGNORECASE)
HTML_CHARSET = re.compile(r"<meta[^>]+charset=['\"]([^'\"]+)['\"]", re.IGNORECASE)
HTML_VIEWPORT = re.compile(r"<meta[^>]+name=['\"]viewport['\"]", re.IGNORECASE)
HTML_INLINE_STYLE = re.compile(r"\sstyle=['\"][^'\"]*['\"]", re.IGNORECASE)
HTML_INTERNAL_SCRIPT = re.compile(r"<script(?![^>]*src=)[^>]*>", re.IGNORECASE)
HTML_CSS_LINK = re.compile(r"<link[^>]+rel=['\"]stylesheet['\"][^>]*href=['\"]([^'\"]+)['\"]", re.IGNORECASE)
HTML_JS_SCRIPT = re.compile(r"<script[^>]+src=['\"]([^'\"]+)['\"]", re.IGNORECASE)

# CSS
CSS_IMPORT = re.compile(r"@import\s+['\"]([^'\"]+)['\"]")
CSS_VAR_DEF = re.compile(r"--[a-zA-Z0-9-]+:")
CSS_VAR_USE = re.compile(r"var\(--[a-zA-Z0-9-]+\)")
CSS_MEDIA_QUERY = re.compile(r"@media")
CSS_IMPORTANT = re.compile(r"!important")

# Markdown
MD_LINK = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
MD_HEADING = re.compile(r"^#+\s+(.+)", re.MULTILINE)
MD_CODE_BLOCK = re.compile(r"```")
MD_TODO_UNCHECKED = re.compile(r"^[-*]\s+\[ \]", re.MULTILINE)
MD_TODO_CHECKED = re.compile(r"^[-*]\s+\[x\]", re.MULTILINE | re.IGNORECASE)

# --- Analyzers ---

def strip_js_comments(text):
    # Remove single line comments
    text = re.sub(r'//.*', '', text)
    # Remove multi-line comments
    text = re.sub(r'/\*[\s\S]*?\*/', '', text)
    return text

def analyze_js(filepath: Path, content: str) -> Dict[str, Any]:
    lines = content.splitlines()
    imports = []
    for line in lines:
        match_from = JS_IMPORT_FROM.search(line)
        if match_from: imports.append(match_from.group(1))
        match_dynamic = JS_DYNAMIC_IMPORT.search(line)
        if match_dynamic: imports.append(match_dynamic.group(1))

    clean_content = strip_js_comments(content)

    return {
        "consistency": {
            "console_log_count": len(JS_CONSOLE_LOG.findall(clean_content)),
            "todo_count": len(JS_TODO.findall(content)),
            "uses_async": bool(JS_ASYNC.search(content)) or bool(JS_AWAIT.search(content)),
            "uses_modules": bool(JS_IMPORT.search(content))
        },
        "dependencies": imports
    }

def analyze_py(filepath: Path, content: str) -> Dict[str, Any]:
    return {
        "consistency": {
            "has_docstrings": bool(PY_DOCSTRING.search(content)),
            "has_type_hints": bool(PY_TYPE_HINT.search(content)),
            "print_count": len(PY_PRINT.findall(content)),
            "logging_count": len(PY_LOGGING.findall(content)),
            "todo_count": len(PY_TODO.findall(content))
        },
        "dependencies": sorted(list(set(PY_IMPORT.findall(content))))
    }

def analyze_html(filepath: Path, content: str) -> Dict[str, Any]:
    lang_match = HTML_LANG.search(content)
    return {
        "consistency": {
            "has_doctype": bool(HTML_DOCTYPE.search(content)),
            "lang_attribute": lang_match.group(1) if lang_match else None,
            "has_charset": bool(HTML_CHARSET.search(content)),
            "has_viewport": bool(HTML_VIEWPORT.search(content)),
            "inline_style_count": len(HTML_INLINE_STYLE.findall(content)),
            "internal_script_count": len(HTML_INTERNAL_SCRIPT.findall(content))
        },
        "dependencies": {
            "css": HTML_CSS_LINK.findall(content),
            "js": HTML_JS_SCRIPT.findall(content)
        }
    }

def analyze_css(filepath: Path, content: str) -> Dict[str, Any]:
    return {
        "consistency": {
            "variable_definitions": len(CSS_VAR_DEF.findall(content)),
            "variable_usages": len(CSS_VAR_USE.findall(content)),
            "media_queries": len(CSS_MEDIA_QUERY.findall(content)),
            "important_usage": len(CSS_IMPORTANT.findall(content))
        },
        "dependencies": CSS_IMPORT.findall(content)
    }

def analyze_md(filepath: Path, content: str) -> Dict[str, Any]:
    unchecked = len(MD_TODO_UNCHECKED.findall(content))
    checked = len(MD_TODO_CHECKED.findall(content))
    return {
        "consistency": {
            "heading_count": len(MD_HEADING.findall(content)),
            "code_block_count": len(MD_CODE_BLOCK.findall(content)) // 2
        },
        "links": [m[1] for m in MD_LINK.findall(content)],
        "todos": {
            "total": unchecked + checked,
            "unchecked": unchecked,
            "checked": checked
        }
    }

ANALYZERS = {
    ".js": analyze_js,
    ".py": analyze_py,
    ".html": analyze_html,
    ".css": analyze_css,
    ".md": analyze_md
}

def process_file(filepath: Path) -> Optional[Dict[str, Any]]:
    """Reads and analyzes a single file."""
    ext = filepath.suffix
    if ext not in ANALYZERS:
        return None

    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return None

    stat = os.stat(filepath)
    
    # Base metadata
    try:
        rel_path = filepath.relative_to(ROOT_DIR)
        category = rel_path.parts[0] if len(rel_path.parts) > 1 else "root"
    except ValueError:
        rel_path = filepath
        category = "unknown"

    data = {
        "filepath": str(rel_path),
        "filename": filepath.name,
        "category": category,
        "type": ext[1:],
        "stats": {
            "size_bytes": stat.st_size,
            "line_count": len(content.splitlines()),
            "last_modified": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat()
        }
    }

    # Run specific analyzer
    analysis = ANALYZERS[ext](filepath, content)
    data.update(analysis)
    
    return data

def main():
    print(f"🚀 Starting unified metadata generation...")
    print(f"📂 Root: {ROOT_DIR}")

    # Collect all files to process
    files_to_process = []
    for root, dirs, files in os.walk(ROOT_DIR):
        # Skip ignored directories
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        
        for file in files:
            filepath = Path(root) / file
            if filepath.suffix in ANALYZERS:
                files_to_process.append(filepath)

    print(f"📝 Found {len(files_to_process)} files to analyze.")

    # Process in parallel
    results = {
        "js": [],
        "py": [],
        "html": [],
        "css": [],
        "md": []
    }

    with concurrent.futures.ThreadPoolExecutor() as executor:
        future_to_file = {executor.submit(process_file, fp): fp for fp in files_to_process}
        for future in concurrent.futures.as_completed(future_to_file):
            data = future.result()
            if data:
                file_type = data["type"]
                if file_type in results:
                    results[file_type].append(data)

    # Write results
    for file_type, items in results.items():
        output_file = METADATA_DIR / f"{file_type}_inventory.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(items, f, indent=2)
        print(f"✅ Wrote {len(items)} items to {output_file.name}")

    print("✨ Metadata generation complete!")

if __name__ == "__main__":
    main()
