# Git Ignore Strategy

**Version**: 1.0
**Status**: Active
**Last Updated**: 2025-10-31

## 1. Overview

This document outlines the `.gitignore` strategy for the Ekklesia project. The primary goal is to maintain a clean and consistent repository for all contributors while allowing individual developers the flexibility to manage their local environments.

This is achieved using a two-file system:
1.  `.gitignore.example` (Tracked by Git)
2.  `.gitignore` (Untracked and personal)

## 2. The Two-File System

### 2.1. `.gitignore.example` - The Project-Wide Template

This file is the single source of truth for ignore patterns that apply to **every developer** on the project.

-   **Purpose**: To enforce a consistent set of ignored files across all development environments.
-   **Tracked by Git**: Yes. This file **MUST** be committed to the repository.
-   **Content**: This file should contain rules for files and directories that are generated during development and should never be committed. This includes:
    -   Dependency directories (`node_modules/`, `venv/`)
    -   Build artifacts (`dist/`, `build/`)
    -   System files (`.DS_Store`)
    -   IDE and editor configuration folders (`.vscode/`, `.idea/`)
    -   General log files (`*.log`)
    -   Local environment files (`.env`, `.env.*`)

**Workflow for New Developers:**
Upon cloning the repository for the first time, every developer should copy this file to create their personal `.gitignore`:
```bash
cp .gitignore.example .gitignore
```

### 2.2. `.gitignore` - The Personal Ignore File

This is your personal, local ignore file. You can add any rules here that are specific to your machine or workflow.

-   **Purpose**: To allow developers to ignore local files without affecting the project or other contributors.
-   **Tracked by Git**: No. This file is **intentionally untracked**. The `.gitignore.example` file contains a rule (`.gitignore`) to ensure this file is never committed.
-   **Content**: This file is for personal convenience. Examples include:
    -   Rules for your specific code editor or tools.
    -   Temporary local test files or scripts.
    -   Local log files with sensitive output.
    -   Files containing personal notes or credentials that are not part of the standard project setup.

## 3. Guiding Principles

-   **Be Specific**: Avoid overly broad patterns (like `*.*` or `*log*`). Prefer more specific patterns like `*.log` or `build/`.
-   **Project vs. Personal**: Before adding a new rule, ask: "Does this apply to everyone, or just me?"
    -   If it applies to everyone, add it to `.gitignore.example`.
    -   If it applies only to you, add it to `.gitignore`.
-   **Use Comments**: Add comments (`#`) to explain why a rule exists, especially for non-obvious patterns.
-   **Directory Rules**: End patterns with a forward slash (`/`) to ensure they only match directories (e.g., `node_modules/`). This is more efficient and safer than matching files of the same name.
-   **Review Regularly**: Periodically review the `.gitignore.example` file to ensure it is up-to-date and does not contain outdated or unnecessary rules.
