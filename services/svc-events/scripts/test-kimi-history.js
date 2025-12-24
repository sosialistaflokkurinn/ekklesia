#!/usr/bin/env node
const { execSync } = require('child_process');

// Get secrets
const KIMI_API_KEY = execSync('gcloud secrets versions access latest --secret=kimi-api-key 2>/dev/null').toString().trim();

process.env.GOOGLE_CLOUD_PROJECT = 'ekklesia-prod-10-2025';
process.env.DATABASE_HOST = 'localhost';
process.env.DATABASE_PORT = '5433';
process.env.DATABASE_NAME = 'socialism';
process.env.DATABASE_USER = 'socialism';
process.env.DATABASE_PASSWORD = 'Socialism2025#Db';

const axios = require('axios');
const embeddingService = require('/home/gudro/Development/projects/ekklesia/services/svc-events/src/services/service-embedding');
const vectorSearch = require('/home/gudro/Development/projects/ekklesia/services/svc-events/src/services/service-vector-search');

const KIMI_API_BASE = 'https://api.moonshot.ai/v1';
const KIMI_MODEL = 'kimi-k2-0711-preview';

const SYSTEM_PROMPT = `Þú ert aðstoðarmaður fyrir félaga í Sósíalistaflokknum.

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
</context>`;

const HISTORY_QUESTIONS = [
  // Stofnun
  'Hvenær var Sósíalistaflokkurinn stofnaður?',
  'Hvar var stofnfundur flokksins haldinn?',
  'Hver stofnaði Sósíalistaflokkinn?',
  'Hvað gerðist 3. apríl 2017?',
  'Hversu margir stofnfélagar skráðu sig?',

  // Skipulag
  'Er formaður í Sósíalistaflokknum?',
  'Hver er valdamesta stjórn flokksins?',
  'Hvað gerir framkvæmdastjórn?',
  'Hvernig er skipulag flokksins?',
  'Hvað er sérstakt við formann kosningastjórnar?',

  // Kosningar
  'Bauð flokkurinn fram í Alþingiskosningunum 2017?',
  'Hversu mikið fylgi fékk flokkurinn 2021?',
  'Af hverju náði flokkurinn ekki þingsæti 2021?',
  'Hver var fyrsti kjörni fulltrúi flokksins?',
  'Hvar bauð flokkurinn fram 2018?',

  // Fólk
  'Hver er STOFNANDI_B?',
  'Hver er STOFNANDI_A?',
  'Hvaða reynslu hafði STOFNANDI_A í fjölmiðlum?',

  // Almennt
  'Hvað er markmið Sósíalistaflokksins?',
  'Hversu marga borgarfulltrúa fékk flokkurinn 2022?',
  'Hversu mikið fylgi fékk flokkurinn 2024?',

  // Samanburður - Efling og flokkurinn
  'Hverjir voru bæði á B-lista Eflingar og hjá Sósíalistaflokknum?',
  'Hver var tengsl Sólveigar Önnu við flokkinn?',
  'Af hverju sagði PERSON_01 af sér 2021?',
  'Hvað gerðist með B-lista Eflingar 2022?',

  // Samanburður - Oddvitar og framboð
  'Hverjir voru oddvitar í Alþingiskosningum 2021 og 2024?',
  'Hverjir buðu fram bæði 2021 og 2024?',
  'Hver var oddviti í Norðausturkjördæmi 2021?',
  'Hverjir voru borgarfulltrúar í Reykjavík bæði 2018 og 2022?',

  // Samanburður - Tímabil
  'Hvernig breyttist fylgi flokksins frá 2021 til 2024?',
  'Hvað gerðist milli sveitarstjórnarkosninga 2018 og 2022?',
  'Hver var fyrst kosin í Reykjavík og hvað gerðist síðar?',
];

function formatContext(documents) {
  return documents.map((doc, i) => {
    const citation = doc.citation || {};
    return `--- Heimild ${i + 1} ---
Titill: ${doc.title}
Hver: ${citation.who || 'Óþekkt'}
Hvenær: ${citation.when || 'Óþekkt'}
Samhengi: ${citation.context || 'Óþekkt'}

${doc.content}
`;
  }).join('\n\n');
}

async function askKimi(question, context) {
  const prompt = SYSTEM_PROMPT.replace('{{CONTEXT}}', context);

  const response = await axios.post(
    `${KIMI_API_BASE}/chat/completions`,
    {
      model: KIMI_MODEL,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: question },
      ],
      max_tokens: 500,
      temperature: 0.3,
    },
    {
      headers: {
        'Authorization': `Bearer ${KIMI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    }
  );

  return response.data.choices[0].message.content;
}

async function main() {
  console.log('='.repeat(70));
  console.log(`KIMI SÖGUPRÓFUN - ${HISTORY_QUESTIONS.length} spurningar`);
  console.log('='.repeat(70) + '\n');

  for (let i = 0; i < HISTORY_QUESTIONS.length; i++) {
    const q = HISTORY_QUESTIONS[i];
    console.log(`\n[${i + 1}/${HISTORY_QUESTIONS.length}] ${q}`);
    console.log('-'.repeat(70));

    try {
      // 1. Get embedding
      const embedding = await embeddingService.generateEmbedding(q);

      // 2. Search for relevant documents
      const documents = await vectorSearch.searchSimilar(embedding, {
        limit: 3,
        threshold: 0.4,
        boostPolicySources: true,
        queryText: q,
      });

      // 3. Format context
      const context = formatContext(documents);

      // 4. Ask Kimi
      const answer = await askKimi(q, context);

      console.log('\n' + answer);
      console.log('\n📚 Heimildir:', documents.map(d => d.title).join(' | '));

    } catch (error) {
      console.log('❌ Villa:', error.message);
    }

    // Delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('\n' + '='.repeat(70));
  console.log('PRÓFUN LOKIÐ');
  console.log('='.repeat(70));

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
