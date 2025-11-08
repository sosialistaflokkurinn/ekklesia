# 📋 Tjékklistar fyrir Ekklesia

Þessi mappa inniheldur tjékklista fyrir algengar stjórnunaraðgerðir í Ekklesia kerfinu.

---

## 📑 Tiltækir tjékklistar

| Tjékklisti | Skrá | Lýsing |
|------------|------|--------|
| **Innskráningar notenda** | [`CHECK_USER_LOGINS.md`](./CHECK_USER_LOGINS.md) | Hvernig á að skoða hverjir hafa skráð sig inn í kerfið |

---

## 🎯 Tilgangur

Tjékklistar eru hannaðir til að:
- Gera algengar aðgerðir endurtekanlegar og áreiðanlegar
- Hjálpa nýjum stjórnendum að læra kerfið
- Tryggja að öryggisreglum sé fylgt
- Skjalfesta bestu starfsvenjur

---

## 🔐 Öryggisatriði

Margir tjékklistar fjalla um viðkvæm gögn. **Alltaf:**
- Fylgdu öryggisreglum í hverri skrá
- Commit-aðu ALDREI viðkvæmum gögnum til Git
- Notaðu aðeins í prófunarumhverfi ef við á
- Gakktu úr skugga um að þú hafir heimild til að nálgast gögnin

---

## 🆕 Búa til nýjan tjékklista

Þegar þú býrð til nýjan tjékklista:

1. **Nafngi skrána**: Notaðu `VERKNAFN_ACTION.md` (t.d. `CHECK_USER_LOGINS.md`)
2. **Skipulag**:
   - Byrjaðu með skýra lýsingu á tilgangi
   - Listaðu forsendur (authentication, aðgangur, etc.)
   - Gefðu skref-fyrir-skref leiðbeiningar með bash dæmum
   - Bættu við troubleshooting hluta
   - Skráðu allar skráarstaðsetningar
3. **Öryggis**: Ef tjékklisti fjallar um PII eða viðkvæm gögn:
   - Merktu það skýrt efst í skjalinu
   - Bættu við í `.gitignore` ef við á
   - Nefndu í `SESSION_START_REMINDER.md`
4. **Uppfærðu þessa README**: Bættu við nýjum tjékklista í töfluna hér að ofan

---

## 📚 Tengd skjöl

- **Session áminning**: [`../SESSION_START_REMINDER.md`](../SESSION_START_REMINDER.md) - Lestu í upphafi nýrrar session
- **Scripts möppur**:
  - Members scripts: `services/members/scripts/`
  - Database scripts: `scripts/database/`
  - Deployment: `scripts/deployment/`

---

## 🔄 Viðhald

**Uppfærsla á tjékklistum:**
- Þegar nýjar aðferðir bætast við
- Þegar eldri aðferðir breytast eða úreldast
- Eftir að villa er fundin í ferli
- Þegar öryggisreglur breytast

**Ábyrðir**: Allir þróunaraðilar og stjórnendur geta uppfært tjékklista

---

**Síðast uppfært**: 2025-11-08
