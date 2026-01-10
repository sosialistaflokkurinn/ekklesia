# Contributing to Ekklesia

## Git Workflow - STRANGAR REGLUR

### Main Branch Vernd

**ALDREI pusha beint á `main`.**

Öll commits á main VERÐA að fara í gegnum Pull Request með squash merge.

### Lágmarks Kröfur fyrir PR á Main

PR verður að uppfylla **að minnsta kosti eitt** af eftirfarandi:

| Krafa | Lýsing |
|-------|--------|
| **≥50 línur kóða** | Raunverulegar breytingar (ekki tómar línur/comments) |
| **≥3 skrár** | Breytingar á 3+ skrám |
| **Nýr feature** | Ný virkni með tests |
| **Bug fix með test** | Villuleiðrétting + test sem sýnir fix |
| **Security fix** | Öryggisleiðrétting (undanþága frá stærð) |

### Ekki Leyft á Main

- ❌ Eitt-skráar docs breytingar (nota `docs/` branch)
- ❌ Typo fixes einir og sér
- ❌ Formatting/linting breytingar einir og sér
- ❌ "WIP" eða "temp" commits
- ❌ Commits án lýsingar
- ❌ Force push (nema með samþykki allra)

### Branch Strategy

```bash
# 1. Búa til feature branch FRÁ main
git checkout main
git pull origin main
git checkout -b feature/lýsandi-nafn

# 2. Vinna og commita (eins mörg commits og þarf)
git add .
git commit -m "wip: working on feature"
git commit -m "wip: more progress"

# 3. Pusha branch
git push -u origin feature/lýsandi-nafn

# 4. Opna PR á GitHub
gh pr create --base main --head feature/lýsandi-nafn

# 5. SQUASH MERGE - allt verður eitt commit á main
gh pr merge --squash --delete-branch
```

### Branch Naming

| Prefix | Notkun | Dæmi |
|--------|--------|------|
| `feature/` | Ný virkni | `feature/member-export` |
| `fix/` | Villuleiðréttingar | `fix/login-timeout` |
| `refactor/` | Endurskipulagning | `refactor/api-cleanup` |
| `docs/` | Skjölun eingöngu | `docs/api-reference` |
| `chore/` | Viðhald | `chore/update-deps` |
| `security/` | Öryggis fix | `security/xss-prevention` |

### Commit Messages (á branch)

Á feature branch má nota hvaða commit messages sem er (þau verða squashed).

**Squash merge message** (á main) verður að fylgja:

```
<type>(<scope>): <lýsing>

<valfrjáls body með upplýsingum>
```

**Types:** `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `security`

### Pull Request Kröfur

1. **Titill** - Conventional commit format
2. **Lýsing** - Hvað og af hverju
3. **Testing** - Hvernig var prófað
4. **Screenshots** - Ef UI breytingar

### Pre-commit Hooks

Hooks keyra sjálfkrafa og:
- Hindra push á main
- Athuga commit stærð
- Scanna fyrir secrets/PII
- Athuga i18n consistency

Sjá `git-hooks/` fyrir uppsetningu.

---

## Undanþágur

Ef þú þarft undanþágu (t.d. critical hotfix), skráðu það í PR lýsingu og fáðu samþykki.
