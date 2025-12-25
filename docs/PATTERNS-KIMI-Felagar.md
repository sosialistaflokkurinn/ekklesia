# PATTERNS-KIMI-Felagar

Kimi AI assistants in svc-events. Two distinct architectures:

| | Party Wiki 📚 | Member Assistant ? |
|---|---|---|
| Route | `route-party-wiki.js` | `route-member-assistant.js` |
| Frontend | `party-wiki-chat.js` | `member-assistant-chat.js` |
| Tech | Static system prompt | RAG + pgvector + embeddings |
| Knowledge | Hardcoded facts | Dynamic document retrieval |
| Use case | Quick facts | Deep research with citations |

---

## Member Assistant (RAG) Architecture

```
Query → Vertex AI Embedding → pgvector Search → Context Assembly → Kimi LLM → Response
```

### Components

| Component | File | Purpose |
|-----------|------|---------|
| Embedding | `src/services/service-embedding.js` | Vertex AI text-embedding-004 (768 dim) |
| Vector Search | `src/services/service-vector-search.js` | pgvector cosine similarity with boosts |
| Verification | `scripts/verify-kimi-answers.js` | 20 tests, expected facts validation |

---

## Party Wiki Architecture

Static knowledge embedded in system prompt. No database queries.

| Component | File | Purpose |
|-----------|------|---------|
| Route | `src/routes/route-party-wiki.js` | Hardcoded party knowledge |
| Frontend | `js/components/party-wiki-chat.js` | Chat widget |

Knowledge includes: party history, structure, key people, policies (all hardcoded).

---

## Database Schema

```sql
-- Table: rag_documents (Cloud SQL PostgreSQL with pgvector)
CREATE TABLE rag_documents (
    id SERIAL PRIMARY KEY,
    source_type VARCHAR(50) NOT NULL,    -- 'party-website', 'kosningaprof-2024', 'discourse-archive', 'discourse-person'
    source_url TEXT,
    source_date DATE,
    chunk_id VARCHAR(100) NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    citation JSONB NOT NULL,             -- {"who": "...", "when": "...", "context": "..."}
    embedding vector(768),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(source_type, chunk_id)
);

-- HNSW index for fast similarity search
CREATE INDEX ON rag_documents USING hnsw (embedding vector_cosine_ops);
```

---

## Scoring Formula

```
final_score = cosine_similarity × source_boost × title_boost × content_boost
```

### Source Type Boosts

| source_type | Boost | Rationale |
|-------------|-------|-----------|
| `party-website` | 1.3x | Official policy statements |
| `kosningaprof-2024` | 1.2x | Recent verified positions |
| `discourse-archive` | 1.2x | Historical party discussions |
| `discourse-person` | 0.6x | Reduce individual profiles noise |

### Title Keyword Boost

1.5x when query keywords match document title.

Keyword extraction:
- Remove common Icelandic words: `hvað, segir, flokkurinn, stefna, er, um, til, að, og...`
- Stem common suffixes: `mála→mál, málum→mál, inu→, inn→, num→`
- Normalize accents: `á→a, é→e, í→i, ó→o, ú→u, ý→y, ð→d, þ→th, æ→ae, ö→o`

### Year Boost

2.0x when query contains year (2017-2030) and document title contains same year.

Example: Query "frambjóðendur 2018" → boost documents with "2018" in title.

### Content Boosts (Historical Facts)

For specific query patterns, boost documents containing factual answers:

| Query Pattern | Boost Logic |
|---------------|-------------|
| `fyrsti kjörni fulltrúi` | 2.5x if content contains "fyrsti kjörni" |
| `stofnandi/stofnaði` | 3.0x for Saga doc, 2.8x for STOFNANDI_A doc |
| `vor til vinstri` | 2.5x if content contains "vor til vinstri" |
| `aðalfund* 2025` / `hallarbylting` | 3.0x for aðalfund+hallarbylting title |
| `formaður framkvæmdastjórnar` | 3.0x for STOFNANDI_A + formaður match |

---

## Keyword → Topic Mapping

Maps query keywords to policy document titles for title boost matching:

```javascript
const keywordToTopic = {
  // Utanríkismál
  'nato': 'utanríkismál', 'hernaðar': 'utanríkismál', 'friðar': 'utanríkismál',
  'úkraín': 'utanríkismál', 'gaza': 'utanríkismál', 'palestín': 'utanríkismál',

  // Auðlindamál
  'kvóta': 'auðlindamál', 'fisk': 'auðlindamál', 'sjávar': 'auðlindamál',

  // Menntamál
  'skóla': 'menntamál', 'háskóla': 'menntamál', 'kennar': 'menntamál',

  // Heilbrigðismál
  'lækn': 'heilbrigðismál', 'sjúkra': 'heilbrigðismál', 'spítal': 'heilbrigðismál',

  // Húsnæðismál
  'íbúð': 'húsnæðismál', 'leig': 'húsnæðismál', 'húsnæð': 'húsnæðismál',

  // Loftslagsmál / Umhverfismál
  'loftsla': 'loftslagsmál', 'umhverf': 'umhverfis', 'náttúr': 'umhverfis',

  // Vinnumarkaðsmál
  'laun': 'vinnumarkaðsmál', 'vinnu': 'vinnumarkaðsmál', 'styttingu': 'vinnumarkaðsmál',

  // Ríkisfjármál
  'skatt': 'ríkisfjármál', 'auðlegð': 'ríkisfjármál', 'auðmenn': 'ríkisfjármál',

  // Saga og skipulag
  'saga': 'saga', 'stofn': 'stofnun', 'skipulag': 'skipulag', 'formaður': 'skipulag',
  'frambjóðend': 'frambjóðendur', 'oddvit': 'frambjóðendur',

  // Efling
  'efling': 'efling', 'b-list': 'efling', 'sólveig anna': 'efling',
};
```

---

## Verification Test Pattern

Structure for testing RAG accuracy:

```javascript
{
  id: 1,
  question: 'Hvenær var Sósíalistaflokkurinn stofnaður?',
  expectedFacts: [
    { fact: '1. maí 2017', required: true },   // Must appear in answer
    { fact: 'Tjarnarbíó', required: true },    // Must appear in answer
    { fact: 'Reykjavík', required: false },    // Nice to have
  ],
  webSearchQuery: 'Sósíalistaflokkur stofnun 2017',  // For manual verification
}
```

### Expected Facts Rules

1. **Use base forms** (nominative), not inflected forms
   - `STOFNANDI_B` (correct)
   - `STOFNANDI_B` (wrong - dative)

2. **Case-insensitive matching**
   - `answer.toLowerCase().includes(fact.toLowerCase())`

3. **Test passes if**: all `required: true` facts found

4. **Scoring**:
   - Pass: all required facts present
   - Fail: any required fact missing

---

## Adding New Content Boosts

When Kimi fails to retrieve correct documents for specific fact queries:

```javascript
// In service-vector-search.js, inside the contentBoostClause section:

// Pattern: [describe query type]
if (queryLower.includes('keyword1') && queryLower.includes('keyword2')) {
  contentBoostClause = `CASE
    WHEN LOWER(title) LIKE '%exact_match%' THEN 3.0
    WHEN LOWER(content) LIKE '%content_pattern%' THEN 2.5
    ELSE ${contentBoostClause} END`;
}
```

### Boost Values

| Boost | Use Case |
|-------|----------|
| 3.0x | Exact title match for specific document |
| 2.5x | Strong content match |
| 2.0x | Partial match or fallback document |
| 1.5x | General keyword relevance |

---

## Adding New Verification Tests

1. Add test object to `VERIFICATION_TESTS` array in `scripts/verify-kimi-answers.js`
2. Use base forms for expected facts
3. Mark critical facts as `required: true`
4. Include web search query for manual verification
5. Run: `node scripts/verify-kimi-answers.js`

---

## System Prompt Pattern

```
Þú ert aðstoðarmaður fyrir félaga í Sósíalistaflokknum.

## HEIMILDAVÍSANIR
Þegar þú vitnar í skoðanir eða staðhæfingar tilgreindu:
1. HVER sagði/svaraði
2. HVENÆR (ár eða dagsetning)
3. Í HVAÐA SAMHENGI

## REGLUR
1. Svaraðu AÐEINS á grundvelli heimildanna
2. Ef upplýsingar vantar: "Ég hef ekki upplýsingar um þetta"
3. Svaraðu stuttlega og hnitmiðað

## HEIMILD
<context>
{{CONTEXT}}
</context>
```

---

## Common Issues

### Issue: Wrong document retrieved

**Symptom**: Kimi answers with incorrect information or says "no information"

**Fix**: Add content boost for the specific query pattern

### Issue: Test fails but answer looks correct

**Symptom**: Verification test fails, but manual review shows answer is correct

**Fix**: Check for Icelandic inflection - use base form in expectedFacts

### Issue: Irrelevant person profiles ranked high

**Symptom**: discourse-person documents appear in top results

**Fix**: Already handled by 0.6x source_type boost penalty

---

## Debugging

### Check retrieved documents

```javascript
// In verify-kimi-answers.js, the askKimi function logs sources:
console.log('Heimildir:', sources.join(' | '));
```

### Test vector search directly

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

---

## Files Reference

| File | Purpose |
|------|---------|
| `src/services/service-embedding.js` | Vertex AI embedding generation |
| `src/services/service-vector-search.js` | pgvector search with boosts |
| `scripts/verify-kimi-answers.js` | 20 verification tests |
| `scripts/index-*.js` | Document indexing scripts |
