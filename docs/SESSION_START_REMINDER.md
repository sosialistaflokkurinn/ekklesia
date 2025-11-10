# 🔔 Session Start Áminning

**Þetta skjal á að lesa í upphafi hverrar nýrrar Claude Code session.**

---

## ⚠️ Mikilvægar áminnningar

### 1. 🔐 Innskráningarskýrslur og PII

**Staðsetning**: `services/members/scripts/check-user-logins.js`

- ⚠️ **Þessar skrár eiga EKKI heima í Git remote repository**
- Þær eru þegar í `.gitignore`
- Þær innihalda aðferðir til að skoða raunveruleg PII gögn:
  - Nöfn notenda
  - Kennitölur
  - Netföng
  - Símanúmer
  - Innskráningartíma

**Ef Claude Code/AI spyr um innskráningar notenda:**
1. Vísa í tjékklista: `docs/checklists/CHECK_USER_LOGINS.md`
2. Nota script: `services/members/scripts/check-user-logins.js`
3. ALDREI commit-a eða push-a þessum skrám

---

### 2. 📋 Tjékklistar fyrir algengar aðgerðir

**Staðsetning**: `docs/checklists/`

| Tjékklisti | Staðsetning | Tilgangur |
|------------|-------------|-----------|
| **Innskráningar** | `CHECK_USER_LOGINS.md` | Skoða hverjir hafa skráð sig inn |

**Þegar notandi spyr um verkefni sem hefur tjékklista:**
1. Vísa fyrst í viðeigandi tjékklista
2. Fylgja skrefum í tjékklistanum
3. Uppfæra tjékklista ef eitthvað vantar

---

### 3. 🛡️ Öryggisreglur

**Aldrei commit-a eftirfarandi:**
- Innskráningarskýrslur eða scripts sem sýna PII
- Service account keys (`*.key.json`)
- Aðgangsorð eða tokens
- Raunveruleg gögn úr production gagnagrunn
- Screenshots með PII (nöfn, kennitölur, etc.)
- Stefnumótandi fundarskýrslur (docs/policy/)
- Skrár með kennitalum (*KENNITALA*.md, *kennitala*.md)

**Allt í `.gitignore`:**
- Athugaðu alltaf `.gitignore` áður en þú býrð til nýjar skrár með viðkvæmum gögnum
- Bættu við reglum ef þarf
- **Sjá heildaryfirlit**: `docs/development/LOCAL_ONLY_FILES.md` fyrir lista yfir allar gitignored skrár

---

### 3.5 🔒 PII Prevention System (Issue #240)

**Staðsetning**: `docs/security/PII_GUIDELINES.md`

**Vörn í þremur lögum:**

#### 1. Pre-commit Hook
- Skannar alla `.github/` og `docs/` skrár fyrir PII
- Blokkar commit ef kennitölur, netföng, eða símanúmer fundist
- Undanskilur leyfileg fake dæmi

**Leyfðar fake dæmi:**
- ✅ Kennitölur: "010190-0000", "111111-1111"
- ✅ Netföng: "email@example.com"
- ✅ Símanúmer: "555-1234", "000-0000"
- ✅ Nöfn: "Jón Jónsson", "Anna Jónsdóttir"

#### 2. GitHub Actions
- `.github/workflows/pii-check.yml` skannar issues, PRs, comments
- Sendir sjálfvirk viðvörun ef PII finnst
- Blokkar EKKI (til að forðast false positives)

#### 3. Handbók
- `docs/security/PII_GUIDELINES.md` útskýrir reglur
- Hvað er PII og hvers vegna það skiptir máli
- Dæmi um góða og slæma venju
- Hvað á að gera ef PII finnst

**Mikilvægt fyrir GitHub Issues/PRs:**
- ❌ **ALDREI** nota raunverulegar kennitölur
- ❌ **ALDREI** nota raunveruleg netföng (nema @example.com)
- ❌ **ALDREI** nota raunverulegt símanúmer
- ❌ **ALDREI** nota raunveruleg nöfn félagsmanna
- ✅ **ALLTAF** nota fake dæmi frá PII_GUIDELINES.md

**Tengt:**
- Issue #240: PII Prevention System
- Issue #136: PII Exposure Incident (hreinsað)
- Issue #48: Database Password Exposure

---

### 4. 🗄️ Gagnagrunnur aðgangur

**Innskráningargögn eru í Firestore, EKKI PostgreSQL**

| Gagnatýpa | Staðsetning | Aðferð |
|-----------|-------------|--------|
| Innskráningar notenda | Firestore `/users/` | `check-user-logins.js` |
| Kosningagögn | PostgreSQL Cloud SQL | `./scripts/database/psql-cloud.sh` |

**Mundu:**
- PostgreSQL þarf Cloud SQL Proxy **með `--gcloud-auth` flag**
- Firestore þarf Firebase Admin SDK með réttum credentials
- Sjá `docs/checklists/CHECK_USER_LOGINS.md` fyrir nákvæmar leiðbeiningar

**🔥 MIKILVÆGT - Database Migrations:**
- **Sjá**: `scripts/database/MIGRATION_GUIDE.md` - Fljótleg tilvísun með copy-paste skipunum
- Notaðu ALLTAF `--gcloud-auth` flag til að forðast 403 ADC villur
- Proxy notar port 5433 (ekki 5432) til að forðast conflicts

---

### 5. 🔑 Auðkenning fyrir nýjar sessions

Ef þú þarft að vinna með gagnagrunn eða Firebase:

```bash
# Google Cloud
gcloud auth login
gcloud auth application-default login

# Firebase
firebase login --reauth

# Staðfesta
gcloud auth list
firebase projects:list
```

---

## 📚 Gagnlegar skrár

| Skrá | Staðsetning | Tilgangur |
|------|-------------|-----------|
| Git ignore reglur | `.gitignore` | Vernda viðkvæm gögn |
| **Local-only skrár** | `docs/development/LOCAL_ONLY_FILES.md` | **Listi yfir allar gitignored skrár** |
| Gitignore stefna | `docs/development/guides/GITIGNORE_STRATEGY.md` | Two-tier .gitignore aðferð |
| Innskráningstjékklisti | `docs/checklists/CHECK_USER_LOGINS.md` | Skref-fyrir-skref leiðbeiningar |
| Innskráningarscript | `services/members/scripts/check-user-logins.js` | Aðalverkfæri |
| **Migration Guide** | `scripts/database/MIGRATION_GUIDE.md` | **Fljótleg tilvísun fyrir DB migrations** |
| Database scripts | `scripts/database/` | PostgreSQL aðgangur |
| Database README | `scripts/database/README.md` | Ítarleg skjölun fyrir database aðgang |
| Environment vars | `scripts/deployment/set-env.sh` | GCP stillingar |

---

## ✅ Tjékklisti fyrir nýja session

- [ ] Lesið þessa áminning
- [ ] Gakktu úr skugga um að þú vitir hvaða gögn eru í Firestore vs PostgreSQL
- [ ] Mundu að **aldrei commit-a** PII innskráningarscript
- [ ] Ef þú býrð til nýjar skrár með viðkvæmum gögnum, bættu þeim við `.gitignore`
- [ ] Sjá tjékklista í `docs/checklists/` áður en þú byrjar á nýju verkefni

---

**Síðast uppfært**: 2025-11-10
**Ástæða síðustu uppfærslu**:
- Bætt við PII Prevention System (Issue #240) - þriggja laga vörn gegn PII í GitHub issues/PRs
- Bætt við vísun í MIGRATION_GUIDE.md fyrir database migrations (Issue #248)
