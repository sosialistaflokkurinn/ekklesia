#!/usr/bin/env python3
"""
Comprehensive remediation strategy for code-documentation compliance

This provides a complete remediation roadmap with:
1. Detailed issue analysis by category
2. Specific file-by-file action items
3. Priority ranking
4. Time estimates
"""

import json
from pathlib import Path
from typing import Dict, List

def load_audit() -> Any:
    """Load detailed audit results"""
    with open('AUDIT_CODE_DOCUMENTATION_DETAILED_2025-10-20.json') as f:
        return json.load(f)

def create_remediation_summary() -> Any:
    """Create comprehensive remediation summary"""
    audit = load_audit()
    
    summary = {
        "overview": {
            "total_issues": len(audit['broken_examples']) + len(audit['missing_files']) + len(audit['api_mismatches']) + len(audit['warnings']),
            "broken_examples": len(audit['broken_examples']),
            "missing_files": len(audit['missing_files']),
            "api_mismatches": len(audit['api_mismatches']),
            "warnings": len(audit['warnings']),
            "total_files_scanned": 51,
            "code_blocks_analyzed": audit['total_blocks']
        },
        "broken_examples_by_type": {},
        "api_mismatches_by_file": {},
        "missing_files_by_type": {},
        "remediation_priority": {
            "CRITICAL": [],
            "HIGH": [],
            "MEDIUM": []
        }
    }
    
    # Analyze broken examples
    for item in audit['broken_examples']:
        issue_type = item['issue']
        if issue_type not in summary['broken_examples_by_type']:
            summary['broken_examples_by_type'][issue_type] = []
        summary['broken_examples_by_type'][issue_type].append(item['doc'])
    
    # Analyze API mismatches
    for item in audit['api_mismatches']:
        doc = item['doc']
        if doc not in summary['api_mismatches_by_file']:
            summary['api_mismatches_by_file'][doc] = []
        summary['api_mismatches_by_file'][doc].append({
            'type': item['type'],
            'issue': item['issue'],
            'line': item['line']
        })
    
    # Categorize missing files
    npm_packages = set()
    example_files = set()
    local_modules = set()
    
    for item in audit['missing_files']:
        ref = item['file_ref']
        if any(x in ref for x in ['k6', 'firebase-admin', 'commander', '@']):
            npm_packages.add(ref)
        elif any(x in ref for x in ['/tmp', 'example', 'sample', '.json', '*.md', 'runbook']):
            example_files.add(ref)
        else:
            local_modules.add(ref)
    
    summary['missing_files_by_type'] = {
        'npm_packages': list(npm_packages),
        'example_files': list(example_files),
        'local_modules': list(local_modules)
    }
    
    # Build priority list
    file_issue_count = {}
    for item in audit['broken_examples']:
        doc = item['doc']
        file_issue_count[doc] = file_issue_count.get(doc, 0) + 1
    
    for item in audit['api_mismatches']:
        doc = item['doc']
        file_issue_count[doc] = file_issue_count.get(doc, 0) + 1
    
    for item in audit['missing_files']:
        doc = item['doc']
        file_issue_count[doc] = file_issue_count.get(doc, 0) + 1
    
    # Sort by issue count
    sorted_files = sorted(file_issue_count.items(), key=lambda x: x[1], reverse=True)
    
    for file, count in sorted_files[:10]:
        if count >= 5:
            summary['remediation_priority']['CRITICAL'].append({'file': file, 'issues': count})
        elif count >= 2:
            summary['remediation_priority']['HIGH'].append({'file': file, 'issues': count})
        else:
            summary['remediation_priority']['MEDIUM'].append({'file': file, 'issues': count})
    
    return summary

def print_comprehensive_report(summary: str) -> None:
    """Print comprehensive remediation report"""
    print("\n" + "="*80)
    print("CODE-DOCUMENTATION COMPLIANCE - COMPREHENSIVE REMEDIATION REPORT")
    print("="*80)
    
    print("\n📊 OVERALL STATISTICS")
    print("-" * 80)
    print(f"Total Issues Found: {summary['overview']['total_issues']}")
    print(f"  - Broken Examples: {summary['overview']['broken_examples']}")
    print(f"  - Missing File References: {summary['overview']['missing_files']}")
    print(f"  - API Mismatches: {summary['overview']['api_mismatches']}")
    print(f"  - Warnings: {summary['overview']['warnings']}")
    print(f"\nCode Blocks Analyzed: {summary['overview']['code_blocks_analyzed']}")
    print(f"Files Scanned: {summary['overview']['total_files_scanned']}")
    
    print("\n🔴 BROKEN EXAMPLES BY TYPE")
    print("-" * 80)
    for issue_type, files in summary['broken_examples_by_type'].items():
        unique_files = len(set(files))
        total = len(files)
        print(f"{issue_type}: {total} occurrences in {unique_files} files")
        for f in sorted(set(files))[:3]:
            print(f"  - {f}")
        if unique_files > 3:
            print(f"  ... and {unique_files - 3} more")
    
    print("\n⚠️  API MISMATCHES BY FILE")
    print("-" * 80)
    for file in sorted(summary['api_mismatches_by_file'].keys())[:8]:
        issues = summary['api_mismatches_by_file'][file]
        print(f"{file}: {len(issues)} issues")
        for issue in issues[:2]:
            print(f"  - {issue['type']}: {issue['issue']} (line {issue['line']})")
        if len(issues) > 2:
            print(f"  ... and {len(issues) - 2} more")
    
    print("\n🔗 MISSING FILE REFERENCES BY TYPE")
    print("-" * 80)
    npm = summary['missing_files_by_type']['npm_packages']
    examples = summary['missing_files_by_type']['example_files']
    local = summary['missing_files_by_type']['local_modules']
    
    print(f"NPM Packages ({len(npm)}): {', '.join(npm[:3])}")
    if len(npm) > 3:
        print(f"              ... and {len(npm) - 3} more")
    
    print(f"\nExample/Demo Files ({len(examples)}): {', '.join(list(examples)[:3])}")
    if len(examples) > 3:
        print(f"                    ... and {len(examples) - 3} more")
    
    print(f"\nLocal Modules ({len(local)}): {', '.join(local[:3])}")
    if len(local) > 3:
        print(f"             ... and {len(local) - 3} more")
    
    print("\n🎯 FILES TO FIX - BY PRIORITY")
    print("-" * 80)
    
    if summary['remediation_priority']['CRITICAL']:
        print(f"\n🔴 CRITICAL ({len(summary['remediation_priority']['CRITICAL'])} files)")
        for item in summary['remediation_priority']['CRITICAL']:
            print(f"   {item['file']}: {item['issues']} issues")
    
    if summary['remediation_priority']['HIGH']:
        print(f"\n🟠 HIGH ({len(summary['remediation_priority']['HIGH'])} files)")
        for item in summary['remediation_priority']['HIGH'][:5]:
            print(f"   {item['file']}: {item['issues']} issues")
        if len(summary['remediation_priority']['HIGH']) > 5:
            print(f"   ... and {len(summary['remediation_priority']['HIGH']) - 5} more")
    
    if summary['remediation_priority']['MEDIUM']:
        print(f"\n🟡 MEDIUM ({len(summary['remediation_priority']['MEDIUM'])} files)")
        for item in summary['remediation_priority']['MEDIUM'][:3]:
            print(f"   {item['file']}: {item['issues']} issues")
        if len(summary['remediation_priority']['MEDIUM']) > 3:
            print(f"   ... and {len(summary['remediation_priority']['MEDIUM']) - 3} more")
    
    print("\n" + "="*80)
    print("TIME ESTIMATE FOR REMEDIATION")
    print("-" * 80)
    print("Phase 1 - Fix Broken Examples: 30-45 minutes")
    print("Phase 2 - Fix API Mismatches: 45-60 minutes")
    print("Phase 3 - Handle Missing Files: 30 minutes")
    print("Phase 4 - Validation & Report: 15-20 minutes")
    print("-" * 80)
    print("TOTAL: 2-3 hours")
    print("="*80 + "\n")

if __name__ == "__main__":
    summary = create_remediation_summary()
    
    # Save detailed summary
    with open('REMEDIATION_SUMMARY_2025-10-20.json', 'w') as f:
        json.dump(summary, f, indent=2)
    
    print_comprehensive_report(summary)
    print("✅ Detailed summary saved to: REMEDIATION_SUMMARY_2025-10-20.json\n")
