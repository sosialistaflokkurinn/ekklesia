#!/usr/bin/env python3
"""
Remove all dead links from DOCUMENTATION_MAP.md that point to non-existent files.
"""

import os
import re
from pathlib import Path

# Repository root
REPO_ROOT = Path(__file__).parent.parent.parent
DOC_MAP = REPO_ROOT / "DOCUMENTATION_MAP.md"

# Read list of broken links
BROKEN_LINKS_FILE = Path("/tmp/all_broken_links.txt")

def remove_dead_links() -> Any:
    """Remove references to files that don't exist"""

    print(f"Reading {DOC_MAP}")
    with open(DOC_MAP, 'r') as f:
        content = f.read()

    # Read broken links
    with open(BROKEN_LINKS_FILE, 'r') as f:
        broken_links = [line.strip() for line in f if line.strip()]

    print(f"Found {len(broken_links)} broken links to remove")

    original_content = content
    removed_count = 0

    for broken_path in broken_links:
        # Skip if file actually exists
        full_path = REPO_ROOT / broken_path
        if full_path.exists():
            print(f"  SKIP (exists): {broken_path}")
            continue

        # Escape special regex characters
        path_escaped = re.escape(broken_path)

        # Pattern 1: Remove markdown links [text](path)
        pattern1 = r'\[([^\]]+)\]\(' + path_escaped + r'\)'
        matches1 = re.findall(pattern1, content)
        if matches1:
            # Just remove the link, keep the text
            content = re.sub(pattern1, r'\1', content)
            removed_count += len(matches1)
            print(f"  Removed link: {broken_path}")
            continue

        # Pattern 2: Remove table rows that reference this path
        # Look for lines like: | `path` | text | text |
        pattern2 = r'\|[^\n]*`?' + path_escaped + r'`?[^\n]*\|\n'
        matches2 = re.findall(pattern2, content)
        if matches2:
            content = re.sub(pattern2, '', content)
            removed_count += len(matches2)
            print(f"  Removed table row: {broken_path}")
            continue

        # Pattern 3: Remove list items that reference this path
        # Look for lines like: - `path`
        pattern3 = r'^[ \t]*[-*][ \t]+`?' + path_escaped + r'`?[^\n]*\n'
        matches3 = re.findall(pattern3, content, re.MULTILINE)
        if matches3:
            content = re.sub(pattern3, '', content, flags=re.MULTILINE)
            removed_count += len(matches3)
            print(f"  Removed list item: {broken_path}")
            continue

        # Pattern 4: Remove bare references in text
        if broken_path in content:
            # Count occurrences
            count = content.count(broken_path)
            print(f"  Warning: {count} bare reference(s) to {broken_path} still exist")

    if content != original_content:
        print(f"\nWriting updated content to {DOC_MAP}")
        with open(DOC_MAP, 'w') as f:
            f.write(content)

        print(f"\n✅ REMOVED {removed_count} dead references")
    else:
        print("\n⚠️  No changes made")

    return removed_count

if __name__ == '__main__':
    removed = remove_dead_links()
    print(f"\nTotal removed: {removed}")
