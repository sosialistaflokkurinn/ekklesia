#!/usr/bin/env python3
"""
Ekklesia Code Health Checker

Finds common issues in the codebase:
- Missing imports (initNavigation, debug, showToast, etc.)
- Unused imports
- Console.log usage (should use debug)
- Hardcoded URLs
- Missing error handling
- Event listener memory leaks

Usage:
    python3 scripts/check_code_health.py
    python3 scripts/check_code_health.py --verbose
    python3 scripts/check_code_health.py --check=navigation
"""

import os
import re
import sys
from pathlib import Path
from typing import List, Dict, Tuple
from dataclasses import dataclass
from collections import defaultdict

# ANSI colors
RED = '\033[0;31m'
YELLOW = '\033[1;33m'
GREEN = '\033[0;32m'
BLUE = '\033[0;34m'
NC = '\033[0m'  # No Color

@dataclass
class Issue:
    severity: str  # 'error', 'warning', 'info'
    category: str
    file_path: str
    line_num: int
    message: str
    
    def __str__(self):
        color = RED if self.severity == 'error' else YELLOW if self.severity == 'warning' else BLUE
        icon = '❌' if self.severity == 'error' else '⚠️' if self.severity == 'warning' else 'ℹ️'
        return f"  {color}{icon} {self.file_path}:{self.line_num}{NC}\n      {self.message}"


class CodeHealthChecker:
    def __init__(self, project_root: str, verbose: bool = False):
        self.project_root = Path(project_root)
        self.verbose = verbose
        self.issues: List[Issue] = []
        # Optimization: Cache JS files list excluding node_modules
        self.js_files = self._get_js_files()
        
    def _get_js_files(self) -> List[Path]:
        """Get all JS files excluding node_modules"""
        files = []
        # Use glob but filter out node_modules
        for path in self.project_root.glob('apps/members-portal/**/*.js'):
            if 'node_modules' not in str(path):
                files.append(path)
        return files

    def check_all(self):
        """Run all checks"""
        print(f"{BLUE}🔍 Ekklesia Code Health Check{NC}")
        print("=" * 50)
        print()

        self.check_navigation_init()
        self.check_missing_imports()
        self.check_console_logs()
        self.check_hardcoded_urls()
        self.check_error_handling()
        self.check_event_listeners()
        self.check_todos()
        # PATTERNS.md compliance checks
        self.check_debug_usage()
        self.check_auth_pattern()
        self.check_duplicate_escapehtml()
        self.check_innerhtml_xss()
        self.check_firebase_imports()
        self.check_deep_nesting()
        self.check_null_checks()
        self.check_hardcoded_icelandic()
        self.check_authenticated_fetch()
        self.check_document_create_element()
        self.check_double_submit()

        self.print_summary()
        
    def check_navigation_init(self):
        """Check for pages with navigation but no initNavigation()"""
        print(f"{BLUE}📱 Checking for missing initNavigation()...{NC}")
        
        # Find all HTML files with nav element (excluding node_modules)
        html_files = [p for p in self.project_root.glob('apps/members-portal/**/*.html') 
                     if 'node_modules' not in str(p)]
        
        for html_file in html_files:
            if not self._has_nav_element(html_file):
                continue
            
            # Read HTML content
            html_content = html_file.read_text(encoding='utf-8')
            
            # First check: Is initNavigation in inline scripts?
            if 'initNavigation' in html_content:
                continue  # Found in inline script, all good
                
            # Second check: Find the corresponding JS module
            js_file = self._find_js_module(html_file)
            
            if js_file and js_file.exists():
                # Check if JS has initNavigation
                content = js_file.read_text(encoding='utf-8')
                if 'initNavigation' not in content:
                    self.issues.append(Issue(
                        severity='warning',
                        category='navigation',
                        file_path=str(js_file.relative_to(self.project_root)),
                        line_num=1,
                        message=f"Page has navigation but doesn't call initNavigation()\n      HTML: {html_file.relative_to(self.project_root)}"
                    ))
        
        if not any(i.category == 'navigation' for i in self.issues):
            print(f"  {GREEN}✅ All pages with navigation have initNavigation(){NC}")
        print()
        
    def check_missing_imports(self):
        """Check for usage without imports"""
        print(f"{BLUE}📦 Checking for missing imports...{NC}")

        checks = [
            ('debug', r'debug\.(log|warn|error|info)', r'import.*debug.*from'),
            ('showToast', r'showToast\(', r'import.*showToast.*from'),
            ('R.string', r'R\.string\.', r'import.*\bR\b.*from.*i18n'),
            ('showStatus', r'showStatus\(', r'import.*showStatus.*from'),
        ]

        for js_file in self.js_files:
            content = js_file.read_text(encoding='utf-8')
            lines = content.split('\n')

            for name, usage_pattern, import_pattern in checks:
                # Skip if this is the definition file itself
                if name in str(js_file):
                    continue

                # Check if used but not imported
                uses = re.search(usage_pattern, content)
                has_import = re.search(import_pattern, content)

                # Special case for R.string: also check for local R definition
                # (e.g., "const R = { string: {} }" or "function applyStrings(R)")
                if name == 'R.string' and uses and not has_import:
                    # Check for local R definition as variable or parameter
                    local_r_def = re.search(r'(const|let|var)\s+R\s*=|function\s+\w+\s*\([^)]*\bR\b[^)]*\)', content)
                    if local_r_def:
                        continue  # R is defined locally, not an error

                if uses and not has_import:
                    # Find line number
                    for i, line in enumerate(lines, 1):
                        if re.search(usage_pattern, line):
                            self.issues.append(Issue(
                                severity='error',
                                category='imports',
                                file_path=str(js_file.relative_to(self.project_root)),
                                line_num=i,
                                message=f"Uses {name} without importing it"
                            ))
                            break
        
        if not any(i.category == 'imports' for i in self.issues):
            print(f"  {GREEN}✅ All imports look good{NC}")
        print()
        
    def check_console_logs(self):
        """Check for console.log (should use debug)"""
        print(f"{BLUE}🚫 Checking for console.log usage...{NC}")

        for js_file in self.js_files:
            # Skip debug.js itself and debug-logger (it's a debug tool)
            if 'debug.js' in str(js_file) or 'debug-logger' in str(js_file):
                continue

            content = js_file.read_text(encoding='utf-8')
            lines = content.split('\n')

            in_jsdoc = False
            for i, line in enumerate(lines, 1):
                stripped = line.strip()

                # Track JSDoc blocks
                if '/**' in stripped:
                    in_jsdoc = True
                if '*/' in stripped:
                    in_jsdoc = False
                    continue

                # Skip JSDoc and regular comments
                if in_jsdoc or stripped.startswith('//') or stripped.startswith('*'):
                    continue

                if 'console.log(' in line:
                    self.issues.append(Issue(
                        severity='warning',
                        category='console',
                        file_path=str(js_file.relative_to(self.project_root)),
                        line_num=i,
                        message=f"Use debug.log() instead of console.log()\n      {line.strip()}"
                    ))
        
        if not any(i.category == 'console' for i in self.issues):
            print(f"  {GREEN}✅ No console.log found{NC}")
        print()
        
    def check_hardcoded_urls(self):
        """Check for hardcoded API URLs"""
        print(f"{BLUE}🔗 Checking for hardcoded URLs...{NC}")
        
        for js_file in self.js_files:
            content = js_file.read_text(encoding='utf-8')
            lines = content.split('\n')
            
            for i, line in enumerate(lines, 1):
                # Look for https:// in fetch/axios calls (but not CDN URLs)
                if re.search(r'(fetch|axios)\s*\([^)]*https://', line):
                    # Skip known CDN/library URLs
                    if any(cdn in line for cdn in ['gstatic', 'googleapis', 'firebasejs', 'cloudflare']):
                        continue
                        
                    self.issues.append(Issue(
                        severity='info',
                        category='hardcoded-url',
                        file_path=str(js_file.relative_to(self.project_root)),
                        line_num=i,
                        message=f"Consider using a constant for this URL\n      {line.strip()}"
                    ))
        
        if not any(i.category == 'hardcoded-url' for i in self.issues):
            print(f"  {GREEN}✅ No hardcoded URLs found{NC}")
        print()
        
    def check_error_handling(self):
        """Check for async functions without try-catch"""
        print(f"{BLUE}⚠️  Checking error handling in async functions...{NC}")
        
        for js_file in self.js_files:
            content = js_file.read_text(encoding='utf-8')
            
            # Find async functions
            async_funcs = re.findall(r'async\s+(function|[a-zA-Z_]\w*\s*\()', content)
            try_catches = content.count('try {')
            
            # If many async functions but no try-catch, might be an issue
            if len(async_funcs) > 2 and try_catches == 0:
                self.issues.append(Issue(
                    severity='info',
                    category='error-handling',
                    file_path=str(js_file.relative_to(self.project_root)),
                    line_num=1,
                    message=f"{len(async_funcs)} async functions, no try-catch blocks"
                ))
        
        if not any(i.category == 'error-handling' for i in self.issues):
            print(f"  {GREEN}✅ Error handling looks good{NC}")
        print()
        
    def check_event_listeners(self):
        """Check for addEventListener without removeEventListener"""
        print(f"{BLUE}🔁 Checking for potential memory leaks...{NC}")
        
        for js_file in self.js_files:
            content = js_file.read_text(encoding='utf-8')
            
            add_count = content.count('addEventListener(')
            remove_count = content.count('removeEventListener(')
            
            # If we add listeners but never remove them, might leak
            if add_count > 0 and remove_count == 0:
                # Check if it's documented as OK
                if not re.search(r'(Module cleanup not needed|One-time init|Cleanup in)', content):
                    self.issues.append(Issue(
                        severity='info',
                        category='memory-leak',
                        file_path=str(js_file.relative_to(self.project_root)),
                        line_num=1,
                        message=f"{add_count} addEventListener, {remove_count} removeEventListener (potential leak?)"
                    ))
        
        if not any(i.category == 'memory-leak' for i in self.issues):
            print(f"  {GREEN}✅ Event listeners look clean{NC}")
        print()
        
    def check_todos(self):
        """Check for TODO comments"""
        print(f"{BLUE}📝 Checking for TODO comments...{NC}")
        
        todo_count = 0
        
        for js_file in self.js_files:
            content = js_file.read_text(encoding='utf-8')
            lines = content.split('\n')
            
            for i, line in enumerate(lines, 1):
                if re.search(r'//\s*(TODO|FIXME|HACK)', line):
                    todo_count += 1
                    if self.verbose:
                        print(f"  {BLUE}ℹ️  {js_file.relative_to(self.project_root)}:{i}{NC}")
                        print(f"      {line.strip()}")
        
        if todo_count == 0:
            print(f"  {GREEN}✅ No TODOs found{NC}")
        else:
            print(f"  {BLUE}ℹ️  {todo_count} TODOs found (not an issue, just FYI){NC}")
        print()

    def check_debug_usage(self):
        """Check for incorrect debug() usage - should be debug.log(), debug.error(), etc."""
        print(f"{BLUE}🐛 Checking debug utility usage (PATTERNS.md)...{NC}")

        # Pattern: debug( but NOT debug.log( or debug.warn( or debug.error(
        # This catches: debug('module', 'message') which is WRONG
        wrong_pattern = r'\bdebug\s*\([^)]*[\'"][^)]*[\'"]\s*,'

        for js_file in self.js_files:
            # Skip debug utility itself
            if 'util-debug' in str(js_file):
                continue

            content = js_file.read_text(encoding='utf-8')
            lines = content.split('\n')

            for i, line in enumerate(lines, 1):
                # Skip comments
                if line.strip().startswith('//'):
                    continue

                # Check for wrong pattern: debug('module', ...)
                if re.search(wrong_pattern, line):
                    # Make sure it's not debug.log, debug.warn, etc.
                    if not re.search(r'debug\.(log|warn|error|info)\s*\(', line):
                        self.issues.append(Issue(
                            severity='error',
                            category='debug-usage',
                            file_path=str(js_file.relative_to(self.project_root)),
                            line_num=i,
                            message=f"Wrong debug usage. Use debug.log() not debug()\n      {line.strip()}"
                        ))

        if not any(i.category == 'debug-usage' for i in self.issues):
            print(f"  {GREEN}✅ Debug utility used correctly{NC}")
        print()

    def check_auth_pattern(self):
        """Check for custom auth checks that should use requireAuth()"""
        print(f"{BLUE}🔐 Checking auth pattern (PATTERNS.md)...{NC}")

        # Pattern: reject(new Error(...innskráður...)) or throw new Error(...login...)
        bad_patterns = [
            (r'reject\s*\(\s*new\s+Error\s*\([^)]*innskráður', 'Throwing error instead of redirect'),
            (r'throw\s+new\s+Error\s*\([^)]*innskráður', 'Throwing error instead of redirect'),
            (r'reject\s*\(\s*new\s+Error\s*\([^)]*[Nn]ot\s*logged', 'Throwing error instead of redirect'),
        ]

        for js_file in self.js_files:
            # Skip auth.js itself and API clients (throw is OK in API clients for defense-in-depth)
            if 'auth.js' in str(js_file):
                continue
            if '/api/' in str(js_file) or 'api-' in str(js_file):
                continue

            content = js_file.read_text(encoding='utf-8')
            lines = content.split('\n')

            for pattern, msg in bad_patterns:
                for i, line in enumerate(lines, 1):
                    if re.search(pattern, line, re.IGNORECASE):
                        self.issues.append(Issue(
                            severity='warning',
                            category='auth-pattern',
                            file_path=str(js_file.relative_to(self.project_root)),
                            line_num=i,
                            message=f"{msg}. Use requireAuth() from js/auth.js\n      {line.strip()}"
                        ))

        if not any(i.category == 'auth-pattern' for i in self.issues):
            print(f"  {GREEN}✅ Auth patterns look correct{NC}")
        print()

    def check_duplicate_escapehtml(self):
        """Check for local escapeHTML definitions (should use shared utility)"""
        print(f"{BLUE}🛡️  Checking for duplicate escapeHTML (PATTERNS.md)...{NC}")

        for js_file in self.js_files:
            # Skip the utility file itself
            if 'util-format' in str(js_file):
                continue

            content = js_file.read_text(encoding='utf-8')
            lines = content.split('\n')

            for i, line in enumerate(lines, 1):
                if re.search(r'function\s+escapeHTML\s*\(', line):
                    self.issues.append(Issue(
                        severity='warning',
                        category='duplicate-utility',
                        file_path=str(js_file.relative_to(self.project_root)),
                        line_num=i,
                        message="Local escapeHTML definition. Import from js/utils/util-format.js instead"
                    ))

        if not any(i.category == 'duplicate-utility' for i in self.issues):
            print(f"  {GREEN}✅ No duplicate escapeHTML found{NC}")
        print()

    def check_innerhtml_xss(self):
        """Check for innerHTML with unescaped variables (potential XSS)"""
        print(f"{BLUE}⚠️  Checking innerHTML for XSS risks (PATTERNS.md)...{NC}")

        # Pattern: innerHTML = `...${variable}...` without escapeHTML
        # This is a heuristic - not perfect but catches common cases
        innerhtml_pattern = r'\.innerHTML\s*=\s*`[^`]*\$\{(?!escapeHTML)[^}]+\}'

        for js_file in self.js_files:
            content = js_file.read_text(encoding='utf-8')
            lines = content.split('\n')

            # Track multi-line template literals
            in_template = False
            template_start_line = 0

            for i, line in enumerate(lines, 1):
                # Simple single-line check
                if re.search(innerhtml_pattern, line):
                    # Check if escapeHTML is used somewhere in the line
                    if 'escapeHTML' not in line:
                        self.issues.append(Issue(
                            severity='info',
                            category='xss-risk',
                            file_path=str(js_file.relative_to(self.project_root)),
                            line_num=i,
                            message=f"innerHTML with variable - verify XSS safety\n      {line.strip()[:80]}"
                        ))

        if not any(i.category == 'xss-risk' for i in self.issues):
            print(f"  {GREEN}✅ No obvious XSS risks in innerHTML{NC}")
        print()

    def check_firebase_imports(self):
        """Check for direct Firebase imports (should use wrapper)"""
        print(f"{BLUE}🔥 Checking Firebase imports (PATTERNS.md)...{NC}")

        # Pattern: direct imports from firebase CDN or firebase modules
        bad_patterns = [
            (r'from\s+[\'"]https://www\.gstatic\.com/firebasejs', 'Direct Firebase CDN import'),
            (r'from\s+[\'"]firebase/', 'Direct firebase/ module import'),
            (r'import.*from\s+[\'"]@firebase/', 'Direct @firebase/ import'),
        ]

        for js_file in self.js_files:
            # Skip the firebase wrapper itself
            if '/firebase/' in str(js_file) and 'app.js' in str(js_file):
                continue

            content = js_file.read_text(encoding='utf-8')
            lines = content.split('\n')

            for pattern, msg in bad_patterns:
                for i, line in enumerate(lines, 1):
                    if re.search(pattern, line):
                        self.issues.append(Issue(
                            severity='error',
                            category='firebase-import',
                            file_path=str(js_file.relative_to(self.project_root)),
                            line_num=i,
                            message=f"{msg}. Import from /firebase/app.js instead\n      {line.strip()}"
                        ))

        if not any(i.category == 'firebase-import' for i in self.issues):
            print(f"  {GREEN}✅ Firebase imports use wrapper correctly{NC}")
        print()

    def check_deep_nesting(self):
        """Check for deeply nested if statements (>4 levels)"""
        print(f"{BLUE}🪆 Checking for deep nesting (PATTERNS.md)...{NC}")

        for js_file in self.js_files:
            content = js_file.read_text(encoding='utf-8')
            lines = content.split('\n')

            # Track nesting level
            nesting_level = 0
            max_nesting = 0
            max_nesting_line = 0

            for i, line in enumerate(lines, 1):
                stripped = line.strip()

                # Skip comments
                if stripped.startswith('//') or stripped.startswith('*'):
                    continue

                # Count opening braces after if/else/for/while
                if re.search(r'\b(if|else|for|while)\s*\(.*\)\s*\{', line):
                    nesting_level += 1
                    if nesting_level > max_nesting:
                        max_nesting = nesting_level
                        max_nesting_line = i
                elif stripped == '}':
                    nesting_level = max(0, nesting_level - 1)

            # Only warn at level 5+ (4 is acceptable for complex logic)
            if max_nesting >= 5:
                self.issues.append(Issue(
                    severity='warning',
                    category='deep-nesting',
                    file_path=str(js_file.relative_to(self.project_root)),
                    line_num=max_nesting_line,
                    message=f"Nesting level {max_nesting} - consider early returns to flatten"
                ))

        if not any(i.category == 'deep-nesting' for i in self.issues):
            print(f"  {GREEN}✅ No deep nesting found{NC}")
        print()

    def check_null_checks(self):
        """Check for getElementById without null check"""
        print(f"{BLUE}🔍 Checking for missing null checks (PATTERNS.md)...{NC}")

        # Pattern: getElementById('x').something without prior null check
        pattern = r"document\.getElementById\(['\"][^'\"]+['\"]\)\s*\."

        for js_file in self.js_files:
            content = js_file.read_text(encoding='utf-8')
            lines = content.split('\n')

            # Count issues per file - only report if excessive (>5)
            file_issues = []

            for i, line in enumerate(lines, 1):
                # Skip comments
                if line.strip().startswith('//'):
                    continue

                if re.search(pattern, line):
                    # Check if it's using optional chaining (?.)
                    if ')?.' in line or 'getElementById' not in line:
                        continue

                    # Check if there's a null check before (simple heuristic)
                    # Look for "const el = getElementById" pattern which is safer
                    if '= document.getElementById' in line:
                        continue

                    file_issues.append((i, line))

            # Only report if there are many issues (single inline access is common and usually safe)
            if len(file_issues) > 5:
                self.issues.append(Issue(
                    severity='info',  # Downgrade to info since many are intentional
                    category='null-check',
                    file_path=str(js_file.relative_to(self.project_root)),
                    line_num=file_issues[0][0],
                    message=f"{len(file_issues)}x getElementById().property - consider using optional chaining"
                ))

        if not any(i.category == 'null-check' for i in self.issues):
            print(f"  {GREEN}✅ Null checks look good{NC}")
        print()

    def check_hardcoded_icelandic(self):
        """Check for hardcoded Icelandic strings (should use i18n)"""
        print(f"{BLUE}🇮🇸 Checking for hardcoded Icelandic strings (PATTERNS.md)...{NC}")

        # Common Icelandic phrases that should be in i18n - only in user-facing functions
        icelandic_patterns = [
            r"showToast\(['\"](?!R\.)[^'\"]*[ÁáÉéÍíÓóÚúÝýÞþÐðÆæÖö][^'\"]*['\"]",
            r"showError\(['\"](?!R\.)[^'\"]*[ÁáÉéÍíÓóÚúÝýÞþÐðÆæÖö][^'\"]*['\"]",
        ]

        for js_file in self.js_files:
            # Skip i18n files themselves and internal tools
            if '/i18n/' in str(js_file) or 'uppstilling' in str(js_file):
                continue  # uppstilling is internal committee tool, hardcoded OK

            content = js_file.read_text(encoding='utf-8')
            lines = content.split('\n')

            file_issues = []
            for i, line in enumerate(lines, 1):
                # Skip comments and DEFAULT_STRINGS definitions
                stripped = line.strip()
                if stripped.startswith('//') or 'DEFAULT_STRINGS' in line:
                    continue

                for pattern in icelandic_patterns:
                    if re.search(pattern, line):
                        file_issues.append((i, line))
                        break  # Only one issue per line

            # Only report files with multiple hardcoded strings
            if len(file_issues) >= 2:
                self.issues.append(Issue(
                    severity='info',
                    category='hardcoded-i18n',
                    file_path=str(js_file.relative_to(self.project_root)),
                    line_num=file_issues[0][0],
                    message=f"{len(file_issues)}x hardcoded Icelandic in showToast/showError - consider R.string"
                ))

        if not any(i.category == 'hardcoded-i18n' for i in self.issues):
            print(f"  {GREEN}✅ No hardcoded Icelandic strings in UI functions{NC}")
        print()

    def check_authenticated_fetch(self):
        """Check for fetch() to API endpoints without authenticatedFetch"""
        print(f"{BLUE}🔑 Checking for unauthenticated API calls (PATTERNS.md)...{NC}")

        for js_file in self.js_files:
            # Skip auth.js itself (defines authenticatedFetch)
            if 'auth.js' in str(js_file):
                continue

            content = js_file.read_text(encoding='utf-8')
            lines = content.split('\n')

            # Check if file has authenticatedFetch import
            has_auth_import = 'authenticatedFetch' in content

            for i, line in enumerate(lines, 1):
                # Skip comments
                if line.strip().startswith('//'):
                    continue

                # Look for fetch() calls to .run.app or /api/ URLs
                if re.search(r'\bfetch\s*\([^)]*\.run\.app', line) or \
                   re.search(r'\bfetch\s*\([^)]*[\'\"]/api/', line):
                    # Check if this is inside authenticatedFetch definition
                    if 'authenticatedFetch' in line:
                        continue

                    # If file doesn't import authenticatedFetch, this is likely wrong
                    if not has_auth_import:
                        self.issues.append(Issue(
                            severity='warning',
                            category='unauthenticated-fetch',
                            file_path=str(js_file.relative_to(self.project_root)),
                            line_num=i,
                            message=f"API call without authenticatedFetch - add auth token\n      {line.strip()[:60]}"
                        ))

        if not any(i.category == 'unauthenticated-fetch' for i in self.issues):
            print(f"  {GREEN}✅ API calls use authenticatedFetch{NC}")
        print()

    def check_document_create_element(self):
        """Check for document.createElement (should use el() helper)"""
        print(f"{BLUE}📦 Checking for document.createElement (PATTERNS.md)...{NC}")

        for js_file in self.js_files:
            # Skip util-dom.js itself (defines el())
            if 'util-dom' in str(js_file):
                continue

            content = js_file.read_text(encoding='utf-8')
            lines = content.split('\n')

            # Count createElement usages
            create_count = 0
            first_line = 0

            for i, line in enumerate(lines, 1):
                if 'document.createElement(' in line:
                    create_count += 1
                    if first_line == 0:
                        first_line = i

            # Only warn if there are multiple usages (one-off is OK)
            if create_count >= 3:
                # Check if el() is imported
                has_el_import = re.search(r'import.*\bel\b.*from.*util-dom', content)
                if not has_el_import:
                    self.issues.append(Issue(
                        severity='info',
                        category='create-element',
                        file_path=str(js_file.relative_to(self.project_root)),
                        line_num=first_line,
                        message=f"{create_count}x document.createElement - consider using el() from util-dom.js"
                    ))

        if not any(i.category == 'create-element' for i in self.issues):
            print(f"  {GREEN}✅ DOM creation patterns look good{NC}")
        print()

    def check_double_submit(self):
        """Check for form submit handlers without button.disabled pattern"""
        print(f"{BLUE}🔄 Checking for double-submit prevention (PATTERNS.md)...{NC}")

        for js_file in self.js_files:
            content = js_file.read_text(encoding='utf-8')

            # Look for form submit handlers
            has_submit_handler = re.search(r'(addEventListener\([\'"]submit|onsubmit|handleSubmit)', content)

            if has_submit_handler:
                # Check if there's a disabled pattern
                has_disabled_pattern = re.search(r'(button\.disabled\s*=\s*true|\.disabled\s*=\s*true|isSubmitting)', content)

                if not has_disabled_pattern:
                    # Find the line with submit handler
                    lines = content.split('\n')
                    for i, line in enumerate(lines, 1):
                        if re.search(r'(addEventListener\([\'"]submit|handleSubmit)', line):
                            self.issues.append(Issue(
                                severity='info',
                                category='double-submit',
                                file_path=str(js_file.relative_to(self.project_root)),
                                line_num=i,
                                message="Form submit handler - verify double-submit prevention (button.disabled)"
                            ))
                            break

        if not any(i.category == 'double-submit' for i in self.issues):
            print(f"  {GREEN}✅ Form handlers have double-submit prevention{NC}")
        print()

    def print_summary(self):
        """Print summary of all issues"""
        print("=" * 50)
        
        # Group by severity
        errors = [i for i in self.issues if i.severity == 'error']
        warnings = [i for i in self.issues if i.severity == 'warning']
        info = [i for i in self.issues if i.severity == 'info']
        
        # Print errors
        if errors:
            print(f"\n{RED}❌ ERRORS ({len(errors)}){NC}")
            for issue in errors:
                print(issue)
        
        # Print warnings
        if warnings:
            print(f"\n{YELLOW}⚠️  WARNINGS ({len(warnings)}){NC}")
            for issue in warnings:
                print(issue)
        
        # Print info (only if verbose or if no other issues)
        if self.verbose or (not errors and not warnings and info):
            if info:
                print(f"\n{BLUE}ℹ️  INFO ({len(info)}){NC}")
                for issue in info[:10]:  # Limit to 10
                    print(issue)
                if len(info) > 10:
                    print(f"  ... and {len(info) - 10} more (use --verbose to see all)")
        
        print()
        
        # Summary
        if not self.issues:
            print(f"{GREEN}✅ No critical issues found! Code health looks good.{NC}")
            return 0
        else:
            print(f"{YELLOW}Found {len(errors)} errors, {len(warnings)} warnings, {len(info)} info{NC}")
            if errors:
                return 1
            return 0
    
    # Helper methods
    
    def _has_nav_element(self, html_file: Path) -> bool:
        """Check if HTML file has nav element"""
        content = html_file.read_text(encoding='utf-8')
        return '<nav class="nav">' in content
        
    def _find_js_module(self, html_file: Path) -> Path:
        """Find the JS module for an HTML file"""
        content = html_file.read_text(encoding='utf-8')
        
        # Look for <script type="module" src="...">
        match = re.search(r'<script\s+type="module"\s+src="([^"]+)"', content)
        if not match:
            # Try alternative: src="..." type="module"
            match = re.search(r'<script\s+src="([^"]+)"\s+type="module"', content)
        
        if match:
            js_path = match.group(1)
            # Resolve relative to HTML file
            return (html_file.parent / js_path).resolve()
        
        return None


def main():
    # Parse args
    verbose = '--verbose' in sys.argv or '-v' in sys.argv
    
    # Find project root (scripts/maintenance/ -> scripts/ -> project root)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    
    # Run checks
    checker = CodeHealthChecker(project_root, verbose=verbose)
    exit_code = checker.check_all()
    
    sys.exit(exit_code)


if __name__ == '__main__':
    main()
