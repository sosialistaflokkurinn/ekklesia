# AI Assistants

This document covers all AI-powered assistants in Ekklesia.

## Overview

| Assistant | Route | Frontend | Model | Use Case |
|-----------|-------|----------|-------|----------|
| **Sysadmin Chat** | `route-kimi-chat.js` | Console only | Gemini 2.0 | System admin queries (superuser) |
| **Member Assistant** | `route-member-assistant.js` | `member-assistant-chat.js` | Gemini 2.0 | RAG-based party knowledge |
| **Party Wiki** | `route-party-wiki.js` | `party-wiki-chat.js` | Moonshot Kimi | Static party facts |
| **Email Template** | `route-email-template-assistant.js` | `template-editor-assistant.js` | Gemini 2.0 | Email content editing |

> **Note:** The sysadmin chat endpoint (`/api/kimi/*`) keeps its name for backwards compatibility but uses Gemini internally.

---

## 1. Sysadmin Chat (Superuser Only)

System administration assistant with tool calling for GitHub code access and GCP queries.

### Model
- **API:** Google Gemini (`service-gemini.js`)
- **Models:** `gemini-2.0-flash` (fast) or `gemini-2.0-flash-thinking-exp-01-21` (reasoning)
- **Secret:** `GEMINI_API_KEY` in GCP Secret Manager

### Files

| File | Purpose |
|------|---------|
| `services/svc-events/src/routes/route-kimi-chat.js` | API endpoint with system prompt and tools |
| `services/svc-events/src/services/service-gemini.js` | Gemini API wrapper |
| `scripts/test-kimi-tools.cjs` | Test with tool calling |
| `scripts/test-kimi-sysadmin.sh` | 45 sysadmin test questions |

### Tools Available

| Tool | Description |
|------|-------------|
| `read_file` | Read file from GitHub repo (main branch) |
| `list_directory` | List directory contents |
| `list_users_by_role` | Query users by role from Firestore |
| GCP tools | Cloud Run, Cloud SQL status queries |

### System Prompt Structure

```
1. Tool usage rules
2. System architecture table
3. Key services (tech, hosting, region)
4. Technical decisions (vanilla JS, no React)
5. VM vs Serverless cost comparison
6. Deployment commands
7. Database connection info
8. Common commands (logs, rollback, secrets)
9. Language guidelines (Icelandic)
10. Real-time system health (added at runtime)
```

### Testing

```bash
# With tools (reads from GitHub)
node scripts/test-kimi-tools.cjs "Hvernig virkar auth middleware?"

# Quick test without tools
./scripts/test-kimi-with-context.sh "Hver er kostnaður við kerfið?"

# All 45 sysadmin questions
./scripts/test-kimi-sysadmin.sh list    # List questions
./scripts/test-kimi-sysadmin.sh 1       # Test question #1
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Empty response | Check `GEMINI_API_KEY` secret is set |
| Rate limited | Wait 10-15 seconds, circuit breaker active |
| Wrong tech (Python vs Node.js) | System prompt clarifies Cloud Run = Node.js |

---

## 2. Member Assistant (RAG)

RAG-based assistant for party members with vector search and document retrieval.

### Architecture

```
Query → Vertex AI Embedding → pgvector Search → Context Assembly → Gemini → Response
```

### Model
- **Embeddings:** Vertex AI `text-embedding-004` (768 dimensions)
- **LLM:** Gemini 2.0 Flash or Thinking
- **Vector DB:** PostgreSQL with pgvector extension

### Files

| File | Purpose |
|------|---------|
| `src/routes/route-member-assistant.js` | API endpoint |
| `src/services/service-embedding.js` | Vertex AI embeddings |
| `src/services/service-vector-search.js` | pgvector similarity search |
| `src/services/service-web-search.js` | Brave Search fallback |
| `scripts/verify-kimi-answers.js` | 20 verification tests |

### Frontend Features

| Feature | Description |
|---------|-------------|
| Random suggestions | 6 random from 30 topic prompts |
| Model selection | Fast (flash) or Thinking (reasoning) |
| Countdown timer | Expected wait time display |
| Markdown parsing | Headers, lists, tables, code blocks |
| Floating panel | Expandable view with FAB toggle |
| XSS protection | `escapeHTML()` on all user input |

### Database Schema

```sql
CREATE TABLE rag_documents (
    id SERIAL PRIMARY KEY,
    source_type VARCHAR(50) NOT NULL,  -- 'party-website', 'kosningaprof-2024', etc.
    source_url TEXT,
    source_date DATE,
    chunk_id VARCHAR(100) NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    citation JSONB NOT NULL,           -- {"who": "...", "when": "...", "context": "..."}
    embedding vector(768),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(source_type, chunk_id)
);

CREATE INDEX ON rag_documents USING hnsw (embedding vector_cosine_ops);
```

### Scoring Formula

```
final_score = cosine_similarity × source_boost × title_boost × content_boost
```

**Source Boosts:**
| source_type | Boost | Rationale |
|-------------|-------|-----------|
| `party-website` | 1.3x | Official policy |
| `kosningaprof-2024` | 1.2x | Recent verified positions |
| `discourse-archive` | 1.2x | Historical discussions |
| `discourse-person` | 0.6x | Reduce individual profile noise |

### Web Search Fallback

When RAG similarity < 0.35, falls back to Brave Search API:
- **Secret:** `brave-search-api-key`
- **Service:** `service-web-search.js`

### Indexing Scripts

```bash
cd services/svc-events
node scripts/add-housing-policy-rag.js     # Index húsnæðisstefna
node scripts/add-fiscal-policy-rag.js      # Index fjármálastefna
node scripts/check-curated-ranking.js      # Verify retrieval
```

---

## 3. Party Wiki

Static knowledge assistant with hardcoded party facts in system prompt.

### Model
- **API:** Moonshot AI (Kimi)
- **Model:** `kimi-k2-0711-preview`
- **Secret:** `kimi-api-key`

### Files

| File | Purpose |
|------|---------|
| `src/routes/route-party-wiki.js` | API with hardcoded knowledge |
| `js/components/party-wiki-chat.js` | Chat widget |

### Knowledge Includes
- Party history and founding
- Organizational structure
- Key people
- Policy positions (hardcoded)

> **Note:** Unlike Member Assistant, Party Wiki does NOT use RAG or database queries.

---

## 4. Email Template Assistant

AI-powered email template editor with quick actions.

### Model
- **API:** Gemini 2.0 Flash
- **Service:** `service-gemini.js`

### Files

| File | Purpose |
|------|---------|
| `src/routes/route-email-template-assistant.js` | API endpoint |
| `apps/members-portal/admin/email/js/template-editor-assistant.js` | Frontend widget |
| `apps/members-portal/admin/email/js/template-editor-preview.js` | Live preview |

### Quick Actions

| Action | Description |
|--------|-------------|
| Sosialistasnid | Apply socialist party tone/style |
| Snida | Improve text clarity |
| Listi | Convert to bullet list |
| Breytur | Add template variables |

See [EMAIL-TEMPLATES-GUIDE.md](EMAIL-TEMPLATES-GUIDE.md) for full template documentation.

---

## Icelandic Language Support

All assistants support Icelandic with:

### BIN API Integration
Uses Beygingarlýsing íslensks nútímamáls (BÍN) for word forms:

```javascript
const declension = require('./src/services/service-icelandic-declension');

// Get all forms of a word
await declension.getAllForms('hestur');
// ['hestur', 'hesturinn', 'hest', 'hestinn', 'hesti', ...]

// Check if text contains word in any form
await declension.textContainsWord('Sönnu Magdalenu', 'Sanna');
// true (matches 'Sönnu')
```

### Pre-cached Names
Common Icelandic names are pre-cached since BÍN doesn't cover all personal names:
```javascript
'sanna': ['sanna', 'sönnu']
'gunnar': ['gunnar', 'gunnari', 'gunnars']
'sæþór': ['sæþór', 'sæþóri', 'sæþórs']
```

---

## Debugging

### Check Gemini Logs
```bash
gcloud run services logs read events-service --region europe-west1 --limit 50 | grep -i gemini
```

### Test Vector Search
```javascript
const embedding = await embeddingService.generateEmbedding('your query');
const docs = await vectorSearch.searchSimilar(embedding, {
  limit: 5,
  threshold: 0.3,
  boostPolicySources: true,
  queryText: 'your query',
});
docs.forEach(d => console.log(`${d.similarity.toFixed(3)} - ${d.title}`));
```

### Verify RAG Answers
```bash
node scripts/verify-kimi-answers.js
```

---

## Secrets

| Secret | Service | Purpose |
|--------|---------|---------|
| `GEMINI_API_KEY` | Gemini | Sysadmin, Member Assistant, Email |
| `kimi-api-key` | Moonshot | Party Wiki |
| `brave-search-api-key` | Brave | Web search fallback |

---

## Deployment

```bash
cd services/svc-events && ./deploy.sh
```

After deploy, verify:
```bash
gcloud run services describe events-service --region europe-west1 --format='value(spec.template.spec.containers[0].env)'
```
