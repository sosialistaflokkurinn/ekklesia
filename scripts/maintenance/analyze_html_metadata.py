#!/usr/bin/env python3
"""
HTML Metadata Analyzer

Analyzes HTML files for metadata, including missing lang attributes and inline styles.
Generates a JSON inventory in .metadata_store.
"""
import os
import json
import re
import datetime
from pathlib import Path

# Configuration
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
HTML_DIR = ROOT_DIR / "apps" / "members-portal"
METADATA_DIR = ROOT_DIR / ".metadata_store"
METADATA_FILE = METADATA_DIR / "html_inventory.json"

# Regex Patterns
DOCTYPE_PATTERN = re.compile(r"<!DOCTYPE\s+html>", re.IGNORECASE)
HTML_LANG_PATTERN = re.compile(r"<html[^>]+lang=['\"]([^'\"]+)['\"]", re.IGNORECASE)
CHARSET_PATTERN = re.compile(r"<meta[^>]+charset=['\"]([^'\"]+)['\"]", re.IGNORECASE)
VIEWPORT_PATTERN = re.compile(r"<meta[^>]+name=['\"]viewport['\"]", re.IGNORECASE)
INLINE_STYLE_PATTERN = re.compile(r"\sstyle=['\"][^'\"]*['\"]", re.IGNORECASE)
INTERNAL_SCRIPT_PATTERN = re.compile(r"<script(?![^>]*src=)[^>]*>", re.IGNORECASE) # Script tag without src attribute

# Dependency Patterns
CSS_LINK_PATTERN = re.compile(r"<link[^>]+rel=['\"]stylesheet['\"][^>]*href=['\"]([^'\"]+)['\"]", re.IGNORECASE)
JS_SCRIPT_PATTERN = re.compile(r"<script[^>]+src=['\"]([^'\"]+)['\"]", re.IGNORECASE)

def analyze_file(filepath):
    """Analyzes a single HTML file and returns metrics."""
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
    has_doctype = bool(DOCTYPE_PATTERN.search(content))
    
    lang_match = HTML_LANG_PATTERN.search(content)
    lang_attr = lang_match.group(1) if lang_match else None
    
    has_charset = bool(CHARSET_PATTERN.search(content))
    has_viewport = bool(VIEWPORT_PATTERN.search(content))
    
    inline_style_count = len(INLINE_STYLE_PATTERN.findall(content))
    internal_script_count = len(INTERNAL_SCRIPT_PATTERN.findall(content))

    # Dependencies
    css_dependencies = CSS_LINK_PATTERN.findall(content)
    js_dependencies = JS_SCRIPT_PATTERN.findall(content)

    # Categorize based on folder structure
    rel_path = filepath.relative_to(HTML_DIR)
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
            "has_doctype": has_doctype,
            "lang_attribute": lang_attr,
            "has_charset": has_charset,
            "has_viewport": has_viewport,
            "inline_style_count": inline_style_count,
            "internal_script_count": internal_script_count
        },
        "dependencies": {
            "css": css_dependencies,
            "js": js_dependencies
        }
    }

def main():
    print(f"🔍 Scanning HTML files in {HTML_DIR}...")
    
    if not HTML_DIR.exists():
        print(f"❌ Directory not found: {HTML_DIR}")
        return

    inventory = []

    for root, _, files in os.walk(HTML_DIR):
        for file in files:
            if file.endswith(".html"):
                filepath = Path(root) / file
                data = analyze_file(filepath)
                if data:
                    inventory.append(data)

    # Ensure metadata directory exists
    METADATA_DIR.mkdir(exist_ok=True)

    # Save to JSON
    with open(METADATA_FILE, "w", encoding="utf-8") as f:
        json.dump(inventory, f, indent=2, ensure_ascii=False)

    print(f"✅ Analysis complete. Found {len(inventory)} HTML files.")
    print(f"💾 Metadata saved to: {METADATA_FILE}")

if __name__ == "__main__":
    main()
