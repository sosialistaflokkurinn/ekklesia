#!/usr/bin/env python3
"""
Comprehensive i18n String Analysis Tool

Finds all i18n strings - both defined and used - across the codebase.
Detects multiple usage patterns:
- R.string.key_name (JavaScript)
- data-i18n="key_name" (HTML attributes)
- Potential untranslated strings (snake_case text in HTML/JS)

Usage:
    python3 scripts/utils/analyze-i18n.py [--verbose] [--fix]
"""

import xml.etree.ElementTree as ET
import os
import re
import sys
from pathlib import Path
from collections import defaultdict
from typing import Dict, Set, List, Tuple

# ANSI colors
class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'

# XML files mapping - which XML file serves which code area
XML_FILE_MAPPING = {
    'portal-strings.xml': {
        'path': 'apps/members-portal/i18n/values-is/portal-strings.xml',
        'serves': ['js/', 'members-area/', 'index.html', 'events/'],
        'description': 'Main portal strings'
    },
    'admin-portal-strings.xml': {
        'path': 'apps/members-portal/admin/i18n/values-is/admin-portal-strings.xml',
        'serves': ['admin/'],
        'description': 'Admin portal strings'
    },
    'admin-elections-strings.xml': {
        'path': 'apps/members-portal/admin-elections/i18n/values-is/admin-elections-strings.xml',
        'serves': ['admin-elections/'],
        'description': 'Admin elections strings'
    },
    'member-elections-strings.xml': {
        'path': 'apps/members-portal/elections/i18n/values-is/member-elections-strings.xml',
        'serves': ['elections/'],
        'description': 'Member elections strings'
    },
    'policy-session-strings.xml': {
        'path': 'apps/members-portal/policy-session/i18n/values-is/policy-session-strings.xml',
        'serves': ['policy-session/'],
        'description': 'Policy session strings'
    },
    'superuser-portal-strings.xml': {
        'path': 'apps/members-portal/superuser/i18n/values-is/superuser-portal-strings.xml',
        'serves': ['superuser/'],
        'description': 'Superuser portal strings'
    },
}

def get_defined_strings(base_path: Path) -> Dict[str, Tuple[str, str]]:
    """Get all defined strings from all XML files.
    Returns: dict of key -> (xml_file, value)
    """
    defined = {}
    for xml_name, config in XML_FILE_MAPPING.items():
        xml_path = base_path / config['path']
        if xml_path.exists():
            try:
                tree = ET.parse(xml_path)
                root = tree.getroot()
                for string_elem in root.findall('.//string'):
                    name = string_elem.get('name')
                    value = string_elem.text or ''
                    if name:
                        defined[name] = (xml_name, value)
            except ET.ParseError as e:
                print(f"{Colors.RED}Error parsing {xml_path}: {e}{Colors.END}")
    return defined


def find_string_usages(base_path: Path) -> Dict[str, List[Dict]]:
    """Find all string usages in code.
    Returns: dict of key -> [{'file': str, 'line': int, 'pattern': str, 'type': str}]
    """
    usages = defaultdict(list)
    code_base = base_path / 'apps' / 'members-portal'
    
    # Patterns to search for
    patterns = [
        # R.string.key_name - standard JS usage
        (r'R\.string\.(\w+)', 'R.string', 'js'),
        # data-i18n="key" - HTML attribute
        (r'data-i18n=["\']([^"\']+)["\']', 'data-i18n', 'html'),
        # getText('key') or t('key') - function calls
        (r'(?:getText|t)\(["\']([^"\']+)["\']\)', 'getText/t()', 'js'),
        # Potential untranslated: snake_case as text content in HTML
        # Matches >snake_case_text< patterns
        (r'>([a-z][a-z0-9]*(?:_[a-z0-9]+)+)<', 'raw_text', 'html'),
        # innerText/textContent = 'snake_case'
        (r'(?:innerText|textContent)\s*=\s*["\']([a-z][a-z0-9]*(?:_[a-z0-9]+)+)["\']', 'innerText', 'js'),
        # Template literal with snake_case ${...}snake_case or snake_case</
        (r'`[^`]*>([a-z][a-z0-9]*(?:_[a-z0-9]+)+)<', 'template_raw', 'js'),
    ]
    
    for root_dir, dirs, files in os.walk(code_base):
        # Skip directories
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.firebase', 'archive']]
        
        for file in files:
            if not file.endswith(('.js', '.html')):
                continue
                
            file_path = Path(root_dir) / file
            rel_path = file_path.relative_to(code_base)
            file_type = 'js' if file.endswith('.js') else 'html'
            
            try:
                content = file_path.read_text(encoding='utf-8')
                lines = content.split('\n')
                
                for pattern, pattern_name, expected_type in patterns:
                    for match in re.finditer(pattern, content):
                        key = match.group(1)
                        # Find line number
                        pos = match.start()
                        line_num = content[:pos].count('\n') + 1
                        
                        usages[key].append({
                            'file': str(rel_path),
                            'line': line_num,
                            'pattern': pattern_name,
                            'type': file_type,
                        })
            except Exception as e:
                print(f"{Colors.YELLOW}Warning: Could not read {file_path}: {e}{Colors.END}")
    
    return usages


def determine_target_xml(file_path: str) -> str:
    """Determine which XML file should contain strings for a given file."""
    for xml_name, config in XML_FILE_MAPPING.items():
        for prefix in config['serves']:
            if file_path.startswith(prefix):
                return xml_name
    return 'portal-strings.xml'  # Default


def analyze_and_report(base_path: Path, verbose: bool = False):
    """Main analysis and reporting."""
    print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}  📊 i18n String Analysis Report{Colors.END}")
    print(f"{Colors.BOLD}{'='*60}{Colors.END}\n")
    
    # Get defined strings
    defined = get_defined_strings(base_path)
    print(f"📚 {Colors.CYAN}Defined strings:{Colors.END} {len(defined)}")
    
    # Count per XML file
    xml_counts = defaultdict(int)
    for key, (xml_file, _) in defined.items():
        xml_counts[xml_file] += 1
    for xml_name, count in sorted(xml_counts.items()):
        print(f"   • {xml_name}: {count}")
    
    # Get usages
    usages = find_string_usages(base_path)
    print(f"\n🔍 {Colors.CYAN}Used string keys:{Colors.END} {len(usages)}")
    
    # Count by pattern type
    pattern_counts = defaultdict(int)
    for key, usage_list in usages.items():
        for usage in usage_list:
            pattern_counts[usage['pattern']] += 1
    print(f"   Pattern breakdown:")
    for pattern, count in sorted(pattern_counts.items(), key=lambda x: -x[1]):
        print(f"   • {pattern}: {count} occurrences")
    
    # Find MISSING strings (used but not defined)
    missing_keys = set(usages.keys()) - set(defined.keys())
    
    # Filter out false positives (things that look like keys but aren't)
    false_positive_prefixes = ['http', 'www', 'data_', 'aria_']
    missing_keys = {k for k in missing_keys 
                    if not any(k.startswith(p) for p in false_positive_prefixes)
                    and len(k) > 3}  # Skip very short keys
    
    if missing_keys:
        print(f"\n{Colors.RED}{'='*60}{Colors.END}")
        print(f"{Colors.RED}⚠️  MISSING STRINGS: {len(missing_keys)} keys used but not defined{Colors.END}")
        print(f"{Colors.RED}{'='*60}{Colors.END}\n")
        
        # Group by target XML file
        by_target = defaultdict(list)
        for key in missing_keys:
            usage_list = usages[key]
            # Determine target based on first usage
            target = determine_target_xml(usage_list[0]['file'])
            by_target[target].append((key, usage_list))
        
        for xml_name in sorted(by_target.keys()):
            items = by_target[xml_name]
            config = XML_FILE_MAPPING.get(xml_name, {})
            print(f"\n{Colors.YELLOW}📄 {xml_name}{Colors.END} ({config.get('description', '')})")
            print(f"   {Colors.CYAN}Add to: {config.get('path', 'unknown')}{Colors.END}")
            print()
            
            for key, usage_list in sorted(items):
                # Group usages by file type
                js_files = [u for u in usage_list if u['type'] == 'js']
                html_files = [u for u in usage_list if u['type'] == 'html']
                
                print(f"   {Colors.BOLD}{key}{Colors.END}")
                
                # Show JS usages
                if js_files:
                    unique_js = list(set(u['file'] for u in js_files))[:2]
                    patterns = list(set(u['pattern'] for u in js_files))
                    print(f"      {Colors.BLUE}JS ({', '.join(patterns)}):{Colors.END}")
                    for f in unique_js:
                        print(f"         → {f}")
                
                # Show HTML usages
                if html_files:
                    unique_html = list(set(u['file'] for u in html_files))[:2]
                    patterns = list(set(u['pattern'] for u in html_files))
                    print(f"      {Colors.GREEN}HTML ({', '.join(patterns)}):{Colors.END}")
                    for f in unique_html:
                        print(f"         → {f}")
    else:
        print(f"\n{Colors.GREEN}✅ All used strings are defined!{Colors.END}")
    
    # Find UNUSED strings
    unused_keys = set(defined.keys()) - set(usages.keys())
    if unused_keys and verbose:
        print(f"\n{Colors.YELLOW}{'='*60}{Colors.END}")
        print(f"{Colors.YELLOW}📋 UNUSED STRINGS: {len(unused_keys)} defined but not found in code{Colors.END}")
        print(f"{Colors.YELLOW}{'='*60}{Colors.END}")
        print(f"   (These might be used dynamically or can be cleaned up)")
        
        by_xml = defaultdict(list)
        for key in unused_keys:
            xml_file, _ = defined[key]
            by_xml[xml_file].append(key)
        
        for xml_name in sorted(by_xml.keys()):
            keys = by_xml[xml_name]
            print(f"\n   {xml_name}: {len(keys)} unused")
            if verbose:
                for key in sorted(keys)[:10]:
                    print(f"      • {key}")
                if len(keys) > 10:
                    print(f"      ... and {len(keys) - 10} more")
    elif unused_keys:
        print(f"\n{Colors.YELLOW}📋 {len(unused_keys)} unused strings (use --verbose to see details){Colors.END}")
    
    # Summary
    print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}  Summary{Colors.END}")
    print(f"{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"   Defined: {len(defined)}")
    print(f"   Used:    {len(usages)}")
    print(f"   {Colors.RED}Missing: {len(missing_keys)}{Colors.END}")
    print(f"   {Colors.YELLOW}Unused:  {len(unused_keys)}{Colors.END}")
    print()
    
    return missing_keys, unused_keys


def main():
    verbose = '--verbose' in sys.argv or '-v' in sys.argv
    
    # Find project root
    script_path = Path(__file__).resolve()
    base_path = script_path.parent.parent.parent  # scripts/utils -> scripts -> project root
    
    if not (base_path / 'apps' / 'members-portal').exists():
        print(f"{Colors.RED}Error: Could not find apps/members-portal directory{Colors.END}")
        print(f"Looking in: {base_path}")
        sys.exit(1)
    
    missing, unused = analyze_and_report(base_path, verbose)
    
    # Exit with error if missing strings
    if missing:
        sys.exit(1)
    sys.exit(0)


if __name__ == '__main__':
    main()
