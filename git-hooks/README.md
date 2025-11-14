# Git Hooks fyrir Ekklesia

Þessi mappa inniheldur Git hooks sem vernda gegn algengum mistökum í verkefninu.

---

## 📋 Tiltæk Hooks

### 1. commit-msg

**Tilgangur**: Koma í veg fyrir AI höfundamerki og pólitískar sjálfsmyndarvillur í commit messages.

**Athugar**:
- ❌ AI authorship markers:
  - `🤖 Generated with [Claude Code]`
  - `Co-Authored-By: Claude <noreply@anthropic.com>`
  - Önnur AI höfundarmerki
- ❌ Rangar stjórnmálaflokks tilvísanir:
  - "Social Democratic" (ætti að vera "Socialist Party")
  - "Samfylkingin" (rangur flokkur)

**Uppsetning**:
```bash
cp git-hooks/commit-msg .git/hooks/commit-msg
chmod +x .git/hooks/commit-msg
```

**Dæmi um blocked commit**:
```
❌ BLOCKED: Commit message contains AI authorship markers

Found AI marker in commit message:
🤖 Generated with [Claude Code](https://claude.com/claude-code)
Co-Authored-By: Claude <noreply@anthropic.com>

⚠️  AUTHORSHIP POLICY:
- Commits must ONLY list human authors
- AI tools (Claude Code, etc.) are assistants, NOT authors
```

---

### 2. pre-commit

**Tilgangur**: Koma í veg fyrir að PII (Personally Identifiable Information), leyndarmál og önnur viðkvæm gögn séu committed.

**Athugar**:
- ❌ Leyndarmál (passwords, API keys, tokens, GCP credentials)
- ❌ PII í skjölum (kennitalur, netföng, símanúmer)
- ⚠️  Pólitísk sjálfsmynd í kóða skrám

**Uppsetning**:
```bash
cp git-hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

**Dæmi um blocked commit**:
```
❌ Commit blocked: Potential secrets detected!

⚠️ Potential secret detected in: services/members/config.py
   Pattern: api[_-]?key.*=.*[A-Za-z0-9+/]{20,}

Please review the matched lines above.
```

---

## 🚀 Uppsetning - Öll Hooks í einu

```bash
# Frá rótarmöppu verkefnis
cp git-hooks/commit-msg .git/hooks/commit-msg
cp git-hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/commit-msg
chmod +x .git/hooks/pre-commit
```

**Staðfesta uppsetningu**:
```bash
ls -la .git/hooks/
# Þú ættir að sjá commit-msg og pre-commit með execute réttindi
```

---

## 🧪 Prófa Hooks

### Prófa commit-msg

```bash
# Búa til test commit með AI markers
git commit -m "test: New feature

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Ætti að blokkast með villu
```

### Prófa pre-commit

```bash
# Búa til test skrá með kennitölu
echo "kennitala: 010190-1234" > test-pii.txt
git add test-pii.txt
git commit -m "test: Add PII"

# Ætti að blokkast með villu
```

---

## 🔧 Bypass Hooks (Aðeins fyrir neyðartilvik)

Ef þú **þarft** að bypass hooks (t.d. í neyðartilfelli):

```bash
git commit --no-verify -m "emergency fix"
```

**⚠️ AÐVÖRUN**: Notaðu þetta AÐEINS ef þú ert 100% viss um að commitið sé öruggt!

---

## 📝 Reglur

### Authorship Policy

**✅ RÉTT**:
```
Author: Guðröður <gudrodur@gmail.com>

feat: Add new feature

Implemented feature X with Y.
```

**❌ RANGT**:
```
Author: Guðröður <gudrodur@gmail.com>

feat: Add new feature

Implemented feature X with Y.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
Co-Authored-By: Claude <noreply@anthropic.com>
```

**Skýring**:
- AI verkfæri (Claude Code, GitHub Copilot, etc.) eru **hjálpartæki**, ekki höfundar
- Þú ert ábyrgur/ábyrg fyrir kóðanum - þú ert höfundur
- Commit history á að endurspegla mannlega ákvarðanatöku

---

## 🛡️ PII Protection

**Fake dæmi sem eru ALLTAF leyfð**:

| Gagnategund | Dæmi |
|-------------|------|
| Nöfn | Jón Jónsson, Anna Jónsdóttir |
| Kennitalur | 000000-0000, 111111-1111, 010190-0000 |
| Netföng | email@example.com, user@example.com |
| Símanúmer | 555-1234, 000-0000, 999-9999 |
| Heimilisföng | Dæmisgata 1, 000 Dæmisbær |

**Raunveruleg gögn eru ALDREI leyfð** í Git repository!

---

## 🔄 Viðhald

Þegar hooks eru uppfærð:

```bash
# Uppfæra local copies frá git-tracked version
cp git-hooks/commit-msg .git/hooks/commit-msg
cp git-hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/*
```

---

## 📚 Tengd Skjöl

- **PII Prevention**: Issue #240
- **Pre-commit Enhancements**: Issue #214
- **Political Identity**: `archive/docs/docs-2025-10-13/docs/PROJECT_IDENTITY.md`
- **Session Start Reminder**: `docs/SESSION_START_REMINDER.md`

---

## ❓ Algengar Spurningar

### Q: Af hverju er AI authorship bannað?

A: Þrjár megin ástæður:
1. **Lagaleg ábyrgð**: Þú ert lagalega ábyrgur/ábyrg fyrir kóðanum
2. **Code review**: Reviewers þurfa að vita hver tók ákvarðanir
3. **Attribution**: Git history á að endurspegla mannlegt framlag

### Q: Get ég notað Claude Code?

A: **Já!** Notaðu Claude Code eins mikið og þér hentar. Fjarlægðu bara AI merkingarnar úr commit message áður en þú commit-ar.

### Q: Hvað ef ég vinn með öðrum á commit?

A: Notaðu `Co-Authored-By:` fyrir **mannlega samstarfsmenn**:
```
Co-Authored-By: Anna Jónsdóttir <anna@example.com>
```

---

**Síðast uppfært**: 2025-11-10
**Höfundur**: Guðröður
