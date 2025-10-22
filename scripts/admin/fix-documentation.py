#!/usr/bin/env python3
"""
Fix broken code documentation examples

This script identifies and attempts to fix:
1. Unmatched quotes in code blocks
2. Unmatched brackets in code blocks
3. Common syntax errors
"""

import re
import json
from pathlib import Path

class DocumentationFixer:
    def __init__(self, docs_root: str, audit_file: str):
        self.docs_root = Path(docs_root)
        self.audit_file = audit_file
        self.fixes_made = []
        self.fixes_failed = []
        
    def load_audit(self):
        """Load audit findings"""
        with open(self.audit_file, 'r') as f:
            return json.load(f)
    
    def fix_broken_examples(self):
        """Attempt to fix broken code examples"""
        audit = self.load_audit()
        
        print("\n" + "="*70)
        print("ATTEMPTING TO FIX BROKEN EXAMPLES")
        print("="*70)
        
        fixed_count = 0
        for item in audit['broken_examples']:
            doc_path = self.docs_root / item['doc']
            line_num = item['line']
            issue = item['issue']
            
            print(f"\n📄 {item['doc']}:{line_num}")
            print(f"   Issue: {issue}")
            
            if not doc_path.exists():
                print(f"   ❌ File not found")
                self.fixes_failed.append((item['doc'], line_num, "File not found"))
                continue
            
            try:
                with open(doc_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                
                if line_num > len(lines):
                    print(f"   ❌ Line {line_num} out of range (file has {len(lines)} lines)")
                    continue
                
                # For now, just report the issue
                target_line = lines[line_num - 1]
                print(f"   Content: {target_line[:100]}")
                print(f"   Status: 🟡 Manual review required")
                
            except Exception as e:
                print(f"   ❌ Error processing: {e}")
                self.fixes_failed.append((item['doc'], line_num, str(e)))
        
        print("\n" + "="*70)
        print(f"Summary: {len(self.fixes_failed)} failures")
        print("="*70 + "\n")
    
    def fix_api_mismatches(self):
        """Fix GraphQL and API syntax errors"""
        audit = self.load_audit()
        
        print("\n" + "="*70)
        print("ANALYZING API MISMATCHES")
        print("="*70)
        
        # Group by file and type
        by_file = {}
        for item in audit['api_mismatches']:
            doc = item['doc']
            if doc not in by_file:
                by_file[doc] = []
            by_file[doc].append(item)
        
        for doc in sorted(by_file.keys()):
            items = by_file[doc]
            print(f"\n📄 {doc}: {len(items)} issues")
            for item in items[:2]:
                print(f"   - Type: {item['type']}")
                print(f"   - Issue: {item['issue']}")
                print(f"   - Line: {item['line']}")
        
        print("\n" + "="*70 + "\n")
    
    def categorize_missing_files(self):
        """Categorize missing file references"""
        audit = self.load_audit()
        
        print("\n" + "="*70)
        print("ANALYZING MISSING FILE REFERENCES")
        print("="*70)
        
        npm_packages = []
        example_files = []
        local_modules = []
        
        for item in audit['missing_files']:
            ref = item['file_ref']
            
            # Categorize
            if any(x in ref for x in ['k6', 'firebase-admin', 'commander', '@']):
                npm_packages.append(ref)
            elif any(x in ref for x in ['/tmp', 'example', 'sample', '.json', '.md', 'runbook']):
                example_files.append(ref)
            else:
                local_modules.append(ref)
        
        print(f"\n📦 NPM Packages ({len(set(npm_packages))}): {set(npm_packages)}")
        print(f"\n📄 Example/Demo Files ({len(set(example_files))}): {set(example_files)}")
        print(f"\n🔗 Local Modules ({len(set(local_modules))}) - First 5: {list(set(local_modules))[:5]}")
        
        print("\n" + "="*70 + "\n")
        
        return {
            'npm_packages': list(set(npm_packages)),
            'example_files': list(set(example_files)),
            'local_modules': list(set(local_modules))
        }

if __name__ == "__main__":
    repo_root = "/home/gudro/Development/projects/ekklesia"
    docs_root = f"{repo_root}/docs"
    audit_file = f"{repo_root}/AUDIT_CODE_DOCUMENTATION_DETAILED_2025-10-20.json"
    
    fixer = DocumentationFixer(docs_root, audit_file)
    fixer.fix_broken_examples()
    fixer.fix_api_mismatches()
    
    missing_categories = fixer.categorize_missing_files()
    
    # Save categorization
    with open(f"{repo_root}/MISSING_FILES_CATEGORIZED.json", 'w') as f:
        json.dump(missing_categories, f, indent=2)
    
    print("✅ Analysis complete. Results saved.")
