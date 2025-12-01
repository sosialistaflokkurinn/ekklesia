#!/usr/bin/env python3
"""
Analyze Markdown Metadata - Code Quality Epic
Generates metadata inventory for all .md files in the project
"""

import json
import os
import re
from pathlib import Path
from datetime import datetime
from collections import defaultdict

PROJECT_ROOT = Path("/home/gudro/Development/projects/ekklesia")
OUTPUT_FILE = PROJECT_ROOT / ".metadata_store" / "md_inventory.json"

# Patterns
HEADING_PATTERN = re.compile(r'^(#{1,6})\s+(.+)$', re.MULTILINE)
LINK_PATTERN = re.compile(r'\[([^\]]+)\]\(([^\)]+)\)')
CODE_BLOCK_PATTERN = re.compile(r'```[\s\S]*?```')
INLINE_CODE_PATTERN = re.compile(r'`[^`]+`')
LIST_PATTERN = re.compile(r'^\s*[-*+]\s+', re.MULTILINE)
TABLE_PATTERN = re.compile(r'^\|.+\|$', re.MULTILINE)
FRONTMATTER_PATTERN = re.compile(r'^---\s*\n(.*?)\n---\s*\n', re.DOTALL)
TODO_PATTERN = re.compile(r'- \[ \]')
DONE_PATTERN = re.compile(r'- \[x\]', re.IGNORECASE)

def categorize_file(filepath: str) -> str:
    """Categorize markdown file by location"""
    parts = filepath.split('/')
    
    if 'docs' in parts:
        idx = parts.index('docs')
        if len(parts) > idx + 1:
            return f"docs/{parts[idx+1]}"
        return "docs"
    elif 'apps' in parts:
        return "apps"
    elif 'services' in parts:
        return "services"
    elif 'scripts' in parts:
        return "scripts"
    elif 'tmp' in parts:
        return "tmp"
    elif parts[0] in ['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md']:
        return "root"
    else:
        return "other"

def analyze_markdown_file(filepath: Path) -> dict:
    """Analyze a single markdown file"""
    try:
        content = filepath.read_text(encoding='utf-8')
        stats = filepath.stat()
        
        # Basic stats
        lines = content.split('\n')
        line_count = len(lines)
        
        # Headings analysis
        headings = HEADING_PATTERN.findall(content)
        heading_levels = defaultdict(int)
        for level, _ in headings:
            heading_levels[len(level)] += 1
        
        # Links analysis
        links = LINK_PATTERN.findall(content)
        internal_links = sum(1 for _, url in links if not url.startswith(('http://', 'https://', 'mailto:')))
        external_links = len(links) - internal_links
        
        # Code blocks
        code_blocks = len(CODE_BLOCK_PATTERN.findall(content))
        inline_code = len(INLINE_CODE_PATTERN.findall(content))
        
        # Lists
        list_items = len(LIST_PATTERN.findall(content))
        
        # Tables
        table_rows = len(TABLE_PATTERN.findall(content))
        
        # Frontmatter
        has_frontmatter = bool(FRONTMATTER_PATTERN.match(content))
        
        # TODOs
        todos_unchecked = len(TODO_PATTERN.findall(content))
        todos_checked = len(DONE_PATTERN.findall(content))
        
        # Image count
        image_count = content.count('![')
        
        return {
            "filepath": str(filepath.relative_to(PROJECT_ROOT)),
            "filename": filepath.name,
            "category": categorize_file(str(filepath.relative_to(PROJECT_ROOT))),
            "stats": {
                "size_bytes": stats.st_size,
                "line_count": line_count,
                "last_modified": datetime.fromtimestamp(stats.st_mtime).isoformat()
            },
            "structure": {
                "headings": dict(heading_levels),
                "total_headings": len(headings),
                "has_h1": 1 in heading_levels,
                "max_heading_level": max(heading_levels.keys()) if heading_levels else 0
            },
            "content": {
                "code_blocks": code_blocks,
                "inline_code": inline_code,
                "list_items": list_items,
                "table_rows": table_rows,
                "images": image_count,
                "has_frontmatter": has_frontmatter
            },
            "links": {
                "internal": internal_links,
                "external": external_links,
                "total": len(links)
            },
            "todos": {
                "unchecked": todos_unchecked,
                "checked": todos_checked,
                "total": todos_unchecked + todos_checked
            }
        }
    except Exception as e:
        return {
            "filepath": str(filepath.relative_to(PROJECT_ROOT)),
            "filename": filepath.name,
            "error": str(e)
        }

def main():
    """Main analysis function"""
    print("🔍 Analyzing markdown files...")
    
    # Find all markdown files
    md_files = list(PROJECT_ROOT.rglob("*.md"))
    
    # Exclude node_modules and .git
    md_files = [
        f for f in md_files 
        if 'node_modules' not in str(f) and '.git' not in str(f)
    ]
    
    print(f"Found {len(md_files)} markdown files")
    
    # Analyze each file
    inventory = []
    for i, filepath in enumerate(md_files, 1):
        if i % 100 == 0:
            print(f"  Analyzed {i}/{len(md_files)} files...")
        
        metadata = analyze_markdown_file(filepath)
        inventory.append(metadata)
    
    # Sort by filepath
    inventory.sort(key=lambda x: x.get('filepath', ''))
    
    # Save to JSON
    OUTPUT_FILE.parent.mkdir(exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(inventory, f, indent=2)
    
    # Print summary
    print(f"\n✅ Analysis complete!")
    print(f"   Total files: {len(inventory)}")
    print(f"   Output: {OUTPUT_FILE}")
    
    # Statistics
    total_lines = sum(f.get('stats', {}).get('line_count', 0) for f in inventory if 'error' not in f)
    total_size = sum(f.get('stats', {}).get('size_bytes', 0) for f in inventory if 'error' not in f)
    total_code_blocks = sum(f.get('content', {}).get('code_blocks', 0) for f in inventory if 'error' not in f)
    total_todos = sum(f.get('todos', {}).get('total', 0) for f in inventory if 'error' not in f)
    
    print(f"\n📊 Summary:")
    print(f"   Total lines: {total_lines:,}")
    print(f"   Total size: {total_size:,} bytes ({total_size / 1024 / 1024:.2f} MB)")
    print(f"   Total code blocks: {total_code_blocks}")
    print(f"   Total TODOs: {total_todos}")
    
    # Category breakdown
    categories = defaultdict(int)
    for f in inventory:
        if 'error' not in f:
            categories[f['category']] += 1
    
    print(f"\n📁 By Category:")
    for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
        print(f"   {cat}: {count} files")

if __name__ == '__main__':
    main()
