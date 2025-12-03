#!/usr/bin/env python3
"""
Find Hardcoded Text in HTML Files

Scans HTML files for text that should be externalized to i18n XML files.
Detects Icelandic text, English text, and potential untranslated strings.

Usage:
    python3 scripts/utils/find-hardcoded-text.py [--fix] [--verbose]
    python3 scripts/utils/find-hardcoded-text.py --staged  # Only check staged files

Options:
    --fix       Generate suggested XML entries for missing strings
    --verbose   Show all matches, not just summary
    --html-only Only scan HTML files (skip JS)
    --staged    Only check staged files (for pre-commit hook)
"""

import os
import re
import sys
import subprocess
from pathlib import Path
from collections import defaultdict
from typing import List, Dict, Tuple, Set

# ANSI colors
class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'

# Icelandic characters for detection
ICELANDIC_CHARS = 'áéíóúýþæöðÁÉÍÓÚÝÞÆÖÐ'

# Common Icelandic words that indicate hardcoded text
ICELANDIC_WORDS = [
    'Staða', 'Uppfæra', 'Vista', 'Eyða', 'Breyta', 'Bæta', 'Skoða',
    'Loka', 'Opna', 'Leita', 'Hætta', 'Halda', 'Velja', 'Senda',
    'Villa', 'Aðgerð', 'Nafn', 'Netfang', 'Símanúmer', 'Heimilisfang',
    'Þjónusta', 'Kerfi', 'Notandi', 'Stjórnandi', 'Félagi',
    'Innskráning', 'Útskráning', 'Stillingar', 'Upplýsingar',
    'Kosning', 'Atkvæði', 'Fundur', 'Tillaga', 'Umsókn',
    'Hleð', 'Bíð', 'Augnablik', 'Vinnsla',
]

# English words that might indicate untranslated text
ENGLISH_WORDS = [
    'Loading', 'Error', 'Success', 'Warning', 'Info',
    'Save', 'Delete', 'Edit', 'Add', 'Remove', 'Cancel',
    'Submit', 'Close', 'Open', 'Search', 'Filter',
    'Status', 'Active', 'Inactive', 'Pending', 'Health',
    'Service', 'System', 'User', 'Admin', 'Member',
]

# Patterns to ignore (not actual hardcoded text)
IGNORE_PATTERNS = [
    r'^\s*$',                    # Empty or whitespace
    r'^[0-9\s\-\.\,\:\/]+$',    # Numbers, dates, times
    r'^[A-Z_]+$',               # ALL_CAPS (likely constants)
    r'^\{\{.*\}\}$',            # Template expressions
    r'^%[sd]$',                  # Format placeholders
    r'^https?://',               # URLs
    r'^[a-z_]+$',               # snake_case (likely keys)
    r'^<!--.*-->$',              # HTML comments
    r'^\s*<',                    # Starts with HTML tag
]

# Files/directories to skip
SKIP_DIRS = ['node_modules', '.firebase', 'archive', 'i18n', '.git']
SKIP_FILES = ['strings-loader.js', 'bundle.css']


def contains_icelandic(text: str) -> bool:
    """Check if text contains Icelandic characters."""
    return any(c in text for c in ICELANDIC_CHARS)


def is_icelandic_word(text: str) -> bool:
    """Check if text contains known Icelandic words."""
    text_lower = text.lower()
    return any(word.lower() in text_lower for word in ICELANDIC_WORDS)


def is_english_word(text: str) -> bool:
    """Check if text contains common English words."""
    # Only flag if it looks like actual content, not code
    words = text.split()
    if len(words) < 1:
        return False
    return any(word in ENGLISH_WORDS for word in words)


def should_ignore(text: str) -> bool:
    """Check if text should be ignored (not hardcoded content)."""
    text = text.strip()
    for pattern in IGNORE_PATTERNS:
        if re.match(pattern, text, re.IGNORECASE):
            return True
    return False


def extract_html_text(content: str) -> List[Tuple[int, str, str]]:
    """
    Extract text content from HTML.
    Returns: [(line_number, text, context)]
    """
    results = []
    lines = content.split('\n')
    
    for line_num, line in enumerate(lines, 1):
        # Skip script and style tags content
        if re.search(r'<(script|style)', line, re.IGNORECASE):
            continue
            
        # Find text between tags: >text<
        for match in re.finditer(r'>([^<]+)<', line):
            text = match.group(1).strip()
            if text and not should_ignore(text):
                # Get surrounding context
                start = max(0, match.start() - 20)
                end = min(len(line), match.end() + 20)
                context = line[start:end].strip()
                results.append((line_num, text, context))
        
        # Find text in value attributes: value="text"
        for match in re.finditer(r'(?:value|placeholder|title|alt)=["\']([^"\']+)["\']', line, re.IGNORECASE):
            text = match.group(1).strip()
            if text and not should_ignore(text):
                results.append((line_num, text, match.group(0)))
    
    return results


def extract_js_strings(content: str) -> List[Tuple[int, str, str]]:
    """
    Extract hardcoded strings from JavaScript.
    Returns: [(line_number, text, context)]
    """
    results = []
    lines = content.split('\n')
    
    for line_num, line in enumerate(lines, 1):
        # Skip comments
        if line.strip().startswith('//') or line.strip().startswith('*'):
            continue
            
        # Find string literals in assignments: .textContent = "text"
        for match in re.finditer(r'(?:textContent|innerText|innerHTML)\s*=\s*["\']([^"\']+)["\']', line):
            text = match.group(1).strip()
            if text and not should_ignore(text):
                results.append((line_num, text, match.group(0)))
        
        # Find template literals with hardcoded text
        for match in re.finditer(r'`[^`]*>([A-ZÁÉÍÓÚÝÞÆÖÐ][^<`]{2,})<[^`]*`', line):
            text = match.group(1).strip()
            if text and not should_ignore(text):
                results.append((line_num, text, f'Template: ...{text[:30]}...'))
    
    return results


def categorize_text(text: str) -> str:
    """Categorize text as Icelandic, English, or unknown."""
    if contains_icelandic(text) or is_icelandic_word(text):
        return 'icelandic'
    elif is_english_word(text):
        return 'english'
    else:
        return 'unknown'


def suggest_key_name(text: str) -> str:
    """Suggest an i18n key name for given text."""
    # Remove special characters and convert to snake_case
    text = text.lower()
    text = re.sub(r'[áàâä]', 'a', text)
    text = re.sub(r'[éèêë]', 'e', text)
    text = re.sub(r'[íìîï]', 'i', text)
    text = re.sub(r'[óòôö]', 'o', text)
    text = re.sub(r'[úùûü]', 'u', text)
    text = re.sub(r'[ýÿ]', 'y', text)
    text = re.sub(r'[þ]', 'th', text)
    text = re.sub(r'[æ]', 'ae', text)
    text = re.sub(r'[ð]', 'd', text)
    text = re.sub(r'[^a-z0-9\s]', '', text)
    text = re.sub(r'\s+', '_', text.strip())
    
    # Truncate if too long
    if len(text) > 40:
        text = text[:40]
    
    return text or 'unknown_string'


def get_staged_files() -> List[str]:
    """Get list of staged files from git."""
    try:
        result = subprocess.run(
            ['git', 'diff', '--cached', '--name-only', '--diff-filter=ACM'],
            capture_output=True,
            text=True,
            check=True
        )
        return [f.strip() for f in result.stdout.strip().split('\n') if f.strip()]
    except subprocess.CalledProcessError:
        return []


def scan_directory(base_path: Path, verbose: bool = False, staged_only: bool = False) -> Dict:
    """Scan all HTML and JS files for hardcoded text."""
    results = {
        'html': defaultdict(list),
        'js': defaultdict(list),
        'by_category': defaultdict(list),
    }
    
    portal_path = base_path / 'apps' / 'members-portal'
    
    if staged_only:
        # Only scan staged files
        staged_files = get_staged_files()
        files_to_scan = []
        for f in staged_files:
            full_path = base_path / f
            if full_path.exists() and 'apps/members-portal' in f:
                if f.endswith('.html') or f.endswith('.js'):
                    try:
                        rel_path = Path(f).relative_to('apps/members-portal')
                    except ValueError:
                        rel_path = Path(f)
                    files_to_scan.append((full_path, rel_path))
    else:
        # Scan all files
        files_to_scan = []
        for root_dir, dirs, files in os.walk(portal_path):
            # Skip unwanted directories
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            
            for file in files:
                if file in SKIP_FILES:
                    continue
                if file.endswith('.html') or file.endswith('.js'):
                    file_path = Path(root_dir) / file
                    rel_path = file_path.relative_to(portal_path)
                    files_to_scan.append((file_path, rel_path))
    
    for file_path, rel_path in files_to_scan:
        try:
            content = file_path.read_text(encoding='utf-8')
        except Exception:
            continue
        
        file_str = str(file_path)
        
        if file_str.endswith('.html'):
            texts = extract_html_text(content)
            for line_num, text, context in texts:
                category = categorize_text(text)
                if category in ['icelandic', 'english']:
                    results['html'][str(rel_path)].append({
                        'line': line_num,
                        'text': text,
                        'context': context,
                        'category': category,
                        'suggested_key': suggest_key_name(text),
                    })
                    results['by_category'][category].append({
                        'file': str(rel_path),
                        'text': text,
                    })
        
        elif file_str.endswith('.js'):
            texts = extract_js_strings(content)
            for line_num, text, context in texts:
                category = categorize_text(text)
                if category in ['icelandic', 'english']:
                    results['js'][str(rel_path)].append({
                        'line': line_num,
                        'text': text,
                        'context': context,
                        'category': category,
                        'suggested_key': suggest_key_name(text),
                    })
                    results['by_category'][category].append({
                        'file': str(rel_path),
                        'text': text,
                    })
    
    return results


def print_report(results: Dict, verbose: bool = False):
    """Print analysis report."""
    print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}  🔍 Hardcoded Text Analysis Report{Colors.END}")
    print(f"{Colors.BOLD}{'='*60}{Colors.END}\n")
    
    # Summary
    html_count = sum(len(v) for v in results['html'].values())
    js_count = sum(len(v) for v in results['js'].values())
    icelandic_count = len(results['by_category']['icelandic'])
    english_count = len(results['by_category']['english'])
    
    print(f"{Colors.CYAN}Summary:{Colors.END}")
    print(f"  HTML files with hardcoded text: {len(results['html'])}")
    print(f"  JS files with hardcoded text:   {len(results['js'])}")
    print(f"  Total hardcoded strings:        {html_count + js_count}")
    print(f"    • Icelandic: {icelandic_count}")
    print(f"    • English:   {english_count}")
    
    if html_count + js_count == 0:
        print(f"\n{Colors.GREEN}✅ No hardcoded text found!{Colors.END}\n")
        return
    
    # HTML details
    if results['html']:
        print(f"\n{Colors.YELLOW}{'='*60}{Colors.END}")
        print(f"{Colors.YELLOW}📄 HTML Files with Hardcoded Text{Colors.END}")
        print(f"{Colors.YELLOW}{'='*60}{Colors.END}")
        
        for file_path, items in sorted(results['html'].items()):
            print(f"\n{Colors.BOLD}{file_path}{Colors.END} ({len(items)} strings)")
            
            if verbose:
                for item in items:
                    category_color = Colors.BLUE if item['category'] == 'icelandic' else Colors.CYAN
                    print(f"  Line {item['line']}: {category_color}{item['text'][:50]}{Colors.END}")
                    print(f"    Suggested key: {item['suggested_key']}")
            else:
                # Show first 3
                for item in items[:3]:
                    category_color = Colors.BLUE if item['category'] == 'icelandic' else Colors.CYAN
                    print(f"  • {category_color}{item['text'][:40]}{Colors.END}")
                if len(items) > 3:
                    print(f"  ... and {len(items) - 3} more")
    
    # JS details
    if results['js']:
        print(f"\n{Colors.YELLOW}{'='*60}{Colors.END}")
        print(f"{Colors.YELLOW}📜 JavaScript Files with Hardcoded Text{Colors.END}")
        print(f"{Colors.YELLOW}{'='*60}{Colors.END}")
        
        for file_path, items in sorted(results['js'].items()):
            print(f"\n{Colors.BOLD}{file_path}{Colors.END} ({len(items)} strings)")
            
            if verbose:
                for item in items:
                    category_color = Colors.BLUE if item['category'] == 'icelandic' else Colors.CYAN
                    print(f"  Line {item['line']}: {category_color}{item['text'][:50]}{Colors.END}")
            else:
                for item in items[:3]:
                    category_color = Colors.BLUE if item['category'] == 'icelandic' else Colors.CYAN
                    print(f"  • {category_color}{item['text'][:40]}{Colors.END}")
                if len(items) > 3:
                    print(f"  ... and {len(items) - 3} more")
    
    # Recommendations
    print(f"\n{Colors.BOLD}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}  💡 Recommendations{Colors.END}")
    print(f"{Colors.BOLD}{'='*60}{Colors.END}")
    print("""
  1. Move hardcoded strings to appropriate XML files:
     • superuser/* → superuser-portal-strings.xml
     • admin/* → admin-portal-strings.xml
     • admin-elections/* → admin-elections-strings.xml
     
  2. Use data-i18n attribute for static HTML text:
     <h1 data-i18n="page_title_system_health"></h1>
     
  3. Use R.string.key for dynamic JavaScript text:
     element.textContent = R.string.btn_refresh;
     
  4. Run with --verbose for full details
  5. Run with --fix to generate XML suggestions
""")


def generate_xml_suggestions(results: Dict):
    """Generate suggested XML entries for missing strings."""
    print(f"\n{Colors.BOLD}📝 Suggested XML Entries{Colors.END}\n")
    
    # Group by suggested target XML file
    by_target = defaultdict(list)
    
    for file_path, items in results['html'].items():
        # Determine target XML based on file path
        if 'superuser/' in file_path:
            target = 'superuser-portal-strings.xml'
        elif 'admin-elections/' in file_path:
            target = 'admin-elections-strings.xml'
        elif 'admin/' in file_path:
            target = 'admin-portal-strings.xml'
        elif 'elections/' in file_path:
            target = 'member-elections-strings.xml'
        elif 'policy-session/' in file_path:
            target = 'policy-session-strings.xml'
        else:
            target = 'portal-strings.xml'
        
        for item in items:
            by_target[target].append(item)
    
    for target, items in sorted(by_target.items()):
        print(f"{Colors.CYAN}<!-- Add to {target} -->{Colors.END}")
        seen_keys = set()
        for item in items:
            key = item['suggested_key']
            if key not in seen_keys:
                seen_keys.add(key)
                print(f'    <string name="{key}">{item["text"]}</string>')
        print()


def main():
    verbose = '--verbose' in sys.argv or '-v' in sys.argv
    fix = '--fix' in sys.argv
    staged_only = '--staged' in sys.argv or '-s' in sys.argv
    
    # Find project root
    script_path = Path(__file__).resolve()
    base_path = script_path.parent.parent.parent
    
    if not (base_path / 'apps' / 'members-portal').exists():
        print(f"{Colors.RED}Error: Could not find apps/members-portal{Colors.END}")
        sys.exit(1)
    
    if staged_only:
        print(f"{Colors.BOLD}🔍 Scanning staged files for hardcoded text...{Colors.END}")
    else:
        print(f"{Colors.BOLD}🔍 Scanning all files for hardcoded text...{Colors.END}")
    
    results = scan_directory(base_path, verbose, staged_only)
    print_report(results, verbose)
    
    if fix:
        generate_xml_suggestions(results)
    
    # Exit with error if hardcoded text found
    total = sum(len(v) for v in results['html'].values()) + sum(len(v) for v in results['js'].values())
    if total > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == '__main__':
    main()
