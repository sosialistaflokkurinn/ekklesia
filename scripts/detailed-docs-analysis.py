#!/usr/bin/env python3
"""
Detailed Documentation Analysis
Provides deeper insights into documentation health
"""

import os
import re
import json
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
from datetime import datetime

def analyze_file(md_file: Path) -> Optional[Dict[str, Any]]:
    """Analyze a single markdown file in detail"""
    try:
        with open(md_file, 'r') as f:
            content = f.read()
            lines = content.split('\n')
    except (OSError, IOError) as e:
        return None
    
    analysis = {
        "file": str(md_file.relative_to(Path("/home/gudro/Development/projects/ekklesia"))),
        "size_bytes": os.path.getsize(md_file),
        "line_count": len(lines),
        "issues": [],
        "status": "HEALTHY"
    }
    
    # Check for actual placeholders (not in code blocks)
    in_code_block = False
    actual_placeholders = []
    
    for i, line in enumerate(lines, 1):
        if line.strip().startswith('```'):
            in_code_block = not in_code_block
            continue
        
        if not in_code_block:
            # Check for TODO, TBD, FIXME outside code blocks
            if any(x in line for x in ['TODO', 'TBD', 'FIXME', 'XXX']):
                actual_placeholders.append({
                    "line": i,
                    "content": line.strip()[:80],
                    "type": "actual_placeholder"
                })
    
    if actual_placeholders:
        analysis["issues"].extend(actual_placeholders)
        analysis["status"] = "HAS_PLACEHOLDERS"
    
    # Check file references
    references = re.findall(r'`([a-zA-Z0-9/_.-]+\.[a-zA-Z]{1,4})`', content)
    analysis["file_references"] = len(references)
    
    # Check function references
    functions = re.findall(r'`(\w+)\(`', content)
    analysis["function_references"] = len(functions)
    
    # Check links
    links = re.findall(r'\[([^\]]+)\]\(([^)]+)\)', content)
    analysis["internal_links"] = len([l for l in links if not l[1].startswith('http')])
    analysis["external_links"] = len([l for l in links if l[1].startswith('http')])
    
    # Check headers
    headers = re.findall(r'^#+\s+', content, re.MULTILINE)
    analysis["headers"] = len(headers)
    
    return analysis

def main() -> None:
    """Main entry point for detailed documentation analysis."""
    docs_dir = Path("/home/gudro/Development/projects/ekklesia/docs")
    md_files = sorted(docs_dir.rglob("*.md"))
    
    print(f"\n📊 Detailed Documentation Analysis\n")
    print(f"Total files: {len(md_files)}\n")
    
    analyses = []
    healthy = 0
    with_placeholders = 0
    
    for md_file in md_files:
        analysis = analyze_file(md_file)
        if analysis:
            analyses.append(analysis)
            if analysis["status"] == "HEALTHY":
                healthy += 1
            elif analysis["status"] == "HAS_PLACEHOLDERS":
                with_placeholders += 1
    
    print(f"✅ Healthy files: {healthy}")
    print(f"⚠️  Files with placeholders: {with_placeholders}")
    print(f"📦 Total size: {sum(a['size_bytes'] for a in analyses) / 1024:.1f} KB")
    print(f"📝 Total lines: {sum(a['line_count'] for a in analyses)}")
    
    # Save detailed analysis
    output = Path("/home/gudro/Development/projects/ekklesia/docs/audits/audit-2025-10-21/DETAILED_ANALYSIS.json")
    with open(output, 'w') as f:
        json.dump(analyses, f, indent=2)
    
    print(f"\n📄 Detailed analysis saved to: {output}")
    
    # Print files with placeholders
    placeholder_files = [a for a in analyses if a["status"] == "HAS_PLACEHOLDERS"]
    if placeholder_files:
        print(f"\n⚠️  Files with placeholders:\n")
        for pf in placeholder_files:
            print(f"  - {pf['file']}")
            for issue in pf['issues'][:2]:
                print(f"    Line {issue['line']}: {issue['content']}")

if __name__ == "__main__":
    main()
