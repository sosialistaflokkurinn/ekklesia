#!/usr/bin/env python3
"""
Link Validation Script for Documentation

Validates internal cross-references in all markdown files in /docs directory.
Checks for:
1. Internal links to other markdown files
2. Links to code files
3. Links to images and assets
4. Anchor references

Usage: 
    python3 validate_links.py
    python3 validate_links.py --exclude audits archive
"""

import argparse
import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Tuple

class LinkValidator:
    def __init__(self, docs_root: str, exclude_dirs: List[str] = None):
        self.docs_root = Path(docs_root)
        self.exclude_dirs = exclude_dirs or []
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.files_checked = 0
        self.links_checked = 0
        self.external_links = []
        
    def validate_all(self) -> Tuple[int, int, int]:
        """Validate all markdown files in docs directory"""
        print("🔍 Starting link validation...\n")
        
        # Get all markdown files
        all_md_files = list(self.docs_root.rglob("*.md"))
        
        # Filter out excluded directories
        md_files = []
        for md_file in all_md_files:
            # Check if file is in any excluded directory
            try:
                relative_path = md_file.relative_to(self.docs_root)
                parts = relative_path.parts
                if not any(excluded in parts for excluded in self.exclude_dirs):
                    md_files.append(md_file)
            except ValueError:
                # File is outside docs_root, skip it
                continue
        print(f"📄 Found {len(md_files)} markdown files")
        
        for md_file in sorted(md_files):
            self.validate_file(md_file)
        
        self.print_report()
        return len(self.errors), len(self.warnings), self.links_checked
    
    def validate_file(self, file_path: Path) -> List:
        """Validate all links in a single markdown file"""
        self.files_checked += 1
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            self.errors.append(f"❌ Cannot read {file_path}: {e}")
            return
        
        # Find all markdown links: [text](path) or [text](url)
        link_pattern = r'\[([^\]]+)\]\(([^)]+)\)'
        links = re.findall(link_pattern, content)
        
        for text, link in links:
            self.links_checked += 1
            self.validate_link(file_path, link, text)
    
    def validate_link(self, from_file: Path, link: str, text: str) -> List:
        """Validate a single link"""
        # Skip external links
        if link.startswith('http://') or link.startswith('https://'):
            self.external_links.append(link)
            return
        
        # Skip anchors, emails, and other non-file references
        if link.startswith('#') or link.startswith('mailto:'):
            return
        
        # Extract file path and anchor
        if '#' in link:
            file_part, anchor = link.split('#', 1)
        else:
            file_part = link
            anchor = None
        
        # Skip empty file parts
        if not file_part:
            if anchor:  # Just an anchor reference (valid for same file)
                return
            self.warnings.append(f"⚠️  {from_file}: Empty link reference in '[{text}]()'")
            return
        
        # Resolve file path
        # Handle repository-root-relative paths (starting with /)
        if file_part.startswith('/'):
            # Path is relative to repository root
            repo_root = self.docs_root.parent  # Parent of /docs is repo root
            target_file = (repo_root / file_part.lstrip('/')).resolve()
        else:
            # Path is relative to current file
            target_file = (from_file.parent / file_part).resolve()
        
        # Check if file exists
        if not target_file.exists():
            # Try without extension if it's a markdown file
            if target_file.with_suffix('.md').exists():
                target_file = target_file.with_suffix('.md')
            else:
                try:
                    relative_path = target_file.relative_to(self.docs_root.parent)
                except ValueError:
                    # File is outside workspace, show full path
                    relative_path = target_file
                self.errors.append(
                    f"❌ {from_file.relative_to(self.docs_root.parent)}: "
                    f"Link '[{text}]({link})' -> File not found: {relative_path}"
                )
                return
        
        # Check anchor if specified
        if anchor:
            try:
                with open(target_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Look for heading or anchor with this ID
                anchor_pattern = rf'(^#{1,6}\s+.*{re.escape(anchor)}|id="{re.escape(anchor)}")'
                if not re.search(anchor_pattern, content, re.MULTILINE | re.IGNORECASE):
                    # Try normalized anchor (spaces to hyphens)
                    normalized_anchor = anchor.replace('_', '-').lower()
                    if normalized_anchor not in content.lower():
                        self.warnings.append(
                            f"⚠️  {from_file.relative_to(self.docs_root.parent)}: "
                            f"Anchor '#{anchor}' not found in {target_file.name}"
                        )
            except Exception as e:
                self.warnings.append(f"⚠️  Cannot read {target_file} for anchor validation: {e}")
    
    def print_report(self) -> None:
        """Print validation report"""
        print("\n" + "="*70)
        print("📊 LINK VALIDATION REPORT")
        print("="*70)
        
        print(f"\n📈 Statistics:")
        print(f"   Files checked: {self.files_checked}")
        print(f"   Links validated: {self.links_checked}")
        print(f"   External links found: {len(set(self.external_links))}")
        print(f"   Errors: {len(self.errors)}")
        print(f"   Warnings: {len(self.warnings)}")
        
        if self.external_links:
            print(f"\n🌐 External Links ({len(set(self.external_links))} unique):")
            for link in sorted(set(self.external_links)):
                print(f"   {link}")
        
        if self.errors:
            print(f"\n❌ Errors ({len(self.errors)}):")
            for error in self.errors:
                print(f"   {error}")
        
        if self.warnings:
            print(f"\n⚠️  Warnings ({len(self.warnings)}):")
            for warning in self.warnings:
                print(f"   {warning}")
        
        if not self.errors and not self.warnings:
            print("\n✅ All links valid!")
        
        print("\n" + "="*70)
        
        # Exit with error code if issues found
        sys.exit(len(self.errors))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Validate internal links in documentation markdown files',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  # Validate all documentation
  python3 validate_links.py
  
  # Exclude specific directories
  python3 validate_links.py --exclude audits archive
  
  # Exclude historical and archived docs
  python3 validate_links.py --exclude audits/historical archive
        '''
    )
    parser.add_argument(
        '--exclude',
        nargs='+',
        default=['audits', 'archive'],  # Exclude historical/archived docs by default
        metavar='DIR',
        help='Directories to exclude from validation (default: audits archive)'
    )
    
    args = parser.parse_args()
    
    docs_path = '/home/gudro/Development/projects/ekklesia/docs'
    validator = LinkValidator(docs_path, exclude_dirs=args.exclude)
    errors, warnings, links = validator.validate_all()
