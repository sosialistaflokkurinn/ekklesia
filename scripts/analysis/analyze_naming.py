#!/usr/bin/env python3
"""
Naming Convention Analyzer

Scans the codebase for naming convention violations based on
docs/standards/NAMING_CONVENTIONS.md.

Usage:
    python3 scripts/analysis/analyze_naming.py [--path PATH] [--strict] [--verbose]

Examples:
    python3 scripts/analysis/analyze_naming.py
    python3 scripts/analysis/analyze_naming.py --path apps/members-portal/js/
    python3 scripts/analysis/analyze_naming.py --strict  # Exit code 1 on violations
"""

import os
import re
import sys
import argparse
from pathlib import Path
from typing import List, Dict, Tuple, Set
from collections import defaultdict

# Terminal colors
RED = '\033[91m'
YELLOW = '\033[93m'
GREEN = '\033[92m'
BLUE = '\033[94m'
RESET = '\033[0m'

# Naming rules for JavaScript files (Frontend)
JS_FILE_PATTERNS = {
    # Pattern: (regex, description, directories_where_required)
    'ui_component': (
        r'^ui-[a-z][a-z0-9-]*\.js$',
        'UI components should be named ui-*.js',
        ['js/components']
    ),
    'page_controller': (
        r'^[a-z][a-z0-9-]*-page\.js$',
        'Page controllers should be named *-page.js',
        []  # Any directory
    ),
    'api_client': (
        r'^api-[a-z][a-z0-9-]*\.js$',
        'API clients should be named api-*.js',
        ['js/api', 'api']
    ),
    'util_module': (
        r'^util-[a-z][a-z0-9-]*\.js$',
        'Utility modules should be named util-*.js',
        ['js/utils', 'utils']
    ),
}

# Naming rules for JavaScript files (Backend - Cloud Run services)
BACKEND_JS_PATTERNS = {
    'route': (
        r'^route-[a-z][a-z0-9-]*\.js$',
        'Route files should be named route-*.js',
        ['src/routes', 'routes']
    ),
    'middleware': (
        r'^middleware-[a-z][a-z0-9-]*\.js$',
        'Middleware files should be named middleware-*.js',
        ['src/middleware', 'middleware']
    ),
    'service': (
        r'^service-[a-z][a-z0-9-]*\.js$',
        'Service files should be named service-*.js',
        ['src/services', 'services']
    ),
    'config': (
        r'^config-[a-z][a-z0-9-]*\.js$',
        'Config files should be named config-*.js',
        ['src/config', 'config']
    ),
    'util': (
        r'^util-[a-z][a-z0-9-]*\.js$',
        'Utility files should be named util-*.js',
        ['src/utils', 'utils']
    ),
}

# Naming rules for Python files
PY_FILE_PATTERNS = {
    'firebase_function': (
        r'^fn_[a-z][a-z0-9_]*\.py$',
        'Firebase functions should be named fn_*.py',
        ['functions']
    ),
    'handler': (
        r'^handler_[a-z][a-z0-9_]*\.py$',
        'Handlers should be named handler_*.py',
        ['handlers']
    ),
    'utility': (
        r'^util_[a-z][a-z0-9_]*\.py$',
        'Utilities should be named util_*.py',
        ['utils']
    ),
}

# Generic file patterns (apply everywhere)
GENERIC_PATTERNS = {
    'kebab_case_js': (
        r'^[a-z][a-z0-9-]*\.js$',
        'JS files should use kebab-case (lowercase, hyphens only)'
    ),
    'kebab_case_css': (
        r'^[a-z][a-z0-9-]*\.css$',
        'CSS files should use kebab-case'
    ),
    'snake_case_py': (
        r'^[a-z][a-z0-9_]*\.py$',
        'Python files should use snake_case'
    ),
}

# Known exceptions (legacy files to be migrated)
# NOTE: Phase 2 completed - these files have been renamed:
#   button.js → ui-button.js, modal.js → ui-modal.js, etc.
#   elections-api.js → api-elections.js, members-client.js → api-members.js
LEGACY_EXCEPTIONS = {
    # Add any remaining legacy files here as they are identified
    # 'example.js',  # Should be ui-example.js
}

# Directories to skip
SKIP_DIRS = {
    'node_modules',
    '.git',
    'dist',
    'build',
    '__pycache__',
    'archive',
    'tmp',
    '.firebase',
    'venv',
}


class NamingAnalyzer:
    def __init__(self, root_path: str, verbose: bool = False):
        self.root_path = Path(root_path)
        self.verbose = verbose
        self.violations: List[Dict] = []
        self.warnings: List[Dict] = []
        self.suggestions: List[Dict] = []
        self.duplicates: Dict[str, List[str]] = defaultdict(list)
        
    def analyze(self) -> Tuple[int, int, int]:
        """
        Run all analysis checks.
        Returns: (violation_count, warning_count, suggestion_count)
        """
        self._scan_files()
        self._check_duplicates()
        return len(self.violations), len(self.warnings), len(self.suggestions)
    
    def _scan_files(self):
        """Scan all files and check naming conventions."""
        for root, dirs, files in os.walk(self.root_path):
            # Skip excluded directories
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            
            rel_root = Path(root).relative_to(self.root_path)
            
            for filename in files:
                filepath = Path(root) / filename
                rel_path = filepath.relative_to(self.root_path)
                
                # Track for duplicate detection
                self.duplicates[filename].append(str(rel_path))
                
                # Check file naming
                self._check_file_naming(filename, str(rel_root), str(rel_path))
    
    def _check_file_naming(self, filename: str, directory: str, full_path: str):
        """Check if a file follows naming conventions."""
        
        # Skip known exceptions
        if filename in LEGACY_EXCEPTIONS:
            self.suggestions.append({
                'path': full_path,
                'type': 'legacy',
                'message': f'Legacy file: consider renaming to follow conventions',
                'suggestion': self._suggest_new_name(filename)
            })
            return
        
        # Check JS files
        if filename.endswith('.js'):
            self._check_js_file(filename, directory, full_path)
        
        # Check Python files
        elif filename.endswith('.py'):
            self._check_py_file(filename, directory, full_path)
        
        # Check CSS files
        elif filename.endswith('.css'):
            self._check_css_file(filename, full_path)
    
    def _is_backend_service(self, directory: str) -> bool:
        """Check if directory is inside a backend service (services/svc-*)."""
        return 'services/svc-' in directory or directory.startswith('svc-')

    def _check_js_file(self, filename: str, directory: str, full_path: str):
        """Check JavaScript file naming."""
        # Skip known entry points and config files
        if filename in ('index.js', 'firebase.js', 'jest.config.js'):
            return

        # Check backend service patterns
        if self._is_backend_service(full_path):
            self._check_backend_js_file(filename, directory, full_path)
            return

        # Basic kebab-case check for frontend
        if not re.match(GENERIC_PATTERNS['kebab_case_js'][0], filename):
            # Check for common violations
            if '_' in filename:
                self.violations.append({
                    'path': full_path,
                    'type': 'case_violation',
                    'message': f'JS files should use kebab-case, not snake_case',
                    'suggestion': filename.replace('_', '-')
                })
            elif any(c.isupper() for c in filename[:-3]):  # Exclude .js extension
                self.violations.append({
                    'path': full_path,
                    'type': 'case_violation',
                    'message': f'JS files should use kebab-case, not PascalCase/camelCase',
                    'suggestion': self._to_kebab_case(filename)
                })

    def _check_backend_js_file(self, filename: str, directory: str, full_path: str):
        """Check backend JavaScript file naming (services/svc-*)."""
        # Check directory-specific patterns
        for pattern_name, (regex, description, required_dirs) in BACKEND_JS_PATTERNS.items():
            for req_dir in required_dirs:
                if req_dir in directory:
                    if not re.match(regex, filename):
                        # Generate suggestion
                        suggestion = self._suggest_backend_name(filename, pattern_name)
                        self.warnings.append({
                            'path': full_path,
                            'type': 'naming_convention',
                            'message': description,
                            'suggestion': suggestion
                        })
                    return

        # For files not in a specific directory, just check kebab-case
        if not re.match(GENERIC_PATTERNS['kebab_case_js'][0], filename):
            self.violations.append({
                'path': full_path,
                'type': 'case_violation',
                'message': 'JS files should use kebab-case'
            })

    def _suggest_backend_name(self, filename: str, pattern_type: str) -> str:
        """Suggest a new name for backend files."""
        name = filename.replace('.js', '')
        prefixes = {
            'route': 'route-',
            'middleware': 'middleware-',
            'service': 'service-',
            'config': 'config-',
            'util': 'util-'
        }
        prefix = prefixes.get(pattern_type, '')
        # Convert camelCase to kebab-case
        kebab_name = re.sub(r'([A-Z])', r'-\1', name).lower().lstrip('-')
        return f"{prefix}{kebab_name}.js"
    
    def _check_py_file(self, filename: str, directory: str, full_path: str):
        """Check Python file naming."""
        # Skip __init__.py and similar
        if filename.startswith('__'):
            return
            
        # Basic snake_case check
        if not re.match(GENERIC_PATTERNS['snake_case_py'][0], filename):
            if '-' in filename:
                self.violations.append({
                    'path': full_path,
                    'type': 'case_violation',
                    'message': f'Python files should use snake_case, not kebab-case',
                    'suggestion': filename.replace('-', '_')
                })
    
    def _check_css_file(self, filename: str, full_path: str):
        """Check CSS file naming."""
        if not re.match(GENERIC_PATTERNS['kebab_case_css'][0], filename):
            self.violations.append({
                'path': full_path,
                'type': 'case_violation',
                'message': f'CSS files should use kebab-case'
            })
    
    def _check_duplicates(self):
        """Check for duplicate file names across directories."""
        for filename, paths in self.duplicates.items():
            if len(paths) > 1:
                # Some duplicates are expected (index.html, package.json, etc.)
                if filename in ('index.html', 'package.json', 'README.md', 
                               'deploy.sh', '.gitignore', '__init__.py'):
                    continue
                
                # Flag component duplicates as warnings
                if filename.endswith('.js') and 'component' in filename.lower():
                    self.warnings.append({
                        'filename': filename,
                        'paths': paths,
                        'type': 'duplicate',
                        'message': f'Component exists in multiple locations'
                    })
                elif filename.endswith('.js'):
                    self.warnings.append({
                        'filename': filename,
                        'paths': paths,
                        'type': 'potential_duplicate',
                        'message': f'File exists in multiple locations - verify if intentional'
                    })
    
    def _suggest_new_name(self, filename: str) -> str:
        """Suggest a new name for legacy files."""
        suggestions = {
            'button.js': 'ui-button.js',
            'modal.js': 'ui-modal.js',
            'toast.js': 'ui-toast.js',
            'badge.js': 'ui-badge.js',
            'card.js': 'ui-card.js',
            'status.js': 'ui-status.js',
            'loading-state.js': 'ui-loading.js',
            'error-state.js': 'ui-error.js',
            'searchable-select.js': 'ui-searchable-select.js',
            'elections-api.js': 'api-elections.js',
            'members-client.js': 'api-members.js',
        }
        return suggestions.get(filename, f'(follow naming conventions)')
    
    def _to_kebab_case(self, filename: str) -> str:
        """Convert a filename to kebab-case."""
        name, ext = os.path.splitext(filename)
        # Insert hyphens before uppercase letters and lowercase everything
        result = re.sub(r'([A-Z])', r'-\1', name).lower().lstrip('-')
        return result + ext
    
    def print_report(self):
        """Print the analysis report."""
        print(f"\n{BLUE}{'='*60}{RESET}")
        print(f"{BLUE}Naming Convention Analysis Report{RESET}")
        print(f"{BLUE}{'='*60}{RESET}\n")
        
        # Violations
        if self.violations:
            print(f"{RED}❌ VIOLATIONS ({len(self.violations)}):{RESET}")
            for v in self.violations:
                print(f"  {v['path']}")
                print(f"    → {v['message']}")
                if 'suggestion' in v:
                    print(f"    💡 Suggestion: {v['suggestion']}")
            print()
        
        # Warnings
        if self.warnings:
            print(f"{YELLOW}⚠️  WARNINGS ({len(self.warnings)}):{RESET}")
            for w in self.warnings:
                if w['type'] in ('duplicate', 'potential_duplicate'):
                    print(f"  {w['filename']} - {w['message']}")
                    for p in w['paths']:
                        print(f"    • {p}")
                else:
                    print(f"  {w.get('path', w.get('filename'))}: {w['message']}")
            print()
        
        # Suggestions
        if self.suggestions:
            print(f"{BLUE}💡 SUGGESTIONS ({len(self.suggestions)}):{RESET}")
            for s in self.suggestions:
                print(f"  {s['path']}")
                print(f"    → {s['message']}")
                if 'suggestion' in s:
                    print(f"    💡 Rename to: {s['suggestion']}")
            print()
        
        # Summary
        print(f"{BLUE}{'='*60}{RESET}")
        if not self.violations and not self.warnings:
            print(f"{GREEN}✅ No critical issues found!{RESET}")
        else:
            print(f"Summary: {RED}{len(self.violations)} violations{RESET}, "
                  f"{YELLOW}{len(self.warnings)} warnings{RESET}, "
                  f"{BLUE}{len(self.suggestions)} suggestions{RESET}")
        print()


def main():
    parser = argparse.ArgumentParser(
        description='Analyze codebase for naming convention violations'
    )
    parser.add_argument(
        '--path', '-p',
        default='.',
        help='Path to analyze (default: current directory)'
    )
    parser.add_argument(
        '--strict', '-s',
        action='store_true',
        help='Exit with code 1 if any violations found'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Show detailed output'
    )
    
    args = parser.parse_args()
    
    # Find project root (look for .git or package.json)
    start_path = Path(args.path).resolve()
    if not start_path.exists():
        print(f"{RED}Error: Path does not exist: {start_path}{RESET}")
        sys.exit(1)
    
    # If path is relative, try to find project root
    root_path = start_path
    if args.path == '.':
        check_path = start_path
        while check_path != check_path.parent:
            if (check_path / '.git').exists() or (check_path / 'package.json').exists():
                root_path = check_path
                break
            check_path = check_path.parent
    
    print(f"Analyzing: {root_path}")
    
    analyzer = NamingAnalyzer(root_path, verbose=args.verbose)
    violations, warnings, suggestions = analyzer.analyze()
    analyzer.print_report()
    
    if args.strict and violations > 0:
        sys.exit(1)
    
    sys.exit(0)


if __name__ == '__main__':
    main()
