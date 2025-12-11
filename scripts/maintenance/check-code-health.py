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
    python3 scripts/check-code-health.py
    python3 scripts/check-code-health.py --verbose
    python3 scripts/check-code-health.py --check=navigation
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
            # Skip debug.js itself
            if 'debug.js' in str(js_file):
                continue
                
            content = js_file.read_text(encoding='utf-8')
            lines = content.split('\n')
            
            for i, line in enumerate(lines, 1):
                # Skip commented lines
                if line.strip().startswith('//'):
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
