# Contributing to Ekklesia

## Git Workflow

### Branch Strategy

**ALLTAF nota feature branch** - aldrei pusha beint á `main`.

```bash
# 1. Búa til feature branch
git checkout -b feature/lýsandi-nafn

# 2. Vinna og commita
git add .
git commit -m "feat(scope): lýsing"

# 3. Pusha branch
git push -u origin feature/lýsandi-nafn

# 4. Opna PR á GitHub
gh pr create --base main --head feature/lýsandi-nafn

# 5. Eftir review, squash-merge
gh pr merge --squash --delete-branch
```

### Branch Naming

| Prefix | Notkun |
|--------|--------|
| `feature/` | Ný virkni |
| `fix/` | Villuleiðréttingar |
| `refactor/` | Endurskipulagning kóða |
| `docs/` | Skjölun |
| `chore/` | Viðhald, dependencies |

### Commit Messages

Notum [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <lýsing>

[valfrjáls body]
```

**Types:**
- `feat` - Ný virkni
- `fix` - Villuleiðrétting
- `docs` - Skjölun
- `refactor` - Endurskipulagning
- `chore` - Viðhald
- `test` - Próf

**Scope dæmi:** `rag`, `member-assistant`, `elections`, `i18n`, `auth`

### Pull Requests

1. **Squash merge** - Eitt commit per PR á main
2. **Lýsandi titill** - Sama og commit message
3. **Testing** - Prófa áður en PR er opnuð
4. **Deploy** - Deploya á staging ef við á

### Ekki leyft

- ❌ Pusha beint á `main`
- ❌ Force push á `main` (nema í neyð með samþykki)
- ❌ Commits án lýsingar
- ❌ Stórar breytingar án PR review

## Code Quality

### Pre-commit Hooks

Hooks keyra sjálfkrafa og athuga:
- Secrets/PII scanning
- i18n consistency
- Naming conventions
- AI authorship markers

### Testing

```bash
# Keyra próf
npm test

# Lint
npm run lint
```

## Deployment

Sjá `docs/deployment/` fyrir deployment leiðbeiningar.
