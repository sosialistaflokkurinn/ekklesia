#!/usr/bin/env python3
import os
import json
import re
import datetime
from pathlib import Path

# Configuration
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
STYLES_DIR = ROOT_DIR / "apps" / "members-portal" / "styles"
METADATA_DIR = ROOT_DIR / ".metadata_store"
METADATA_FILE = METADATA_DIR / "css_inventory.json"

# Regex Patterns
BEM_PATTERN = re.compile(r"(__|--)")
HEX_COLOR_PATTERN = re.compile(r"#[0-9a-fA-F]{3,6}")
RGB_PATTERN = re.compile(r"rgb\s*\(|rgba\s*\(")
VAR_PATTERN = re.compile(r"var\s*\(--")
IMPORTANT_PATTERN = re.compile(r"!important")

# New Analysis Patterns
TYPOGRAPHY_PROP_PATTERN = re.compile(r"(font-(?:size|weight|family|style)|line-height|letter-spacing)\s*:\s*([^;]+)")
SPACING_PROP_PATTERN = re.compile(r"(margin(?:-[a-z]+)?|padding(?:-[a-z]+)?|gap|row-gap|column-gap)\s*:\s*([^;]+)")

def analyze_file(filepath):
    """Analyzes a single CSS file and returns metrics."""
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
    uses_bem = bool(BEM_PATTERN.search(content))
    uses_css_vars = bool(VAR_PATTERN.search(content))
    
    # Count hardcoded colors (excluding those inside var(...), though simple regex might catch all)
    # For simplicity, we just count occurrences. A more robust parser would be needed for context.
    hex_count = len(HEX_COLOR_PATTERN.findall(content))
    rgb_count = len(RGB_PATTERN.findall(content))
    hardcoded_colors = hex_count + rgb_count
    
    important_count = len(IMPORTANT_PATTERN.findall(content))

    # Typography Analysis
    typography_matches = TYPOGRAPHY_PROP_PATTERN.findall(content)
    typography_total = len(typography_matches)
    typography_vars = sum(1 for _, val in typography_matches if "var(" in val)
    typography_hardcoded = typography_total - typography_vars

    # Spacing Analysis
    spacing_matches = SPACING_PROP_PATTERN.findall(content)
    spacing_total = len(spacing_matches)
    spacing_vars = sum(1 for _, val in spacing_matches if "var(" in val)
    spacing_hardcoded = spacing_total - spacing_vars

    # Dependencies (Imports)
    # Looking for @import "..." or @import url(...)
    imports = []
    import_pattern = re.compile(r'@import\s+(?:url\()?["\']([^"\']+)["\']')
    for line in lines:
        match = import_pattern.search(line)
        if match:
            imports.append(match.group(1))

    # Categorize based on folder structure
    rel_path = filepath.relative_to(STYLES_DIR)
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
            "uses_bem": uses_bem,
            "uses_css_vars": uses_css_vars,
            "hardcoded_colors": hardcoded_colors,
            "important_count": important_count,
            "typography": {
                "total": typography_total,
                "hardcoded": typography_hardcoded
            },
            "spacing": {
                "total": spacing_total,
                "hardcoded": spacing_hardcoded
            }
        },
        "dependencies": imports
    }

def main():
    print(f"🔍 Scanning CSS files in {STYLES_DIR}...")
    
    if not STYLES_DIR.exists():
        print(f"❌ Directory not found: {STYLES_DIR}")
        return

    inventory = []

    for root, _, files in os.walk(STYLES_DIR):
        for file in files:
            if file.endswith(".css"):
                filepath = Path(root) / file
                data = analyze_file(filepath)
                if data:
                    inventory.append(data)

    # Ensure metadata directory exists
    METADATA_DIR.mkdir(exist_ok=True)

    # Save to JSON
    with open(METADATA_FILE, "w", encoding="utf-8") as f:
        json.dump(inventory, f, indent=2, ensure_ascii=False)

    print(f"✅ Analysis complete. Found {len(inventory)} CSS files.")
    print(f"💾 Metadata saved to: {METADATA_FILE}")

if __name__ == "__main__":
    main()
