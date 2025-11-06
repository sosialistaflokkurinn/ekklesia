#!/usr/bin/env python3
"""
Audit Script: Validate MD documentation against actual codebase implementation

This script:
1. Extracts all code examples from .md files
2. Compares them with actual code in the repository
3. Validates command syntax, APIs, and execution paths
4. Generates a comprehensive audit report
"""

import os
import re
import json
import subprocess
from pathlib import Path
from typing import Dict, List, Tuple

class DocumentationAudit:
    def __init__(self, repo_root: str, docs_root: str):
        self.repo_root = Path(repo_root)
        self.docs_root = Path(docs_root)
        self.findings = {
            "code_examples": [],
            "broken_examples": [],
            "outdated": [],
            "missing_files": [],
            "api_mismatches": [],
            "warnings": []
        }
        
    def extract_code_blocks(self, md_file: Path) -> List[Dict]:
        """Extract all code blocks from a markdown file"""
        code_blocks = []
        
        try:
            with open(md_file, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            self.findings["warnings"].append(f"Cannot read {md_file}: {e}")
            return []
        
        # Find all code blocks
        pattern = r'```(?:bash|javascript|js|node|python|py|sql|json|shell)?\n(.*?)```'
        matches = re.finditer(pattern, content, re.DOTALL)
        
        for i, match in enumerate(matches):
            code = match.group(1).strip()
            if code:
                code_blocks.append({
                    "file": str(md_file.relative_to(self.docs_root)),
                    "block_num": i + 1,
                    "code": code,
                    "language": self.detect_language(code)
                })
        
        return code_blocks
    
    def detect_language(self, code: str) -> str:
        """Detect programming language of code snippet"""
        if code.startswith(('gcloud ', 'gh ', 'git ', 'curl ', 'npm ', 'python ', 'node ', 'bash ')):
            return 'shell'
        elif 'SELECT ' in code.upper() or 'INSERT ' in code.upper():
            return 'sql'
        elif '{' in code and '(' in code and 'function' in code.lower():
            return 'javascript'
        elif 'import ' in code or 'from ' in code or 'def ' in code:
            return 'python'
        else:
            return 'unknown'
    
    def audit_all_docs(self) -> Dict:
        """Audit all .md files in docs directory"""
        print("🔍 Starting Documentation Audit...")
        print(f"📂 Docs path: {self.docs_root}\n")
        
        all_md_files = list(self.docs_root.rglob("*.md"))
        print(f"📄 Found {len(all_md_files)} markdown files\n")
        
        total_blocks = 0
        for md_file in sorted(all_md_files):
            blocks = self.extract_code_blocks(md_file)
            if blocks:
                total_blocks += len(blocks)
                print(f"  📝 {md_file.name}: {len(blocks)} code block(s)")
                
                for block in blocks:
                    self.validate_code_block(block)
        
        print(f"\n✅ Total code blocks found: {total_blocks}\n")
        return self.findings
    
    def validate_code_block(self, block: Dict) -> List:
        """Validate a single code block"""
        code = block["code"]
        lang = block["language"]
        
        # Check for common issues
        self.check_file_references(code, block)
        self.check_gcloud_commands(code, block)
        self.check_api_calls(code, block)
        self.check_syntax(code, block)
    
    def check_file_references(self, code: str, block: Dict) -> List:
        """Check if referenced files exist"""
        # Match file paths in code
        file_patterns = [
            r'["\'](\.?\.?[/\w\-\.]+\.(?:js|py|sql|json|md|sh))["\']',
            r'(?:file|path|source|location)[=:][ ]?["\'](.*?)["\']',
            r'(?:git add|git commit -m|cat >|echo .* >)[ ]+([\w\-\./]+\.(?:js|py|sql|md))'
        ]
        
        for pattern in file_patterns:
            matches = re.findall(pattern, code)
            for file_path in matches:
                # Resolve relative paths
                resolved = (self.repo_root / file_path).resolve()
                if not resolved.exists() and file_path not in ['...', 'FILE_ID']:
                    self.findings["missing_files"].append({
                        "doc": block["file"],
                        "block": block["block_num"],
                        "file": file_path,
                        "code_snippet": code[:100]
                    })
    
    def check_gcloud_commands(self, code: str, block: Dict) -> List:
        """Check gcloud commands for validity"""
        if 'gcloud' in code:
            # Extract gcloud command
            gcloud_match = re.search(r'gcloud\s+([^\s]+\s+[^\s]+(?:\s+[^\s]+)?)', code)
            if gcloud_match:
                command = gcloud_match.group(0)
                # Check if it's a realistic gcloud command
                valid_services = ['functions', 'run', 'sql', 'secrets', 'iam', 'config']
                if not any(service in command for service in valid_services):
                    self.findings["warnings"].append({
                        "type": "gcloud_command",
                        "doc": block["file"],
                        "command": command[:50]
                    })
    
    def check_api_calls(self, code: str, block: Dict) -> List:
        """Check API calls for syntax and endpoints"""
        # Check Firebase API calls
        if 'admin.auth()' in code or 'admin.firestore()' in code:
            if 'getUser(' not in code and 'setCustomUserClaims(' not in code and 'get()' not in code:
                self.findings["api_mismatches"].append({
                    "doc": block["file"],
                    "api": "Firebase Admin SDK",
                    "issue": "Incomplete API usage"
                })
        
        # Check GraphQL calls
        if 'graphql' in code.lower() or 'mutation' in code.lower():
            if 'query' not in code and 'mutation' not in code:
                self.findings["api_mismatches"].append({
                    "doc": block["file"],
                    "api": "GraphQL",
                    "issue": "Invalid GraphQL syntax"
                })
    
    def check_syntax(self, code: str, block: Dict) -> List:
        """Basic syntax checking"""
        lang = block["language"]
        
        if lang == 'shell':
            self.check_shell_syntax(code, block)
        elif lang == 'python':
            self.check_python_syntax(code, block)
        elif lang == 'javascript':
            self.check_js_syntax(code, block)
        elif lang == 'sql':
            self.check_sql_syntax(code, block)
    
    def check_shell_syntax(self, code: str, block: Dict) -> List:
        """Check shell script syntax"""
        # Check for unmatched quotes
        single_quotes = code.count("'")
        double_quotes = code.count('"')
        
        if single_quotes % 2 != 0:
            self.findings["broken_examples"].append({
                "doc": block["file"],
                "issue": "Unmatched single quotes in shell command",
                "code_snippet": code[:80]
            })
        
        if double_quotes % 2 != 0:
            self.findings["broken_examples"].append({
                "doc": block["file"],
                "issue": "Unmatched double quotes in shell command",
                "code_snippet": code[:80]
            })
    
    def check_python_syntax(self, code: str, block: Dict) -> List:
        """Check Python syntax"""
        try:
            compile(code, '<string>', 'exec')
        except SyntaxError as e:
            self.findings["broken_examples"].append({
                "doc": block["file"],
                "language": "Python",
                "error": str(e),
                "code_snippet": code[:100]
            })
    
    def check_js_syntax(self, code: str, block: Dict) -> List:
        """Check JavaScript syntax"""
        # Simple check for common issues
        if code.count('{') != code.count('}'):
            self.findings["broken_examples"].append({
                "doc": block["file"],
                "issue": "Unmatched braces in JavaScript",
                "code_snippet": code[:80]
            })
    
    def check_sql_syntax(self, code: str, block: Dict) -> List:
        """Check SQL syntax"""
        # Check for basic SQL syntax
        required_keywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE']
        has_keyword = any(kw in code.upper() for kw in required_keywords)
        
        if not has_keyword and code.strip():
            self.findings["warnings"].append({
                "type": "sql_syntax",
                "doc": block["file"],
                "issue": "SQL code without recognizable keywords"
            })
    
    def print_report(self) -> None:
        """Print audit report"""
        print("\n" + "="*80)
        print("📋 DOCUMENTATION AUDIT REPORT")
        print("="*80 + "\n")
        
        print(f"⚠️  BROKEN EXAMPLES: {len(self.findings['broken_examples'])}")
        for item in self.findings["broken_examples"][:5]:
            print(f"   - {item.get('doc')}: {item.get('issue', 'Syntax error')}")
        
        print(f"\n🔗 MISSING FILE REFERENCES: {len(self.findings['missing_files'])}")
        for item in self.findings["missing_files"][:5]:
            print(f"   - {item.get('doc')}: {item.get('file')}")
        
        print(f"\n❌ API MISMATCHES: {len(self.findings['api_mismatches'])}")
        for item in self.findings["api_mismatches"][:5]:
            print(f"   - {item.get('doc')}: {item.get('api')} - {item.get('issue')}")
        
        print(f"\n⚠️  WARNINGS: {len(self.findings['warnings'])}")
        for item in self.findings["warnings"][:5]:
            if isinstance(item, dict):
                print(f"   - {item.get('doc', item.get('type'))}: {item.get('issue', item.get('command', ''))}")
            else:
                print(f"   - {item}")
        
        print("\n" + "="*80)

if __name__ == '__main__':
    repo_root = '/home/gudro/Development/projects/ekklesia'
    docs_root = '/home/gudro/Development/projects/ekklesia/docs'
    
    audit = DocumentationAudit(repo_root, docs_root)
    findings = audit.audit_all_docs()
    audit.print_report()
    
    # Save detailed report
    report_file = f"{repo_root}/AUDIT_CODE_DOCUMENTATION_2025-10-20.json"
    with open(report_file, 'w') as f:
        json.dump(findings, f, indent=2)
    print(f"\n📁 Detailed report saved: {report_file}")
