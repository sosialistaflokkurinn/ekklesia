# Session Hooks Uppsetning fyrir Claude Code

Þetta skjal útskýrir hvernig á að setja upp session hooks í Claude Code til að minna á mikilvæg atriði í upphafi hverrar session.

---

## 🎯 Tilgangur

Session hooks keyra sjálfkrafa skipanir eða sýna áminningu þegar ný Claude Code session byrjar. Þetta er gagnlegt til að:
- Minna á öryggisreglur
- Vísa í tjékklista fyrir algengar aðgerðir
- Tryggja að nauðsynlegar stillingar séu til staðar

---

## ⚙️ Uppsetning

### 1. Búa til settings skrá

Claude Code notar `.claude/settings.local.json` fyrir local stillingar (ekki tracked í Git).

```bash
# Frá rótarmöppu verkefnis
mkdir -p .claude
```

### 2. Búa til eða uppfæra settings.local.json

Búðu til skrána `.claude/settings.local.json` með eftirfarandi innihaldi:

```json
{
  "hooks": {
    "SessionStart": "cat docs/SESSION_START_REMINDER.md"
  }
}
```

Eða ef þú vilt einfaldari útgáfu sem birtir bara helstu áminningu:

```json
{
  "hooks": {
    "SessionStart": "echo '🔔 Áminning: Sjá docs/SESSION_START_REMINDER.md fyrir mikilvægar upplýsingar um PII, innskráningarskýrslur og öryggisreglur.'"
  }
}
```

### 3. Staðfesta uppsetningu

Endurræstu Claude Code eða byrjaðu nýja session. Þú ættir að sjá áminninguna sjálfkrafa.

---

## 📝 Annað hooks dæmi

### Sýna stutta áminingu um tjékklista

```json
{
  "hooks": {
    "SessionStart": "echo '\n🔔 Session Start Áminning:\n  • Innskráningarskýrslur: docs/checklists/CHECK_USER_LOGINS.md\n  • ALDREI commit-a PII scripts (check-user-logins.js)\n  • Sjá docs/SESSION_START_REMINDER.md fyrir meira\n'"
  }
}
```

### Keyra script sem athugar auðkenningu

```json
{
  "hooks": {
    "SessionStart": "bash -c 'echo \"Athuga GCP auðkenningu:\" && gcloud auth list && echo \"\" && echo \"Sjá SESSION_START_REMINDER.md fyrir frekari upplýsingar\"'"
  }
}
```

### Keyra margar skipanir

```json
{
  "hooks": {
    "SessionStart": "bash -c 'cat docs/SESSION_START_REMINDER.md && echo \"\" && echo \"✅ Tilbúinn til að byrja!\"'"
  }
}
```

---

## 🔒 Öryggisatriði

**Ábendingar:**
- `.claude/settings.local.json` er þegar í `.gitignore`
- Settu ALDREI aðgangsorð eða tokens í hooks
- Hooks ættu aðeins að vísa í skjöl eða keyra öruggar skipanir

---

## 📁 Skráarstaðsetningar

| Skrá | Staðsetning | Tilgangur |
|------|-------------|-----------|
| **Claude settings** | `.claude/settings.local.json` | Session hooks og local stillingar |
| **Session áminning** | `docs/SESSION_START_REMINDER.md` | Aðal áminningarskjal |
| **Tjékklisti mappa** | `docs/checklists/` | Allir tjékklistar |
| **Gitignore** | `.gitignore` | Verndar viðkvæm gögn |

---

## ✅ Tjékklisti

- [ ] Búið til `.claude/` möppu
- [ ] Búið til `.claude/settings.local.json`
- [ ] Bætt við `SessionStart` hook
- [ ] Prófað með nýrri session
- [ ] Staðfest að áminning birtist

---

## 🔄 Viðhald

Þegar nýjar áminnningar bætast við:
1. Uppfærðu `docs/SESSION_START_REMINDER.md`
2. Session hooks þurfa ekki uppfærslu (vísa í skjalið)
3. Ef þú vilt breyta hook útfærslu, uppfærðu `.claude/settings.local.json`

---

## 📚 Frekari upplýsingar

- [Claude Code Documentation](https://docs.claude.com/claude-code)
- Session Start Reminder: `docs/SESSION_START_REMINDER.md`
- Tjékklistar: `docs/checklists/README.md`

---

**Síðast uppfært**: 2025-11-08
