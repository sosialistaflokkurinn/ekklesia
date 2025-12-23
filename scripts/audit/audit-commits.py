#!/usr/bin/env python3
"""
Comprehensive Commit Audit Script
Analyzes commits for security and code quality issues.
"""

import subprocess
import re
import sys
from datetime import datetime
from collections import defaultdict
from typing import List, Dict, Tuple

# Security patterns to check
SECURITY_PATTERNS = {
    'hardcoded_secret': {
        'pattern': r'(password|secret|api.?key|token)\s*[:=]\s*["\'][^"\']{8,}',
        'severity': 'CRITICAL',
        'message': 'Potential hardcoded secret'
    },
    'sql_injection': {
        # Only flag f-strings passed directly to execute functions
        'pattern': r'(execute_query|execute|cursor\.execute)\s*\(\s*f["\']',
        'severity': 'CRITICAL',
        'message': 'f-string passed directly to SQL execute'
    },
    'eval_usage': {
        'pattern': r'\beval\s*\(',
        'severity': 'CRITICAL',
        'message': 'eval() usage detected'
    },
    'console_log': {
        'pattern': r'console\.log\s*\(',
        'severity': 'WARNING',
        'message': 'console.log usage (use debug module)'
    },
    'innerhtml_xss': {
        # Only flag innerHTML with template literal interpolation
        'pattern': r'\.innerHTML\s*=\s*`[^`]*\$\{',
        'severity': 'WARNING',
        'message': 'innerHTML with template interpolation (check escaping)'
    },
    'direct_firebase': {
        'pattern': r'from\s+["\']firebase',
        'severity': 'WARNING',
        'message': 'Direct Firebase import (use wrapper)'
    },
    'todo_fixme': {
        'pattern': r'(TODO|FIXME|HACK|XXX):',
        'severity': 'INFO',
        'message': 'TODO/FIXME comment'
    },
    'hardcoded_url': {
        'pattern': r'https?://[a-zA-Z0-9].*?\.(com|is|net|org)',
        'severity': 'INFO',
        'message': 'Hardcoded URL'
    },
    # Removed 'missing_rate_limit' - too many false positives, better done manually
}

# File extensions to analyze
ANALYZABLE_EXTENSIONS = {'.js', '.py', '.ts', '.jsx', '.tsx'}


def run_git_command(args: List[str]) -> str:
    """Run a git command and return output."""
    result = subprocess.run(
        ['git'] + args,
        capture_output=True,
        text=True,
        cwd='/home/gudro/Development/projects/ekklesia'
    )
    return result.stdout


def get_commits_for_date(date: str) -> List[Tuple[str, str]]:
    """Get all commits for a given date."""
    output = run_git_command([
        'log', '--oneline',
        f'--since={date} 00:00',
        f'--until={date} 23:59:59',
        '--reverse'
    ])
    commits = []
    for line in output.strip().split('\n'):
        if line:
            parts = line.split(' ', 1)
            if len(parts) == 2:
                commits.append((parts[0], parts[1]))
    return commits


def get_commit_diff(commit_hash: str) -> str:
    """Get the diff for a commit."""
    return run_git_command(['show', commit_hash, '--no-color'])


def get_changed_files(commit_hash: str) -> List[str]:
    """Get list of changed files in a commit."""
    output = run_git_command([
        'diff-tree', '--no-commit-id', '--name-only', '-r', commit_hash
    ])
    return [f for f in output.strip().split('\n') if f]


def analyze_diff(diff: str, files: List[str]) -> Dict[str, List[Dict]]:
    """Analyze a diff for security and code quality issues."""
    issues = defaultdict(list)

    # Only check added lines
    added_lines = []
    current_file = None
    line_num = 0

    for line in diff.split('\n'):
        if line.startswith('+++ b/'):
            current_file = line[6:]
            line_num = 0
        elif line.startswith('@@'):
            # Parse line number from hunk header
            match = re.search(r'\+(\d+)', line)
            if match:
                line_num = int(match.group(1)) - 1
        elif line.startswith('+') and not line.startswith('+++'):
            line_num += 1
            added_lines.append((current_file, line_num, line[1:]))
        elif not line.startswith('-'):
            line_num += 1

    # Check each added line against patterns
    for filepath, line_num, content in added_lines:
        if not filepath:
            continue

        # Skip non-code files
        ext = '.' + filepath.split('.')[-1] if '.' in filepath else ''
        if ext not in ANALYZABLE_EXTENSIONS:
            continue

        for check_name, check_info in SECURITY_PATTERNS.items():
            if re.search(check_info['pattern'], content, re.IGNORECASE):
                # Skip false positives
                if check_name == 'hardcoded_url' and any(x in content.lower() for x in ['localhost', '127.0.0.1', 'example.com']):
                    continue
                if check_name == 'console_log' and 'console.error' in content:
                    continue
                # Allow console.log in scripts/ directory and CLI migration scripts
                if check_name == 'console_log' and (
                    filepath.startswith('scripts/') or
                    'migrate-images.js' in filepath
                ):
                    continue
                # Skip innerHTML that uses escapeHTML or safe i18n interpolation
                if check_name == 'innerhtml_xss':
                    # escapeHTML is used
                    if 'escapeHTML' in content:
                        continue
                    # Only R.string or adminStrings interpolation (safe i18n)
                    if 'R.string' in content or 'adminStrings' in content or 'getString' in content:
                        continue
                    # Static HTML with no variable interpolation (spinner, icons)
                    if re.search(r'innerHTML\s*=\s*`[^$`]*`', content):
                        continue

                issues[check_info['severity']].append({
                    'check': check_name,
                    'file': filepath,
                    'line': line_num,
                    'message': check_info['message'],
                    'content': content.strip()[:100]
                })

    return dict(issues)


def generate_report(date: str, commits: List[Tuple[str, str]],
                   all_issues: Dict[str, Dict]) -> str:
    """Generate markdown audit report."""
    report = []
    report.append(f"# Daily Commit Audit Report: {date}")
    report.append(f"\nGenerated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append(f"\n## Summary")
    report.append(f"\n- **Commits Analyzed:** {len(commits)}")

    total_critical = sum(len(issues.get('CRITICAL', [])) for issues in all_issues.values())
    total_warning = sum(len(issues.get('WARNING', [])) for issues in all_issues.values())
    total_info = sum(len(issues.get('INFO', [])) for issues in all_issues.values())

    report.append(f"- **Critical Issues:** {total_critical}")
    report.append(f"- **Warnings:** {total_warning}")
    report.append(f"- **Info:** {total_info}")

    report.append("\n## Commits")
    report.append("\n| Hash | Message |")
    report.append("|------|---------|")
    for hash, msg in commits:
        report.append(f"| {hash} | {msg[:60]}{'...' if len(msg) > 60 else ''} |")

    report.append("\n---\n")

    # Detail each commit with issues
    for commit_hash, commit_msg in commits:
        issues = all_issues.get(commit_hash, {})
        report.append(f"\n### {commit_hash}: {commit_msg[:50]}")

        if not issues:
            report.append("\n**Issues:** None found")
        else:
            for severity in ['CRITICAL', 'WARNING', 'INFO']:
                if severity in issues:
                    report.append(f"\n**{severity}:**")
                    for issue in issues[severity]:
                        report.append(f"- `{issue['file']}:{issue['line']}` - {issue['message']}")
                        if issue['content']:
                            report.append(f"  ```")
                            report.append(f"  {issue['content']}")
                            report.append(f"  ```")

        report.append("")

    # Recommendations
    report.append("\n---\n")
    report.append("\n## Recommendations\n")

    if total_critical > 0:
        report.append("- **CRITICAL:** Review and fix all critical issues immediately")
    if total_warning > 0:
        report.append("- **WARNING:** Review warning-level issues before production")
    if total_info > 0:
        report.append("- **INFO:** Consider addressing info-level issues")

    if total_critical == 0 and total_warning == 0:
        report.append("- **OK:** No critical or warning issues found")

    report.append("\n\n*Generated by audit-commits.py*")

    return '\n'.join(report)


def main():
    """Main entry point."""
    date = sys.argv[1] if len(sys.argv) > 1 else datetime.now().strftime('%Y-%m-%d')

    print(f"\033[34m=== Commit Audit for {date} ===\033[0m\n")

    commits = get_commits_for_date(date)
    print(f"Found \033[36m{len(commits)}\033[0m commits\n")

    all_issues = {}

    for commit_hash, commit_msg in commits:
        print(f"\033[33mAnalyzing:\033[0m {commit_hash} {commit_msg[:50]}")

        diff = get_commit_diff(commit_hash)
        files = get_changed_files(commit_hash)
        issues = analyze_diff(diff, files)

        all_issues[commit_hash] = issues

        critical = len(issues.get('CRITICAL', []))
        warning = len(issues.get('WARNING', []))

        if critical > 0:
            print(f"  \033[31mCritical: {critical}\033[0m")
        if warning > 0:
            print(f"  \033[33mWarning: {warning}\033[0m")
        if critical == 0 and warning == 0:
            print(f"  \033[32mOK\033[0m")

    # Generate report
    report = generate_report(date, commits, all_issues)

    # Save report
    report_dir = '/home/gudro/Development/projects/ekklesia/tmp/audit-reports'
    subprocess.run(['mkdir', '-p', report_dir])
    report_file = f'{report_dir}/audit-{date}.md'

    with open(report_file, 'w') as f:
        f.write(report)

    print(f"\n\033[32mReport saved to:\033[0m {report_file}")

    # Summary
    total_critical = sum(len(issues.get('CRITICAL', [])) for issues in all_issues.values())
    total_warning = sum(len(issues.get('WARNING', [])) for issues in all_issues.values())

    print(f"\n\033[34m=== Summary ===\033[0m")
    print(f"Commits: {len(commits)}")
    print(f"Critical: \033[31m{total_critical}\033[0m")
    print(f"Warnings: \033[33m{total_warning}\033[0m")

    # Exit with error if critical issues
    if total_critical > 0:
        sys.exit(1)


if __name__ == '__main__':
    main()
