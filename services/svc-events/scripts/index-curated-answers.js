#!/usr/bin/env node
/**
 * Index Curated Q&A Answers
 *
 * Indexes high-quality Q&A pairs from the thinking model into the RAG database.
 * These are manually verified answers that should be surfaced for common questions.
 * Each document includes question variations to match different phrasings.
 */

// Set up environment
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'ekklesia-prod-10-2025';
process.env.DATABASE_HOST = process.env.DATABASE_HOST || 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT || '5433';
process.env.DATABASE_NAME = process.env.DATABASE_NAME || 'socialism';
process.env.DATABASE_USER = process.env.DATABASE_USER || 'socialism';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD || 'Socialism2025#Db';

const embeddingService = require('../src/services/service-embedding');
const vectorSearch = require('../src/services/service-vector-search');

// Curated Q&A pairs from Kimi thinking model with question variations
const CURATED_ANSWERS = [
  {
    id: 'stefna-heimsvaldastefna',
    title: 'Afstaða Sósíalistaflokksins til heimsvaldastefnu og hernaðar',
    // Include question variations to help RAG match different phrasings
    questionVariations: [
      'Hvað segir flokkurinn um heimsvaldastefnu?',
      'Hver er afstaða flokksins til heimsvaldastefnu?',
      'Hvað finnst flokknum um heimsvaldastefnu?',
      'Er flokkurinn á móti heimsvaldastefnu?',
      'Afstaða til heimsvaldastefnu',
      'Heimsvaldastefna sósíalista',
      'Hvað segir flokkurinn um NATO?',
      'Er flokkurinn á móti NATO?',
      'Afstaða til NATO og hernaðar',
      'Hvað segir flokkurinn um herlaust Ísland?',
      'Er flokkurinn fyrir herlaust land?',
      'Afstaða til friðarbandalags',
      'Hvað segir flokkurinn um varnarsamning við Bandaríkin?',
    ],
    content: `SPURNING: Hvað segir flokkurinn um heimsvaldastefnu?

SVAR:
Sósíalistaflokkurinn er mjög andvígur heimsvaldastefnu og hernaðarstefnu. Hér eru lykilatriði úr stefnu flokksins:

HEIMSVALDASTEFNA OG HERNAÐ:
• Flokkurinn leggst gegn heimsvaldastefnu stórvelda og hernaðarhyggju
• Krefst alþjóðlegra tengsla sem byggjast á jafnrétti og gagnkvæmri virðingu

NATO OG VARNARSAMNINGUR:
• Flokkurinn vill að Ísland segi sig úr NATO
• Krefst þjóðaratkvæðagreiðslu um NATO-aðild
• Vill segja upp varnarsamningnum við Bandaríkin
• Leggst gegn hernaðarsamstarfi við Bandaríkin

HERLAUST ÍSLAND:
• Flokkurinn er mjög sammála því að Ísland eigi að vera herlaust land
• Vill að Ísland gerist hluti af friðarbandalagi þjóða án heraflans

ALÞJÓÐLEG STAÐA:
• Leggur áherslu á sjálfstæði Íslands í utanríkismálum
• Styður alþjóðlegt samstarf sem byggt er á friði og réttlæti

Þessi afstaða kemur skýrt fram í kosningaprófum RÚV og á heimasíðu flokksins. Flokkurinn fær 5/5 (mjög sammála) í spurningum um herlaust Ísland og friðarbandalag, og 1/5 (mjög ósammála) í spurningum um hernaðarsamstarf.`,
    citation: {
      who: 'Kimi viðtalsgreinandi',
      when: '2025-12-25',
      context: 'Greining á stefnu flokksins um heimsvaldastefnu og hernað, byggt á RÚV kosningaprófi og heimasíðu',
      url: 'https://sosialistaflokkurinn.is/',
    },
  },
  {
    id: 'stefna-esb',
    title: 'Afstaða Sósíalistaflokksins til Evrópusambandsins',
    questionVariations: [
      'Hvað segir flokkurinn um Evrópusambandið?',
      'Hvað segir flokkurinn um ESB?',
      'Hver er afstaða flokksins til ESB?',
      'Er flokkurinn á móti ESB?',
      'Vill flokkurinn ganga í ESB?',
      'Afstaða til Evrópusambandsins',
      'ESB sósíalista',
      'Evrópusambandið og flokkurinn',
      'Á flokkurinn að ganga í Evrópusambandið?',
      'Hvað finnst flokknum um aðild að ESB?',
      'Styður flokkurinn aðild að ESB?',
      'Hvað segir flokkurinn um Evrópumál?',
    ],
    content: `SPURNING: Hvað segir flokkurinn um Evrópusambandið?

SVAR:
Samkvæmt svörum flokksins í kosningaprófi RÚV 2024 er flokkurinn "frekar sammála" því að Ísland eigi að vera utan Evrópusambandsins (4/5 stig).

LYKILATRIÐI UM ESB-AFSTÖÐU:
• Flokkurinn vill að Ísland haldi sig utan Evrópusambandsins
• Styður þó þjóðaratkvæðagreiðslu ef spurning um aðild kemur upp

ÞJÓÐARATKVÆÐAGREIÐSLA:
• Flokkurinn er fylgjandi lýðræðislegri ákvörðun um ESB-málið
• Ef til kemur aðildarumsókn ætti fólkið að fá að greiða atkvæði

ÁSTÆÐUR FYRIR AFSTÖÐU:
• Áhyggjur af fullveldismissi
• Áhersla á sjálfstæði í efnahagsmálum
• Gagnrýni á einhæfni ESB-stefnu

Þetta svar byggir á svörum flokksins í kosningaprófi RÚV fyrir Alþingiskosningar 2024.`,
    citation: {
      who: 'Kimi viðtalsgreinandi',
      when: '2025-12-25',
      context: 'Greining á afstöðu flokksins til ESB, byggt á RÚV kosningaprófi 2024',
      url: 'https://www.ruv.is/kjor/kosningaprof',
    },
  },
  {
    id: 'stefna-kapitalismi',
    title: 'Afstaða Sósíalistaflokksins til kapítalisma og auðvalds',
    questionVariations: [
      'Er sósíalistaflokkurinn á móti kapitalisma?',
      'Er flokkurinn á móti kapitalisma?',
      'Hvað segir flokkurinn um kapitalisma?',
      'Afstaða til kapítalisma',
      'Kapitalismi sósíalista',
      'Hvað finnst flokknum um kapitalisma?',
      'Er flokkurinn sósíalískur?',
      'Hvað þýðir sósíalismi?',
      'Hvað vill flokkurinn gera við stórfyrirtæki?',
      'Hvað segir flokkurinn um auðvaldið?',
      'Afstaða til auðmanna',
      'Hvað segir flokkurinn um efnahagskerfið?',
      'Vill flokkurinn afnema kapitalisma?',
      'Hvað þýðir að lýðræðisvæða fyrirtæki?',
    ],
    content: `SPURNING: Er sósíalistaflokkurinn á móti kapitalisma?

SVAR:
Já, Sósíalistaflokkurinn berst gegn "auðvaldinu" og vill breyta efnahagskerfinu í grundvallaratriðum. Hér eru lykilatriði:

BARÁTTA GEGN AUÐVALDI:
• Flokkurinn skilgreinir sig sem andstæðing "auðvaldsins" - þ.e. þeirra sem eiga og stjórna stórfyrirtækjum
• Stefnan er að draga úr valdaþéttingu í efnahagslífinu

LÝÐRÆÐISVÆÐING FYRIRTÆKJA:
• Flokkurinn vill lýðræðisvæða stór fyrirtæki þannig að starfsfólk hafi meira að segja
• Markmiðið er að "setja völdin í hendur fólksins" - ekki aðeins í pólitík heldur líka í efnahagslífi

STEFNUMÁL UM SKATTA OG AUÐLINDAGJÖLD:
• Mjög sammála hækkun á fyrirtækjaskatti (4/5)
• Mjög sammála auðlegðarskatti (5/5)
• Mjög sammála hærri skatti á arðgreiðslur (5/5)
• Mjög sammála hærri skattlagningu auðlindafyrirtækja (5/5)

EKKI FULLKOMIÐ AFNÁM:
• Flokkurinn talar um breytingar á kerfinu, ekki endilega algert afnám kapítalisma á einni nóttu
• Áherslan er á smám saman lýðræðisvæðingu og tilfærslu valds frá fáum til margra

Þetta er kjarni sósíalískrar stefnu: Að vinna gegn misskiptingu auðs og valds, og færa efnahagslegt vald til launafólks og samfélagsins alls.`,
    citation: {
      who: 'Kimi viðtalsgreinandi',
      when: '2025-12-25',
      context: 'Greining á afstöðu flokksins til kapítalisma, byggt á lögum flokksins og RÚV kosningaprófi',
      url: 'https://sosialistaflokkurinn.is/',
    },
  },
];

async function indexDocument(doc) {
  console.log(`  Indexing: ${doc.title}`);

  try {
    // Build content with question variations for better RAG matching
    const variationsText = doc.questionVariations
      ? '\n\nALGENGAR SPURNINGAR SEM ÞETTA SVAR SVARAR:\n• ' + doc.questionVariations.join('\n• ')
      : '';

    const fullContent = doc.content + variationsText;

    // Generate embedding
    const embedding = await embeddingService.generateEmbedding(fullContent);

    // Upsert to database
    await vectorSearch.upsertDocument({
      sourceType: 'curated-answer',
      sourceUrl: doc.citation.url,
      sourceDate: new Date().toISOString().split('T')[0],
      chunkId: doc.id,
      title: doc.title,
      content: fullContent,
      citation: doc.citation,
      embedding,
    });

    console.log(`    ✅ Done (${fullContent.length} chars, ${doc.questionVariations?.length || 0} variations)`);
    return true;
  } catch (error) {
    console.error(`    ❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Indexing Curated Q&A Answers');
  console.log('='.repeat(60));

  let success = 0;
  let failed = 0;

  console.log(`\n📝 Indexing ${CURATED_ANSWERS.length} curated answers...`);
  for (const answer of CURATED_ANSWERS) {
    if (await indexDocument(answer)) success++;
    else failed++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Done! ${success} documents indexed, ${failed} failed`);
  console.log('='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
