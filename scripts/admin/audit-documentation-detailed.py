#!/usr/bin/env python3
"""
Detailed Code-Documentation Compliance Audit

Validates that all code examples in markdown documentation:
1. Have valid syntax
2. Reference existing files
3. Use correct APIs
4. Match actual implementation
"""

import os
import re
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

class DetailedDocumentationAudit:
    def __init__(self, docs_root: str):
        self.docs_root = Path(docs_root)
        self.findings = {
            "broken_examples": [],
            "missing_files": [],
            "api_mismatches": [],
            "warnings": [],
            "total_blocks": 0
        }
        self.file_refs_seen = set()
        self.code_blocks_by_file = {}
        
    def scan_all_docs(self) -> Any:
        """Scan all markdown files"""
        md_files = list(self.docs_root.glob('**/*.md'))
        print(f"\n🔍 Found {len(md_files)} markdown files")
        
        for md_file in sorted(md_files):
            self.process_file(md_file)
            
        return self.findings
    
    def process_file(self, md_file: Path) -> Any:
        """Process a single markdown file"""
        rel_path = md_file.relative_to(self.docs_root)
        
        try:
            with open(md_file, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            self.findings["warnings"].append({
                "file": str(rel_path),
                "type": "read_error",
                "message": str(e)
            })
            return
        
        # Extract all code blocks
        # Updated to include proper language support for Ekklesia tech stack:
        # Python, JavaScript, Shell, SQL, JSON, YAML, CSS, HTML, XML, GraphQL
        pattern = r'```(?:bash|shell|sh|javascript|js|node|python|py|sql|json|yaml|yml|css|html|xml|graphql|gql)?\n(.*?)```'
        matches = re.finditer(pattern, content, re.DOTALL)
        
        blocks_in_file = []
        for match in matches:
            code = match.group(1).strip()
            if code:
                self.findings["total_blocks"] += 1
                line_num = content[:match.start()].count('\n') + 1
                
                block_info = {
                    "file": str(rel_path),
                    "line": line_num,
                    "code": code[:200],  # First 200 chars
                    "full_code": code
                }
                blocks_in_file.append(block_info)
                
                # Analyze the block
                self.analyze_block(block_info)
        
        self.code_blocks_by_file[str(rel_path)] = blocks_in_file
    
    def analyze_block(self, block_info: Dict) -> Any:
        """Analyze a single code block for issues"""
        code = block_info["full_code"]
        doc_file = block_info["file"]
        line = block_info["line"]
        
        # Check for file references
        file_patterns = [
            r"['\"]([^'\"]*\.(?:js|py|sh|sql|json|yaml|md|rules))['\"]",
            r"cat\s+([^\s]+\.(?:js|py|sh|sql|json|yaml|md))",
            r"require\(['\"]([^'\"]+)['\"]\)",
            r"import\s+.*\s+from\s+['\"]([^'\"]+)['\"]",
        ]
        
        for pattern in file_patterns:
            matches = re.findall(pattern, code)
            for file_ref in matches:
                if not self._file_exists(file_ref):
                    self.findings["missing_files"].append({
                        "doc": doc_file,
                        "line": line,
                        "file_ref": file_ref,
                        "code_snippet": code[:100]
                    })
                    self.file_refs_seen.add(file_ref)
        
        # Check for common API syntax errors
        if 'gql' in code or 'query' in code.lower() or 'mutation' in code.lower():
            self._check_graphql_syntax(code, doc_file, line)
        
        if 'firebase' in code.lower() or 'firestore' in code.lower():
            self._check_firebase_syntax(code, doc_file, line)
        
        if 'gcloud' in code or 'gsutil' in code:
            self._check_gcloud_syntax(code, doc_file, line)
        
        # Check for basic syntax errors
        self._check_basic_syntax(code, doc_file, line)
    
    def _file_exists(self, file_ref: str) -> bool:
        """Check if a file exists in the repo"""
        # Remove quotes and clean paths
        file_ref = file_ref.strip('\'"')
        
        # Skip npm packages, node_modules, and relative imports
        if any(x in file_ref for x in ['node_modules', '@', 'npm', 'https://', 'http://']):
            return True
        
        # Check various locations
        possible_paths = [
            self.docs_root.parent / file_ref,
            self.docs_root / file_ref,
            self.docs_root.parent / 'src' / file_ref,
            self.docs_root.parent / 'functions' / file_ref,
        ]
        
        for path in possible_paths:
            if path.exists():
                return True
        
        return False
    
    def _check_graphql_syntax(self, code: str, doc: str, line: int):
        """Validate GraphQL syntax"""
        # Check for common GraphQL errors
        issues = []
        
        # Check for unmatched braces
        open_braces = code.count('{')
        close_braces = code.count('}')
        if open_braces != close_braces:
            issues.append("Unmatched braces in GraphQL")
        
        # Check for incomplete queries
        if ('query' in code or 'mutation' in code) and '{' not in code:
            issues.append("Query without opening brace")
        
        # Note: Removed overly-aggressive field syntax check
        # Pattern `: {` is VALID in GraphQL for input objects
        
        for issue in issues:
            self.findings["api_mismatches"].append({
                "doc": doc,
                "line": line,
                "type": "GraphQL",
                "issue": issue,
                "code_snippet": code[:100]
            })
    
    def _check_firebase_syntax(self, code: str, doc: str, line: int):
        """Validate Firebase API syntax"""
        issues = []
        
        # Check for deprecated patterns
        if 'firebase.database()' in code and '.ref()' not in code:
            issues.append("Missing .ref() in Realtime Database call")
        
        if 'getDoc' in code and 'getDocs' in code:
            issues.append("Mixing getDoc and getDocs patterns")
        
        for issue in issues:
            self.findings["api_mismatches"].append({
                "doc": doc,
                "line": line,
                "type": "Firebase",
                "issue": issue,
                "code_snippet": code[:100]
            })
    
    def _check_gcloud_syntax(self, code: str, doc: str, line: int):
        """Validate gcloud command syntax"""
        issues = []
        
        # Check for missing service names
        if 'gcloud functions' in code:
            if not re.search(r'(deploy|list|describe|delete)', code):
                issues.append("gcloud functions command incomplete")
        
        # Check for invalid region names
        if any(x in code for x in ['--region', '--zones']):
            if not re.search(r'(europe-west|us-central|us-east|asia)', code):
                issues.append("Invalid or missing region specification")
        
        for issue in issues:
            self.findings["warnings"].append({
                "doc": doc,
                "line": line,
                "type": "gcloud",
                "message": issue
            })
    
    def _check_basic_syntax(self, code: str, doc: str, line: int):
        """Check for basic syntax errors"""
        issues = []
        
        # Skip if this is clearly markdown content (not code)
        # Common markdown patterns:
        if code.startswith(('##', '#', '---', '- ', '* ')):
            return  # This is markdown, not code
        
        # Skip if content has markdown formatting that indicates it's documentation
        if '❌' in code or '✅' in code:
            return  # This is likely documentation/commentary, not real code
        
        # For apostrophe checks, be very conservative - only flag obvious issues
        # The heuristics are too error-prone, so we'll be very selective:
        
        # Only check for OBVIOUSLY broken brackets/braces in code
        # Skip quote checks entirely since they have too many false positives
        
        # Check for unmatched brackets/braces (but not parens, those are common)
        for open_b, close_b in [('[', ']'), ('{', '}')]:
            open_count = code.count(open_b)
            close_count = code.count(close_b)
            # Only flag if severely mismatched (e.g., 5+ difference)
            if abs(open_count - close_count) > 3:
                issues.append(f"Unmatched {open_b}{close_b} brackets")
        
        # Check for incomplete shell commands
        if code.startswith('$'):
            if code.count('|') > 0 and code.strip().endswith('|'):
                issues.append("Incomplete piped command")
        
        for issue in issues:
            self.findings["broken_examples"].append({
                "doc": doc,
                "line": line,
                "issue": issue,
                "code_snippet": code[:100],
                "code_length": len(code)
            })
    
    def generate_report(self, output_file: str = None) -> None:
        """Generate audit report"""
        if output_file:
            with open(output_file, 'w') as f:
                json.dump(self.findings, f, indent=2)
            print(f"\n✅ Report saved to: {output_file}")
        
        return self.findings
    
    def print_summary(self) -> None:
        """Print summary of findings"""
        print("\n" + "="*70)
        print("CODE-DOCUMENTATION COMPLIANCE AUDIT - DETAILED FINDINGS")
        print("="*70)
        
        print(f"\n📊 STATISTICS:")
        print(f"  Total code blocks analyzed: {self.findings['total_blocks']}")
        print(f"  Files scanned: {len(self.code_blocks_by_file)}")
        
        print(f"\n🔴 BROKEN EXAMPLES: {len(self.findings['broken_examples'])}")
        for item in self.findings['broken_examples'][:5]:
            print(f"    - {item['doc']}:{item['line']} - {item['issue']}")
        if len(self.findings['broken_examples']) > 5:
            print(f"    ... and {len(self.findings['broken_examples']) - 5} more")
        
        print(f"\n🔗 MISSING FILE REFERENCES: {len(self.findings['missing_files'])}")
        for item in self.findings['missing_files'][:5]:
            print(f"    - {item['doc']}:{item['line']} → {item['file_ref']}")
        if len(self.findings['missing_files']) > 5:
            print(f"    ... and {len(self.findings['missing_files']) - 5} more")
        
        print(f"\n⚠️  API MISMATCHES: {len(self.findings['api_mismatches'])}")
        for item in self.findings['api_mismatches'][:5]:
            print(f"    - {item['doc']}:{item['line']} ({item['type']}) - {item['issue']}")
        if len(self.findings['api_mismatches']) > 5:
            print(f"    ... and {len(self.findings['api_mismatches']) - 5} more")
        
        print(f"\n⚠️  WARNINGS: {len(self.findings['warnings'])}")
        for item in self.findings['warnings'][:3]:
            if 'message' in item:
                print(f"    - {item['doc']}: {item['message']}")
        if len(self.findings['warnings']) > 3:
            print(f"    ... and {len(self.findings['warnings']) - 3} more")
        
        print("\n" + "="*70)
        print(f"📁 Full report: AUDIT_CODE_DOCUMENTATION_DETAILED_2025-10-20.json")
        print("="*70 + "\n")


if __name__ == "__main__":
    repo_root = "/home/gudro/Development/projects/ekklesia"
    docs_root = f"{repo_root}/docs"
    
    audit = DetailedDocumentationAudit(docs_root)
    audit.scan_all_docs()
    audit.print_summary()
    audit.generate_report("AUDIT_CODE_DOCUMENTATION_DETAILED_2025-10-20.json")
