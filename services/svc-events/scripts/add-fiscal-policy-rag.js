#!/usr/bin/env node
/**
 * Add fiscal policy election platform to RAG
 *
 * "Betra plan í ríkisfjármálum" - Kosningaáætlun Alþingiskosningar 2024
 * https://sosialistaflokkurinn.is/2024/11/19/betra-plan-i-rikisfjarmalum/
 *
 * This is a special election platform document published for the
 * November 2024 parliamentary elections, not the general party policy.
 *
 * Usage: node scripts/add-fiscal-policy-rag.js
 */

process.env.GOOGLE_CLOUD_PROJECT = 'ekklesia-prod-10-2025';
process.env.DATABASE_HOST = 'localhost';
process.env.DATABASE_PORT = '5433';
process.env.DATABASE_NAME = 'socialism';
process.env.DATABASE_USER = 'socialism';
process.env.DATABASE_PASSWORD = 'Socialism2025#Db';

const embeddingService = require('../src/services/service-embedding');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

const SOURCE_URL = 'https://sosialistaflokkurinn.is/2024/11/19/betra-plan-i-rikisfjarmalum/';
const SOURCE_DATE = new Date('2024-11-19');

// Policy document broken into thematic chunks
const FISCAL_POLICY_DOCUMENTS = [
  {
    chunkId: 'rikisfjarmalamal-yfirlit',
    title: 'Betra plan í ríkisfjármálum - Yfirlit',
    content: `SPURNING: Hver er skattastefna Sósíalistaflokksins?

SVAR:
Sósíalistaflokkurinn leggur höfuðáherslu á að tekjuöflun ríkissjóðs verði gerð réttlátari. Þetta er forsenda þess að hægt sé að stöðva skuldasöfnun ríkisins.

MEGINMARKMIÐ SKATTASTEFNU:
1. Skattalækkanir til almennings og smærri fyrirtækja
2. Skattalækkanir undanfarinna áratuga til auðugustu fjármagnseigenda og stærstu fyrirtækja gangi til baka
3. Leiðum til skattaundanskota verði lokað og skatteftirlit eflt
4. Almenningur innheimti eðlilegt gjald fyrir auðlindir sínar
5. Tekjustofnar sveitarfélaganna verði styrktir

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Betra plan í ríkisfjármálum
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'rikisfjarmalamal-audlegdarskattur',
    title: 'Auðlegðarskattur - Stefna Sósíalistaflokksins',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um auðlegðarskatt?

SVAR:
Sósíalistaflokkurinn leggur til þrepaskiptan auðlegðarskatt sem leggst á eignir umfram það sem telja má eðlilega eign vel setts millistéttarfólks.

TILLÖGUR UM AUÐLEGÐARSKATT:
- 2% á hreina eign umfram 200 m.kr. hjá hjónum
- Upp í 9% hjá hjónum sem eiga meira en 10 milljarða króna
- Innan við 1% skattgreiðenda myndi greiða auðlegðarskatt
- Rúmlega 99% landsmanna myndu engan slíkan skatt greiða

SAGA EIGNASKATTA:
- Eignaskattar eru elstu skattar á Íslandi (tíund þjóðveldisaldar)
- Eignaskattar voru lagðir á hérlendis í rúm 900 ár
- Auðlegðarskattur var lagður á tímabundið eftir Hrun 2008

TILGANGUR:
Markmið er að skattleggja þann auð sem hin ríku hafa safnað upp vegna skattaumbyltingar nýfrjálshyggjuáranna - að endurheimta hluta af þeim auði sem þau sóttu í almannasjóði.

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Betra plan í ríkisfjármálum
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'rikisfjarmalamal-fjarmagnstekjur',
    title: 'Fjármagnstekjur og hátekjuþrep - Stefna',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um skattlagningu fjármagnstekna?

SVAR:
Sósíalistaflokkurinn vill að fjármagnstekjur beri sama skatt og launatekjur og skattstiginn verði þrepaskiptur og brattur.

NÚVERANDI STAÐA:
- Jaðarskattur launatekna: 46,25%
- Jaðarskattur fjármagnstekna: 22% (meira en helmingi lægri)
- Lægst launaða fólkið greiðir nánast sama hlutfall í skatt og auðugustu fjármagnseigendurnir
- Launatekjur bera útsvar en fjármagnstekjur ekki

TILLÖGUR UM HÁTEKJUÞREP:
- 60% skattur á tekjur umfram 5 m.kr. á mánuði
- 75% þrep á tekjur umfram 20 m.kr. á mánuði
- 90% þrep á tekjur umfram 50 m.kr. á mánuði

SÖGULEGUR SAMHENGI:
Á eftirstríðsárunum voru jaðarskattar á háar tekjur um og yfir 90% í okkar heimshluta.

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Betra plan í ríkisfjármálum
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'rikisfjarmalamal-erfdafjarskattur',
    title: 'Erfðafjárskattur - Stefna Sósíalistaflokksins',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um erfðafjárskatt?

SVAR:
Sósíalistaflokkurinn telur að erfðafjárskattur sé í grunninn tekjuskattur og skattþrep erfðafjárskatts eigi að vera þau sömu og tekjuskatts.

TILLÖGUR:
- Skattleysismörk miðast við gott íbúðaverð (60 m.kr. skattfrjálst)
- Arf umfram það beri venjulegan tekjuskatt með sama hætti og aðrar tekjur

DÆMI:
- Erfir þú 75 m.kr. væru 60 m.kr. skattfrjálsar, 15 m.kr. bæru tekjuskatt
- Þú greiddir 4,8 m.kr. í erfðafjárskatt og héldirefter 70,2 m.kr.
- Í dag myndir þú borga 7 m.kr. í erfðafjárskatt

STÓREIGNIR:
- Sá sem erfir 20 milljarða myndi greiða 17,8 milljarða í erfðafjárskatt
- Í dag greiðir slíkur einstaklingur aðeins um 10% skatt

TILGANGUR:
Lækkun erfðafjárskatts á nýfrjálshyggjuárunum hefur búið til erfðastétt auðfólks sem erfir ekki aðeins auðæfi heldur völd og samfélagsstöðu.

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Betra plan í ríkisfjármálum
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'rikisfjarmalamal-skattaundanskot',
    title: 'Stöðvum skattaundanskotin - Stefna',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um skattaundanskot?

SVAR:
Sósíalistar leggja til þrjú atriði til að vinna gegn skattaundanskotum:
1. Svipta eignarhaldsfélög sjálfstæðri skattalegri aðild
2. Takmarka heimildir til að nýta fjármagnskostnað til frádráttar
3. Stórefla skatteftirlit með auðugustu fjármagnseigendum og stórfyrirtækjum

UM EIGNARHALDSFÉLÖG:
- Eignarhaldsfélög eru farvegur fyrir skattaundanskot
- Arður úr rekstrarfélögum er fluttur upp í eignarhaldsfélög þar sem ótal tækifæri eru til að fresta eða komast hjá skattgreiðslum
- Sósíalistar vilja skattleggja eigendur eignarhaldsfélaga beint eins og félögin væru ekki til

UM FJÁRMAGNSKOSTNAÐ:
- Fyrirtæki hafa misnotað afskriftir og vexti til skattaundanskota
- Álver greiða móðurfélögum háa vexti svo hagnaður rekstrarfélaganna er nánast enginn
- Útgerðir kaupa togara sem afskrifaðir eru á 8 árum þó þeir duga í 30 ár

SKATTRANNSÓKNIR:
- Efla þarf embætti skattrannsóknarstjóra
- Skattsvik og skattaundanskot aukast eftir því sem fólk hefur hærri tekjur
- Engin starfsemi hins opinbera mun skila jafn miklum tekjum og efling skatteftirlits

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Betra plan í ríkisfjármálum
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'rikisfjarmalamal-sjavarutvegur',
    title: 'Sjávarútvegsstefna - Auðlindir til almennings',
    content: `SPURNING: Hver er stefna Sósíalistaflokksins í sjávarútvegi?

SVAR:
Sósíalistar vilja færa yfirráð yfir kvótanum aftur til byggðanna og innleiða fjölbreytni og valddreifingu í nýtingu fiskimiðanna.

GREINING Á NÚVERANDI STÖÐU:
- Sjávarauðlindin hefur í reynd verið einkavædd með kvótakerfinu
- Örfáar ofuauðugar fjölskyldur drottna yfir veiðum, vinnslu og sölu
- Margar sjávarbyggðir misstu kvótann í braski útgerðarmanna

TILLÖGUR SÓSÍALISTA:
- Frjálsar handfæraveiðar
- Stuðningur við smárekstur
- Uppbygging fiskmarkaða
- Uppbygging innviða sem þjóna smærri aðilum
- Færa yfirráð yfir kvótanum út í byggðirnar

RÖKSEMDAFÆRSLA:
- Smærri fiskvinnslufyrirtæki sem kaupa fisk á markaði fara betur með hráefnið
- Þau fá hærra afurðaverð á erlendum markaði en stórfyrirtækin
- Uppbrot stórfyrirtækjanna er klók leið til að hámarka arð samfélagsins

AUÐLINDALEIGA:
Í auðlindatilboði sósíalista er gert ráð fyrir auðlindaleigu sem rennur í sameiginlega sjóði - gjald fyrir notkun á auðlindinni.

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Betra plan í ríkisfjármálum
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'rikisfjarmalamal-orkumal',
    title: 'Orkumál - Stefna Sósíalistaflokksins',
    content: `SPURNING: Hver er stefna Sósíalistaflokksins í orkumálum?

SVAR:
Sósíalistar vilja að allar orkuauðlindir skuli vera almenningseign og í opinberum rekstri. Orkukerfið er grunnkerfi samfélagsins og uppbygging þess skal vera með samfélagslegum markmiðum.

MEGINSJÓNARMIÐ:
- Orkuauðlindir eiga að vera sameign almennings
- Opinber fyrirtæki eiga ekki að hegða sér eins og arðsemidrifin einkafyrirtæki
- Orkan skal nýtt til að byggja upp sterkt samfélag

FORGANGSRÖÐUN ORKUNÝTINGAR:
1. Stórfelld matvælaframleiðsla til að skapa störf og spara gjaldeyri
2. Orkuskipti úr jarðefnaeldsneyti í endurnýtanlega orku
3. Uppbygging samfélagslegra innviða

GAGNRÝNI Á NÚVERANDI STEFNU:
- Helsta nýjungin í orkunýtingu eru gagnaver sem grafa eftir Bitcoin
- Slík starfsemi er samfélagslega tilgangslaus og skaðleg
- Orkustefnan hefur verið rekin eins og hér sé orkuskortur - svo er ekki

UM AUÐLINDASJÓÐ:
Sósíalistar hafna hugmyndum um auðlindasjóð sem ávaxti arðgreiðslur af Landsvirkjun. Orkuauðlindirnar á að nýta í samfélagsleg verkefni undir stjórn almennings.

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Betra plan í ríkisfjármálum
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'rikisfjarmalamal-ferdathjonusta',
    title: 'Ferðaþjónusta - Stefna Sósíalistaflokksins',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um ferðaþjónustu?

SVAR:
Sósíalistar líta á ferðaþjónustuna sem auðlindanýtingu þar sem ríkisvaldið og sveitarfélög eiga að gegna veigamiklu hlutverki við uppbyggingu.

TILLÖGUR:
- Opinbert átaksverkefni við uppbyggingu þjónustumiðstöðva við helstu náttúruperlur
- Færa virðisaukaskatt af ferðaþjónustu upp í almennt þrep
- Innheimta gistináttagjald sem fer til sveitarfélaga
- Setja á komugjöld á ferðafólk til að stýra ferðamannastraum

GAGNRÝNI:
- Aðgerðarleysi stjórnvalda hefur valdið glundroða
- Mikið álag á náttúruna
- Illir starfshættir, launaþjófnaður og kúgun starfsfólks
- Ofvöxtur og stjórnleysi

FYRIRMYND:
Í Bretlandseyjum hefur sjálfseignarstofnun umsjón með öllum helstu náttúru- og söguminjum og staðið fyrir glæsilegri uppbyggingu.

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Betra plan í ríkisfjármálum
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'rikisfjarmalamal-loftslagsmal',
    title: 'Loftslags- og umhverfismál - Skattastefna',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um loftslagsmál og skatta?

SVAR:
Sósíalistar leggja til stigvaxandi kolefnis- og mengunarskatta til að verja umhverfi og náttúru.

MEGINSJÓNARMIÐ:
- Loftslagsváin er afleiðing ójöfnuðar og valdaójafnvægis
- Hin ríku og valdamiklu hafa komist upp með að menga og spilla
- Frumskilyrði batans er að taka völdin af auðvaldinu

TILLÖGUR:
- Stigvaxandi kolefnis- og mengunarskatttar
- Opinber fjárfesting til að flýta orkuskiptum
- Efla innlenda matvælaframleiðslu
- Landgræðsla og skógrækt

VARÚÐ:
- Almannafé skal renna í samfélagsleg verkefni og opinberar rannsóknarstofnanir
- Fyrirtækin verða að sjá um sig sjálf
- Ef þau breytast ekki verður starfsemi þeirra bönnuð
- Eigendur fyrirtækja geta ekki þurrausið sjóði til að greiða sér arð og sótt svo opinbert fé

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Betra plan í ríkisfjármálum
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'rikisfjarmalamal-sveitarfelog',
    title: 'Tekjur sveitarfélaga - Stefna Sósíalistaflokksins',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um tekjur sveitarfélaga?

SVAR:
Sósíalistar leggja til að styrkja tekjustofna sveitarfélaga með aðstöðugjaldi og útsvari á fjármagnstekjur.

TILLÖGUR:
1. Aðstöðugjald endurvakið - veltutengdur skattur til sveitarfélaga
2. Útsvar á fjármagnstekjur - tekjuhæsta fólkið greiðir oft ekki krónu til sveitarfélaga
3. Landsútsvar stórfyrirtækja sem rennur til sveitarfélaga

UM AÐSTÖÐUGJALD:
- Þrepaskipt svo smæstu fyrirtækin greiði lítið en stórfyrirtækin mikið
- Nota má skattfrelsi til að örva nýsköpun eða stuðla að atvinnusköpun
- Ríkisvaldið ákvarði gjaldið svo sveitarfélög fari ekki í skattasamkeppni

SÖGULEGUR SAMHENGI:
- Útsvar í Reykjavík var 6,7% árið 1991 en er 14,97% í dag
- Munurinn er tæplega 330.000 kr. á ári af lágmarkslaunum
- Og 650.000 kr. á ári af meðallaunum

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Betra plan í ríkisfjármálum
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'rikisfjarmalamal-skattalaekkun-almennings',
    title: 'Skattalækkun til almennings - Stefna',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um skattalækkun til almennings?

SVAR:
Sósíalistar vilja lækka skattbyrði tekjuskatts á miðlungs og lægri tekjur um 700.000 kr. á ári og stöðva skattlagningu á fátækt.

FÁTÆKT SKAL EKKI SKATTLÖGÐ:
- Fólk á lágmarkslaunum greiðir um 15% í skatt (64.000 kr.)
- Fyrir nýfrjálshyggju borgaði ekkert af þessu fólki skatta
- Óheimilt eigi að vera að innheimta skatt hjá fólki undir fátæktarmörkum

SÖGULEGUR SAMANBURÐUR:
- 1991: Enginn skattur greiddur af lægstu launum (0%)
- Í dag: 15% skattur af lágmarkslaunum
- Lágtekjufólk hefur misst 767.000 kr. á ári umfram það sem það borgaði fyrir nýfrjálshyggju

BARNABÆTUR:
- Barnabætur voru 1,2% af landsframleiðslu 1991 en aðeins 0,35% í dag
- Barnabætur hafa lækkað um 38,6 milljarða á þrjátíu árum
- Markmið: Öll börn fái barnabætur upp á 65.000 kr. á mánuði (sama og persónuafsláttur)

HÚSNÆÐISBÆTUR:
- Enginn ætti að greiða meira en fjórðung tekna í húsnæðiskostnað
- Ríkissjóður verður að bæta þeim skaðann sem verða fyrir barðinu á húsnæðismarkaðinum

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Betra plan í ríkisfjármálum
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'rikisfjarmalamal-gjaldfrjals-thjonusta',
    title: 'Gjaldfrjáls opinber þjónusta - Stefna',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um gjaldtöku fyrir opinbera þjónustu?

SVAR:
Sósíalistar hafna alfarið öllum hugmyndum um markaðs- og einkavæðingu innviða og eru andsnúnir allri gjaldtöku fyrir opinbera þjónustu.

MEGINSJÓNARMIÐ:
- Gjaldtaka fyrir opinbera þjónustu er tæki nýfrjálshyggju til að markaðsvæða þjónustu
- Gjaldtakan hefur engan samfélagslegan tilgang
- Hin efnaminni neita sér um heilbrigðisþjónustu og menntun vegna gjaldtökunnar

TILLÖGUR:
- Hætta gjaldtöku fyrir opinbera þjónustu
- Fyrsta skref: Gjaldfrjáls notkun tekjulægstu hópanna
  - Börn
  - Námsfólk
  - Öryrkjar
  - Eftirlaunafólk
  - Fólk á framfærslu sveitarfélaga

RÖKSEMDAFÆRSLA:
- Gjaldfrjálsir innviðir bæta lífskjör alls almennings
- Þeir virka sem jöfnunartæki
- Gjaldfrjáls þjónusta útvegar fyrirtækjum menntaðra og heilsubetra starfsfólk
- Kröftug uppbygging gjaldfrjálsra innviða er forsenda aukinnar velmegunar

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Betra plan í ríkisfjármálum
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'rikisfjarmalamal-smafyrirtaeki',
    title: 'Skattalækkun til smáfyrirtækja - Stefna',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um skattlagningu smáfyrirtækja?

SVAR:
Sósíalistar vilja lækka skatta á smáfyrirtæki og vinna gegn samþjöppun í atvinnulífinu.

GREINING:
- Skattabreytingar nýfrjálshyggjuáranna þjónuðu auðugustu fjármagnseigendum og stórfyrirtækjum
- Launakostnaður er hærra hlutfall útgjalda hjá smærri fyrirtækjum
- Stórfyrirtæki hafa komist hjá skattgreiðslum með klækjum sem smærri fyrirtæki hafa ekki bolmagn til

TILLÖGUR:
1. Þrepaskiptur tekjuskattur fyrirtækja - smæstu greiða minnst
2. Þrepaskipt aðstöðugjald - stórfyrirtæki greiða mest
3. Lækkun tryggingargjalds á fyrsta starfsfólk
4. Hvatar til stofnunar samvinnufyrirtækja
5. Einfaldari reglugerðir og eftirlit fyrir smærri fyrirtæki

UM SAMVINNUFYRIRTÆKI:
- Styrkja atvinnulífið og auka seiglu þess
- Óhagnaðardrifin fyrirtæki skilja meiri verðmæti eftir í samfélaginu
- Auka lýðræði í atvinnulífinu

SKATTEFTIRLIT:
- Vinna gegn misnotkun einkahlutafélaga þar sem einkaneysla er skráð á rekstur
- Enginn skattalegur munur á að vera á milli þeirra sem stunda rekstur á eigin kennitölu og í einkahlutafélagi

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Betra plan í ríkisfjármálum
URL: ${SOURCE_URL}`,
  },
];

async function addDocument(doc) {
  console.log(`\n📝 Bæti við: ${doc.title}`);

  // Generate embedding
  console.log('   🔄 Bý til embedding...');
  const embedding = await embeddingService.generateEmbedding(doc.content);
  const vectorStr = `[${embedding.join(',')}]`;

  // Insert into database
  const sql = `
    INSERT INTO rag_documents (
      source_type, source_url, source_date, chunk_id,
      title, content, citation, embedding
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)
    ON CONFLICT (source_type, chunk_id)
    DO UPDATE SET
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      embedding = EXCLUDED.embedding,
      source_url = EXCLUDED.source_url,
      source_date = EXCLUDED.source_date
    RETURNING id
  `;

  const result = await pool.query(sql, [
    'curated-answer',
    SOURCE_URL,
    SOURCE_DATE,
    doc.chunkId,
    doc.title,
    doc.content,
    JSON.stringify({
      source: 'Kosningaáætlun Alþingiskosningar 2024',
      document: 'Betra plan í ríkisfjármálum',
      url: SOURCE_URL,
      date: '2024-11-19',
      type: 'election-platform',
      verified: true,
    }),
    vectorStr,
  ]);

  console.log(`   ✅ Vistað með ID: ${result.rows[0].id}`);
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Bæti við: Betra plan í ríkisfjármálum (nóv 2024)          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nURL: ${SOURCE_URL}`);
  console.log(`Fjöldi kafla: ${FISCAL_POLICY_DOCUMENTS.length}\n`);

  try {
    for (const doc of FISCAL_POLICY_DOCUMENTS) {
      await addDocument(doc);
    }

    // Verify
    const countResult = await pool.query(
      "SELECT COUNT(*) FROM rag_documents WHERE source_type = 'curated-answer'"
    );
    console.log(`\n✅ Samtals curated-answer skjöl: ${countResult.rows[0].count}`);

    // List fiscal policy docs
    const fiscalResult = await pool.query(
      "SELECT chunk_id, title FROM rag_documents WHERE chunk_id LIKE 'rikisfjarmalamal%' ORDER BY chunk_id"
    );
    console.log(`\n📋 Ríkisfjármálaskjöl:`);
    for (const row of fiscalResult.rows) {
      console.log(`   - ${row.title}`);
    }

  } catch (error) {
    console.error('❌ Villa:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
