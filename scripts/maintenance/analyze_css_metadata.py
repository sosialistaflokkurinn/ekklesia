"""
CSS Metadata Analyzer

Analyzes CSS files for hardcoded values (colors, spacing, typography)
to enforce design system consistency.
"""
import os
import re

def analyze_css_files(root_dir):
    css_files = []
    for root, dirs, files in os.walk(root_dir):
        for file in files:
            if file.endswith(".css"):
                css_files.append(os.path.join(root, file))

    hardcoded_patterns = {
        "font-size": r"font-size:\s*(?![var|inherit])\d+(?:px|rem|em|%);",
        "font-weight": r"font-weight:\s*(?![var|inherit])\d+;",
        "line-height": r"line-height:\s*(?![var|inherit])[\d\.]+(?!;);",
        "letter-spacing": r"letter-spacing:\s*(?![var|inherit])[\d\.]+(?:px|em|rem);",
        "color": r"color:\s*(?!var\()(#|rgb|hsl)[^;]+;",
        "background-color": r"background-color:\s*(?!var\()(#|rgb|hsl)[^;]+;",
        "border-color": r"border-color:\s*(?!var\()(#|rgb|hsl)[^;]+;",
        "margin": r"margin(?:-[a-z]+)?:\s*(?!var\()(?![0auto\s]+;)\d+(?:px|rem|em);",
        "padding": r"padding(?:-[a-z]+)?:\s*(?!var\()(?![0\s]+;)\d+(?:px|rem|em);"
    }

    results = {}
    total_hardcoded = 0

    for file_path in css_files:
        with open(file_path, 'r') as f:
            content = f.read()
            
        file_results = {}
        has_issues = False
        for prop, pattern in hardcoded_patterns.items():
            matches = re.findall(pattern, content)
            if matches:
                file_results[prop] = len(matches)
                total_hardcoded += len(matches)
                has_issues = True
        
        if has_issues:
            results[file_path] = file_results

    print(f"Total hardcoded properties found: {total_hardcoded}")
    for file_path, issues in results.items():
        print(f"\n{file_path}:")
        for prop, count in issues.items():
            print(f"  {prop}: {count}")

if __name__ == "__main__":
    from pathlib import Path
    # Determine the project root relative to this script
    # Script location: scripts/maintenance/analyze_css_metadata.py
    current_dir = Path(__file__).resolve().parent
    project_root = current_dir.parent.parent
    target_dir = project_root / "apps" / "members-portal"
    
    if not target_dir.exists():
        print(f"Error: Target directory not found: {target_dir}")
        exit(1)
        
    print(f"Analyzing CSS files in: {target_dir}")
    analyze_css_files(str(target_dir))