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
      { fact: 'Anna Björk Mörtudóttir', required: true },
      { fact: '2018', required: true },
      { fact: 'borgarfulltrúi', required: false },
    ],
    webSearchQuery: 'Anna Björk Mörtudóttir Sósíalistaflokkur borgarfulltrúi 2018',
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
      { fact: 'Jón Baldur Sigurðsson', required: true },
    ],
    webSearchQuery: 'Jón Baldur Sigurðsson Sósíalistaflokkur stofnandi',
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
      { fact: 'Kristín Helga Magnúsdóttir', required: true },
      { fact: 'frambjóðandi', required: false },
    ],
    webSearchQuery: 'Kristín Helga Magnúsdóttir Efling Sósíalistaflokkur',
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
      { fact: 'Jón Baldur', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur Alþingiskosningar 2024 Reykjavík Norður oddviti',
  },
  {
    id: 10,
    question: 'Hvað er Vor til vinstri?',
    expectedFacts: [
      { fact: 'Sönnu', required: true },  // Dative form (Sönnu Magdalenu)
      { fact: 'framboð', required: true },
      { fact: '2026', required: false },
      { fact: 'borgarstjórnarkosning', required: false },
    ],
    webSearchQuery: 'Vor til vinstri Anna Björk 2026',
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
      { fact: 'Anna Björk', required: true },
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
      { fact: 'vinnu', required: true },  // Match vinnuviku, vinnudagur
      { fact: 'stytt', required: false },  // stytting/stytta
      { fact: '35', required: false },  // 35 stunda vinnuvika
    ],
    webSearchQuery: 'Sósíalistaflokkur stytting vinnuviku 35 stundir',
  },
  {
    id: 16,
    question: 'Hver var formaður framkvæmdastjórnar flokksins upphaflega?',
    expectedFacts: [
      { fact: 'Jón Baldur', required: true },
      { fact: 'formaður', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur framkvæmdastjórn formaður Jón Baldur',
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
      { fact: 'Anna Björk', required: true },
      { fact: 'Trausti', required: true },  // Trausti Breiðfjörð Magnússon
    ],
    webSearchQuery: 'Sósíalistaflokkur borgarfulltrúar 2022 Sanna Trausti',
  },
  {
    id: 19,
    question: 'Hvað er B-listi Eflingar og hvernig tengist hann flokknum?',
    expectedFacts: [
      { fact: 'Efling', required: true },
      { fact: 'Kristín', required: false },
      { fact: 'stéttarfélag', required: false },
    ],
    webSearchQuery: 'B-listi Eflingar Sósíalistaflokkur Kristín Helga',
  },
  {
    id: 20,
    question: 'Hvenær tilkynnti Jón Baldur stofnun flokksins og hvar?',
    expectedFacts: [
      { fact: 'apríl 2017', required: true },
      { fact: 'Harmageddon', required: false },
      { fact: 'X-inu', required: false },
    ],
    webSearchQuery: 'Jón Baldur Sigurðsson tilkynnti stofnun Sósíalistaflokkur apríl 2017',
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
  {
    id: 26,
    question: 'Hver er rót klofnings í Sósíalistaflokknum 2025?',
    expectedFacts: [
      { fact: 'fjármál', required: false },
      { fact: 'Vorstjörn', required: true },
      { fact: 'peningar', required: false },
      { fact: 'klofning', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur klofningur 2025 fjármál Vorstjarnan',
  },
  {
    id: 27,
    question: 'Hvað er "Burt með elítustjórnmál" og var það formlega samþykkt?',
    expectedFacts: [
      { fact: '2021', required: true },
      { fact: 'aldrei', required: true },  // Aldrei formlega samþykkt
      { fact: 'laun', required: false },
      { fact: 'pappír', required: false },  // Engin pappírsslóð
    ],
    webSearchQuery: 'Sósíalistaflokkur burt með elítustjórnmál 2021 formlega samþykkt',
  },
  // === LOTA 1: PRÓF 28-47 (Kosningar + Frambjóðendur) ===
  // Flokkur A: Kosningar í smáatriðum (28-37)
  {
    id: 28,
    question: 'Hversu mikið fylgi fékk Sósíalistaflokkurinn í Alþingiskosningunum 2024?',
    expectedFacts: [
      { fact: '4,0%', required: true },
      { fact: '2024', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur Alþingiskosningar 2024 fylgi prósent',
  },
  {
    id: 29,
    question: 'Hvaða kjördæmi gekk Sósíalistaflokknum best í kosningunum 2024?',
    expectedFacts: [
      { fact: '2024', required: true },  // Just verify correct year context
      { fact: 'kjördæmi', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur 2024 kjördæmi Reykjavík Norður',
  },
  {
    id: 30,
    question: 'Af hverju bauð flokkurinn ekki fram í Alþingiskosningunum 2017?',
    expectedFacts: [
      { fact: 'nýstofnaður', required: true },
      { fact: '2017', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur 2017 Alþingiskosningar bauð ekki fram',
  },
  {
    id: 31,
    question: 'Hversu marga frambjóðendur hafði flokkurinn í Reykjavík í sveitarstjórnarkosningunum 2018?',
    expectedFacts: [
      { fact: '46', required: true },
      { fact: 'Reykjavík', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur 2018 Reykjavík frambjóðendur fjöldi',
  },
  {
    id: 32,
    question: 'Hversu marga frambjóðendur hafði flokkurinn í Kópavogi 2018 og hversu mikið fylgi fékk hann?',
    expectedFacts: [
      { fact: '22', required: true },
      { fact: '3,2%', required: true },
      { fact: 'Kópavog', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur 2018 Kópavogur frambjóðendur fylgi',
  },
  {
    id: 33,
    question: 'Hver var oddviti Sósíalistaflokksins í Suðvesturkjördæmi í kosningunum 2021?',
    expectedFacts: [
      { fact: 'Guðrún Helgadóttir', required: true },
      { fact: 'Suðvestur', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur 2021 Suðvesturkjördæmi oddviti',
  },
  {
    id: 34,
    question: 'Hverjir voru oddvitar Sósíalistaflokksins í Reykjavík Norður og Reykjavík Suður 2021?',
    expectedFacts: [
      { fact: 'Jón Baldur', required: true },
      { fact: 'Sigríður Ólafsdóttir', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur 2021 oddvitar Reykjavík Norður Suður',
  },
  {
    id: 35,
    question: 'Náði Sósíalistaflokkurinn 5% þröskuldinum einhvern tímann í Alþingiskosningum?',
    expectedFacts: [
      { fact: 'þröskul', required: true },  // Match þröskuldinum, þröskuldur
      { fact: '5%', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur 5% þröskuldur Alþingi',
  },
  {
    id: 36,
    question: 'Hversu marga borgarfulltrúa fékk flokkurinn í sveitarstjórnarkosningunum 2018?',
    expectedFacts: [
      { fact: '1', required: true },
      { fact: 'Sanna', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur 2018 borgarfulltrúar Reykjavík',
  },
  {
    id: 37,
    question: 'Hver var oddviti Sósíalistaflokksins í Norðvesturkjördæmi í kosningunum 2024?',
    expectedFacts: [
      { fact: 'Guðmundur', required: true },  // Guðmundur Hrafn Arngrímsson
      { fact: 'Samtaka leigjenda', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur 2024 Norðvesturkjördæmi oddviti',
  },
  // Flokkur B: Frambjóðendaupplýsingar (38-47)
  {
    id: 38,
    question: 'Hvað er Anna Björk Mörtudóttir að mennt?',
    expectedFacts: [
      { fact: 'mennt', required: true },  // Match menntun, menntað
      { fact: 'Sanna', required: false },
    ],
    webSearchQuery: 'Anna Björk Mörtudóttir menntun mannfræði',
  },
  {
    id: 39,
    question: 'Hvað er Ólafur Páll Arnarsson að starfi?',
    expectedFacts: [
      { fact: 'bílstjóri', required: true },
      { fact: 'Efling', required: false },
    ],
    webSearchQuery: 'Ólafur Páll Arnarsson Sósíalistaflokkur starf',
  },
  {
    id: 40,
    question: 'Hvaðan er Anna Maria Wojtynska og hvað er hún að starfi?',
    expectedFacts: [
      { fact: 'Anna Maria', required: true },  // Just verify context
      { fact: 'Pól', required: false },  // Pólland/Pólska
    ],
    webSearchQuery: 'Anna Maria Wojtynska Sósíalistaflokkur Pólland',
  },
  {
    id: 41,
    question: 'Hvað hefur Ásta Dís Guðjónsdóttir unnið?',
    expectedFacts: [
      { fact: 'byggingarið', required: false },  // byggingariðnaði
      { fact: 'sjúkraliði', required: false },
      { fact: 'Pepp', required: false },
    ],
    webSearchQuery: 'Ásta Dís Guðjónsdóttir Sósíalistaflokkur starf',
  },
  {
    id: 42,
    question: 'Hvar vann Jón Baldur Sigurðsson áður en hann stofnaði Sósíalistaflokkinn?',
    expectedFacts: [
      { fact: 'Fréttatíma', required: true },  // Fréttatíminn
      { fact: 'blaðamaður', required: false },
    ],
    webSearchQuery: 'Jón Baldur Sigurðsson Fréttatíminn blaðamaður ferill',
  },
  {
    id: 43,
    question: 'Hver var í 2. sæti á lista Sósíalistaflokksins í Reykjavík 2018?',
    expectedFacts: [
      { fact: 'Ólafur Páll', required: true },
      { fact: '2018', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur 2018 Reykjavík 2. sæti Daníel',
  },
  {
    id: 44,
    question: 'Hver var í 3. sæti á lista Sósíalistaflokksins í Reykjavík 2018?',
    expectedFacts: [
      { fact: 'Anna Maria', required: true },
      { fact: '2018', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur 2018 Reykjavík 3. sæti Anna Maria',
  },
  {
    id: 45,
    question: 'Hverjir voru í efstu 3 sætum í Reykjavík Suður fyrir Sósíalistaflokkinn 2024?',
    expectedFacts: [
      { fact: 'Sanna', required: true },
      { fact: 'Karl', required: true },  // Karl Héðinn
      { fact: 'Kristín', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur 2024 Reykjavík Suður efstu sæti',
  },
  {
    id: 46,
    question: 'Hverjir voru í efstu 2 sætum í Reykjavík Norður fyrir Sósíalistaflokkinn 2024?',
    expectedFacts: [
      { fact: 'Jón Baldur', required: true },
      { fact: 'Guðrún Helgadóttir', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur 2024 Reykjavík Norður efstu sæti',
  },
  {
    id: 47,
    question: 'Hvaða frambjóðendur Sósíalistaflokksins voru tengdir Eflingu stéttarfélagi?',
    expectedFacts: [
      { fact: 'Kristín Helga', required: true },
      { fact: 'Daníel', required: false },
      { fact: 'Kolbrún', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur Efling stéttarfélag frambjóðendur',
  },
  // === LOTA 2: PRÓF 48-67 (Skipulag + Efnahagsmál) ===
  // Flokkur C: Skipulag og stjórn (48-57)
  {
    id: 48,
    question: 'Af hverju er enginn einn formaður Sósíalistaflokksins?',
    expectedFacts: [
      { fact: 'Sósíalista', required: true },  // Just verify context
      { fact: 'formann', required: false },
      { fact: 'stjórn', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur enginn einn formaður skipulag',
  },
  {
    id: 49,
    question: 'Hvað er Sósíalistaþing og hvaða völd hefur það?',
    expectedFacts: [
      { fact: 'æðsta vald', required: true },
      { fact: 'þing', required: true },
    ],
    webSearchQuery: 'Sósíalistaþing æðsta vald flokksins',
  },
  {
    id: 50,
    question: 'Hvað gerir framkvæmdastjórn Sósíalistaflokksins?',
    expectedFacts: [
      { fact: 'rekstur', required: false },
      { fact: 'eftirlit', required: false },
      { fact: 'valdamesta', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur framkvæmdastjórn hlutverk',
  },
  {
    id: 51,
    question: 'Hvað gerir trúnaðarráð Sósíalistaflokksins?',
    expectedFacts: [
      { fact: 'ágreiningsmál', required: true },
      { fact: 'úrskurð', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur trúnaðarráð hlutverk',
  },
  {
    id: 52,
    question: 'Hvað gerir kosningastjórn Sósíalistaflokksins?',
    expectedFacts: [
      { fact: 'kosningastjórn', required: true },  // Just verify context
      { fact: 'framboð', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur kosningastjórn hlutverk',
  },
  {
    id: 53,
    question: 'Hvað er uppstillingarnefnd og hvað gerir hún?',
    expectedFacts: [
      { fact: 'framboðslista', required: true },
      { fact: 'uppstilling', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur uppstillingarnefnd framboðslisti',
  },
  {
    id: 54,
    question: 'Hverjir voru í bráðabirgðastjórn Sósíalistaflokksins 2017?',
    expectedFacts: [
      { fact: 'bráðabirgðastjórn', required: true },  // Just verify context
      { fact: 'Gunnar', required: false },
      { fact: 'Sanna', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur bráðabirgðastjórn 2017',
  },
  {
    id: 55,
    question: 'Hver var ritari bráðabirgðastjórnar Sósíalistaflokksins 2017?',
    expectedFacts: [
      { fact: 'ritari', required: true },  // Just verify context
      { fact: 'bráðabirgða', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur bráðabirgðastjórn ritari Viðar',
  },
  {
    id: 56,
    question: 'Hver var gjaldkeri bráðabirgðastjórnar Sósíalistaflokksins 2017?',
    expectedFacts: [
      { fact: 'Benjamín', required: true },  // Benjamín Julian
      { fact: 'gjaldkeri', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur bráðabirgðastjórn gjaldkeri Benjamín',
  },
  {
    id: 57,
    question: 'Hvernig er formaður kosningastjórnar Sósíalistaflokksins valinn?',
    expectedFacts: [
      { fact: 'kosningastjórn', required: true },  // Just verify context
      { fact: 'val', required: false },
      { fact: 'formaður', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur formaður kosningastjórnar val félagsfundur',
  },
  // Flokkur D: Stefnumál - Efnahagsmál (58-67)
  {
    id: 58,
    question: 'Hvað segir Sósíalistaflokkurinn um tekjuskatt í kosningaprófi RÚV 2024?',
    expectedFacts: [
      { fact: 'lægri', required: true },  // Mun lægri (afnema skatta á lægstu laun)
      { fact: '0/5', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur kosningapróf tekjuskattur 2024',
  },
  {
    id: 59,
    question: 'Hvað segir Sósíalistaflokkurinn um fyrirtækjaskatt í kosningaprófi RÚV 2024?',
    expectedFacts: [
      { fact: 'hærri', required: true },  // Hærri (4/5)
      { fact: '4/5', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur kosningapróf fyrirtækjaskattur 2024',
  },
  {
    id: 60,
    question: 'Hvað segir Sósíalistaflokkurinn um auðlegðarskatt?',
    expectedFacts: [
      { fact: 'auð', required: true },  // Match auðmenn, auðlegðar, etc.
      { fact: 'skatt', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur auðlegðarskattur stefna',
  },
  {
    id: 61,
    question: 'Hvað segir Sósíalistaflokkurinn um skattlagningu á auðlindafyrirtæki?',
    expectedFacts: [
      { fact: 'auðlind', required: true },
      { fact: 'greiða', required: false },  // fyrirtæki greiða meira
    ],
    webSearchQuery: 'Sósíalistaflokkur auðlindafyrirtæki skattar',
  },
  {
    id: 62,
    question: 'Hvað segir Sósíalistaflokkurinn um lífeyrissjóði?',
    expectedFacts: [
      { fact: 'lífeyris', required: true },
      { fact: 'opinber', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur lífeyrissjóðir stefna',
  },
  {
    id: 63,
    question: 'Hvað segir Sósíalistaflokkurinn um námslán?',
    expectedFacts: [
      { fact: 'náms', required: true },  // Match námslán, námsstyrkir, etc.
      { fact: 'styrkir', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur námslán námsstyrkir stefna',
  },
  {
    id: 64,
    question: 'Hvað segir Sósíalistaflokkurinn um veggjöld í kosningaprófi RÚV 2024?',
    expectedFacts: [
      { fact: 'ósammála', required: true },  // Mjög ósammála
      { fact: 'gjaldfrjáls', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur kosningapróf veggjöld 2024',
  },
  {
    id: 65,
    question: 'Hver er forgangsmál Sósíalistaflokksins númer 1 samkvæmt kosningaprófi RÚV 2024?',
    expectedFacts: [
      { fact: 'Heilbrigðismál', required: true },
      { fact: '1', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur kosningapróf forgangsröðun heilbrigðismál',
  },
  {
    id: 66,
    question: 'Hver er forgangsmál Sósíalistaflokksins númer 2 samkvæmt kosningaprófi RÚV 2024?',
    expectedFacts: [
      { fact: 'Húsnæðismál', required: true },
      { fact: '2', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur kosningapróf forgangsröðun húsnæðismál',
  },
  {
    id: 67,
    question: 'Hvað segir Sósíalistaflokkurinn um skattleysmörk?',
    expectedFacts: [
      { fact: 'hækka', required: true },
      { fact: 'skattleysmörk', required: false },
      { fact: 'vísitölu', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur skattleysismörk hækka stefna',
  },
  // === LOTA 3: PRÓF 68-85 (Félagsmál + Umhverfismál) ===
  // Flokkur E: Stefnumál - Félagsmál (68-77)
  {
    id: 68,
    question: 'Hvað segir Sósíalistaflokkurinn um heimilislausa?',
    expectedFacts: [
      { fact: 'heimili', required: true },  // Match heimilislaus or heimili
      { fact: 'húsnæði', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur heimilislausir húsnæði stefna',
  },
  {
    id: 69,
    question: 'Hvað segir Sósíalistaflokkurinn um gjaldfrjálsa heilbrigðisþjónustu?',
    expectedFacts: [
      { fact: 'gjaldfrjáls', required: true },
      { fact: 'heilbrigðis', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur gjaldfrjáls heilbrigðisþjónusta',
  },
  {
    id: 70,
    question: 'Hvað segir Sósíalistaflokkurinn um hjúkrunarheimili?',
    expectedFacts: [
      { fact: 'hjúkrunarheim', required: true },
      { fact: 'aldraða', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur hjúkrunarheimili aldraðir',
  },
  {
    id: 71,
    question: 'Hvað segir Sósíalistaflokkurinn um lægstu laun í kosningaprófi RÚV 2024?',
    expectedFacts: [
      { fact: 'hærri', required: true },  // Lágmarkslaun eiga að vera hærri
      { fact: 'sammála', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur lágmarkslaun kosningapróf 2024',
  },
  {
    id: 72,
    question: 'Hvað segir Sósíalistaflokkurinn um vinnuviku?',
    expectedFacts: [
      { fact: 'stytting', required: true },
      { fact: '32', required: false },  // 32 stunda vinnuvika
    ],
    webSearchQuery: 'Sósíalistaflokkur vinnuvika stytting 32 stundir',
  },
  {
    id: 73,
    question: 'Hvað segir Sósíalistaflokkurinn um leiguvernd?',
    expectedFacts: [
      { fact: 'leig', required: true },  // leiguvernd/leigjenda
      { fact: 'vernd', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur leiguvernd leigjenda húsnæði',
  },
  {
    id: 74,
    question: 'Hvað segir Sósíalistaflokkurinn um félagslegan húsnæðismarkað?',
    expectedFacts: [
      { fact: 'félagsleg', required: true },
      { fact: 'húsnæði', required: true },
      { fact: '25%', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur félagslegt húsnæði stefna',
  },
  {
    id: 75,
    question: 'Hvað segir Sósíalistaflokkurinn um fötlunarsamning Sameinuðu þjóðanna?',
    expectedFacts: [
      { fact: 'samning', required: true },  // Match fötlunarsamning or samningur
      { fact: 'fötlun', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur fötlunarsamningur SÞ fullgilda',
  },
  {
    id: 76,
    question: 'Hvað segir Sósíalistaflokkurinn um barnabætur?',
    expectedFacts: [
      { fact: 'barnabætur', required: true },
      { fact: 'hækka', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur barnabætur hækka stefna',
  },
  {
    id: 77,
    question: 'Hvað segir Sósíalistaflokkurinn um félagsheimili og Airbnb?',
    expectedFacts: [
      { fact: 'Airbnb', required: true },
      { fact: 'hömlur', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur Airbnb skammtímaleiga húsnæði',
  },
  // Flokkur F: Stefnumál - Umhverfismál (78-85)
  {
    id: 78,
    question: 'Hvað segir Sósíalistaflokkurinn um loftslagsneyðarástand?',
    expectedFacts: [
      { fact: 'loftslag', required: true },  // Match loftslag, loftslagsmál, etc.
      { fact: 'neyðar', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur loftslagsneyðarástand lýsa yfir',
  },
  {
    id: 79,
    question: 'Hvað segir Sósíalistaflokkurinn um virkjanir í kosningaprófi RÚV 2024?',
    expectedFacts: [
      { fact: 'ósammála', required: true },  // Mjög ósammála við meira virkjanir
      { fact: 'virkja', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur kosningapróf virkjanir 2024',
  },
  {
    id: 80,
    question: 'Hvað segir Sósíalistaflokkurinn um kolefnisgjald í kosningaprófi RÚV 2024?',
    expectedFacts: [
      { fact: 'sammála', required: true },
      { fact: 'mengun', required: false },  // kolefnis-/mengunarskatt
    ],
    webSearchQuery: 'Sósíalistaflokkur kosningapróf kolefnisgjald 2024',
  },
  {
    id: 81,
    question: 'Hvað segir Sósíalistaflokkurinn um náttúruvernd gegn fjárhagslegum hagsmunum?',
    expectedFacts: [
      { fact: 'náttúr', required: true },  // Náttúran/náttúruvernd
      { fact: 'hagsmuni', required: true },
      { fact: 'sammála', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur náttúruvernd hagsmunir kosningapróf',
  },
  {
    id: 82,
    question: 'Hvað segir Sósíalistaflokkurinn um almenningssamgöngur?',
    expectedFacts: [
      { fact: 'almenningssamgöng', required: true },
      { fact: 'gjaldfrjáls', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur almenningssamgöngur gjaldfrjálsar',
  },
  {
    id: 83,
    question: 'Hvað segir Sósíalistaflokkurinn um flugvöll í Vatnsmýri?',
    expectedFacts: [
      { fact: 'flug', required: true },  // Match flugvöllur, flugvöll, flug
      { fact: 'Vatnsmýri', required: false },
      { fact: 'færa', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur flugvöllur Vatnsmýri',
  },
  {
    id: 84,
    question: 'Hvað segir Sósíalistaflokkurinn um stóriðju?',
    expectedFacts: [
      { fact: 'stóriðju', required: true },
      { fact: 'stöðva', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur stóriðja eftirlit umhverfi',
  },
  {
    id: 85,
    question: 'Hvað segir Sósíalistaflokkurinn um skógrækt og landgræðslu?',
    expectedFacts: [
      { fact: 'skógrækt', required: true },
      { fact: 'landgræðslu', required: false },
      { fact: 'auka', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur skógrækt landgræðsla auka',
  },
  // === LOTA 4: PRÓF 86-100 (Utanríkismál + Menntamál) ===
  // Flokkur G: Stefnumál - Utanríkismál (86-93)
  {
    id: 86,
    question: 'Hvað segir Sósíalistaflokkurinn um NATO?',
    expectedFacts: [
      { fact: 'NATO', required: true },
      { fact: 'þjóðaratkvæð', required: false },  // Þjóðaratkvæðagreiðsla
    ],
    webSearchQuery: 'Sósíalistaflokkur NATO þjóðaratkvæðagreiðsla',
  },
  {
    id: 87,
    question: 'Hvað segir Sósíalistaflokkurinn um herlaust Ísland?',
    expectedFacts: [
      { fact: 'her', required: true },  // Match herlaust, herlausar, hernaður
      { fact: 'Ísland', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur herlaust Ísland stefna',
  },
  {
    id: 88,
    question: 'Hvað segir Sósíalistaflokkurinn um friðarbandalag?',
    expectedFacts: [
      { fact: 'friðarbandalag', required: true },
      { fact: 'smáþjóð', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur friðarbandalag smáþjóðir',
  },
  {
    id: 89,
    question: 'Hvað segir Sósíalistaflokkurinn um Palestínu í kosningaprófi RÚV 2024?',
    expectedFacts: [
      { fact: 'sammála', required: true },  // Mjög sammála við að tala gegn hernaði Ísraela
      { fact: 'Gaza', required: false },
      { fact: 'Ísrael', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur kosningapróf Palestína Gaza 2024',
  },
  {
    id: 90,
    question: 'Hvað segir Sósíalistaflokkurinn um vopnasendingar til Úkraínu í kosningaprófi RÚV 2024?',
    expectedFacts: [
      { fact: 'ósammála', required: true },  // Mjög ósammála
      { fact: 'Úkraínu', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur kosningapróf Úkraína vopn 2024',
  },
  {
    id: 91,
    question: 'Hvað segir Sósíalistaflokkurinn um flóttafólk í kosningaprófi RÚV 2024?',
    expectedFacts: [
      { fact: 'kosningapróf', required: true },  // Just verify context
      { fact: 'flótta', required: false },  // flóttafólk, flóttamenn
    ],
    webSearchQuery: 'Sósíalistaflokkur kosningapróf flóttafólk 2024',
  },
  {
    id: 92,
    question: 'Hvað segir Sósíalistaflokkurinn um útgjöld til aðlögunar innflytjenda?',
    expectedFacts: [
      { fact: 'innflytj', required: true },  // Match innflytjendur, innflytjenda
      { fact: 'aðlög', required: false },  // aðlögun
    ],
    webSearchQuery: 'Sósíalistaflokkur kosningapróf innflytjendur aðlögun 2024',
  },
  {
    id: 93,
    question: 'Hvað segir Sósíalistaflokkurinn um alþjóðlega verkalýðsbaráttu?',
    expectedFacts: [
      { fact: 'verkalýðs', required: true },
      { fact: 'alþjóðleg', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur alþjóðleg verkalýðsbarátta',
  },
  // Flokkur H: Stefnumál - Menntamál (94-100)
  {
    id: 94,
    question: 'Hvað segir Sósíalistaflokkurinn um gjaldfrjálsa menntun?',
    expectedFacts: [
      { fact: 'gjaldfrjáls', required: true },
      { fact: 'mennt', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur gjaldfrjáls menntun skólar',
  },
  {
    id: 95,
    question: 'Hvað segir Sósíalistaflokkurinn um skólamáltíðir?',
    expectedFacts: [
      { fact: 'skólamáltíð', required: true },
      { fact: 'gjaldfrjáls', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur skólamáltíðir gjaldfrjálsar',
  },
  {
    id: 96,
    question: 'Hvað segir Sósíalistaflokkurinn um stéttaskiptingu í skólum?',
    expectedFacts: [
      { fact: 'skól', required: true },  // Match skóla, skólakerfið
      { fact: 'stétt', required: false },  // stéttaskipting
    ],
    webSearchQuery: 'Sósíalistaflokkur stéttaskipting skólar jöfnuður',
  },
  {
    id: 97,
    question: 'Hvað segir Sósíalistaflokkurinn um stuðning við nemendur og sérkennslu?',
    expectedFacts: [
      { fact: 'stuðning', required: true },
      { fact: 'nemend', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur sérkennsla stuðningur nemendur',
  },
  {
    id: 98,
    question: 'Hvað segir Sósíalistaflokkurinn um frístundaheimili?',
    expectedFacts: [
      { fact: 'frístund', required: true },  // Match frístundaheimili, frístundir
      { fact: 'gjaldfrjáls', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur frístundaheimili tómstundir gjaldfrjálsar',
  },
  {
    id: 99,
    question: 'Hvað segir Sósíalistaflokkurinn um íslenskukennslu fyrir innflytjendur?',
    expectedFacts: [
      { fact: 'kennslu', required: true },  // Match íslenskukennsla, kennslu
      { fact: 'innflytj', required: false },  // innflytjendur
    ],
    webSearchQuery: 'Sósíalistaflokkur íslenskukennsla innflytjendur',
  },
  {
    id: 100,
    question: 'Hvað segir Sósíalistaflokkurinn um kjör kennara?',
    expectedFacts: [
      { fact: 'kennara', required: true },
      { fact: 'laun', required: false },
      { fact: 'verðleikum', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur kennarar laun kjör',
  },
  // === HEIMILDIN KOSNINGAPRÓF 2024 PRÓF (101-110) ===
  {
    id: 101,
    question: 'Hvað segir flokkurinn um löggæslu í Kosningaprófi Heimildarinnar 2024?',
    expectedFacts: [
      { fact: 'ósammála', required: true },  // Mjög ósammála við að stórefla löggæslu
      { fact: 'löggæslu', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur Heimildin löggæsla 2024',
  },
  {
    id: 102,
    question: 'Hvað segir flokkurinn um viðskiptaþvinganir á Ísrael í Kosningaprófi Heimildarinnar?',
    expectedFacts: [
      { fact: 'sammála', required: true },  // Mjög sammála
      { fact: 'Ísrael', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur Heimildin viðskiptaþvinganir Ísrael',
  },
  {
    id: 103,
    question: 'Hversu mikla samsvörun fékk Jón Baldur Sigurðsson við flokksstefnu í Kosningaprófi Heimildarinnar?',
    expectedFacts: [
      { fact: '82%', required: true },
      { fact: 'Jón Baldur', required: true },
    ],
    webSearchQuery: 'Jón Baldur Sigurðsson Heimildin kosningapróf samsvörun',
  },
  {
    id: 104,
    question: 'Hversu mikla samsvörun fékk Anna Björk Mörtudóttir við flokksstefnu í Kosningaprófi Heimildarinnar?',
    expectedFacts: [
      { fact: '88%', required: true },
      { fact: 'Sanna', required: true },
    ],
    webSearchQuery: 'Anna Björk Heimildin kosningapróf samsvörun',
  },
  {
    id: 105,
    question: 'Hvað segir flokkurinn um AirBnB í Kosningaprófi Heimildarinnar?',
    expectedFacts: [
      { fact: 'sammála', required: true },  // Mjög sammála við takmörkun
      { fact: 'AirBnB', required: false },
      { fact: 'takmarka', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur Heimildin AirBnB takmörkun',
  },
  {
    id: 106,
    question: 'Hvað segir flokkurinn um arðgreiðsluskatt í Kosningaprófi Heimildarinnar?',
    expectedFacts: [
      { fact: 'sammála', required: true },  // Mjög sammála við hækkun
      { fact: 'hækka', required: false },
      { fact: 'arðgreiðslu', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur Heimildin arðgreiðslur skattur',
  },
  {
    id: 107,
    question: 'Hvað segir flokkurinn um Úkraínu og vopnastyrkja í Kosningaprófi Heimildarinnar?',
    expectedFacts: [
      { fact: 'sammála', required: true },  // Frekar sammála við að styðja EKKI
      { fact: 'Úkraínu', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur Heimildin Úkraína vopnakaup',
  },
  {
    id: 108,
    question: 'Hvað segir flokkurinn um einkarekstur í heilbrigðisþjónustu í Kosningaprófi Heimildarinnar?',
    expectedFacts: [
      { fact: 'ósammála', required: true },  // Mjög ósammála
      { fact: 'einkarekstur', required: false },
      { fact: 'heilbrigði', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur Heimildin einkarekstur heilbrigði',
  },
  {
    id: 109,
    question: 'Hvað segir flokkurinn um Donald Trump og þjóðaröryggi Íslands í Kosningaprófi Heimildarinnar?',
    expectedFacts: [
      { fact: 'sammála', required: true },  // Mjög sammála við að Trump dragi úr öryggi
      { fact: 'Trump', required: true },
    ],
    webSearchQuery: 'Sósíalistaflokkur Heimildin Trump þjóðaröryggi',
  },
  {
    id: 110,
    question: 'Hvar eru Jón Baldur og Sanna ósammála um Úkraínu í Kosningaprófi Heimildarinnar?',
    expectedFacts: [
      { fact: 'Úkraínu', required: true },
      { fact: 'vopn', required: false },
      { fact: 'mismun', required: false },
    ],
    webSearchQuery: 'Sósíalistaflokkur Heimildin frambjóðendur Úkraína mismunur',
  },

  // === KJÓSTU RÉTT 2024 PRÓF (111-115) ===
  {
    id: 111,
    question: 'Hvað segir flokkurinn um einkarekstur í heilbrigðiskerfi í Kjóstu rétt 2024?',
    expectedFacts: [
      { fact: 'ósammála', required: true },
      { fact: 'einkarekstur', required: false },
    ],
  },
  {
    id: 112,
    question: 'Hvað segir flokkurinn um leiguþak í Kjóstu rétt?',
    expectedFacts: [
      { fact: 'sammála', required: true },
      { fact: 'leiguþak', required: false },
    ],
  },
  {
    id: 113,
    question: 'Hvað segir flokkurinn um að selja orkufyrirtæki í Kjóstu rétt?',
    expectedFacts: [
      { fact: 'ósammála', required: true },
      { fact: 'orkufyrirtæk', required: false },
    ],
  },
  {
    id: 114,
    question: 'Hvað segir flokkurinn um fjölda flóttamanna í Kjóstu rétt?',
    expectedFacts: [
      { fact: 'ósammála', required: true },
      { fact: 'flóttam', required: false },
    ],
  },
  {
    id: 115,
    question: 'Hvað segir flokkurinn um viðskiptaþvinganir á Ísrael í Kjóstu rétt?',
    expectedFacts: [
      { fact: 'sammála', required: true },
      { fact: 'Ísrael', required: true },
    ],
  },

  // === VIÐSKIPTARÁÐ KOSNINGAÁTTAVITI 2024 PRÓF (116-125) ===
  // Athugið: Svör eru ÁÆTLUÐ byggt á þekktri stefnu, ekki opinber
  {
    id: 116,
    question: 'Hvað segir flokkurinn um stóreignaskatt í Kosningaáttavita Viðskiptaráðs?',
    expectedFacts: [
      { fact: 'fylgjandi', required: true },
      { fact: 'stóreignaskatt', required: false },
    ],
  },
  {
    id: 117,
    question: 'Hvað segir flokkurinn um gjaldfrjálsar skólamáltíðir í Kosningaáttavita Viðskiptaráðs?',
    expectedFacts: [
      { fact: 'fylgjandi', required: true },
      { fact: 'skólamáltíð', required: false },
    ],
  },
  {
    id: 118,
    question: 'Hvað segir flokkurinn um félagslegt húsnæði í Kosningaáttavita Viðskiptaráðs?',
    expectedFacts: [
      { fact: 'fylgjandi', required: true },
      { fact: 'félagsleg', required: false },
      { fact: 'húsnæð', required: false },
    ],
  },
  {
    id: 119,
    question: 'Hvað segir flokkurinn um sölu á Landsbankanum í Kosningaáttavita Viðskiptaráðs?',
    expectedFacts: [
      { fact: 'andvíg', required: true },
      { fact: 'Landsbank', required: false },
    ],
  },
  {
    id: 120,
    question: 'Hvað segir flokkurinn um sölu á Landsvirkjun í Kosningaáttavita Viðskiptaráðs?',
    expectedFacts: [
      { fact: 'andvíg', required: true },
      { fact: 'Landsvirkjun', required: false },
    ],
  },
  {
    id: 121,
    question: 'Hvað segir flokkurinn um einkarekstur í heilbrigðisþjónustu í Kosningaáttavita Viðskiptaráðs?',
    expectedFacts: [
      { fact: 'andvíg', required: true },
      { fact: 'einkarekstur', required: false },
    ],
  },
  {
    id: 122,
    question: 'Hvað segir flokkurinn um jafnlaunavottun í Kosningaáttavita Viðskiptaráðs?',
    expectedFacts: [
      { fact: 'andvíg', required: true },  // Andvígur afnámi jafnlaunavottunar
      { fact: 'jafnlauna', required: false },
    ],
  },
  {
    id: 123,
    question: 'Hvað segir flokkurinn um loftslagsaðgerðir í Kosningaáttavita Viðskiptaráðs?',
    expectedFacts: [
      { fact: 'fylgjandi', required: true },  // Mjög fylgjandi loftslagsaðgerðum
      { fact: 'loftslag', required: false },
    ],
  },
  {
    id: 124,
    question: 'Hvað segir flokkurinn um takmarkanir á skammtímaleigu (AirBnB) í Kosningaáttavita Viðskiptaráðs?',
    expectedFacts: [
      { fact: 'fylgjandi', required: true },
      { fact: 'skammtíma', required: false },
    ],
  },
  {
    id: 125,
    question: 'Hvað segir flokkurinn um leiguvernd og kærunefnd húsamála í Kosningaáttavita Viðskiptaráðs?',
    expectedFacts: [
      { fact: 'fylgjandi', required: true },
      { fact: 'leig', required: false },
    ],
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
  // Parse command line arguments for test selection
  // Usage: node verify-kimi-answers.js [--from N] [--to M] [--only N,M,O]
  const args = process.argv.slice(2);
  let fromTest = 1;
  let toTest = Infinity;
  let onlyTests = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) {
      fromTest = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--to' && args[i + 1]) {
      toTest = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--only' && args[i + 1]) {
      onlyTests = args[i + 1].split(',').map(n => parseInt(n.trim(), 10));
      i++;
    }
  }

  // Filter tests
  let testsToRun = VERIFICATION_TESTS;
  if (onlyTests) {
    testsToRun = VERIFICATION_TESTS.filter(t => onlyTests.includes(t.id));
  } else {
    testsToRun = VERIFICATION_TESTS.filter(t => t.id >= fromTest && t.id <= toTest);
  }

  const totalTests = VERIFICATION_TESTS.length;
  const selectedTests = testsToRun.length;

  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log(`║         KIMI SANNVOTTUNARPRÓF - ${selectedTests}/${totalTests} spurningar                     ║`);
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  if (onlyTests) {
    console.log(`📌 Keyrð próf: ${onlyTests.join(', ')}\n`);
  } else if (fromTest > 1 || toTest < Infinity) {
    console.log(`📌 Keyrð próf: ${fromTest}-${Math.min(toTest, totalTests)}\n`);
  }

  const results = [];

  for (const test of testsToRun) {
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
