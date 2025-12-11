#!/usr/bin/env python3
"""
TODO Health Check Script

Monitors TODO health across markdown files using md_inventory.json metadata.
Reports completion rates, stale files, and actionable recommendations.

Usage:
    python3 scripts/maintenance/check_todo_health.py
    python3 scripts/maintenance/check_todo_health.py --verbose
    python3 scripts/maintenance/check_todo_health.py --category docs/development
"""

import json
import sys
from pathlib import Path
from datetime import datetime, timedelta
from collections import defaultdict

# Configuration
INVENTORY_FILE = Path(__file__).parent.parent.parent / ".metadata_store" / "md_inventory.json"
STALE_DAYS = 90  # Consider TODOs stale if file not modified in 90+ days
HIGH_TODO_THRESHOLD = 20  # Files with >20 TODOs are "TODO-heavy"

# ANSI color codes
class Colors:
    RED = '\033[91m'
    YELLOW = '\033[93m'
    GREEN = '\033[92m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'

def load_inventory():
    """Load markdown inventory from JSON file."""
    if not INVENTORY_FILE.exists():
        print(f"{Colors.RED}Error: Inventory file not found: {INVENTORY_FILE}{Colors.END}")
        print(f"Run: python3 scripts/maintenance/analyze_md_metadata.py")
        sys.exit(1)

    with open(INVENTORY_FILE, 'r') as f:
        return json.load(f)

def days_since_modified(file_data):
    """Calculate days since file was last modified."""
    last_modified = datetime.fromisoformat(file_data['stats']['last_modified'])
    return (datetime.now() - last_modified).days

def print_header(title):
    """Print a formatted section header."""
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'=' * 70}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{title}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'=' * 70}{Colors.END}\n")

def print_metric(label, value, unit="", color=Colors.BLUE):
    """Print a formatted metric."""
    print(f"  {color}{label}:{Colors.END} {Colors.BOLD}{value}{unit}{Colors.END}")

def check_todo_health(category_filter=None, verbose=False):
    """Main TODO health check function."""
    inventory = load_inventory()

    # Filter by category if specified
    if category_filter:
        inventory = [f for f in inventory if f['category'] == category_filter]
        if not inventory:
            print(f"{Colors.YELLOW}No files found in category: {category_filter}{Colors.END}")
            return

    # Calculate overall stats
    files_with_todos = [f for f in inventory if f['todos']['total'] > 0]
    total_todos = sum(f['todos']['total'] for f in inventory)
    unchecked_todos = sum(f['todos']['unchecked'] for f in inventory)
    checked_todos = sum(f['todos']['checked'] for f in inventory)

    if total_todos > 0:
        completion_rate = (checked_todos / total_todos) * 100
    else:
        completion_rate = 0

    # Print overall summary
    print_header("📊 TODO Health Summary")
    print_metric("Total markdown files analyzed", len(inventory))
    print_metric("Files with TODOs", len(files_with_todos))
    print_metric("Total TODOs", total_todos)
    print_metric("Unchecked TODOs", unchecked_todos, color=Colors.YELLOW)
    print_metric("Checked TODOs", checked_todos, color=Colors.GREEN)
    print_metric("Completion rate", f"{completion_rate:.1f}", "%",
                 Colors.GREEN if completion_rate > 30 else Colors.YELLOW if completion_rate > 10 else Colors.RED)

    # Problem areas
    print_header("⚠️  Problem Areas")

    # 1. Stale TODO files (not modified in 90+ days with unchecked TODOs)
    stale_files = [f for f in inventory
                   if f['todos']['unchecked'] > 0
                   and days_since_modified(f) > STALE_DAYS]

    print_metric("Stale TODO files (90+ days old)", len(stale_files),
                 color=Colors.RED if len(stale_files) > 10 else Colors.YELLOW)

    if verbose and stale_files:
        print(f"\n  {Colors.YELLOW}Top 5 stale files:{Colors.END}")
        for f in sorted(stale_files, key=lambda x: days_since_modified(x), reverse=True)[:5]:
            days = days_since_modified(f)
            unchecked = f['todos']['unchecked']
            print(f"    • {f['filepath']}")
            print(f"      {days} days old, {unchecked} unchecked TODOs")

    # 2. TODO-heavy files with 0% completion
    zero_completion = [f for f in inventory
                       if f['todos']['total'] > HIGH_TODO_THRESHOLD
                       and f['todos']['checked'] == 0]

    print_metric("TODO-heavy files (>20 TODOs, 0% done)", len(zero_completion),
                 color=Colors.RED if len(zero_completion) > 5 else Colors.YELLOW)

    if verbose and zero_completion:
        print(f"\n  {Colors.RED}Files needing immediate attention:{Colors.END}")
        for f in sorted(zero_completion, key=lambda x: x['todos']['total'], reverse=True)[:5]:
            total = f['todos']['total']
            print(f"    • {f['filepath']}")
            print(f"      {total} TODOs, 0% complete")

    # 3. Files with >50 TODOs (overwhelmingly large)
    overwhelming = [f for f in inventory if f['todos']['total'] > 50]

    print_metric("Overwhelming files (>50 TODOs)", len(overwhelming),
                 color=Colors.RED if len(overwhelming) > 3 else Colors.YELLOW)

    if overwhelming:
        print(f"\n  {Colors.RED}🔥 Critical: These files need splitting:{Colors.END}")
        for f in sorted(overwhelming, key=lambda x: x['todos']['total'], reverse=True):
            total = f['todos']['total']
            checked = f['todos']['checked']
            completion = (checked / total * 100) if total > 0 else 0
            print(f"    • {f['filepath']}")
            print(f"      {total} TODOs ({completion:.0f}% complete)")

    # Completion rates by category
    print_header("📁 Completion Rates by Category")

    by_category = defaultdict(lambda: {'files': 0, 'total': 0, 'checked': 0, 'unchecked': 0})
    for f in inventory:
        if f['todos']['total'] > 0:
            cat = f['category']
            by_category[cat]['files'] += 1
            by_category[cat]['total'] += f['todos']['total']
            by_category[cat]['checked'] += f['todos']['checked']
            by_category[cat]['unchecked'] += f['todos']['unchecked']

    # Sort by unchecked count
    sorted_categories = sorted(by_category.items(),
                               key=lambda x: x[1]['unchecked'],
                               reverse=True)

    for cat, stats in sorted_categories[:10]:
        completion = (stats['checked'] / stats['total'] * 100) if stats['total'] > 0 else 0
        color = Colors.GREEN if completion > 30 else Colors.YELLOW if completion > 10 else Colors.RED

        print(f"\n  {Colors.BOLD}{cat}{Colors.END} ({stats['files']} files)")
        print(f"    Total: {stats['total']} TODOs")
        print(f"    Unchecked: {color}{stats['unchecked']}{Colors.END}")
        print(f"    Completion: {color}{completion:.1f}%{Colors.END}")

    # Best performers
    print_header("✅ Best Performers (>30% Completion)")

    good_files = [f for f in inventory
                  if f['todos']['total'] > 5
                  and (f['todos']['checked'] / f['todos']['total']) > 0.3]

    if good_files:
        for f in sorted(good_files,
                        key=lambda x: (x['todos']['checked'] / x['todos']['total']),
                        reverse=True)[:5]:
            total = f['todos']['total']
            checked = f['todos']['checked']
            completion = (checked / total * 100)
            print(f"\n  {Colors.GREEN}• {f['filepath']}{Colors.END}")
            print(f"    {checked}/{total} TODOs complete ({completion:.0f}%)")
    else:
        print(f"  {Colors.YELLOW}No files with >30% completion rate yet{Colors.END}")

    # Actionable recommendations
    print_header("💡 Actionable Recommendations")

    recommendations = []

    if len(zero_completion) > 0:
        recommendations.append({
            'priority': '🔴 HIGH',
            'action': f'Review {len(zero_completion)} TODO-heavy files with 0% completion',
            'impact': 'Mark completed items, archive obsolete, prioritize remaining'
        })

    if len(overwhelming) > 0:
        recommendations.append({
            'priority': '🔴 HIGH',
            'action': f'Split {len(overwhelming)} overwhelming files (>50 TODOs)',
            'impact': 'See docs/standards/CHECKLIST_SPLITTING_RECOMMENDATIONS.md'
        })

    if len(stale_files) > 10:
        recommendations.append({
            'priority': '🟡 MEDIUM',
            'action': f'Review {len(stale_files)} stale files (90+ days old)',
            'impact': 'Archive completed work, defer or delete obsolete TODOs'
        })

    if completion_rate < 20:
        recommendations.append({
            'priority': '🟡 MEDIUM',
            'action': 'Focus on quick wins - mark completed TODOs',
            'impact': f'Target: Increase from {completion_rate:.1f}% → 30% in 2 weeks'
        })

    if not recommendations:
        recommendations.append({
            'priority': '✅ GOOD',
            'action': 'TODO health is reasonable',
            'impact': 'Continue regular maintenance'
        })

    for i, rec in enumerate(recommendations, 1):
        print(f"\n  {rec['priority']} {i}. {rec['action']}")
        print(f"      Impact: {rec['impact']}")

    # Summary score
    print_header("📈 TODO Health Score")

    # Calculate score (0-100)
    score = 0

    # Completion rate (0-40 points)
    score += min(completion_rate, 40)

    # Fewer stale files is better (0-20 points)
    stale_ratio = len(stale_files) / len(files_with_todos) if files_with_todos else 0
    score += max(0, 20 - (stale_ratio * 100))

    # Fewer zero-completion files (0-20 points)
    zero_ratio = len(zero_completion) / len(files_with_todos) if files_with_todos else 0
    score += max(0, 20 - (zero_ratio * 100))

    # Fewer overwhelming files (0-20 points)
    overwhelming_ratio = len(overwhelming) / len(files_with_todos) if files_with_todos else 0
    score += max(0, 20 - (overwhelming_ratio * 200))

    score = max(0, min(100, score))

    if score >= 80:
        color = Colors.GREEN
        grade = "A - Excellent"
    elif score >= 60:
        color = Colors.BLUE
        grade = "B - Good"
    elif score >= 40:
        color = Colors.YELLOW
        grade = "C - Needs Improvement"
    else:
        color = Colors.RED
        grade = "D - Critical"

    print(f"\n  {color}{Colors.BOLD}Score: {score:.0f}/100{Colors.END}")
    print(f"  {color}{Colors.BOLD}Grade: {grade}{Colors.END}\n")

    # Footer
    print(f"{Colors.CYAN}{'=' * 70}{Colors.END}")
    print(f"\nFor cleanup strategy, see: {Colors.BOLD}docs/standards/TODO_CLEANUP_STRATEGY.md{Colors.END}")
    print(f"For splitting recommendations, see: {Colors.BOLD}docs/standards/CHECKLIST_SPLITTING_RECOMMENDATIONS.md{Colors.END}\n")

def main():
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Check TODO health across markdown documentation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 scripts/maintenance/check_todo_health.py
  python3 scripts/maintenance/check_todo_health.py --verbose
  python3 scripts/maintenance/check_todo_health.py --category docs/development
        """
    )

    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Show detailed information about problem files')
    parser.add_argument('--category', '-c', type=str,
                        help='Filter by category (e.g., docs/development)')

    args = parser.parse_args()

    try:
        check_todo_health(category_filter=args.category, verbose=args.verbose)
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}Interrupted by user{Colors.END}")
        sys.exit(130)
    except Exception as e:
        print(f"{Colors.RED}Error: {e}{Colors.END}")
        sys.exit(1)

if __name__ == '__main__':
    main()
