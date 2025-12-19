#!/usr/bin/env python3
"""
Map all references to a Cloud Function service across the codebase.

Usage:
    ./scripts/maintenance/map-service-references.py updatememberprofile
    ./scripts/maintenance/map-service-references.py verifymembership
    ./scripts/maintenance/map-service-references.py bidirectional-sync
"""

import os
import re
import sys
from pathlib import Path
from typing import List, Dict, Tuple
from collections import defaultdict

# ANSI color codes
BOLD = '\033[1m'
GREEN = '\033[92m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
MAGENTA = '\033[95m'
CYAN = '\033[96m'
RESET = '\033[0m'

# Directories to search (relative to project root)
SEARCH_DIRS = [
    'apps/',
    'services/',
    'docs/',
    'scripts/',
    '.github/',
]

# File patterns to search
INCLUDE_PATTERNS = [
    '*.py',
    '*.js',
    '*.ts',
    '*.jsx',
    '*.tsx',
    '*.json',
    '*.yaml',
    '*.yml',
    '*.md',
    '*.txt',
    '*.sh',
]

# Directories to exclude
EXCLUDE_DIRS = [
    'node_modules',
    '.git',
    '__pycache__',
    'venv',
    '.venv',
    'dist',
    'build',
    '.next',
    'coverage',
    '.pytest_cache',
    '.metadata_store',
]

def should_search_file(file_path: Path) -> bool:
    """Check if file should be searched based on patterns and exclusions."""
    # Check if in excluded directory
    for exclude_dir in EXCLUDE_DIRS:
        if exclude_dir in file_path.parts:
            return False

    # Check if matches include patterns
    for pattern in INCLUDE_PATTERNS:
        if file_path.match(pattern):
            return True

    return False

def search_file(file_path: Path, search_term: str) -> List[Tuple[int, str]]:
    """
    Search a file for the search term and return matching lines.

    Returns:
        List of (line_number, line_content) tuples
    """
    matches = []
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            for line_num, line in enumerate(f, start=1):
                if search_term.lower() in line.lower():
                    matches.append((line_num, line.rstrip()))
    except Exception as e:
        print(f"Error reading {file_path}: {e}", file=sys.stderr)

    return matches

def categorize_reference(file_path: Path, line: str, search_term: str) -> str:
    """Categorize the type of reference based on file type and content."""
    file_str = str(file_path)
    line_lower = line.lower()

    # Documentation
    if file_path.suffix == '.md':
        return 'documentation'

    # Configuration
    if file_path.suffix in ['.json', '.yaml', '.yml']:
        return 'configuration'

    # Deployment
    if '.github' in file_str or 'cloudbuild' in line_lower or 'deploy' in line_lower:
        return 'deployment'

    # Function definition
    if 'def ' in line and search_term in line:
        return 'function_definition'

    # Import statement
    if 'import' in line_lower or 'from' in line_lower:
        return 'import'

    # URL/endpoint reference
    if 'http' in line_lower or 'url' in line_lower or 'endpoint' in line_lower:
        return 'endpoint'

    # Function call
    if '(' in line and search_term in line:
        return 'function_call'

    # Comment
    if line.strip().startswith('#') or line.strip().startswith('//'):
        return 'comment'

    return 'code_reference'

def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <service-name>")
        print(f"\nExample: {sys.argv[0]} updatememberprofile")
        sys.exit(1)

    search_term = sys.argv[1]

    # Get project root (2 levels up from script location)
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent.parent

    print(f"\n{BOLD}{CYAN}Service Reference Mapper{RESET}")
    print(f"{BOLD}{'=' * 80}{RESET}\n")
    print(f"{BOLD}Searching for:{RESET} {GREEN}{search_term}{RESET}")
    print(f"{BOLD}Project root:{RESET} {project_root}\n")

    # Collect all matches
    all_matches: Dict[str, List[Tuple[Path, int, str]]] = defaultdict(list)
    total_files_searched = 0
    total_matches = 0

    # Search through all directories
    for search_dir in SEARCH_DIRS:
        dir_path = project_root / search_dir
        if not dir_path.exists():
            continue

        for file_path in dir_path.rglob('*'):
            if not file_path.is_file():
                continue

            if not should_search_file(file_path):
                continue

            total_files_searched += 1
            matches = search_file(file_path, search_term)

            if matches:
                for line_num, line in matches:
                    category = categorize_reference(file_path, line, search_term)
                    relative_path = file_path.relative_to(project_root)
                    all_matches[category].append((relative_path, line_num, line))
                    total_matches += 1

    # Print results by category
    if total_matches == 0:
        print(f"{YELLOW}No matches found.{RESET}\n")
        return

    print(f"{BOLD}Results:{RESET} Found {GREEN}{total_matches}{RESET} matches in {GREEN}{len([m for matches in all_matches.values() for m in matches])}{RESET} locations\n")
    print(f"{BOLD}{'=' * 80}{RESET}\n")

    # Category order and display names
    category_display = {
        'function_definition': '🔧 Function Definitions',
        'import': '📥 Import Statements',
        'function_call': '📞 Function Calls',
        'endpoint': '🌐 URL/Endpoint References',
        'configuration': '⚙️  Configuration Files',
        'deployment': '🚀 Deployment Files',
        'documentation': '📚 Documentation',
        'comment': '💬 Comments',
        'code_reference': '📝 Code References',
    }

    for category, display_name in category_display.items():
        if category not in all_matches:
            continue

        matches = all_matches[category]
        print(f"\n{BOLD}{MAGENTA}{display_name}{RESET} ({len(matches)} matches)")
        print(f"{BOLD}{'-' * 80}{RESET}")

        # Sort by file path
        matches.sort(key=lambda x: str(x[0]))

        current_file = None
        for file_path, line_num, line in matches:
            # Print file header if new file
            if file_path != current_file:
                print(f"\n{BOLD}{BLUE}{file_path}{RESET}")
                current_file = file_path

            # Highlight the search term in the line
            highlighted_line = re.sub(
                f'({re.escape(search_term)})',
                f'{GREEN}\\1{RESET}',
                line,
                flags=re.IGNORECASE
            )

            print(f"  {YELLOW}Line {line_num:4d}:{RESET} {highlighted_line.strip()}")

    # Summary
    print(f"\n{BOLD}{'=' * 80}{RESET}")
    print(f"\n{BOLD}Summary:{RESET}")
    print(f"  Files searched: {total_files_searched}")
    print(f"  Total matches: {total_matches}")
    print(f"  Categories found: {len(all_matches)}")

    print(f"\n{BOLD}Category Breakdown:{RESET}")
    for category, display_name in category_display.items():
        if category in all_matches:
            count = len(all_matches[category])
            print(f"  {display_name}: {count}")

    print()

if __name__ == '__main__':
    main()
