# Kimi AI Assistant - Patterns & Guide

Þetta skjal er fyrir AI aðstoðarmenn (Claude, etc.) sem vinna með Kimi.

## Hvað er Kimi?

Kimi er **kerfisstjórnunaraðstoðarmaður** fyrir Ekklesia superuser console. Hann:
- Svarar spurningum um kerfið á íslensku
- Les kóða úr GitHub repo-inu með tólum
- Hefur aðgang að real-time heilsugögnum
- Er aðeins aðgengilegur superusers

**Tækni:** Moonshot AI API, model `kimi-k2-0711-preview`

## Skráarstaðsetningar

| Skrá | Lýsing |
|------|--------|
| `services/svc-events/src/routes/route-kimi-chat.js` | **Production endpoint** - system prompt, tól, API kall |
| `scripts/test-kimi-tools.cjs` | Test með tólum (les GitHub) |
| `scripts/test-kimi-with-context.sh` | Hraðtest án tóla |
| `scripts/test-kimi-sysadmin.sh` | 45 kerfisstjóraspurningar |
| `scripts/test-kimi-batch.sh` | Sjálfvirkar prófanir |
| `scripts/test-kimi-interactive.sh` | Gagnvirkt spjall |

## Prófun

### Með tólum (mælum með)
```bash
# Kimi les kóða úr GitHub
node scripts/test-kimi-tools.cjs "Hvernig virkar auth middleware?"
```

### Án tóla (hraðar)
```bash
./scripts/test-kimi-with-context.sh "Hver er kostnaður við kerfið?"
```

### Kerfisstjóraspurningar
```bash
./scripts/test-kimi-sysadmin.sh list    # Sjá allar 45 spurningar
./scripts/test-kimi-sysadmin.sh 1       # Prófa spurningu #1
```

## System Prompt Uppbygging

System prompt er í `route-kimi-chat.js` og inniheldur:

```
1. TÓLANOTKUNARREGLUR      # Hvenær nota tól
2. Kerfisarkitektúr         # Tafla með þjónustum
3. Lykilþjónustur           # Tækni, hýsing, region
4. Tækniákvarðanir          # Meðvituð val (ekki React, etc.)
5. VM vs Serverless         # Kostnaðarsamanburður
6. Deployment               # Skipanir
7. Gagnagrunnur             # Cloud SQL tenging
8. Algengar skipanir        # logs, rollback, secrets
9. Leiðbeiningar            # Tungumál, format
10. RAUNVERULEG KERFISHEILSA # Bætt við runtime
```

## Að bæta við þekkingu

### Þegar Kimi svarar vitlaust:

1. **Finna vandamálið** - prófa með test script
2. **Bæta við system prompt** - í `BASE_SYSTEM_PROMPT` í route-kimi-chat.js
3. **Uppfæra test scripts** - ef þau nota sama prompt
4. **Deploy** - `cd services/svc-events && ./deploy.sh`
5. **Prófa aftur** - staðfesta lagfæringu

### Dæmi - Bæta við nýrri þekkingu:

```javascript
// Í route-kimi-chat.js, bæta við BASE_SYSTEM_PROMPT:

## Nýr hluti
- Upplýsingar hér
- Skipanir eða gögn
```

## Algeng vandamál og lausnir

### 1. Kimi segir "Python" þegar það á að vera "Node.js"

**Vandamál:** Ruglaði saman svc-members (Python) og Cloud Run (Node.js)

**Lausn:** Bættum við skýrri töflu og "MIKILVÆGT" athugasemd:
```
**MIKILVÆGT:** Cloud Run þjónusturnar eru **Node.js**, EKKI Python!
```

### 2. Kimi gefur ófullnægjandi svar um gagnagrunn

**Vandamál:** Reyndi nota tól en gat ekki svarað án þeirra

**Lausn:** Bættum við `## Gagnagrunnur` hluta með:
- Cloud SQL Proxy skipun
- Connection strings
- Lykilupplýsingar (instance, database, user)

### 3. Kimi gagnrýnir tækniákvarðanir (React, TypeScript)

**Vandamál:** Sagði að vanti React/TypeScript, gaf 6/10

**Lausn:** Bættum við `## Tækniákvarðanir (meðvitaðar)` sem útskýrir:
- Vanilla JS er meðvitað val
- Ekki TypeScript - sveigjanleiki
- 7/10 er rétt einkunn

### 4. Kimi veit ekki um kostnað

**Vandamál:** Gat ekki svarað "hvað kostar kerfið?"

**Lausn:** Bættum við `### Áætlaður kostnaður` í health context:
- Sundurliðun á GCP þjónustum
- Samtals: ~$18-27/mánuður

### 5. Kimi API overloaded

**Vandamál:** `engine_overloaded_error`

**Lausn:** Bíða 10-15 sekúndur og reyna aftur. Circuit breaker er í production.

## Tól (Tool Calling)

Kimi hefur aðgang að tveimur tólum:

### read_file
```json
{
  "name": "read_file",
  "parameters": { "path": "services/svc-events/src/index.js" }
}
```
Les skrá úr GitHub repo (main branch).

### list_directory
```json
{
  "name": "list_directory",
  "parameters": { "path": "services/svc-events/src" }
}
```
Listar innihald möppu.

### Hvernig tól virka:

1. Kimi fær spurningu
2. Kimi ákveður að nota tól
3. Server keyrir tól (sækir frá GitHub)
4. Server sendir niðurstöðu til Kimi
5. Kimi svarar byggt á gögnum
6. Endurtekið allt að 5x

**Athugið:** Test scripts án tóla (`test-kimi-with-context.sh`) styðja EKKI tól. Notaðu `test-kimi-tools.cjs` fyrir spurningar sem krefjast kóðalestur.

## Real-time Health Data

Production endpoint bætir við health gögnum í system prompt:

```javascript
// Í getSystemHealthContext():
- svc-events uptime og minni
- Cloud SQL staða og töflur
- svc-elections latency
- svc-members (Firebase Functions) staða
- Kostnaðarmat
```

Þetta gerir Kimi kleift að svara "hvernig er heilsa kerfisins?" með raunverulegum gögnum.

## Tungumál

- **System prompt:** Íslenska
- **Svör:** Íslenska (stillt í leiðbeiningum)
- **Tól:** Enska (GitHub API)
- **Villur:** Íslenska

## API Lykill

Geymdur í GCP Secret Manager:
```bash
gcloud secrets versions access latest --secret=kimi-api-key
```

## Rate Limiting

- Production: Circuit breaker (5 failures → 1 min cooldown)
- Test: Engin takmörk (passið ykkur)

## Kostnaður

Kimi API er greitt eftir tokens:
- Prompt: ~2000 tokens per kall
- Response: ~200-700 tokens
- Með tólum: getur verið 10,000+ tokens

## Debugging

### Sjá hvað Kimi fær:
```javascript
// Í route-kimi-chat.js, bæta við:
console.log('Messages:', JSON.stringify(messages, null, 2));
```

### Sjá tólakall:
```javascript
// Þegar tól er kallað:
logger.info('Kimi tool call', {
  tool: toolCall.function.name,
  args: toolCall.function.arguments
});
```

### Logs í production:
```bash
gcloud run services logs read events-service --region europe-west1 --limit 50 | grep -i kimi
```

## Prófa nýja virkni

1. Breyta `route-kimi-chat.js`
2. Deploy: `cd services/svc-events && ./deploy.sh`
3. Prófa: `node scripts/test-kimi-tools.cjs "spurning"`
4. Ef gott → commit og push

## Flokkar kerfisstjóraspurninga

Í `test-kimi-sysadmin.sh` eru 45 spurningar í 11 flokkum:

1. Villuleit (5)
2. Eftirlit (4)
3. Öryggi (5)
4. Backup (4)
5. Stækkun (4)
6. Gagnagrunnur (4)
7. Deployment (4)
8. Loggar (4)
9. Kostnaður (4)
10. Samþættingar (3)
11. Viðhald (4)

## Samantekt

- **Breyta þekkingu:** Edit `BASE_SYSTEM_PROMPT` í route-kimi-chat.js
- **Prófa með tólum:** `node scripts/test-kimi-tools.cjs "spurning"`
- **Prófa hratt:** `./scripts/test-kimi-with-context.sh "spurning"`
- **Deploy:** `cd services/svc-events && ./deploy.sh`
- **Logs:** `gcloud run services logs read events-service --region europe-west1`
