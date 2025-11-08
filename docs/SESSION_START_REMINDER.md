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

**Allt í `.gitignore`:**
- Athugaðu alltaf `.gitignore` áður en þú býrð til nýjar skrár með viðkvæmum gögnum
- Bættu við reglum ef þarf

---

### 4. 🗄️ Gagnagrunnur aðgangur

**Innskráningargögn eru í Firestore, EKKI PostgreSQL**

| Gagnatýpa | Staðsetning | Aðferð |
|-----------|-------------|--------|
| Innskráningar notenda | Firestore `/users/` | `check-user-logins.js` |
| Kosningagögn | PostgreSQL Cloud SQL | `./scripts/database/psql-cloud.sh` |

**Mundu:**
- PostgreSQL þarf Cloud SQL Proxy
- Firestore þarf Firebase Admin SDK með réttum credentials
- Sjá `docs/checklists/CHECK_USER_LOGINS.md` fyrir nákvæmar leiðbeiningar

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
| Innskráningstjékklisti | `docs/checklists/CHECK_USER_LOGINS.md` | Skref-fyrir-skref leiðbeiningar |
| Innskráningarscript | `services/members/scripts/check-user-logins.js` | Aðalverkfæri |
| Database scripts | `scripts/database/` | PostgreSQL aðgangur |
| Environment vars | `scripts/deployment/set-env.sh` | GCP stillingar |

---

## ✅ Tjékklisti fyrir nýja session

- [ ] Lesið þessa áminning
- [ ] Gakktu úr skugga um að þú vitir hvaða gögn eru í Firestore vs PostgreSQL
- [ ] Mundu að **aldrei commit-a** PII innskráningarscript
- [ ] Ef þú býrð til nýjar skrár með viðkvæmum gögnum, bættu þeim við `.gitignore`
- [ ] Sjá tjékklista í `docs/checklists/` áður en þú byrjar á nýju verkefni

---

**Síðast uppfært**: 2025-11-08
**Ástæða**: Bætt við innskráningarskýrslum og PII verndum
