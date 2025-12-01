# 🏗️ Codebase Audit & Refactoring Plan (November 2025)

**Status:** Draft
**Date:** 2025-11-22
**Scope:** JavaScript & CSS across the Ekklesia project

---

## 1. Executive Summary

**Question:** Is it too big of a task to list, categorize, and harmonize all JS/CSS files?
**Answer:** **No.** While the codebase is growing (160+ files), it is at a critical inflection point where standardizing now will save significant time later.

We have already begun this process with the `el()` helper refactoring. Continuing this systematic approach is highly recommended.

---

## 2. Codebase Inventory

### 🌐 Frontend: Members Portal (`apps/members-portal/`)

This is the largest surface area for code duplication.

| Category | Path | Key Files | Status |
|----------|------|-----------|--------|
| **Core JS** | `js/` | `profile.js`, `dashboard.js`, `login.js` | 🟡 Mixed styles |
| **Core Utils** | `js/utils/` | `dom.js`, `format.js`, `api-client.js` | 🟢 Modernizing |
| **Admin JS** | `admin/js/` | `members-list.js`, `sync-history.js` | 🟢 Refactored to `el()` |
| **Admin Elections** | `admin-elections/js/` | `election-wizard.js` | 🟡 Needs review |
| **Styles** | `styles/` | `global.css`, `elections.css` | 🟢 Uses Variables |
| **Admin Styles** | `admin/styles/` | `admin.css` | 🟢 Extends Global |

### ⚙️ Backend Services (`services/`)

Microservices are naturally decoupled, but should share patterns.

| Service | Tech Stack | Key Areas for Consistency |
|---------|------------|---------------------------|
| **Elections** | Node.js | Error handling, Logging, DB access |
| **Events** | Node.js | Error handling, Logging, DB access |
| **Members** | Python/JS | Cloud Functions structure |

---

## 3. Harmonization Opportunities

### 🟢 1. DOM Manipulation (High Priority)
**Problem:** Older code uses verbose `document.createElement`, `className`, `appendChild` chains.
**Solution:** Standardize on the `el()` helper from `js/utils/dom.js`.
**Progress:**
- ✅ `js/profile/` (Complete)
- ✅ `admin/js/` (Complete)
- ⏳ `admin-elections/js/` (Pending)
- ⏳ `js/components/` (Pending)

### 🟡 2. API Client Pattern (Medium Priority)
**Problem:** Some files might use raw `fetch()` calls, while others use a wrapper.
**Solution:** Ensure all network requests go through a centralized `api-client.js` that handles:
- Auth headers (Firebase tokens)
- Error parsing
- Base URLs
- Loading states

### 🟡 3. CSS Architecture (Medium Priority)
**Problem:** Potential duplication of colors/spacing if not strictly using `global.css` variables.
**Solution:**
- Enforce usage of `--color-*` variables.
- Audit `z-index` values (often a source of bugs).
- Standardize button classes (`.btn`, `.btn--primary`).

### ⚪ 4. Internationalization (Low Priority - Already Good)
**Problem:** Hardcoded strings.
**Solution:** The project already uses a strong `R.string` pattern. We just need to ensure it's used 100% of the time.

---

## 4. Action Plan

### Phase 1: DOM Standardization (Current)
- [x] Refactor `js/profile/`
- [x] Refactor `admin/js/`
- [x] Refactor `admin-elections/js/` (Completed Nov 22)
- [ ] Scan `js/components/` for `document.createElement`

### Phase 2: API Client Unification
- [ ] Grep for `fetch(` to find raw API calls.
- [ ] Refactor to use `api-client.js` or service-specific clients.

### Phase 3: CSS Variable Enforcement
- [ ] Grep for hex codes (e.g., `#d32f2f`) in CSS files to ensure variables are used instead.
- [ ] Check for hardcoded pixel values that should be spacing variables.

### Phase 4: Dead Code Removal
- [ ] Identify unused files in `archive/` or `scripts/` that can be deleted.

---

## 5. Recommendation

**Start with Phase 1 (DOM Standardization).** It yields the most immediate code readability benefits and reduces file size. We have already established the pattern and it is working well.
