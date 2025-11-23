#!/usr/bin/env python3
import json
from pathlib import Path

METADATA_DIR = Path(".metadata_store")

def load_json(filename):
    try:
        with open(METADATA_DIR / filename, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return []

def analyze_css(data):
    if not data: return None
    total = len(data)
    bem_usage = sum(1 for d in data if d["consistency"]["uses_bem"])
    vars_usage = sum(1 for d in data if d["consistency"]["uses_css_vars"])
    total_important = sum(d["consistency"]["important_count"] for d in data)
    total_hardcoded = sum(d["consistency"]["hardcoded_colors"] for d in data)
    
    # New metrics
    total_typography = sum(d["consistency"].get("typography", {}).get("total", 0) for d in data)
    hardcoded_typography = sum(d["consistency"].get("typography", {}).get("hardcoded", 0) for d in data)
    total_spacing = sum(d["consistency"].get("spacing", {}).get("total", 0) for d in data)
    hardcoded_spacing = sum(d["consistency"].get("spacing", {}).get("hardcoded", 0) for d in data)
    
    return {
        "total": total,
        "bem_percentage": (bem_usage / total) * 100,
        "vars_percentage": (vars_usage / total) * 100,
        "total_important": total_important,
        "total_hardcoded_colors": total_hardcoded,
        "total_typography": total_typography,
        "hardcoded_typography": hardcoded_typography,
        "total_spacing": total_spacing,
        "hardcoded_spacing": hardcoded_spacing
    }

def analyze_js(data):
    if not data: return None
    total = len(data)
    console_logs = sum(d["consistency"]["console_log_count"] for d in data)
    todos = sum(d["consistency"]["todo_count"] for d in data)
    async_usage = sum(1 for d in data if d["consistency"]["uses_async"])
    
    return {
        "total": total,
        "total_console_logs": console_logs,
        "total_todos": todos,
        "async_percentage": (async_usage / total) * 100
    }

def analyze_html(data):
    if not data: return None
    total = len(data)
    missing_lang = sum(1 for d in data if not d["consistency"]["lang_attribute"])
    inline_styles = sum(d["consistency"]["inline_style_count"] for d in data)
    
    return {
        "total": total,
        "missing_lang": missing_lang,
        "total_inline_styles": inline_styles
    }

def analyze_py(data):
    if not data: return None
    total = len(data)
    missing_docstrings = sum(1 for d in data if not d["consistency"]["has_docstrings"])
    missing_types = sum(1 for d in data if not d["consistency"]["has_type_hints"])
    print_statements = sum(d["consistency"]["print_count"] for d in data)
    todos = sum(d["consistency"]["todo_count"] for d in data)
    
    return {
        "total": total,
        "missing_docstrings": missing_docstrings,
        "missing_type_hints": missing_types,
        "total_print_statements": print_statements,
        "total_todos": todos
    }

def main():
    css_stats = analyze_css(load_json("css_inventory.json"))
    js_stats = analyze_js(load_json("js_inventory.json"))
    html_stats = analyze_html(load_json("html_inventory.json"))
    py_stats = analyze_py(load_json("py_inventory.json"))

    print("--- CSS ANALYSIS ---")
    if css_stats:
        print(f"Files: {css_stats['total']}")
        print(f"BEM Usage: {css_stats['bem_percentage']:.1f}%")
        print(f"CSS Vars Usage: {css_stats['vars_percentage']:.1f}%")
        print(f"Total !important: {css_stats['total_important']}")
        print(f"Total Hardcoded Colors: {css_stats['total_hardcoded_colors']}")
        print(f"Typography: {css_stats['total_typography']} props ({css_stats['hardcoded_typography']} hardcoded)")
        print(f"Spacing: {css_stats['total_spacing']} props ({css_stats['hardcoded_spacing']} hardcoded)")
    
    print("\n--- JS ANALYSIS ---")
    if js_stats:
        print(f"Files: {js_stats['total']}")
        print(f"Console Logs: {js_stats['total_console_logs']}")
        print(f"TODOs: {js_stats['total_todos']}")
        print(f"Async Usage: {js_stats['async_percentage']:.1f}%")

    print("\n--- HTML ANALYSIS ---")
    if html_stats:
        print(f"Files: {html_stats['total']}")
        print(f"Missing Lang Attribute: {html_stats['missing_lang']}")
        print(f"Inline Styles: {html_stats['total_inline_styles']}")

    print("\n--- PYTHON ANALYSIS ---")
    if py_stats:
        print(f"Files: {py_stats['total']}")
        print(f"Missing Docstrings: {py_stats['missing_docstrings']}")
        print(f"Missing Type Hints: {py_stats['missing_type_hints']}")
        print(f"Print Statements (should be logging): {py_stats['total_print_statements']}")
        print(f"TODOs: {py_stats['total_todos']}")

if __name__ == "__main__":
    main()
