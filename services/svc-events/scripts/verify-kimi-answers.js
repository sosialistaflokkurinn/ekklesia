#!/usr/bin/env node
/**
 * Kimi Answer Verification Test
 *
 * Tests Kimi's RAG responses against web sources for accuracy.
 *
 * Usage: node scripts/verify-kimi-answers.js
 */

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
const embeddingService = require('../src/services/service-embedding');
const vectorSearch = require('../src/services/service-vector-search');

const KIMI_API_BASE = 'https://api.moonshot.ai/v1';
const KIMI_MODEL = 'kimi-k2-0711-preview';

// 10 verification questions with expected facts to check
const VERIFICATION_TESTS = [
  {
    id: 1,
    question: 'Hvenær var Sósíalistaflokkurinn stofnaður og hvar?',
    expectedFacts: [
      { fact: 'Stofnaður 1. maí 2017', required: true },
      { fact: 'Tjarnarbíó', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur Íslands stofnun 2017 Tjarnarbíó',
  },
  {
    id: 2,
    question: 'Hver var fyrsti kjörni fulltrúi Sósíalistaflokksins?',
    expectedFacts: [
      { fact: 'Sanna Magdalena Mörtudóttir', required: true },
      { fact: '2018', required: true },
      { fact: 'borgarfulltrúi', required: false },
    ],
    webSearchQuery: 'Sanna Magdalena Mörtudóttir Sósíalistaflokkur borgarfulltrúi 2018',
  },
  {
    id: 3,
    question: 'Hversu mikið fylgi fékk flokkurinn í Alþingiskosningunum 2021?',
    expectedFacts: [
      { fact: '4,1%', required: true },
      { fact: 'náði ekki 5% þröskuldinum', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur Íslands Alþingiskosningar 2021 fylgi prósent',
  },
  {
    id: 4,
    question: 'Hver stofnaði Sósíalistaflokkinn?',
    expectedFacts: [
      { fact: 'Gunnar Smári Egilsson', required: true },
    ],
    webSearchQuery: 'Gunnar Smári Egilsson Sósíalistaflokkur stofnandi',
  },
  {
    id: 5,
    question: 'Hvað segir flokkurinn um heilbrigðisþjónustu í kosningaprófi RÚV 2024?',
    expectedFacts: [
      { fact: 'gjaldfrjáls', required: false },
      { fact: 'draga úr kostnaðarþátttöku', required: false },
      { fact: 'sammála', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur kosningapróf RÚV 2024 heilbrigðismál',
  },
  {
    id: 6,
    question: 'Hversu marga borgarfulltrúa fékk flokkurinn í sveitarstjórnarkosningunum 2022?',
    expectedFacts: [
      { fact: '2', required: true },
      { fact: 'Reykjavík', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur sveitarstjórnarkosningar 2022 borgarfulltrúar Reykjavík',
  },
  {
    id: 7,
    question: 'Hver er formaður Eflingar og hvernig tengist hann/hún flokknum?',
    expectedFacts: [
      { fact: 'Sólveig Anna Jónsdóttir', required: true },
      { fact: 'frambjóðandi', required: false },
    ],
    webSearchQuery: 'Sólveig Anna Jónsdóttir Efling Sósíalistaflokkur',
  },
  {
    id: 8,
    question: 'Hvað er afstaða flokksins til NATO og hernaðar?',
    expectedFacts: [
      { fact: 'NATO', required: true },
      { fact: 'herlaust', required: false },
      { fact: 'friður', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur Íslands NATO hernaður stefna',
  },
  {
    id: 9,
    question: 'Hver var oddviti flokksins í Reykjavík Norður í Alþingiskosningunum 2024?',
    expectedFacts: [
      { fact: 'Gunnar Smári', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur Alþingiskosningar 2024 Reykjavík Norður oddviti',
  },
  {
    id: 10,
    question: 'Hvað er Vor til vinstri?',
    expectedFacts: [
      { fact: 'Sanna Magdalena', required: true },  // Base form
      { fact: 'framboð', required: true },
      { fact: '2026', required: false },
      { fact: 'borgarstjórnarkosning', required: false },
    ],
    webSearchQuery: 'Vor til vinstri Sanna Magdalena 2026',
  },
  // === NÝ PRÓF 11-20 ===
  {
    id: 11,
    question: 'Hvað segir flokkurinn um byggingariðnað og regluverk í kosningaprófi RÚV 2024?',
    expectedFacts: [
      { fact: 'ósammála', required: true },  // MJÖG ÓSAMMÁLA við að slaka á regluverki
      { fact: 'regluverk', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur kosningapróf RÚV 2024 byggingariðnaður regluverk',
  },
  {
    id: 12,
    question: 'Hversu mikið fylgi fékk flokkurinn í Reykjavík í sveitarstjórnarkosningunum 2018?',
    expectedFacts: [
      { fact: '6,4%', required: true },
      { fact: 'Reykjavík', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur sveitarstjórnarkosningar 2018 Reykjavík fylgi prósent',
  },
  {
    id: 13,
    question: 'Hver var oddviti flokksins í Reykjavík Suður í Alþingiskosningunum 2024?',
    expectedFacts: [
      { fact: 'Sanna Magdalena', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur Alþingiskosningar 2024 Reykjavík Suður oddviti',
  },
  {
    id: 14,
    question: 'Hvað gerðist á aðalfundi flokksins í maí 2025?',
    expectedFacts: [
      { fact: 'Sæþór', required: true },  // Sæþór Benjamín became new formaður
      { fact: 'framkvæmdastjórn', required: false },
      { fact: 'valdaskipti', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur aðalfundur 2025 Sæþór Benjamín',
  },
  {
    id: 15,
    question: 'Hvað er afstaða flokksins til styttingar vinnuvikunnar?',
    expectedFacts: [
      { fact: 'stytting', required: true },  // Base form
      { fact: 'sammála', required: false },
      { fact: '35', required: false },  // 35 stunda vinnuvika
    ],
    webSearchQuery: 'Sósíalistaflokkur stytting vinnuviku 35 stundir',
  },
  {
    id: 16,
    question: 'Hver var formaður framkvæmdastjórnar flokksins upphaflega?',
    expectedFacts: [
      { fact: 'Gunnar Smári', required: true },
      { fact: 'formaður', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur framkvæmdastjórn formaður Gunnar Smári',
  },
  {
    id: 17,
    question: 'Hvað segir flokkurinn um kvótakerfið í sjávarútvegi?',
    expectedFacts: [
      { fact: 'kvóta', required: true },
      { fact: 'þjóðar', required: false },  // auðlind þjóðarinnar
      { fact: 'afnema', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur kvótakerfi sjávarútvegur afnema',
  },
  {
    id: 18,
    question: 'Hvaða borgarfulltrúar áttu sæti fyrir flokkinn eftir kosningarnar 2022?',
    expectedFacts: [
      { fact: 'Sanna Magdalena', required: true },
      { fact: 'Trausti', required: true },  // Trausti Breiðfjörð Magnússon
    ],
    webSearchQuery: 'Sósíalistaflokkur borgarfulltrúar 2022 Sanna Trausti',
  },
  {
    id: 19,
    question: 'Hvað er B-listi Eflingar og hvernig tengist hann flokknum?',
    expectedFacts: [
      { fact: 'Efling', required: true },
      { fact: 'Sólveig', required: false },
      { fact: 'stéttarfélag', required: false },
    ],
    webSearchQuery: 'B-listi Eflingar Sósíalistaflokkur Sólveig Anna',
  },
  {
    id: 20,
    question: 'Hvenær tilkynnti Gunnar Smári stofnun flokksins og hvar?',
    expectedFacts: [
      { fact: 'apríl 2017', required: true },
      { fact: 'Harmageddon', required: false },
      { fact: 'X-inu', required: false },
    ],
    webSearchQuery: 'Gunnar Smári Egilsson tilkynnti stofnun Sósíalistaflokkur apríl 2017',
  },
  // Tests 21-25: Fjármál flokksins og klofningur
  {
    id: 21,
    question: 'Hvað er Vorstjarnan og hvernig tengist hún flokknum?',
    expectedFacts: [
      { fact: 'Vorstjarnan', required: true },
      { fact: 'leiga', required: false },
      { fact: 'styrkur', required: false },
    ],
    webSearchQuery: 'Vorstjarnan Sósíalistaflokkur félagasamtök',
  },
  {
    id: 22,
    question: 'Hvað er Alþýðufélagið og Samstöðin?',
    expectedFacts: [
      { fact: 'Alþýðufélag', required: true },
      { fact: 'Samstöð', required: true },
      { fact: 'áskrifend', required: false },
    ],
    webSearchQuery: 'Alþýðufélagið Samstöðin samstodin.is',
  },
  {
    id: 23,
    question: 'Hvað var stefna flokksins um fjármál kjörinna fulltrúa 2021?',
    expectedFacts: [
      { fact: 'elítustjórnmál', required: false },
      { fact: 'Vorstjörn', required: true },
      { fact: 'laun', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur burt með elítustjórnmál 2021 laun Vorstjarnan',
  },
  {
    id: 24,
    question: 'Hvert fóru peningar flokksins - ríkisstyrkur og félagsgjöld?',
    expectedFacts: [
      { fact: 'Vorstjörn', required: true },
      { fact: 'Alþýðufélag', required: true },
      { fact: '50%', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur fjármál ríkisstyrkur Vorstjarnan Alþýðufélagið',
  },
  {
    id: 25,
    question: 'Hversu mikið var í kosningasjóði flokksins fyrir kosningarnar 2024?',
    expectedFacts: [
      { fact: 'núll', required: true },
      { fact: 'kosningasjóð', required: false },
      { fact: '2024', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur kosningasjóður 2024 fjármál',
  },
];

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

async function askKimi(question) {
  // Get embedding
  const embedding = await embeddingService.generateEmbedding(question);

  // Search for relevant documents
  const documents = await vectorSearch.searchSimilar(embedding, {
    limit: 3,
    threshold: 0.3,
    boostPolicySources: true,
    queryText: question,
  });

  // Format context
  const context = documents.map((doc, i) => {
    return `--- Heimild ${i + 1}: ${doc.title} ---\n${doc.content}`;
  }).join('\n\n');

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

  return {
    answer: response.data.choices[0].message.content,
    sources: documents.map(d => d.title),
  };
}

function checkFacts(answer, expectedFacts) {
  const results = [];
  const answerLower = answer.toLowerCase();

  for (const { fact, required } of expectedFacts) {
    const factLower = fact.toLowerCase();
    const found = answerLower.includes(factLower);
    results.push({
      fact,
      required,
      found,
      status: found ? '✅' : (required ? '❌' : '⚠️'),
    });
  }

  return results;
}

async function runTest(test) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`PRÓF ${test.id}: ${test.question}`);
  console.log('='.repeat(70));

  try {
    // Get Kimi's answer
    console.log('\n📤 Spyr Kimi...');
    const { answer, sources } = await askKimi(test.question);

    console.log('\n📥 SVAR KIMI:');
    console.log('-'.repeat(50));
    console.log(answer);
    console.log('-'.repeat(50));
    console.log('Heimildir:', sources.join(' | '));

    // Check expected facts
    console.log('\n🔍 SANNVOTTUN:');
    const factResults = checkFacts(answer, test.expectedFacts);

    let requiredPassed = 0;
    let requiredTotal = 0;

    for (const r of factResults) {
      console.log(`  ${r.status} "${r.fact}" ${r.required ? '(krafist)' : '(valkvætt)'}`);
      if (r.required) {
        requiredTotal++;
        if (r.found) requiredPassed++;
      }
    }

    const passed = requiredPassed === requiredTotal;
    console.log(`\n📊 Niðurstaða: ${passed ? '✅ STAÐIST' : '❌ MISTÓKST'} (${requiredPassed}/${requiredTotal} kröfur uppfylltar)`);

    return {
      id: test.id,
      question: test.question,
      passed,
      requiredPassed,
      requiredTotal,
      answer,
    };

  } catch (error) {
    console.log(`\n❌ Villa: ${error.message}`);
    return {
      id: test.id,
      question: test.question,
      passed: false,
      error: error.message,
    };
  }
}

async function main() {
  const totalTests = VERIFICATION_TESTS.length;
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log(`║         KIMI SANNVOTTUNARPRÓF - ${totalTests} spurningar                      ║`);
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  const results = [];

  for (const test of VERIFICATION_TESTS) {
    const result = await runTest(test);
    results.push(result);

    // Delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 2000));
  }

  // Summary
  console.log('\n\n' + '═'.repeat(70));
  console.log('SAMANTEKT');
  console.log('═'.repeat(70));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`\n✅ Staðist: ${passed}/${total}`);
  console.log(`❌ Mistókst: ${failed}/${total}`);
  console.log(`📊 Nákvæmni: ${(passed / total * 100).toFixed(0)}%`);

  if (failed > 0) {
    console.log('\n❌ Mistókust próf:');
    for (const r of results.filter(r => !r.passed)) {
      console.log(`  - Próf ${r.id}: ${r.question}`);
    }
  }

  console.log('\n' + '═'.repeat(70));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Villa:', err.message);
  process.exit(1);
});
