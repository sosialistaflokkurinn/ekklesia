#!/usr/bin/env python3
"""
Analyze Markdown Metadata Insights
Find patterns, issues, and interesting conclusions
"""

import json
from pathlib import Path
from collections import defaultdict

INVENTORY_FILE = Path("/home/gudro/Development/projects/ekklesia/.metadata_store/md_inventory.json")

def load_inventory():
    with open(INVENTORY_FILE) as f:
        return json.load(f)

def main():
    inventory = load_inventory()
    
    print("# Markdown Analysis - Insights & Conclusions")
    print("=" * 60)
    
    # 1. Size Analysis
    print("\n## 📏 Size Distribution")
    small = [f for f in inventory if f['stats']['size_bytes'] < 5000]
    medium = [f for f in inventory if 5000 <= f['stats']['size_bytes'] < 50000]
    large = [f for f in inventory if 50000 <= f['stats']['size_bytes'] < 200000]
    very_large = [f for f in inventory if f['stats']['size_bytes'] >= 200000]
    
    print(f"  Small (<5KB):      {len(small):3d} files ({len(small)/len(inventory)*100:.1f}%)")
    print(f"  Medium (5-50KB):   {len(medium):3d} files ({len(medium)/len(inventory)*100:.1f}%)")
    print(f"  Large (50-200KB):  {len(large):3d} files ({len(large)/len(inventory)*100:.1f}%)")
    print(f"  Very Large (>200KB): {len(very_large):3d} files ({len(very_large)/len(inventory)*100:.1f}%)")
    
    # Top 10 largest
    print("\n  📦 Top 10 Largest Files:")
    sorted_by_size = sorted(inventory, key=lambda x: x['stats']['size_bytes'], reverse=True)[:10]
    for f in sorted_by_size:
        size_kb = f['stats']['size_bytes'] / 1024
        print(f"    {size_kb:6.1f} KB - {f['filepath']}")
    
    # 2. Documentation Structure Quality
    print("\n## 🏗️  Documentation Structure Quality")
    
    # Files without H1
    no_h1 = [f for f in inventory if not f['structure']['has_h1']]
    print(f"  Files without H1:  {len(no_h1)} files ({len(no_h1)/len(inventory)*100:.1f}%)")
    
    # Files with good structure (h1, h2, h3)
    good_structure = [f for f in inventory if 
                      f['structure']['has_h1'] and 
                      2 in f['structure']['headings'] and
                      f['structure']['total_headings'] >= 3]
    print(f"  Well-structured:   {len(good_structure)} files ({len(good_structure)/len(inventory)*100:.1f}%)")
    
    # Files with no headings at all
    no_headings = [f for f in inventory if f['structure']['total_headings'] == 0]
    print(f"  No headings:       {len(no_headings)} files ({len(no_headings)/len(inventory)*100:.1f}%)")
    
    # Average headings per file
    avg_headings = sum(f['structure']['total_headings'] for f in inventory) / len(inventory)
    print(f"  Avg headings/file: {avg_headings:.1f}")
    
    # 3. Code Documentation Ratio
    print("\n## 💻 Code Documentation Ratio")
    
    # Files with code blocks
    has_code = [f for f in inventory if f['content']['code_blocks'] > 0]
    print(f"  Files with code:   {len(has_code)} files ({len(has_code)/len(inventory)*100:.1f}%)")
    
    # Average code blocks per file
    avg_code_blocks = sum(f['content']['code_blocks'] for f in inventory) / len(inventory)
    print(f"  Avg code blocks:   {avg_code_blocks:.1f} per file")
    
    # Top 10 most code-heavy files
    print("\n  🔬 Top 10 Most Code-Heavy Files:")
    sorted_by_code = sorted(inventory, key=lambda x: x['content']['code_blocks'], reverse=True)[:10]
    for f in sorted_by_code:
        print(f"    {f['content']['code_blocks']:3d} blocks - {f['filepath']}")
    
    # 4. TODO Analysis
    print("\n## ✅ TODO Analysis")
    
    has_todos = [f for f in inventory if f['todos']['total'] > 0]
    unchecked_todos = sum(f['todos']['unchecked'] for f in inventory)
    checked_todos = sum(f['todos']['checked'] for f in inventory)
    total_todos = unchecked_todos + checked_todos
    
    if total_todos > 0:
        completion_rate = (checked_todos / total_todos) * 100
    else:
        completion_rate = 0
    
    print(f"  Files with TODOs:  {len(has_todos)} files ({len(has_todos)/len(inventory)*100:.1f}%)")
    print(f"  Total TODOs:       {total_todos}")
    print(f"  Unchecked:         {unchecked_todos} ({unchecked_todos/total_todos*100:.1f}%)")
    print(f"  Checked:           {checked_todos} ({checked_todos/total_todos*100:.1f}%)")
    print(f"  Completion rate:   {completion_rate:.1f}%")
    
    # Top 10 files with most TODOs
    print("\n  📝 Top 10 Files with Most TODOs:")
    sorted_by_todos = sorted(inventory, key=lambda x: x['todos']['total'], reverse=True)[:10]
    for f in sorted_by_todos:
        unchecked = f['todos']['unchecked']
        total = f['todos']['total']
        print(f"    {total:3d} TODOs ({unchecked} unchecked) - {f['filepath']}")
    
    # 5. Link Analysis
    print("\n## 🔗 Link Analysis")
    
    has_links = [f for f in inventory if f['links']['total'] > 0]
    internal_links = sum(f['links']['internal'] for f in inventory)
    external_links = sum(f['links']['external'] for f in inventory)
    total_links = internal_links + external_links
    
    print(f"  Files with links:  {len(has_links)} files ({len(has_links)/len(inventory)*100:.1f}%)")
    print(f"  Total links:       {total_links}")
    print(f"  Internal:          {internal_links} ({internal_links/total_links*100 if total_links > 0 else 0:.1f}%)")
    print(f"  External:          {external_links} ({external_links/total_links*100 if total_links > 0 else 0:.1f}%)")
    
    # 6. Content Type Distribution
    print("\n## 📊 Content Type Distribution")
    
    has_tables = [f for f in inventory if f['content']['table_rows'] > 0]
    has_lists = [f for f in inventory if f['content']['list_items'] > 0]
    has_images = [f for f in inventory if f['content']['images'] > 0]
    has_frontmatter = [f for f in inventory if f['content']['has_frontmatter']]
    
    print(f"  Tables:            {len(has_tables)} files ({len(has_tables)/len(inventory)*100:.1f}%)")
    print(f"  Lists:             {len(has_lists)} files ({len(has_lists)/len(inventory)*100:.1f}%)")
    print(f"  Images:            {len(has_images)} files ({len(has_images)/len(inventory)*100:.1f}%)")
    print(f"  Frontmatter:       {len(has_frontmatter)} files ({len(has_frontmatter)/len(inventory)*100:.1f}%)")
    
    # 7. Category Insights
    print("\n## 📁 Category Insights")
    
    # Average size by category
    by_category = defaultdict(list)
    for f in inventory:
        by_category[f['category']].append(f)
    
    print("\n  Average Size by Category (top 10):")
    cat_avg_size = []
    for cat, files in by_category.items():
        avg = sum(f['stats']['size_bytes'] for f in files) / len(files) / 1024
        cat_avg_size.append((cat, avg, len(files)))
    
    cat_avg_size.sort(key=lambda x: x[1], reverse=True)
    for cat, avg_kb, count in cat_avg_size[:10]:
        print(f"    {avg_kb:6.1f} KB avg - {cat} ({count} files)")
    
    # 8. Documentation Quality Issues
    print("\n## ⚠️  Potential Documentation Issues")
    
    # Large files without structure
    large_no_structure = [f for f in inventory if 
                          f['stats']['line_count'] > 100 and 
                          f['structure']['total_headings'] < 3]
    print(f"  Large files with poor structure: {len(large_no_structure)}")
    if large_no_structure[:5]:
        for f in large_no_structure[:5]:
            print(f"    - {f['filepath']} ({f['stats']['line_count']} lines, {f['structure']['total_headings']} headings)")
    
    # Files with many TODOs (>20)
    todo_heavy = [f for f in inventory if f['todos']['unchecked'] > 20]
    print(f"\n  Files with >20 unchecked TODOs:  {len(todo_heavy)}")
    if todo_heavy[:5]:
        for f in todo_heavy[:5]:
            print(f"    - {f['filepath']} ({f['todos']['unchecked']} TODOs)")
    
    # Empty or nearly empty files
    nearly_empty = [f for f in inventory if f['stats']['line_count'] < 10]
    print(f"\n  Nearly empty files (<10 lines):  {len(nearly_empty)}")
    if nearly_empty[:5]:
        for f in nearly_empty[:5]:
            print(f"    - {f['filepath']} ({f['stats']['line_count']} lines)")
    
    # 9. Documentation Age Analysis
    print("\n## 📅 Documentation Freshness")
    
    from datetime import datetime, timedelta
    now = datetime.now()
    
    recent = [f for f in inventory if 
              (now - datetime.fromisoformat(f['stats']['last_modified'])).days < 30]
    old = [f for f in inventory if 
           (now - datetime.fromisoformat(f['stats']['last_modified'])).days > 180]
    
    print(f"  Modified in last 30 days:   {len(recent)} files ({len(recent)/len(inventory)*100:.1f}%)")
    print(f"  Not modified in 180+ days:  {len(old)} files ({len(old)/len(inventory)*100:.1f}%)")
    
    # 10. Key Conclusions
    print("\n" + "=" * 60)
    print("## 🎯 KEY CONCLUSIONS")
    print("=" * 60)
    
    print("\n1. DOCUMENTATION VOLUME")
    print(f"   - {len(inventory)} markdown files with {sum(f['stats']['line_count'] for f in inventory):,} lines")
    print(f"   - Average {sum(f['stats']['line_count'] for f in inventory) / len(inventory):.0f} lines per file")
    
    print("\n2. CODE DOCUMENTATION")
    print(f"   - {len(has_code)/len(inventory)*100:.0f}% of docs contain code examples")
    print(f"   - {avg_code_blocks:.1f} code blocks per file on average")
    print(f"   - Very code-heavy documentation (excellent for technical docs)")
    
    print("\n3. STRUCTURE QUALITY")
    print(f"   - {len(good_structure)/len(inventory)*100:.0f}% well-structured")
    print(f"   - {len(no_h1)/len(inventory)*100:.0f}% missing H1 (should be fixed)")
    print(f"   - {len(no_headings)} files have no headings at all")
    
    print("\n4. TODO TRACKING")
    print(f"   - {total_todos} TODOs tracked in documentation")
    print(f"   - {completion_rate:.0f}% completion rate")
    print(f"   - {unchecked_todos} unchecked items remaining")
    
    print("\n5. DOCUMENTATION HEALTH")
    if len(nearly_empty) > 10:
        print(f"   ⚠️  {len(nearly_empty)} nearly empty files (cleanup candidate)")
    if len(large_no_structure) > 20:
        print(f"   ⚠️  {len(large_no_structure)} large files need better structure")
    if len(old) > len(inventory) * 0.3:
        print(f"   ⚠️  {len(old)/len(inventory)*100:.0f}% of docs are >6 months old")
    if len(recent) > 50:
        print(f"   ✅ Active documentation ({len(recent)} recent updates)")
    
    print("\n6. CATEGORY INSIGHTS")
    print(f"   - Most docs in: {max(by_category.items(), key=lambda x: len(x[1]))[0]}")
    print(f"   - Largest category: {max(cat_avg_size, key=lambda x: x[1])[0]}")

if __name__ == '__main__':
    main()
