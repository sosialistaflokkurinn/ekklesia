# Tjékklisti: Skoða Innskráningar Notenda

Þessi tjékklisti útskýrir hvernig á að skoða hverjir hafa skráð sig inn í Ekklesia kerfið.

---

## ⚠️ Mikilvægt: Gagnaskipan

**Innskráningargögn eru í Firestore, EKKI PostgreSQL**

- **Firestore**: `/users/` collection með `lastLogin` timestamp
- **PostgreSQL**: Inniheldur aðeins kosningagögn (voting_tokens, audit_log)

---

## 📋 Skref fyrir skref

### 1. ✅ Gakktu úr skugga um að þú sért með aðgang

```bash
# Innskráning í Google Cloud
gcloud auth login

# Innskráning í Firebase
firebase login --reauth

# Setja upp Application Default Credentials (fyrir Cloud SQL Proxy)
gcloud auth application-default login
```

**Staðfesting**: Þú átt að sjá `Credentials saved to file:` skilaboð

---

### 2. ✅ Farðu í réttu möppuna

```bash
cd /home/gudro/Development/projects/ekklesia/services/members/scripts
```

Eða frá rótar möppu verkefnis:
```bash
cd services/members/scripts
```

---

### 3. ✅ Keyrðu innskráningarskýrslu

**Sjá innskráningar í dag**:
```bash
node check-user-logins.js
```

**Aðrir valmöguleikar**:
```bash
# Síðustu 7 daga
node check-user-logins.js --days 7

# Síðustu 20 innskráningar
node check-user-logins.js --latest 20

# Tiltekinn dagur
node check-user-logins.js --date 2025-11-01

# Sjá hjálp
node check-user-logins.js --help
```

---

### 4. ✅ Túlka niðurstöður

Scriptið sýnir fyrir hvern notanda:
- **Nafn**: Fullt nafn notanda
- **Kennitala**: Íslensk kennitala
- **Innskráning**: Nákvæmur tími innskráningar
- **Email**: Netfang (ef til staðar)
- **Sími**: Símanúmer (ef til staðar)
- **Félagsmaður**: Já/Nei - hvort viðkomandi er skráður félagsmaður
- **Hlutverk**: Admin hlutverk (ef einhver)

**Dæmi um úttak**:
```
1. Jón Jónsson (0101901234)
   Innskráning: 8.11.2025, 12:19:21
   Email: jon.jonsson@example.com
   Sími: 555-1234
   Félagsmaður: Já
```

---

## 🔧 Ef eitthvað virkar ekki

### Villa: "Cannot find module 'firebase-admin'"

**Lausn**: Þú ert í rangri möppu. Farðu í `services/members/scripts`:
```bash
cd /home/gudro/Development/projects/ekklesia/services/members/scripts
```

---

### Villa: "auth: cannot fetch token"

**Lausn**: Þú þarft að setja upp Application Default Credentials:
```bash
gcloud auth application-default login
```

---

### Villa: "Failed to get instance metadata"

**Ástæða**: Þetta er aðeins vandamál ef þú ert að reyna tengjast PostgreSQL (sem þú þarft EKKI fyrir innskráningargögn).

**Lausn fyrir PostgreSQL** (ef þörf er á):
1. Gakktu úr skugga um að þú sért með réttan aðgang
2. Keyrðu: `gcloud auth application-default login`
3. Ræstu Cloud SQL Proxy:
   ```bash
   cd /home/gudro/Development/projects/ekklesia
   source scripts/deployment/set-env.sh
   cloud-sql-proxy $DB_CONNECTION_NAME --port 5433 &
   ```
4. Tengstu með:
   ```bash
   ./scripts/database/psql-cloud.sh
   ```

---

### Villa: "Permission denied" eða "Index not found"

**Lausn**: Ef Firestore index vantar, keyrðu:
```bash
firebase deploy --only firestore:indexes
```

---

## 📊 PostgreSQL Gagnagrunnur (Kosningagögn)

Ef þú þarft að skoða kosningagögn (ekki innskráningar):

### Byrja Cloud SQL Proxy

```bash
# Frá rótarmöppu verkefnis
source scripts/deployment/set-env.sh
cloud-sql-proxy $DB_CONNECTION_NAME --port 5433 &
```

### Tengjast PostgreSQL

```bash
./scripts/database/psql-cloud.sh
```

### Gagnlegar fyrirspurnir

```sql
-- Skoða nýlegustu admin aðgerðir
SELECT id, action_type, performed_by, election_title, timestamp
FROM elections.admin_audit_log
ORDER BY timestamp DESC
LIMIT 20;

-- Skoða kosningamiða
SELECT COUNT(*) as total_tokens,
       COUNT(*) FILTER (WHERE used = true) as used_tokens,
       MIN(registered_at) as first_token,
       MAX(registered_at) as last_token
FROM elections.voting_tokens;

-- Skoða miða frá ákveðnum degi
SELECT * FROM elections.voting_tokens
WHERE registered_at >= '2025-11-01'
ORDER BY registered_at DESC;
```

### Loka tengingu

```bash
# Finna og drepa proxy process
pkill cloud-sql-proxy
```

---

## 📁 Skráarstaðsetningar

| Skrá | Staðsetning | Tilgangur |
|------|-------------|-----------|
| **Innskráningarscript** | `services/members/scripts/check-user-logins.js` | Aðalscriptið til að skoða innskráningar |
| **Innskráningar í dag** | `services/members/scripts/check-logins-today.js` | Einfaldara script bara fyrir í dag |
| **README** | `services/members/scripts/README.md` | Skjölun allra scripts |
| **Proxy script** | `scripts/database/start-proxy.sh` | Ræsir Cloud SQL Proxy |
| **PostgreSQL script** | `scripts/database/psql-cloud.sh` | Tengist PostgreSQL |
| **Umhverfisbreytur** | `scripts/deployment/set-env.sh` | GCP stillingar |

---

## 🔐 Öryggisatriði

- ⚠️ **Innskráningarscript eiga EKKI heima í Git remote**
  - Þau eru í `.gitignore`
  - Þau innihalda viðkvæm gögn um notendur

- ⚠️ **Geyma ALDREI aðgangsorð í Git**
  - Öll lykilorð eru í GCP Secret Manager
  - Sækja með: `gcloud secrets versions access latest --secret=postgres-password`

- ⚠️ **Nota alltaf Cloud SQL Proxy fyrir PostgreSQL**
  - Aldrei tengjast beint (nema í neyðartilvikum)
  - Proxy býr til örugga dulkóðaða tengingu

---

## ✅ Tjékklisti

Afhakaðu þegar þú hefur lokið hverju skrefi:

- [ ] Innskráð/ur í `gcloud auth login`
- [ ] Innskráð/ur í `firebase login`
- [ ] Sett upp `gcloud auth application-default login`
- [ ] Farið í `services/members/scripts` möppuna
- [ ] Keyrt `node check-user-logins.js` með viðeigandi valmöguleikum
- [ ] Fengið niðurstöður og túlkað þær
- [ ] (Valfrjálst) Lokað Cloud SQL Proxy ef það var notað

---

## 🔄 Hraðleiðir fyrir framtíðina

**Allt í einu skipun fyrir innskráningar í dag**:
```bash
cd /home/gudro/Development/projects/ekklesia/services/members/scripts && node check-user-logins.js
```

**Síðustu 10 innskráningar**:
```bash
cd /home/gudro/Development/projects/ekklesia/services/members/scripts && node check-user-logins.js --latest 10
```

---

## 📞 Hjálp

Ef þú lendir í vandræðum:

1. Athugaðu að þú sért í réttri möppu: `pwd` ætti að sýna `...ekklesia/services/members/scripts`
2. Athugaðu að þú sért innskráð/ur: `gcloud auth list` og `firebase projects:list`
3. Lestu villumeldingu vandlega - hún segir oft til um lausnina
4. Sjá `services/members/scripts/README.md` fyrir nánari upplýsingar

---

**Síðast uppfært**: 2025-11-08
**Höfundur**: Claude Code
