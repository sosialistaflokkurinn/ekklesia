# Documentation Maintenance Scripts

Scripts for validating, auditing, and maintaining project documentation.

## 📋 Available Scripts

### Validation Scripts

#### `validate_documentation_map.py`
Validates DOCUMENTATION_MAP.md against the filesystem.

**Purpose:**
- Verifies file references in DOCUMENTATION_MAP.md exist
- Lists documentation files not referenced in the map
- Excludes archive and audits directories by default

**Usage:**
```bash
python3 validate_documentation_map.py
python3 validate_documentation_map.py --ignore archive audits
```

**Last Updated:** Nov 9, 2025 (added archive/audits exclusion)

---

#### `validate-links.py`
Validates internal cross-references in markdown files.

**Purpose:**
- Checks internal links to other markdown files
- Validates links to code files
- Checks anchor references
- Excludes archive and audits by default

**Usage:**
```bash
python3 validate-links.py
python3 validate-links.py --exclude audits archive
```

**Last Updated:** Nov 9, 2025 (added default exclusions)

---

### Audit Scripts

#### `audit-documentation.py`
Audits documentation for completeness and quality.

**Purpose:**
- Checks documentation coverage
- Validates markdown formatting
- Identifies missing sections

**Usage:**
```bash
python3 audit-documentation.py
```

---

#### `audit-documentation-detailed.py`
Detailed documentation audit with quality metrics.

**Purpose:**
- Comprehensive documentation analysis
- Quality scoring
- Detailed reporting

**Usage:**
```bash
python3 audit-documentation-detailed.py
```

---

### Fix/Remediation Scripts

#### `fix_documentation_map_links.py`
Fixes broken links in DOCUMENTATION_MAP.md.

**Purpose:**
- Automatically repairs broken links
- Updates moved file references
- Suggests corrections

**Usage:**
```bash
python3 fix_documentation_map_links.py
```

---

#### `fix-documentation.py`
General documentation fix utility.

**Purpose:**
- Fixes common documentation issues
- Standardizes formatting
- Repairs broken references

**Usage:**
```bash
python3 fix-documentation.py
```

---

#### `remove_dead_links.py`
Removes dead links from documentation.

**Purpose:**
- Identifies and removes broken links
- Updates link references
- Cleans up documentation

**Usage:**
```bash
python3 remove_dead_links.py
```

---

#### `remediation-summary.py`
Generates summary of documentation fixes.

**Purpose:**
- Reports on applied fixes
- Summarizes changes
- Tracks remediation progress

**Usage:**
```bash
python3 remediation-summary.py
```

---

## 🔄 Workflow

### Regular Maintenance

1. **Validate documentation:**
   ```bash
   python3 validate_documentation_map.py
   python3 validate-links.py
   ```

2. **Audit quality:**
   ```bash
   python3 audit-documentation.py
   ```

3. **Fix issues:**
   ```bash
   python3 fix_documentation_map_links.py
   python3 fix-documentation.py
   ```

4. **Generate summary:**
   ```bash
   python3 remediation-summary.py
   ```

---

## 📝 Notes

- All scripts support `--help` for detailed usage
- Scripts exclude archive/ and audits/ directories by default
- Run from repository root for best results
- Some scripts may modify files - commit changes carefully

---

## 🔗 Related

- `/docs/` - Documentation directory
- `/scripts/admin/README.md` - Admin scripts overview
- `DOCUMENTATION_MAP.md` - Main documentation map

---

**Last Updated:** November 9, 2025
