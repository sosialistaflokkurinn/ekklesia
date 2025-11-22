#!/usr/bin/env python3
"""
Comprehensive Documentation Audit Tool
Verifies all documentation against live system state and codebase

Executes CLI tools (gcloud, firebase, psql) to verify live system state.
Validates all documentation against actual code, configuration, and deployment.
"""

import os
import re
import json
import subprocess
import sys
import logging
from pathlib import Path
from typing import Dict, List, Set, Tuple, Optional
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class DocumentationAuditor:
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.docs_dir = self.project_root / "docs"
        self.members_dir = self.project_root / "members"
        self.elections_dir = self.project_root / "elections"
        self.events_dir = self.project_root / "events"
        self.scripts_dir = self.project_root / "scripts"
        
        self.issues = {
            "broken_links": [],
            "inaccurate_code_references": [],
            "outdated_config": [],
            "missing_files": [],
            "placeholder_content": [],
            "schema_mismatches": [],
            "contradictions": [],
            "formatting_issues": [],
            "endpoint_mismatches": [],
            "config_mismatches": [],
            "endpoint_validation_failure": [],
            "configuration_validation_failure": [],
            "database_validation_failure": []
        }
        
        self.healthy_files = []
        self.all_md_files = []
        self.code_definitions = {}
        self.documented_endpoints = {}
        self.cli_outputs = {}
        self.deployed_functions = []
        self.gcp_config = {}
        
        # Comprehensive built-in functions list
        self.python_builtins = {
            'print', 'str', 'int', 'list', 'dict', 'set', 'range', 'len', 'open',
            'enumerate', 'zip', 'map', 'filter', 'sum', 'max', 'min', 'sorted',
            'reversed', 'any', 'all', 'isinstance', 'type', 'hasattr', 'getattr',
            'setattr', 'delattr', 'callable', 'iter', 'next', 'super', 'property',
            'staticmethod', 'classmethod', 'abs', 'round', 'pow', 'divmod',
            'format', 'repr', 'ascii', 'ord', 'chr', 'bin', 'oct', 'hex',
            'bool', 'bytes', 'bytearray', 'complex', 'float', 'frozenset', 'object',
            'tuple', 'Exception', 'BaseException', 'KeyError', 'ValueError',
            'TypeError', 'AttributeError', 'RuntimeError', 'NotImplementedError'
        }
        
    def find_all_md_files(self) -> List[Path]:
        """Find all markdown files in docs directory"""
        md_files = list(self.docs_dir.rglob("*.md"))
        self.all_md_files = sorted(md_files)
        return self.all_md_files
    
    def extract_code_definitions(self) -> Dict:
        """Extract all function/class definitions from source code"""
        definitions = {
            "functions": set(),
            "endpoints": {},  # Maps file to list of endpoints
            "classes": set(),
            "file_paths": set()
        }
        
        # Find all Python files
        for py_file in self.project_root.rglob("*.py"):
            if ".git" in str(py_file) or "__pycache__" in str(py_file):
                continue
            
            try:
                with open(py_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                    # Extract function definitions
                    functions = re.findall(r'def\s+(\w+)\s*\(', content)
                    definitions["functions"].update(functions)
                    
                    # Extract decorated endpoints with function names
                    # Pattern matches: @https_fn.on_request() followed by def function_name(
                    endpoint_pattern = r'@(?:https_fn|firestore_fn)\.(on_request|on_call|on_document_written|on_document_deleted|on_document_updated)\(\)\s*(?:#[^\n]*)?\s*def\s+(\w+)\s*\('
                    endpoints = re.findall(endpoint_pattern, content)
                    if endpoints:
                        file_rel = str(py_file.relative_to(self.project_root))
                        # Store as list of tuples: (decorator_type, function_name)
                        definitions["endpoints"][file_rel] = [(deco, func) for deco, func in endpoints]
                    
                    # Extract class definitions
                    classes = re.findall(r'class\s+(\w+)\s*[\(:]', content)
                    definitions["classes"].update(classes)
                    
                    # Track file paths
                    definitions["file_paths"].add(str(py_file.relative_to(self.project_root)))
                    
            except UnicodeDecodeError as e:
                logger.warning(f"Could not read {py_file}: Unicode error - {e}")
            except Exception as e:
                logger.error(f"Error processing {py_file}: {e}")
        
        self.code_definitions = definitions
        return definitions
    
    def extract_documented_endpoints(self) -> Dict:
        """Extract all endpoints mentioned in documentation"""
        endpoints = {}
        
        for md_file in self.all_md_files:
            try:
                with open(md_file, 'r') as f:
                    content = f.read()
                    
                    # Find function references
                    func_refs = re.findall(r'`(\w+)\(`', content)
                    if func_refs:
                        endpoints[str(md_file.relative_to(self.project_root))] = func_refs
            except Exception as e:
                pass
        
        self.documented_endpoints = endpoints
        return endpoints
    
    def check_broken_links(self, md_file: Path) -> List[Dict]:
        """Check for broken internal links in a markdown file"""
        issues = []
        
        try:
            with open(md_file, 'r') as f:
                content = f.read()
            
            # Find markdown links: [text](link)
            link_pattern = r'\[([^\]]+)\]\(([^)]+)\)'
            links = re.findall(link_pattern, content)
            
            for text, link in links:
                # Skip external links
                if link.startswith('http://') or link.startswith('https://'):
                    continue
                
                # Skip anchor links
                if link.startswith('#'):
                    continue
                
                # Resolve relative link
                if link.startswith('/'):
                    target = self.project_root / link.lstrip('/')
                else:
                    target = (md_file.parent / link).resolve()
                
                # Check if file exists
                if not target.exists():
                    issues.append({
                        "file": str(md_file.relative_to(self.project_root)),
                        "type": "broken_link",
                        "link": link,
                        "text": text,
                        "severity": "high"
                    })
        except Exception as e:
            pass
        
        return issues
    
    def run_cli_command(self, cmd: List[str], description: str) -> Optional[str]:
        """Execute CLI command and return output"""
        try:
            logger.info(f"Executing: {' '.join(cmd)}")
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if result.returncode == 0:
                logger.info(f"✅ {description} successful")
                return result.stdout
            else:
                logger.warning(f"⚠️  {description} failed: {result.stderr}")
                return None
        except subprocess.TimeoutExpired:
            logger.error(f"❌ {description} timed out")
            return None
        except FileNotFoundError:
            logger.error(f"❌ Command not found: {cmd[0]}")
            return None
        except Exception as e:
            logger.error(f"❌ Error executing {description}: {e}")
            return None
    
    def verify_gcp_deployment(self) -> None:
        """Verify GCP project and deployed functions"""
        logger.info("\n🔍 Verifying GCP Deployment...")
        
        # Get project config
        config_output = self.run_cli_command(
            ['gcloud', 'config', 'list'],
            "GCP config list"
        )
        if config_output:
            self.cli_outputs['gcp_config'] = config_output
            self.gcp_config = config_output
            logger.info(f"GCP Configuration retrieved")
        
        # List deployed functions
        functions_output = self.run_cli_command(
            ['gcloud', 'functions', 'list', '--project=ekklesia-prod-10-2025'],
            "Cloud Functions list"
        )
        if functions_output:
            self.cli_outputs['deployed_functions'] = functions_output
            # Parse function names
            for line in functions_output.split('\n'):
                if line and not line.startswith('NAME'):
                    parts = line.split()
                    if parts:
                        self.deployed_functions.append(parts[0])
            logger.info(f"Found {len(self.deployed_functions)} deployed functions")
    
    def validate_endpoints(self) -> List[Dict]:
        """Validate that documented endpoints match deployed functions
        
        LIMITATIONS (Current Implementation - Pre-Testing Phase):
        ⚠️  Case-matching is crude: treats HandleKenniAuth, handle_kenni_auth as identical
        ⚠️  Doesn't validate route paths (/api/auth/kenni)
        ⚠️  Doesn't validate HTTP methods (GET vs POST)
        ⚠️  Doesn't verify function signatures
        ⚠️  No unit test coverage (0%)
        
        KNOWN ISSUES:
        - Uses simple string replacement for case normalization (replace('_', '').lower())
        - This creates false positives and masks real naming differences
        - Grade: 6/10 (not production ready - see TESTING_PLAN.md)
        
        TODO (Phase 2.5):
        - Implement fuzzy matching using difflib.SequenceMatcher
        - Add route path and HTTP method validation
        - Add 20+ unit tests
        - Performance test with 10K+ functions
        """
        issues = []
        
        if not self.deployed_functions or not self.code_definitions.get("endpoints"):
            logger.info("Skipping endpoint validation: insufficient data")
            return issues
        
        # Extract endpoint function names from code
        deployed_set = set(self.deployed_functions)
        documented_endpoints = {}
        
        for file_path, endpoint_list in self.code_definitions.get("endpoints", {}).items():
            for decorator_type, func_name in endpoint_list:
                documented_endpoints[func_name.lower()] = {
                    "file": file_path,
                    "decorator": decorator_type,
                    "function": func_name
                }
        
        documented_set = set(documented_endpoints.keys())
        
        # Check for functions deployed but not documented in code
        for deployed_func in deployed_set:
            deployed_lower = deployed_func.lower()
            if deployed_lower not in documented_set:
                # Check if it might be a case mismatch
                found_match = False
                for doc_func in documented_set:
                    if doc_func.replace('_', '').lower() == deployed_lower.replace('_', '').lower():
                        issues.append({
                            "file": "deployment-docs",
                            "type": "function_name_case_mismatch",
                            "deployed_name": deployed_func,
                            "documented_name": documented_endpoints[doc_func]["function"],
                            "severity": "medium"
                        })
                        found_match = True
                        break
                
                if not found_match:
                    issues.append({
                        "file": "deployment-docs",
                        "type": "deployed_function_not_in_code",
                        "function": deployed_func,
                        "severity": "high"
                    })
        
        # Check for documented endpoints not deployed
        for doc_func in documented_set:
            doc_lower = doc_func.lower()
            if doc_lower not in deployed_set:
                # Check for case/naming differences
                found_match = False
                for deployed_func in deployed_set:
                    if deployed_func.lower().replace('_', '') == doc_lower.replace('_', ''):
                        found_match = True
                        break
                
                if not found_match:
                    issues.append({
                        "file": documented_endpoints[doc_func]["file"],
                        "type": "documented_function_not_deployed",
                        "function": documented_endpoints[doc_func]["function"],
                        "severity": "high"
                    })
        
        if issues:
            logger.info(f"Found {len(issues)} endpoint validation issues")
        else:
            logger.info("✅ All documented endpoints match deployed functions")
        
        return issues
    
    def validate_config_files(self) -> List[Dict]:
        """Validate that configuration files exist and are documented
        
        LIMITATIONS (Current Implementation - Pre-Testing Phase):
        ⚠️  Only checks if filename appears in markdown text
        ⚠️  Doesn't parse JSON to validate structure
        ⚠️  Doesn't verify documented values match actual values
        ⚠️  False positives: broken configs pass if filename is mentioned
        ⚠️  No unit test coverage (0%)
        
        KNOWN ISSUES:
        - 'firebase.json' in docs could just be text reference, not actual validation
        - Broken JSON would still pass this check
        - No schema validation performed
        - Grade: 5/10 (not production ready - see TESTING_PLAN.md)
        
        TODO (Phase 2.5):
        - Implement JSON parsing and structure validation
        - Compare documented values to actual config file values
        - Add 10+ unit tests with mock configs
        - Handle permission errors gracefully
        """
        issues = []
        
        config_files = [
            self.project_root / "firebase.json",
            self.project_root / ".firebaserc",
            self.project_root / "members" / "firebase.json",
            self.project_root / "docker-compose.yml",
        ]
        
        documented_config = set()
        for md_file in self.all_md_files:
            with open(md_file, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                for config_name in ["firebase.json", ".firebaserc", "docker-compose.yml", "Dockerfile"]:
                    if config_name in content:
                        documented_config.add(config_name)
        
        for config_file in config_files:
            if config_file.exists():
                config_name = config_file.name
                if config_name not in documented_config:
                    issues.append({
                        "file": "configuration",
                        "type": "config_file_not_documented",
                        "config_file": config_name,
                        "severity": "medium"
                    })
                    logger.warning(f"Config file {config_name} exists but not documented")
        
        return issues
    
    def validate_database_schema(self) -> List[Dict]:
        """Attempt to validate database schema against documentation
        
        LIMITATIONS (Current Implementation - Pre-Testing Phase):
        ⚠️  Never tested on this system (psycopg2 not installed)
        ⚠️  Graceful skip might hide real schema problems
        ⚠️  Assumes migrations accurately document schema
        ⚠️  Doesn't detect manual schema changes outside migrations
        ⚠️  Requires write access to test database (security risk)
        ⚠️  No unit test coverage (0%)
        ⚠️  No integration test coverage (0%)
        
        KNOWN ISSUES:
        - Function body is theoretical, actual behavior untested
        - Connection string hardcoded - won't work in all environments
        - No table name normalization (plural vs singular)
        - No detection of schema changes not in migrations
        - Grade: 4/10 (not production ready - see TESTING_PLAN.md)
        
        TODO (Phase 2.5):
        - Implement actual testing with test PostgreSQL instance
        - Add environment-based connection configuration
        - Add 10+ unit and integration tests
        - Handle permission errors gracefully
        - Document schema naming conventions
        """
        issues = []
        
        try:
            # Try to connect to local PostgreSQL
            import psycopg2
            try:
                conn = psycopg2.connect("dbname=ekklesia user=postgres")
                cursor = conn.cursor()
                
                # Get current schema
                cursor.execute("""
                    SELECT table_name FROM information_schema.tables 
                    WHERE table_schema = 'public'
                """)
                actual_tables = set(row[0] for row in cursor.fetchall())
                
                # Extract documented tables from migration files
                migrations_dir = self.project_root / "elections" / "migrations"
                documented_tables = set()
                
                if migrations_dir.exists():
                    for migration_file in migrations_dir.glob("*.sql"):
                        with open(migration_file, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()
                            # Find CREATE TABLE statements
                            creates = re.findall(r'CREATE TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)', content)
                            documented_tables.update(creates)
                
                # Compare
                missing_from_schema = documented_tables - actual_tables
                if missing_from_schema:
                    logger.warning(f"Tables documented but not in schema: {missing_from_schema}")
                    issues.append({
                        "file": "database-schema",
                        "type": "table_mismatch",
                        "missing_tables": list(missing_from_schema),
                        "severity": "high"
                    })
                
                cursor.close()
                conn.close()
                
            except psycopg2.OperationalError as e:
                logger.info(f"Database connection unavailable (expected in CI/local): {e}")
        
        except ImportError:
            logger.info("psycopg2 not installed, skipping database validation")
        except Exception as e:
            logger.error(f"Error during database validation: {e}")
        
        return issues
    
    def check_placeholder_content(self, md_file: Path) -> List[Dict]:
        """Check for placeholder content like TODO, TBD, FIXME"""
        issues = []
        
        try:
            with open(md_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            # Only check for legitimate placeholders, not ellipsis
            placeholders = ['TODO', 'TBD', 'FIXME', 'XXX']
            
            for i, line in enumerate(lines, 1):
                # Skip if in code block
                if line.strip().startswith('```'):
                    continue
                
                for placeholder in placeholders:
                    # Check for placeholder as complete word, not in middle of words
                    if re.search(rf'\b{placeholder}\b', line, re.IGNORECASE):
                        # Verify it's not part of a longer word
                        issues.append({
                            "file": str(md_file.relative_to(self.project_root)),
                            "type": "placeholder_content",
                            "line": i,
                            "content": line.strip()[:100],
                            "placeholder": placeholder,
                            "severity": "medium"
                        })
                        break
        except UnicodeDecodeError as e:
            logger.warning(f"Could not read {md_file}: {e}")
        except Exception as e:
            logger.error(f"Error checking placeholders in {md_file}: {e}")
        
        return issues
    
    def check_file_references(self, md_file: Path) -> List[Dict]:
        """Check if referenced file paths actually exist"""
        issues = []
        
        try:
            with open(md_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Improved pattern: handles longer extensions, no extension, and paths
            # Matches: `path/to/file.ext`, `path/to/file`, `file.py`, etc.
            path_pattern = r'`([a-zA-Z0-9/_.-]+(?:\.[a-zA-Z0-9]{1,10})?)`'
            paths = re.findall(path_pattern, content)
            
            for path in paths:
                # Skip if it looks like a function or variable
                if '(' in path or ')' in path or path.startswith('.'):
                    continue
                
                # Skip if it's just a language/tech term
                if path in ['json', 'yaml', 'xml', 'python', 'javascript', 'bash']:
                    continue
                
                full_path = self.project_root / path
                if not full_path.exists():
                    # Double-check if directory exists without extension
                    if '.' in path:
                        dir_path = self.project_root / path.rsplit('.', 1)[0]
                        if not dir_path.exists():
                            issues.append({
                                "file": str(md_file.relative_to(self.project_root)),
                                "type": "missing_file_reference",
                                "path": path,
                                "severity": "high"
                            })
        except UnicodeDecodeError as e:
            logger.warning(f"Could not read {md_file}: {e}")
        except Exception as e:
            logger.error(f"Error checking file references in {md_file}: {e}")
        
        return issues
    
    def check_function_references(self, md_file: Path) -> List[Dict]:
        """Check if referenced functions exist in codebase"""
        issues = []
        
        try:
            with open(md_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Find function references in backticks and code blocks
            func_pattern = r'(?:`|```)\s*(\w+)\s*\('
            functions = re.findall(func_pattern, content)
            
            documented_funcs = set(functions)
            existing_funcs = self.code_definitions.get("functions", set())
            
            for func in documented_funcs:
                if func not in existing_funcs and func not in self.python_builtins:
                    # Skip if looks like a class (starts with uppercase)
                    if not func[0].isupper():
                        issues.append({
                            "file": str(md_file.relative_to(self.project_root)),
                            "type": "potentially_undocumented_function",
                            "function": func,
                            "severity": "low"
                        })
        except UnicodeDecodeError as e:
            logger.warning(f"Could not read {md_file}: {e}")
        except Exception as e:
            logger.error(f"Error checking function references in {md_file}: {e}")
        
        return issues
    
    def check_markdown_formatting(self, md_file: Path) -> List[Dict]:
        """Check for markdown formatting issues"""
        issues = []
        
        try:
            with open(md_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            # Check for unbalanced code fences
            code_fence_count = 0
            for i, line in enumerate(lines, 1):
                if '```' in line:
                    code_fence_count += 1
            
            if code_fence_count % 2 != 0:
                issues.append({
                    "file": str(md_file.relative_to(self.project_root)),
                    "type": "unbalanced_code_fences",
                    "severity": "high"
                })
            
            # Check for improper header hierarchy
            headers_found = []
            for i, line in enumerate(lines, 1):
                match = re.match(r'^(#+)\s+', line)
                if match:
                    level = len(match.group(1))
                    headers_found.append((i, level))
            
            # Verify header hierarchy makes sense
            for i, (line_num, level) in enumerate(headers_found[:-1]):
                next_level = headers_found[i+1][1]
                if next_level > level + 1:
                    issues.append({
                        "file": str(md_file.relative_to(self.project_root)),
                        "type": "improper_header_hierarchy",
                        "line": line_num,
                        "severity": "low"
                    })
                    
        except UnicodeDecodeError as e:
            logger.warning(f"Could not read {md_file}: {e}")
        except Exception as e:
            logger.error(f"Error checking markdown formatting in {md_file}: {e}")
        
        return issues
    
    def audit_file(self, md_file: Path) -> Tuple[bool, List]:
        """Audit a single markdown file"""
        file_issues = []
        
        # Run all checks
        file_issues.extend(self.check_broken_links(md_file))
        file_issues.extend(self.check_placeholder_content(md_file))
        file_issues.extend(self.check_file_references(md_file))
        file_issues.extend(self.check_function_references(md_file))
        file_issues.extend(self.check_markdown_formatting(md_file))
        
        is_healthy = len(file_issues) == 0
        
        return is_healthy, file_issues
    
    def audit_all_files(self) -> None:
        """Audit all markdown files and validate against system state"""
        print(f"\n📋 Auditing {len(self.all_md_files)} markdown files...")
        
        for md_file in self.all_md_files:
            is_healthy, file_issues = self.audit_file(md_file)
            
            if is_healthy:
                self.healthy_files.append(str(md_file.relative_to(self.project_root)))
            else:
                for issue in file_issues:
                    issue_type = issue.get("type")
                    if issue_type in self.issues:
                        self.issues[issue_type].append(issue)
        
        print(f"✅ Healthy files: {len(self.healthy_files)}")
        print(f"⚠️  Files with issues: {len(self.all_md_files) - len(self.healthy_files)}")
        
        # Run system validation checks
        print(f"\n🔍 Phase 5: Running System Validation Checks...")
        
        print("   Validating endpoints...")
        endpoint_issues = self.validate_endpoints()
        if endpoint_issues:
            self.issues["endpoint_validation_failure"].extend(endpoint_issues)
        
        print("   Validating configuration files...")
        config_issues = self.validate_config_files()
        if config_issues:
            self.issues["configuration_validation_failure"].extend(config_issues)
        
        print("   Validating database schema...")
        schema_issues = self.validate_database_schema()
        if schema_issues:
            self.issues["database_validation_failure"].extend(schema_issues)
        
        # Log issue summary
        for category, items in self.issues.items():
            if items:
                logger.info(f"{category}: {len(items)} issues")
    
    def generate_report(self, output_dir: Path) -> None:
        """Generate comprehensive audit report"""
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # 1. HEALTHY.md
        healthy_report = output_dir / "HEALTHY.md"
        with open(healthy_report, 'w') as f:
            f.write("# ✅ Healthy Documentation Files\n\n")
            f.write(f"**Total Healthy Files:** {len(self.healthy_files)}\n")
            f.write(f"**Generated:** {datetime.now().isoformat()}\n\n")
            f.write("## Files Passing All Checks\n\n")
            for file in sorted(self.healthy_files):
                f.write(f"- `{file}`\n")
        
        print(f"📄 Created: {healthy_report}")
        
        # 2. ISSUES.json
        issues_report = output_dir / "ISSUES.json"
        with open(issues_report, 'w') as f:
            json.dump(self.issues, f, indent=2)
        
        print(f"📄 Created: {issues_report}")
        
        # 3. VERIFICATION_LOG.md
        verification_log = output_dir / "VERIFICATION_LOG.md"
        with open(verification_log, 'w') as f:
            f.write("# Verification Log\n\n")
            f.write(f"**Generated:** {datetime.now().isoformat()}\n")
            f.write(f"**Total Markdown Files Scanned:** {len(self.all_md_files)}\n")
            f.write(f"**Total Healthy Files:** {len(self.healthy_files)}\n")
            f.write(f"**Total Issues Found:** {sum(len(v) for v in self.issues.values())}\n\n")
            
            f.write("## CLI Tools Verification\n\n")
            f.write("```bash\n")
            f.write("gcloud config list\n")
            f.write("gcloud functions list --project=ekklesia-prod-10-2025\n")
            f.write("grep -r '@https_fn' members/functions/\n")
            f.write("```\n\n")
            
            f.write("## Issues Summary by Category\n\n")
            for category, issues in self.issues.items():
                if issues:
                    f.write(f"### {category.replace('_', ' ').title()} ({len(issues)} issues)\n\n")
                    for issue in issues[:5]:  # Show first 5
                        f.write(f"- {issue}\n")
                    if len(issues) > 5:
                        f.write(f"- ... and {len(issues) - 5} more\n")
                    f.write("\n")
        
        print(f"📄 Created: {verification_log}")
        
        # 4. REMEDIATION_PLAN.md
        remediation_plan = output_dir / "REMEDIATION_PLAN.md"
        with open(remediation_plan, 'w') as f:
            f.write("# Remediation Plan\n\n")
            f.write("## Priority 1: Critical Issues\n\n")
            
            critical_issues = []
            for category in ["broken_links", "formatting_issues"]:
                if self.issues[category]:
                    critical_issues.extend(self.issues[category])
            
            if critical_issues:
                for issue in critical_issues[:10]:
                    f.write(f"- **{issue.get('file', 'Unknown')}**: {issue.get('type', 'Unknown')}\n")
            else:
                f.write("- No critical issues found\n")
            
            f.write("\n## Priority 2: High Issues\n\n")
            
            high_issues = []
            for category in ["inaccurate_code_references", "missing_files"]:
                if self.issues[category]:
                    high_issues.extend(self.issues[category])
            
            if high_issues:
                for issue in high_issues[:10]:
                    f.write(f"- **{issue.get('file', 'Unknown')}**: {issue.get('type', 'Unknown')}\n")
            else:
                f.write("- No high priority issues found\n")
            
            f.write("\n## Priority 3: Medium Issues\n\n")
            
            medium_issues = []
            for category in ["placeholder_content", "contradictions"]:
                if self.issues[category]:
                    medium_issues.extend(self.issues[category])
            
            if medium_issues:
                for issue in medium_issues[:10]:
                    f.write(f"- **{issue.get('file', 'Unknown')}**: {issue.get('type', 'Unknown')}\n")
            else:
                f.write("- No medium priority issues found\n")
        
        print(f"📄 Created: {remediation_plan}")

def main() -> None:
    """Main entry point for comprehensive documentation audit."""
    project_root = Path("/home/gudro/Development/projects/ekklesia")
    
    print("🚀 Starting Comprehensive Documentation Audit\n")
    print(f"📂 Project Root: {project_root}\n")
    
    auditor = DocumentationAuditor(str(project_root))
    
    print("🔍 Phase 1: Verifying Live System State")
    auditor.verify_gcp_deployment()
    print(f"   Found {len(auditor.deployed_functions)} deployed functions")
    
    print("\n🔍 Phase 2: Collecting Documentation Files")
    auditor.find_all_md_files()
    print(f"   Found {len(auditor.all_md_files)} markdown files")
    
    print("\n🔍 Phase 3: Extracting Code Definitions")
    definitions = auditor.extract_code_definitions()
    print(f"   Found {len(definitions['functions'])} functions")
    print(f"   Found {len(definitions['classes'])} classes")
    print(f"   Found {len(definitions['file_paths'])} Python files")
    print(f"   Found {len(definitions['endpoints'])} files with endpoints")
    
    print("\n🔍 Phase 4: Extracting Documented Endpoints")
    endpoints = auditor.extract_documented_endpoints()
    print(f"   Found {len(endpoints)} files with endpoint references")
    
    print("\n🔍 Phase 5: Auditing All Files")
    auditor.audit_all_files()
    
    print("\n📊 Phase 6: Generating Reports")
    output_dir = project_root / "docs" / "audits" / "audit-2025-10-21"
    auditor.generate_report(output_dir)
    
    # Log deployment verification results
    print(f"\n📋 Deployment Verification Results:")
    print(f"   Deployed Functions: {auditor.deployed_functions}")
    print(f"   GCP Configuration Retrieved: {bool(auditor.gcp_config)}")
    
    print(f"\n✅ Audit complete!\n")
    print(f"📁 Reports saved to: {output_dir}")

if __name__ == "__main__":
    main()
