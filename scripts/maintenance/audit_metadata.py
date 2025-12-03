#!/usr/bin/env python3
"""
Metadata Auditor

Reads the inventory JSON files from .metadata_store and reports on code health issues.
Demonstrates the value of the metadata for harmonization.
"""

import json
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
METADATA_DIR = ROOT_DIR / ".metadata_store"

def load_inventory(file_type):
    path = METADATA_DIR / f"{file_type}_inventory.json"
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def audit_js(inventory):
    print("\n--- 🟨 JavaScript Audit ---")
    issues = 0
    for item in inventory:
        cons = item.get("consistency", {})
        path = item.get("filepath")
        
        if cons.get("console_log_count", 0) > 0:
            print(f"  ⚠️  {path}: {cons['console_log_count']} console.log calls (should use debug.js)")
            issues += 1
        
        if cons.get("todo_count", 0) > 0:
            print(f"  📝 {path}: {cons['todo_count']} TODOs")
            
    if issues == 0:
        print("  ✅ No critical JS issues found.")

def audit_py(inventory):
    print("\n--- 🐍 Python Audit ---")
    issues = 0
    for item in inventory:
        cons = item.get("consistency", {})
        path = item.get("filepath")
        
        if cons.get("print_count", 0) > 0:
            # Skip scripts folder for print checks as scripts often use print
            if not path.startswith("scripts/"):
                print(f"  ⚠️  {path}: {cons['print_count']} print() calls (should use logging)")
                issues += 1
            
        if not cons.get("has_docstrings", True):
             # Skip __init__.py
            if not path.endswith("__init__.py"):
                print(f"  📄 {path}: Missing docstrings")
                issues += 1

    if issues == 0:
        print("  ✅ No critical Python issues found.")

def audit_html(inventory):
    print("\n--- 🌐 HTML Audit ---")
    issues = 0
    for item in inventory:
        cons = item.get("consistency", {})
        path = item.get("filepath")
        
        if cons.get("inline_style_count", 0) > 0:
            print(f"  🎨 {path}: {cons['inline_style_count']} inline styles (move to CSS)")
            issues += 1
            
        if not cons.get("lang_attribute"):
            print(f"  🌍 {path}: Missing 'lang' attribute")
            issues += 1

    if issues == 0:
        print("  ✅ No critical HTML issues found.")

def main():
    print("🔍 Running Code Health Audit based on Metadata Store...")
    
    js_data = load_inventory("js")
    py_data = load_inventory("py")
    html_data = load_inventory("html")
    
    if not (js_data or py_data or html_data):
        print("❌ No metadata found. Run 'scripts/maintenance/generate_metadata.py' first.")
        return

    audit_js(js_data)
    audit_py(py_data)
    audit_html(html_data)
    
    print("\nDone.")

if __name__ == "__main__":
    main()
