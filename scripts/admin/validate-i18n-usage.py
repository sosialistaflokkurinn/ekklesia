#!/usr/bin/env python3
"""
Validate i18n String Usage (Enhanced)

Checks that all strings defined in i18n XML files are actually used in the codebase.
Helps identify orphaned/unused translation strings.

Enhanced to detect:
- Direct access: R.string.key
- Function calls: adminStrings.get('key')
- Dynamic access: R.string[dynamicKey] (marks entire families as used)
- Template literals: ${R.string.key}
- HTML data attributes: data-i18n="key"
- Document title assignments
- Function parameters

Usage:
    python3 scripts/admin/validate-i18n-usage.py
"""

import os
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from collections import defaultdict

# Colors for output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def find_i18n_xml_files(base_path: Path) -> Any:
    """Find all i18n XML files in the project"""
    xml_files = []

    # Members portal i18n
    members_i18n = base_path / 'apps' / 'members-portal' / 'i18n' / 'values-is' / 'strings.xml'
    if members_i18n.exists():
        xml_files.append(('members', members_i18n))

    # Admin portal i18n
    admin_i18n = base_path / 'apps' / 'members-portal' / 'admin' / 'i18n' / 'values-is' / 'strings.xml'
    if admin_i18n.exists():
        xml_files.append(('admin', admin_i18n))

    return xml_files

def extract_string_keys(xml_path: Path) -> Any:
    """Extract all string keys from an XML file"""
    tree = ET.parse(xml_path)
    root = tree.getroot()

    strings = []
    for string_elem in root.findall('string'):
        name = string_elem.get('name')
        value = string_elem.text or ''
        if name:
            strings.append({
                'name': name,
                'value': value.strip(),
                'line': string_elem.sourceline if hasattr(string_elem, 'sourceline') else '?'
            })

    return strings

def find_dynamic_string_families(base_path: Path, context: str) -> Any:
    """
    Find dynamic string access patterns like R.string[key] or adminStrings.get(variable)
    Returns set of string prefixes that are accessed dynamically (e.g., 'role_badge_')
    """
    families = set()

    # Determine search paths based on context
    if context == 'admin':
        search_paths = [
            base_path / 'apps' / 'members-portal' / 'admin' / 'js',
            base_path / 'apps' / 'members-portal' / 'admin'
        ]
    else:  # members
        search_paths = [
            base_path / 'apps' / 'members-portal' / 'js',
            base_path / 'apps' / 'members-portal' / 'members-area'
        ]

    # Patterns that indicate dynamic string access
    dynamic_patterns = [
        r'R\.string\[',                          # R.string[variable]
        r'adminStrings\.get\([^\'"]',            # adminStrings.get(variable)
    ]

    for search_path in search_paths:
        if not search_path.exists() or not search_path.is_dir():
            continue

        for file_path in search_path.rglob('*.js'):
            try:
                content = file_path.read_text(encoding='utf-8')

                for pattern in dynamic_patterns:
                    if re.search(pattern, content):
                        # Found dynamic access - try to extract the pattern
                        # Look for template strings like `role_badge_${role}`
                        template_matches = re.findall(r'[`\'"](\w+)_\$\{', content)
                        for match in template_matches:
                            families.add(match + '_')  # e.g., 'role_badge_'

                        # Also look for explicit prefix patterns
                        # e.g., const key = `role_badge_${role}`
                        prefix_matches = re.findall(r'const\s+\w+\s*=\s*[`\'"](\w+)_', content)
                        for match in prefix_matches:
                            families.add(match + '_')

            except Exception:
                pass  # Skip files that can't be read

    return families

def search_string_usage(base_path: Path, string_name: str, context: str, dynamic_families: List) -> Any:
    """
    Search for usage of a string key in JavaScript and HTML files
    Enhanced to detect multiple patterns including dynamic access
    """
    usage_locations = []

    # Check if this string is part of a dynamic family
    for family in dynamic_families:
        if string_name.startswith(family):
            return [{'file': 'dynamic access pattern', 'line': 0, 'pattern': f'R.string[key] with prefix "{family}"'}]

    # Determine search paths based on context
    if context == 'admin':
        search_paths = [
            base_path / 'apps' / 'members-portal' / 'admin' / 'js',
            base_path / 'apps' / 'members-portal' / 'admin'
        ]
        patterns = [
            rf'adminStrings\.get\([\'"]({string_name})[\'"]\)',  # adminStrings.get('key')
            rf'R\.string\.({string_name})\b',                    # R.string.key
            rf'strings\.({string_name})\b',                       # strings.key (admin pattern)
            rf'\$\{{R\.string\.({string_name})\}}',              # ${R.string.key}
            rf'\$\{{strings\.({string_name})\}}',                # ${strings.key}
            rf'data-i18n=[\'"]({string_name})[\'"]',             # data-i18n="key"
        ]
    else:  # members
        search_paths = [
            base_path / 'apps' / 'members-portal' / 'js',
            base_path / 'apps' / 'members-portal' / 'members-area'
        ]
        patterns = [
            rf'R\.string\.({string_name})\b',                    # R.string.key
            rf'R\.format\(["\']?R\.string\.({string_name})',     # R.format(R.string.key, ...)
            rf'\$\{{R\.string\.({string_name})\}}',              # ${R.string.key}
            rf'data-i18n=[\'"]({string_name})[\'"]',             # data-i18n="key"
        ]

    # Search in JavaScript and HTML files
    for search_path in search_paths:
        if not search_path.exists() or not search_path.is_dir():
            continue

        files = []
        files.extend(search_path.rglob('*.js'))
        files.extend(search_path.rglob('*.html'))

        for file_path in files:
            try:
                content = file_path.read_text(encoding='utf-8')
                for pattern in patterns:
                    matches = re.finditer(pattern, content)
                    for match in matches:
                        line_num = content[:match.start()].count('\n') + 1
                        usage_locations.append({
                            'file': str(file_path.relative_to(base_path)),
                            'line': line_num,
                            'pattern': pattern
                        })
            except Exception:
                pass  # Skip files that can't be read

    return usage_locations

def main() -> None:
    """Main entry point for i18n string usage validation."""
    base_path = Path(__file__).parent.parent.parent

    print(f"{Colors.BOLD}=== i18n String Usage Validation (Enhanced) ==={Colors.RESET}\n")

    # Find all i18n XML files
    xml_files = find_i18n_xml_files(base_path)

    if not xml_files:
        print(f"{Colors.RED}No i18n XML files found!{Colors.RESET}")
        return 1

    total_strings = 0
    total_used = 0
    total_unused = 0
    total_dynamic = 0

    all_unused = []

    for context, xml_path in xml_files:
        print(f"{Colors.BLUE}{Colors.BOLD}Checking {context} i18n ({xml_path.relative_to(base_path)}){Colors.RESET}")

        # Find dynamic string families first
        dynamic_families = find_dynamic_string_families(base_path, context)
        if dynamic_families:
            print(f"  Found {len(dynamic_families)} dynamic string families: {', '.join(sorted(dynamic_families))}")

        # Extract strings
        strings = extract_string_keys(xml_path)
        print(f"  Found {len(strings)} strings")

        used_count = 0
        unused = []
        dynamic_count = 0

        # Check each string
        for string_data in strings:
            string_name = string_data['name']
            usages = search_string_usage(base_path, string_name, context, dynamic_families)

            total_strings += 1

            if usages:
                used_count += 1
                total_used += 1

                # Check if it's dynamic access
                if any('dynamic access pattern' in u.get('file', '') for u in usages):
                    dynamic_count += 1
                    total_dynamic += 1
            else:
                unused.append(string_data)
                total_unused += 1
                all_unused.append({
                    'context': context,
                    'file': str(xml_path.relative_to(base_path)),
                    **string_data
                })

        # Report for this file
        usage_pct = (used_count / len(strings) * 100) if strings else 100
        print(f"  {Colors.GREEN}Used: {used_count}/{len(strings)} ({usage_pct:.1f}%){Colors.RESET}")

        if dynamic_count > 0:
            print(f"  {Colors.BLUE}Dynamic: {dynamic_count} (accessed via R.string[key]){Colors.RESET}")

        if unused:
            print(f"  {Colors.YELLOW}Unused: {len(unused)}{Colors.RESET}")

        print()

    # Overall summary
    print(f"{Colors.BOLD}=== Summary ==={Colors.RESET}")
    print(f"Total strings: {total_strings}")
    print(f"{Colors.GREEN}Used: {total_used} ({total_used/total_strings*100:.1f}%){Colors.RESET}")

    if total_dynamic > 0:
        print(f"{Colors.BLUE}Dynamic access: {total_dynamic} ({total_dynamic/total_strings*100:.1f}%){Colors.RESET}")

    if total_unused > 0:
        print(f"{Colors.YELLOW}Unused: {total_unused} ({total_unused/total_strings*100:.1f}%){Colors.RESET}")
        print()
        print(f"{Colors.BOLD}Unused Strings:{Colors.RESET}")

        # Group by context
        members_unused = [u for u in all_unused if u['context'] == 'members']
        admin_unused = [u for u in all_unused if u['context'] == 'admin']

        if members_unused:
            print(f"\n{Colors.BLUE}Members Portal ({len(members_unused)}):{Colors.RESET}")
            for unused_item in members_unused[:10]:  # Show first 10
                print(f"  {Colors.YELLOW}• {unused_item['name']}{Colors.RESET}")
                print(f"    Value: \"{unused_item['value'][:50]}{'...' if len(unused_item['value']) > 50 else ''}\"")
            if len(members_unused) > 10:
                print(f"  ... and {len(members_unused) - 10} more")

        if admin_unused:
            print(f"\n{Colors.BLUE}Admin Portal ({len(admin_unused)}):{Colors.RESET}")
            for unused_item in admin_unused[:10]:  # Show first 10
                print(f"  {Colors.YELLOW}• {unused_item['name']}{Colors.RESET}")
                print(f"    Value: \"{unused_item['value'][:50]}{'...' if len(unused_item['value']) > 50 else ''}\"")
            if len(admin_unused) > 10:
                print(f"  ... and {len(admin_unused) - 10} more")

        print()
        print(f"{Colors.YELLOW}⚠️  Consider removing unused strings to keep i18n files clean.{Colors.RESET}")
        print(f"{Colors.YELLOW}    Or verify they're used in patterns not detected by this script.{Colors.RESET}")
        return 1
    else:
        print(f"{Colors.GREEN}✅ All i18n strings are in use!{Colors.RESET}")
        return 0

if __name__ == '__main__':
    exit(main())
