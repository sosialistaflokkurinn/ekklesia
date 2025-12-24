#!/usr/bin/env node
/**
 * Index Party Website Content
 *
 * Indexes content from sosialistaflokkurinn.is (xj.is) into pgvector
 * for RAG semantic search.
 *
 * Usage:
 *   node scripts/index-party-website.js [--dry-run] [--no-embeddings]
 *
 * Requires:
 *   - Cloud SQL proxy running on port 5433
 *   - GCP credentials for Vertex AI
 */

// Set up environment for Cloud SQL BEFORE any imports
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'ekklesia-prod-10-2025';
process.env.DATABASE_HOST = process.env.DATABASE_HOST || 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT || '5433';
process.env.DATABASE_NAME = process.env.DATABASE_NAME || 'socialism';
process.env.DATABASE_USER = process.env.DATABASE_USER || 'socialism';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD || 'Socialism2025#Db';

const embeddingService = require('../src/services/service-embedding');
const vectorSearch = require('../src/services/service-vector-search');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_EMBEDDINGS = process.argv.includes('--no-embeddings');

// Party website content from sosialistaflokkurinn.is
// Last updated: December 2025
const WEBSITE_CONTENT = {
  metadata: {
    source: 'sosialistaflokkurinn.is',
    lastUpdated: '2025-12',
    url: 'https://sosialistaflokkurinn.is/',
  },
  pages: [
    {
      id: 'about',
      title: 'Um Sósíalistaflokkinn',
      url: 'https://sosialistaflokkurinn.is/sidur/the-socialist-party-of-iceland',
      content: `Sósíalistaflokkur Íslands er stjórnmálaflokkur almennings á Íslandi.

Markmið flokksins er að vinna að samfélagi frelsis, jafnréttis, mannúðar og samkenndar. Þetta er aðeins hægt með því að setja völdin í hendur fólksins.

Flokkurinn talar fyrir launafólki og jaðarsettum hópum. Hann berst gegn auðvaldinu og fulltrúum þess með víðtækri stéttabaráttu sem hafnar málamiðlunum og fölskum samræðum.

Flokkurinn tekur öllum opnum örmum óháð kyni, uppruna, trú eða kynhneigð.

Fimm meginmál flokksins:
1. Lífskjör - Tryggja mannsæmandi kjör launafólks, atvinnulausra, lífeyrisþega, námsmanna og heimavinnandi
2. Húsnæðismál - Tryggja aðgang að öruggu og viðráðanlegu húsnæði
3. Samfélagsþjónusta - Gjaldfrjáls heilbrigðisþjónusta, menntun á öllum stigum og þjónusta við fólk
4. Vinnutími - Stytta vinnuvikuna til að bæta lífsgæði og lýðræðislega þátttöku
5. Skattar - Endurskipuleggja skattakerfið svo auðmenn greiði sinn skerf og draga úr byrðum annarra`,
    },
    {
      id: 'husnaedi',
      title: 'Stefna - Húsnæðismál',
      url: 'https://sosialistaflokkurinn.is/malefnaflokkar/husnaedismal/',
      content: `Húsnæðismál - Stefna Sósíalistaflokksins (samþykkt 15. júní 2024)

KJARNASTEFNA: Húsnæði fyrir fólk - ekki leikvöllur braskara. Húsnæðisöryggi er grunnforsenda velferðar og sjálfsögð mannréttindi.

STÓRA MARKMIÐIÐ:
30 þúsund félagslegar íbúðir á næstu 10 árum. Byggðar verði 4.000 íbúðir á ári næstu þrjú árin til að mæta uppsafnaðri þörf.

Helstu atriði:

1. HÚSNÆÐISSJÓÐUR ALMENNINGS
Stofna nýjan húsnæðissjóð sem byggir og leigir óhagnaðardrifið húsnæði til félagslega rekinna leigufélaga (sveitarfélaga, námsmannafélaga, félaga fatlaðs fólks, aldraðra, einstæðra foreldra).

2. 25% FÉLAGSLEGT HÚSNÆÐI
Tryggt verði fjármagn í að félagslega rekin leigufélög verði að lágmarki 25% af húsnæðismarkaðnum eftir 20 ár.

3. VERND LEIGJENDA
- Langtímaleigusamningar með þaki á leiguverði
- Viðhaldsskylda leigusala
- Vísitölubreyting á húsaleigu aðeins einu sinni á ári
- Enginn greiði meira en fjórðung ráðstöfunartekna í húsaleigu

4. HÖMLUR Á AIRBNB
Settar verði ríkari hömlur á skammtímaleigu til ferðamanna (Airbnb) svo leigumarkaðurinn verði ekki markaðsöflum að bráð.

5. HEIMILISLEYSI ÚTRÝMT
Ólöglegt verði fyrir hið opinbera að vísa nauðstöddu fólki á götuna. Gistiskýli verði ekki rekin sem nætur-úrræði eingöngu.

6. HÚSNÆÐI FYRIR NÁMSMENN
Námsmönnum í háskóla- eða framhaldsskólanámi verði tryggt húsnæði á nemendagörðum í gegnum óhagnaðardrifin húsnæðisfélög.

7. HÚSNÆÐI FYRIR FATLAÐ FÓLK OG ALDRAÐA
Tryggt húsnæði í gegnum félagslega rekin og óhagnaðardrifin húsnæðisfélög.

8. SAMVINNUFÉLÖG
Lög um samvinnufélög verði endurskoðuð svo hægt sé að stofna leigufélög og samvinnufélög á gerlegan máta. Byggingasamvinnufélög og leigufélög rekin af íbúunum sjálfum fái blómstrað.

9. VERND GEGN AFNÁMI
Tryggt verði að eitt löggjafarþing geti ekki afnumið félagslega eða samvinnufélagslega rekin húsnæðiskerfi og sjóði.

FJÁRMÖGNUN:
- Húsnæðissjóður almennings aflar 70% fjármagns með útgáfu skuldabréfa til lífeyrissjóða
- Sveitarfélög og ríki leggja til 13% í formi lóða
- 17% kemur sem lán frá ríkissjóði á lægstu vöxtum`,
    },
    {
      id: 'heilbrigdi',
      title: 'Stefna - Heilbrigðismál',
      url: 'https://sosialistaflokkurinn.is/sidur/stefnan',
      content: `Heilbrigðismál - Stefna Sósíalistaflokksins

Meginstefna: Gjaldfrjáls, skattfjármögnuð heilbrigðisþjónusta fyrir alla.

Helstu atriði:
- Andstaða við markaðsvæðingu heilbrigðiskerfisins
- Áhersla á eflingu heilsugæslunnar
- Fullgilding samnings Sameinuðu þjóðanna um réttindi fatlaðs fólks
- Notendastýrð persónuleg aðstoð fyrir fatlað fólk
- Full niðurgreiðsla lyfja og stofnun opinberra apóteka
- Útvíkkun geðheilbrigðisþjónustu þ.m.t. barna- og unglingageðdeild
- Langtímaáætlun í heilbrigðismálum með fullnægjandi fjármögnun Landspítala
- Heimahjúkrun, hjúkrunarheimili og sjúkrahúsvalkostir fyrir aldraða
- Heilbrigðisþjónusta á landsbyggðinni og fjarlæknisfræði
- Bætt kjör heilbrigðisstarfsmanna og teymisvinnu
- Stofnun umbóðsmanns sjúklinga`,
    },
    {
      id: 'lydraedi',
      title: 'Stefna - Lýðræðismál',
      url: 'https://sosialistaflokkurinn.is/sidur/stefnan',
      content: `Lýðræðismál - Stefna Sósíalistaflokksins

Meginstefna: Jöfnuður sé hornsteinn lýðræðis.

Helstu atriði:
- Sanngjarnt kosningakerfi þar sem atkvæði allra hafa jafnt vægi óháð búsetu
- Niðurstöður þjóðaratkvæðagreiðslna verði alltaf virtar
- Forgangsröðun innleiðingar nýrrar stjórnarskrár
- Lýðræði innbyggt í grunnskólanám
- Almenningur hafi aðgang að áreiðanlegum upplýsingum
- Lýðræðisvæðing verkalýðsfélaga og lífeyrissjóða
- Stuðningur við neytendaverndarssamtök
- Náttúruauðlindir verði áfram í eigu almennings
- Þátttaka starfsmanna og lýðræðisleg stjórnun vinnustaða`,
    },
    {
      id: 'sjodir',
      title: 'Stefna - Sameiginlegir sjóðir',
      url: 'https://sosialistaflokkurinn.is/sidur/stefnan',
      content: `Sameiginlegir sjóðir - Stefna Sósíalistaflokksins

Meginstefna: Sameinað tryggingakerfi sem sameinar sundurslitnar bætur og lífeyri.

Helstu atriði:
- Einfaldað almannatryggingakerfi
- Námsstyrkir í stað námslána
- Aukin skattrannsókn og eftirlitsöfl sem beinast að auðugum einstaklingum og fyrirtækjum
- Stighækkandi skattlagning til tekjujöfnunar
- Hækkaðar barnabætur fyrir fjölskyldur
- Afnám þjónustugjalda á opinberri þjónustu með þjóðnýtingu auðlindatekna`,
    },
    {
      id: 'utanrikismal',
      title: 'Stefna - Utanríkismál',
      url: 'https://sosialistaflokkurinn.is/malefnaflokkar/utanrikismal/',
      content: `Utanríkismál - Stefna Sósíalistaflokksins (samþykkt 4. júlí 2021)

KJARNASTEFNA: Ísland sé herlaust og vopnalaust land sem vinnur að friði í stað hernaðarbandalaga.

AFSTAÐA TIL NATO:
Flokkurinn vill að Ísland stofni friðarbandalag með öðrum smáþjóðum í stað þátttöku í hernaðarbandalagi eins og NATO. Innganga í NATO var aldrei borin undir þjóðina og ætti að gera sem fyrst í þjóðaratkvæðagreiðslu.

Helstu atriði stefnunnar:

1. HERLAUST OG VOPNALAUST LAND
Ísland skal vera herlaust land, fari aldrei með ófriði á hendur öðrum ríkjum né styðji slíkar aðgerðir. Landið sé með öllu vopnalaust og vopna- og kjarnorkuflutningar inn í íslenska landhelgi og lofthelgi sé með öllu óheimil.

2. FRIÐARBANDALAG Í STAÐ HERNAÐARBANDALAGS
Flokkurinn vill að þjóðin styrki samband sitt og samvinnu við nágrannaþjóðirnar og aðrar smáþjóðir og komi á friðarbandalagi. Slíkt bandalag verði valkostur á móti núverandi veru landsins í NATO.

3. ÞJÓÐARATKVÆÐAGREIÐSLA UM NATO
Innganga í NATO var ekki borin undir þjóðina á sínum tíma. Flokkurinn telur að það ætti að gera sem fyrst. Stærri ákvarðanir um alþjóðlegt samráð og þátttöku í bandalögum skulu settar í þjóðaratkvæðagreiðslu.

4. SAMSTAÐA MEÐ SMÁÞJÓÐUM
Ísland sýni samstöðu með hinum smáu og undirokuðu sem þrá frelsi og sjálfstæði hvar sem þá er að finna í heiminum, þ.m.t. Grænlendingar, Færeyingar, Palestínumenn og Kúrdar.

5. LÝÐRÆÐI OG MANNRÉTTINDI
Staðið sé með lýðræði og mannréttindum hvar sem er og baráttunni gegn auðvaldi og kúgun á alþjóðavettvangi.

6. LOFTSLAGSNEYÐARÁSTAND
Lýsa yfir neyðarástandi í loftslagsmálum og vinna með öðrum ríkjum að því að afstýra loftslagshamförum.

7. FLÓTTAFÓLK OG ÚTLENDINGALÖG
Útlendingalög landsins verði endurskoðuð frá grunni með mannúð og mannréttindi í öndvegi. Taka á móti flóttafólki með mannúð.

8. ALÞJÓÐLEG VERKALÝÐSBARÁTTA
Styðja við verkalýðsbaráttu um allan heim og samvinnu verkalýðshreyfingarinnar milli landa.`,
    },
    {
      id: 'fyrstu-barattumal',
      title: 'Stefna - Fyrstu baráttumál',
      url: 'https://sosialistaflokkurinn.is/malefnaflokkar/fyrstu-barattumal/',
      content: `Fyrstu baráttumál - Stefna Sósíalistaflokksins (samþykkt 1. maí 2017)

Fimm meginmál flokksins:

1. MANNSÆMANDI KJÖR
Mannsæmandi kjör fyrir alla landsmenn, hvort sem þeir eru launamenn, atvinnulausir, lífeyrisþegar, námsmenn eða heimavinnandi.

2. HÚSNÆÐI
Aðgengi að öruggu og ódýru húsnæði.

3. GJALDFRJÁLS GRUNNÞJÓNUSTA
Aðgengi að gjaldfrjálsu heilbrigðiskerfi, að gjaldfrjálsri menntun á öllum skólastigum og að gjaldfrjálsu velferðarkerfi.

4. STYTTING VINNUVIKUNNAR
Stytting vinnuvikunnar, til að bæta lífsgæði fólksins í landinu og auðvelda því að gerast virkir þátttakendur í lýðræðinu.

5. SKATTHEIMTA
Enduruppbygging skattheimtunnar með það fyrir augum að auðstéttin greiði eðlilegan skerf til samneyslunnar en álögum sé létt af öðrum.`,
    },
    {
      id: 'menntamal',
      title: 'Stefna - Menntamál',
      url: 'https://sosialistaflokkurinn.is/malefnaflokkar/menntamal/',
      content: `Menntamál - Stefna Sósíalistaflokksins (samþykkt 19. maí 2019)

KJARNASTEFNA: Menntun barna og ungmenna sé með öllu gjaldfrjáls.

14 stefnuatriði:

1. Menntun barna og ungmenna sé með öllu gjaldfrjáls sem og háskóla- og framhaldsnám á vegum hins opinbera.

2. Skólamáltíðir á grunn- og framhaldsskólastigi séu gjaldfrjálsar.

3. Komið sé í veg fyrir stéttskiptingu milli skóla og innan þeirra með aðgerðum til jöfnuðar.

4. Skólinn stuðli að vellíðan nemenda og starfsfólks með því að draga úr samkeppni innan skólaumhverfisins.

5. Allir skólar bjóði upp á þann stuðning sem nemendur þurfa á að halda óháð biðlistum og greiningum.

6. Börnum og ungmennum séu tryggðar gjaldfrjálsar tómstundir og að þær séu færðar inní skólahúsnæðið.

7. Innflytjendum á öllum aldri sé tryggð íslenskukennsla og innflytjendabörnum móðurmálskennsla.

8. Börnum á flótta sé tryggð menntun til jafns við önnur börn.

9. Lýðræðisvitund nemenda og starfsfólks á öllum skólastigum sé virkjuð.

10. Störf kennara séu metin að verðleikum og gerð eftirsóknarverð.

11. Öll tengsl menntunar og vinnumarkaðar séu í samstarfi við verkalýðsfélög.

12. Auka verk-, tækni- og listnám á öllum skólastigum.

13. Tekið verði upp námsstyrkjakerfi.

14. Tryggja virkt rannsókna-, vísinda- og fræðaumhverfi á Íslandi.`,
    },
    {
      id: 'sveitastjornarmal',
      title: 'Stefna - Sveitastjórnarmál',
      url: 'https://sosialistaflokkurinn.is/malefnaflokkar/sveitastjornarmal/',
      content: `Sveitastjórnarmál - Stefna Sósíalistaflokksins (samþykkt 1. maí 2018)

KJARNASTEFNA: Grunnþörfum allra íbúa sveitarfélaga sé mætt.

14 stefnuatriði:

1. VELFERÐ: Sveitarfélög skulu vinna í þágu einstaklinga og fjölskyldna og hlúa sérstaklega að eldri fólki, öryrkjum og láglaunafólki.

2. BÖRN: Yngstu börnum tryggðar aðstæður til þroska með fjölskyldu sinni og síðar með jafnöldrum.

3. MENNTUN: Börnum og ungmennum tryggð menntun og gjaldfrjáls skóli og námsgögn.

4. FRAMFÆRSLUVIÐMIÐ: Sveitarfélög útbúi raunhæf framfærsluviðmið sem tryggja örugga framfærslu.

5. FÉLAGSÞJÓNUSTA: Setja þarfir og rödd notenda félagsþjónustu í fyrsta sæti.

6. HÚSNÆÐI: Allir eigi rétt á góðu húsnæði með félagslegri leigubyggingu og þaki á leiguverð.

7. LÝÐRÆÐI: Íbúar fái meiri áhrif með samráðshópum og slembivöldum einstaklingum.

8. LAUN: Sveitarfélög skulu hverfa frá láglaunastefnu og verða leiðandi fyrirmynd um laun og kjör.

9. UMHVERFI: Tryggja réttindi íbúa til heilsusamlegs umhverfis.

10. SAMGÖNGUR: Samgöngur miði að því að þjóna íbúum og fjargi bílaborg.

11. FYRIRTÆKI: Standa vörð um fyrirtæki í eigu sveitarfélaga og auka aðhald og gegnsæi.

12. JÖFNUÐUR: Öll sveitarfélög taki sameiginlega ábyrgð og tryggi jöfnuð íbúa, sveitarfélaga og landshluta.

13. GEGNSÆI: Innleiða stjórnsýslulög og upplýsingalög og auka gegnsæi starfa sinna.

14. Tilvísun til annarra stefnumála flokksins.`,
    },
    {
      id: 'vinnumarkadsmal',
      title: 'Stefna - Vinnumarkaðsmál',
      url: 'https://sosialistaflokkurinn.is/malefnaflokkar/vinnumarkadsmal/',
      content: `Vinnumarkaðsmál - Stefna Sósíalistaflokksins (samþykkt 19. maí 2019)

KJARNASTEFNA: Gætt sé að manngildi, reisn og öryggi á vinnumarkaði með mannsæmandi kjörum og vinnuaðstæðum.

17 stefnuatriði:

1. Grunntaxti lágmarkslauna og skattleysismörk aldrei undir opinberu framfærsluviðmiði.

2. Ríki og sveitarfélög ekki leiðandi í láglaunastefnu.

3. Minnkun munar milli hæstu og lægstu launa.

4. Stöðvun útvistunnar á starfum hins opinbera.

5. Jafnrétti á vinnumarkaði með sömu kjörum fyrir sömu vinnu.

6. Erlent starfsfólk með sömu kjör og réttindi sem íslenskt starfsfólk.

7. Skýr aðgerðaáætlun gegn mansali og eftirlit með starfsmannaleigum.

8. Koma í veg fyrir óeðlilega tengingu vinnuveitanda og leigusala.

9. Viðurlög við kennitöluflakki og launaþjófnaði.

10. Endalok skerðingar lífeyrisþega við atvinnuþátttöku.

11. Afnám starfsgetumats og krónu-á-móti-krónu-skerðingar.

12. Framlengja fæðingarorlof í 18 mánuði.

13. Aukið lýðræði á vinnustöðum.

14. Stuðningur við samvinnufélög.

15. 32 stunda vinnuvika.

16. Vörnun lýðræðis í stéttarfélögum.

17. Og fleiri stefnuatriði um betri vinnumarkað.`,
    },
    {
      id: 'velferdarmal',
      title: 'Stefna - Velferðarmál',
      url: 'https://sosialistaflokkurinn.is/malefnaflokkar/velferdarmal/',
      content: `Velferðarmál - Stefna Sósíalistaflokksins (samþykkt 19. maí 2019)

KJARNASTEFNA: Hér á landi sé rekið velferðarsamfélag þar sem unnið er markvisst að réttlátri skiptingu gæða og útrýmingu fátæktar.

16 stefnuatriði:

1. Öllum sé tryggður aðgangur að velferðarkerfi með lögum án tillits til greiðslugetu.

2. Velferðarþjónusta skal ekki rekin í hagnaðarskyni.

3. Notendur eiga að taka þátt í stjórnun velferðarmála og kjósa sér fulltrúa.

4. Enginn verði framfærslulaus og skal ríkið tryggja lífeyrisþegum, öldruðum, atvinnulausum framfærslu.

5. Ríkið skal setja fram framfærsluviðmið miðað við launaþróun og húsaleigu.

6. Greiðan aðgang að réttindum í gegnum þjónustufulltrúa og umboðsmann.

7. Fólk haldi réttindum þrátt fyrir flutninga milli sveitarfélaga.

8. Félagsleg úrræði óháð búsetu.

9. Börn og barnafjölskyldur njóti sérstakrar verndar.

10. Langveik börn missi ekki réttindi við sjálfræðisaldur.

11. Öllum tryggð búseta við hæfi.

12. Efling örorkulífeyriskerfis; afnám krónu-á-móti-krónu-skerðinga.

13. Eldri borgurum þjónusta við hæfi.

14. Hugað að velferð viðkvæmra hópa og jaðarsettra.

15. Fíknisjúkdómurinn sé afglæpavæddur og tekið á honum sem heilbrigðisvanda.

16. Velferðarþjónusta byggist á virðingu og mannhelgi.`,
    },
    {
      id: 'jafnrettismal',
      title: 'Stefna - Jafnréttismál',
      url: 'https://sosialistaflokkurinn.is/malefnaflokkar/jafnrettismal/',
      content: `Jafnréttismál - Stefna Sósíalistaflokksins (samþykkt 13. október 2019)

KJARNASTEFNA: Allir skulu vera jafnir fyrir lögum samfélagsins óháð efnahag, félagslegri stöðu, uppruna eða líkamlegu atgervi.

21 stefnuatriði:

1. Efnahagsleg forréttindi skal ekki ráða stefnu eða lögum landsins.
2. Slagorðið "Ekkert um okkur án okkar" skal virðað í stjórnvaldsákvörðunum.
3. Skattheimta skal vera réttlát og notuð sem jöfnunartæki.
4. Upplýsingar til almennings skulu vera fullnægjandi og aðgengilegar.
5. Vægi atkvæða til alþingiskosninga skal vera jafnt óháð búsetu.
6. Lýðræði skal virt og þjóðaratkvæðagreiðslur bindandi.
7. Nægilegt fjármagn í heilbrigðis- og velferðarþjónustu.
8. Bráðaúrræði opin og fleiri fíknimeðferðarúrræði.
9. Aðgengismál fatlaðs fólks og virting mannréttinda þeirra.
10. Markvisst unnið að mannréttindum hinsegin fólks.
11. Börn njóta sérstakrar verndar gegn kynrænum aðgerðum.
12. Öll þjónusta við börn gjaldfrjáls.
13. Jafnrétti í skólum og á vinnumarkaði óháð fleiri þáttum.
14. Barátta gegn láglaunastefnu, sérstaklega "kvennastörf".
15. Markvisst unnið gegn kynbundnu ofbeldi.
16. Barátta gegn ofsóknum, hatursorðræðu og heimilisofbeldi.
17. Sérstakur gaumur að margfaldri mismunun innan stjórnsýslunnar.
18. Sjálfsákvörðunarréttur um þungunarrof og líkamafrek.
19. Allir jafnir alþjóðlega; mannúðleg meðferð fyrir þá sem leita verndar.
20. Siðferðileg ábyrgð gegn mannréttindabrotum á heimsvísu.
21. Yfirvöld ekki í viðskiptum við fyrirtæki sem brjóta mannréttindi.`,
    },
    {
      id: 'umhverfismal',
      title: 'Stefna - Umhverfis- og loftslagsmál',
      url: 'https://sosialistaflokkurinn.is/malefnaflokkar/umhverfis-og-loftslagsmal/',
      content: `Umhverfis- og loftslagsmál - Stefna Sósíalistaflokksins (samþykkt 13. október 2019)

KJARNASTEFNA: Umhverfis- og loftslagsmál eru mannúðarmál sem varða réttindi komandi kynslóða til lífs.

20 stefnuatriði:

1. Lýsa skal yfir neyðarástandi í loftslagsmálum með hraðri og vissum viðbrögðum.

2. Snúa skal baki við kapítalísku hagkerfi og nýfrjálshyggjukenndum lausnum í umhverfismálum.

3. Náttúran og lífríki hennar skal vera í fyrirrúmi fram yfir fjárhagslega hagsmuni.

4. Öllum íbúum skal gerð kleif að lifa umhverfisvænu lífi óháð efnahagslegri stöðu.

5. Stuðla skal matvælaframleiðslu í nærumhverfinu með grænni orku.

6. Taka skal róttæk skref gegn einnota plasti og plastmengun.

7. Sveitarfélög skulu koma upp ókeypis flokkunarkerfi fyrir íbúa.

8. Almenningssamgöngur sem lið í umhverfisvernd og sjálfsagða þjónustu.

9. Endurskoða skal flug- og skipaflutninga.

10. Stöðva skal frekari stóriðju og efla eftirlit.

11. Græða landið og auka trjárækt.

12. Leggja skal kvaðir á sóun á mat og varningi.

13. Gera róttækar breytingar á eldsneytisnýtingu.

14. Auka möguleika á umhverfisvænni fararkostum.

15. Takmarka notkun nagladekkja og svifryks.

16. Standa vörð um sjávarlifríki.

17. Aðhald í vatnsnýtingu og gjöld fyrir fyrirtæki.

18. Umhverfisvæn framkvæmd mannvirkja.

19. Horfa skal á umhverfismál sem sameiginlega hagsmuni allra jarðarbúa með hnattrænni sýn.

20. Kapítalismi er meginástæða loftslagsbreytinga og áhersla á breytingar við framleiðsluna.`,
    },
    {
      id: 'samgongumal',
      title: 'Stefna - Samgöngumál',
      url: 'https://sosialistaflokkurinn.is/malefnaflokkar/samgongumal/',
      content: `Samgöngumál - Stefna Sósíalistaflokksins (samþykkt 18. janúar 2020)

KJARNASTEFNA: Samgöngumannvirki og rekstur þeirra séu í eigu þjóðarinnar.

17 stefnuatriði:

1. Samgöngumannvirki og rekstur þeirra séu í eigu þjóðarinnar.

2. Jarðgöng, brýr og vegir séu öllum aðgengilegir án gjaldtöku og veggjöldum verið alfarið hafnað.

3. Tryggð sé nægileg fjármögnun til viðhalds og reksturs samgöngumannvirkja og vegakerfis.

4. Vinna markvisst að umhverfisvænum lausnum í samgöngumálum (rafvædd ökutæki, strætó/borgarlína).

5. Styrkja nýsköpun í útfærslu nýrra farartækja.

6. Byggja upp innviði fyrir fjölbreyttar samgöngur um land allt (land, loft, sjó).

7. Almannavarnir hafðar í fyrirrúmi á öllu landinu og flóttaleiðir tryggðar.

8. Flugvellir og hafnir séu í þjóðareign og reknar af hinu opinberu.

9. Ferðaþjónusta fatlaðra sé sjálfsögð mannréttindi, gjaldfrjáls og gerð aðgengilegri.

10. Sjúkraflutningar, ferðaþjónusta fatlaðra og önnur sjálfsögð akstursþjónusta sé í almannaeigu.

11. Gjaldfrjálst verði í strætó/borgarlínu.

12. Almenningssamgöngur séu efldar innan höfuðborgarsvæðisins með því að þjóna betur úthverfum.

13. Launakjör og starfsumhverfi starfsmanna í almenningssamgöngum séu bætt.

14. Þjónusta fólks í nærumhverfi sínu sé bætt til að draga úr löngum akstursleiðum.

15. Almenningur geti tekið þátt í uppbyggingu samgangna í sínu nærumhverfi.

16. Internetið sé hluti af samgöngumálum og innviðir fjarskipta séu í almannaeigu.

17. Strandflutningar verði efldir og þungaflutningar fari sjóleiðina.`,
    },
    {
      id: 'audlindamal',
      title: 'Stefna - Auðlindamál',
      url: 'https://sosialistaflokkurinn.is/malefnaflokkar/audlindamal/',
      content: `Auðlindamál - Stefna Sósíalistaflokksins (samþykkt 18. janúar 2020)

KJARNASTEFNA: Auðlindir í náttúru Íslands séu sameiginleg og ævarandi sameign þjóðarinnar og vernd náttúrunnar verði ávallt höfð í fyrirrúmi.

19 stefnuatriði:

1. Auðlindir í þjóðareign: náttúrugæði, vistkerfi, nytjastofna, vatn, jarðhita, rafmagn, sjó og andrúmsloft.

2. Leyfi til auðlindanýtingar krefst umhverfismats með almannahagsmunum og sjálfbærni.

3. Jafnræðissjónarmið verða virt við leyfisveitingar í gagnsæju ferli.

4. Óháð eftirlit með nýtingarrétti bundist lögum.

5. Eftirlit með auðlindanýtingu skal stóraukið með aðgengilegum upplýsingum.

6. Rannsóknir og mælingar á gæðum auðlinda skulu stórauknar og vel fjármagnaðar.

7. Leyfi leiðir aldrei til eignarréttar eða óafturkallanlegs forræðis.

8. Núverandi kvótakerfi skal afnumið; nýtt fiskveiðistjórnunarkerfi settist á.

9. Fiskveiðileyfi veittust tímabundið, gagnvart gjaldi fyrir þjóðina.

10. Fiskveiðileyfi skulu skilyrt staðbundnum og óframseljanleg.

11. Landbúnaðarkerfi endurskoðað með bændum, með sjálfbærni og matvælaöryggi.

12. Jarðnæði, bújarðir háð skilyrðum; engin safnun jarða.

13. Andrúmsloft verndað sem best; iðnaður fylgi ítrustu útblásturs- og loftgæðiskröfum.

14. Orkuframleiðsla ekki aukin óþarflaust umfram þörf almennings.

15. Einkavæðing orkuframleiðslu lögð af; orkuvelar færðar í þjóðareign.

16. Yfirvöld tryggja orkuveitu um landið og skilgreina raforku sem grunnþörf.

17. Ferðaþjónusta ber ábyrgð á auðlindum með sjálfbærnigjaldi.

18. Auðlindir annarra ríkja umgengist af virðingu; spilling varðað ströngu viðurlögum.

19. Ítarleg útfærsla á sjálfbærni, vistkerfi, leyfisveitingum og orkumálum.`,
    },
    {
      id: 'byggdamal',
      title: 'Stefna - Byggðamál',
      url: 'https://sosialistaflokkurinn.is/malefnaflokkar/byggdamal/',
      content: `Byggðamál - Stefna Sósíalistaflokksins (samþykkt 3. júní 2020)

KJARNASTEFNA: Íslensk náttúra gangi óspillt til næstu kynslóða og þjóðgörðum verði stjórnað í almannaþágu en ekki í þágu atvinnugreina.

17 stefnuatriði:

1. Öllum byggðarlögum skal gerð jafn há stjórnsýsla með félagslegum háttum og réttlátri valddreifingu.

2. Öll opinber þjónusta fylgi nægilegt fjármagn um landið og allir íbúar geti sótt þjónustu í heimabyggð.

3. Félagsleg réttindi, framfærsla, húsnæðisbætur og þjónusta samræmd um allt land.

4. Þriðja stjórnsýslustig með stækkuðum sveitarfélögum sem landshlutastjórnvaldseiningar.

5. Hver landsfjórðungur með kjarna innviði: vel búnum sjúkrastofnunum, heilsugæslu án gjalds, sjúkraþyrlu og snjóplógum.

6. Öryggismál tryggð með orkuverum, fjarskiptabúnaði, snjóflóðavörnum, raforku og varaaflsstöðvum.

7. Bætt vegakerfi án veggjalda og sterk almenningssamgöngur á samfélagslegum forsendum.

8. Endurskoðað fiskveiðistjórnunarkerfi sem styrkir byggðir sem treysta á fiskimið.

9. Aukin sjálfbærni með fullvinnslu afurða (fisk, matvæli) innanlands.

10. Aukið framtak á nýsköpun um allt land í öllum greinum.

11. Efld list og menning á landsbyggðinni með nýrri sköpun og verndun eldri arfs.

12. Tækniskólar og háskólar innan hvers landshluta með endurmenntunarúrræðum.

13. Opinberar stofnanir og stórfyrirtæki taki upp fjarvinnu og störf án staðsetningar.

14. Aukið eftirlit með ferðaþjónustu til verndunar náttúru.

15. Óspillt víðerni, hálendið skilgreind sem þjóðgarðar, vernduð fyrir ágangi.

16. Nýting bújarða háð skilyrðum svo sem búsetuskilyrðum og til tiltekins tíma í senn.

17. Um 40% ósnortra víðerna Evrópu liggur á Íslandi og skal nýtast með sjálfbærni.`,
    },
    {
      id: 'landbunadarmal',
      title: 'Stefna - Landbúnaðar- og matvælamál',
      url: 'https://sosialistaflokkurinn.is/malefnaflokkar/landbunadar-og-matvaelamal/',
      content: `Landbúnaðar- og matvælamál - Stefna Sósíalistaflokksins (samþykkt 3. júní 2020)

KJARNASTEFNA: Leitað verði þjóðarsáttar um landbúnað.

17 stefnuatriði:

1. Leitað verði þjóðarsáttar um landbúnað.

2. Gert sé vistkort eða rammaáætlun um landbúnað og landnýtingu frá fjöru til fjalls um allt land.

3. Áhersla verði lögð á styttri virðiskeðju, umhverfisvernd, dýravernd, sjálfbærni og lífræna ræktun.

4. Fæðuöryggi sé tryggt á Íslandi með stöðugri og aukinni innlendri fæðuframleiðslu.

5. Bændum séu tryggð mannsæmandi kjör og starfsskilyrði.

6. Auknir nýsköpunarstyrkir verði veittir í landbúnaði með áherslu á lífræna ræktun.

7. Landbúnaðarkerfið sé gert sanngjarnari og sveigjanlegri svo möguleikar lítilla framleiðslueininga séu auknir.

8. Dýravernd sé háð hávegum og Ísland í fremstu röð við endurskoðun landbúnaðarkerfisins.

9. Myndaður verði hvati til stofnunar samvinnufélaga og pöntunarfélaga.

10. Auðvelda aðgengi að kaupum og sölu á matvöru í nærumhverfi neytenda.

11. Kvótakerfi verði endurskoðað og tryggt að það sé háð búsetu og framleiðsluskuldbindingu.

12. Auka eftirlit með innfluttri matvöru og tryggja samkeppnishæfni innlendrar vöru.

13. Veittur verði afsláttur af raforku til gróðurhúsaræktunar.

14. Komið sé í veg fyrir að fólk safni bújörðum með búskildu og takmörkunum.

15. Lausaganga búfjár verði skilyrt og landeyðing stöðvuð.

16. Skógrækt og landgræðsla verði aukin verulega.

17. Eiturefnanotkun og leyfisbundin útsæðisnotkun verði óheimil í landbúnaði og vegagerð.`,
    },
    {
      id: 'domsmal',
      title: 'Stefna - Dómsmál',
      url: 'https://sosialistaflokkurinn.is/malefnaflokkar/domsmal/',
      content: `Dómsmál - Stefna Sósíalistaflokksins (samþykkt 12. desember 2020)

KJARNASTEFNA: Dómskerfið byggi á réttlæti og sanngirni og allir hafi jafnan aðgang að því á öllum dómstigum óháð fjárhag og félagslegri stöðu.

23 stefnuatriði:

1. Gjafsókn verði öllum fær undir hátekjuviðmiðum.
2. Sakamál og dómsmál, sér í lagi kynferðisbrotamál, setjast í gagngera endurskoðun.
3. Barnaverndarmál setjast í endurskoðun með hagsmuni barna í fyrirrúmi.
4. Þolendur ofbeldismála fái réttindagæslumann/talsmann að kostnaðarlausu.
5. Fólki bjóðist áfallahjálp án þess að tapa réttindum.
6. Refsirammi sé í samræmi við alvarleika brota.
7. Kennitöluflakk og skattaskjól gerðar ólögleg.
8. Ríkið beri ábyrgð á greiðslum miska- og skaðabóta.
9. Hegningarlög fari í gagngera endurskoðun með betrunarstefnu.
10. Endurskoða umgjörð við skipun dómara.
11. Sektir verði tekjutengdar.
12. Ekki sé hægt að sækja til saka fyrir neyðir með ákveðnum mörkum.
13. Aðkoma almennings að dómskerfinu aukin á lýðræðislegum forsendum.
14. Ferli dómsmála endurskoðaðir með tryggðum áfrýjunarrétti.
15. Hælisleitendur og flóttafólk fái skjóta, efnislega málsmeðferð.
16. Enginn geti verið skilgreindur ólöglegur.
17. Stefna í innflytjendamálum endurskoðuð með aukinni réttindi.
18. Aðskilnaður ríkis og kirkju.
19. Dómsmál taki tillit til ólíkra fjölskyldumynstra.
20. Tvöfalt lögheimili barna verði mögulegt.
21. 19. grein lögreglulaga breytt til verndar borgaralegum réttindum.
22. Ríkið beri ábyrgð á allri upplýsingagjöf um réttindi og skyldur.
23. Ítarleg útfærsla á ofangreindum málum.`,
    },
    {
      id: 'rikisfjormal',
      title: 'Stefna - Ríkisfjármál',
      url: 'https://sosialistaflokkurinn.is/malefnaflokkar/rikisfjormal/',
      content: `Ríkisfjármál - Stefna Sósíalistaflokksins (samþykkt 12. desember 2020)

KJARNASTEFNA: Öll áhersla í ríkisfjármálum sé á velferð og jöfnuð.

21 stefnuatriði:

1. Endurskoða skal fjármálastefnu og innleiða MMT (Modern Monetary Theory).
2. Ríkið skal sinna grundvallarþörfum og reka grunn innviði.
3. Innheimta skal fullt gjald fyrir nýtingu auðlinda í þjóðareign.
4. Hæstu laun innan opinbera geti ekki verið hærri en þreföld lægstu laun.
5. Laun og bætur skulu ekki fara undir alþjóðleg fátæktarmörk.
6. Skattleysismörk skal hækka og fylgja vísitölu.
7. Skattkerfið skal nota til tekjujöfnunar með hátekjuskatti.
8. Fjármagnstekjur leggjast við aðrar tekjur.
9. Breyta lögum um einkahlutafélög til að koma í veg fyrir skattsniðgöngu.
10. Endurskoða virðisaukaskattskerfið og afnema hann á grundvörum.
11. Skattleggja sjálfvirkni og róbótavæðingu.
12. Börn skulu ekki skattlögð fyrir 18 ára aldur.
13. Stofna samfélagsbanka.
14. Afnema verðtryggingu.
15. Binda endi á fullkomna bankaleynd.
16. Ríkið skal reka virka atvinnustefnu.
17. Styðja sprotafyrirtæki og lítil fyrirtæki með þrepsköptu skattkerfi.
18. Stórfyrirtæki séu lýðræðisvædd.
19. Takmarka aðgang einstaklinga með stórfyrirtækjatengsl að þingsetu.
20. Þing og fjármálaráðuneyti leitist við samvinnu við almenning.
21. Virk þátttaka almennings við stefnumótun.`,
    },
    {
      id: 'menningarmal',
      title: 'Stefna - Menningarmál og listir',
      url: 'https://sosialistaflokkurinn.is/malefnaflokkar/menningarmal-og-listir/',
      content: `Menningarmál og listir - Stefna Sósíalistaflokksins (samþykkt 10. október 2024)

KJARNASTEFNA: Allir geti notið menningar og lista óháð efnahag, stétt eða stöðu.

19 stefnuatriði:

1. Veita fjármagn til fjölbreyttastra menningarkima, listgreina, safna, listhúsa, þjóðmenningu, fræðastarfa, fjölmiðla, bókasafna, sundlauga og félagsrýma.

2. Hættar allra samfélagshópa jafnt og stuðla að jafnri virðingu fyrir mismunandi listgreinum.

3. Efla menningu jaðarhópa með útgáfu miðla, farandsýningum, tónleikum og listsmiðjum.

4. Tryggja rekstur bókasafna, menningarmiðstöðva og virknimiðstöðva um allt land með aðgengi fyrir alla.

5. Gera úttekt á rekstri Hörpu tónleikahúss og efla menningu þar.

6. Stofna þjóðaróperu með staðfestu í lögum um sviðslistir.

7. Koma á fót danshúsi með samstarfi ríkis og sveitarfélaga.

8. Styrkja íslenska kvikmyndagerð með betri sjóðakerfi.

9. Tryggja sjálfstæði fjölmiðla með heilbrigðri gagnrýni.

10. Fjölga sjálfstætt starfandi fræðimönnum með afkomuöryggi.

11. Lögfesta höfundarréttarstefnu samkvæmt hugverkastefnu.

12. Tryggja aðgengi allra að listnámi með afnámi skólagjalda.

13. Efla þátttöku innflytjenda í listnám og menningarlífi.

14. Veita erlendum listamönnum aðgang og landvistarleyfi.

15. Efla starfslaunasjóði listamanna og verkefnastyrki.

16. Tryggja réttindi listamanna við opinberlega styrktar stofnanir.

17. Setja umhverfisvæn viðmið fyrir menningu og menningariðnað.

18. Stofna menningarmálaráðuneyti til að tryggja listum brautargengi.

19. Styðja menningarstofnanir og listamenn um allt land.`,
    },
    {
      id: 'contact',
      title: 'Tengiliðaupplýsingar',
      url: 'https://sosialistaflokkurinn.is/',
      content: `Sósíalistaflokkur Íslands

Heimilisfang: Hverfisgata 105, 101 Reykjavík
Netfang: xj@xj.is
Sími: 850 2244

Vefsíða: sosialistaflokkurinn.is (áður xj.is)`,
    },
  ],
};

/**
 * Index a page from the website
 */
async function indexPage(page, metadata) {
  const chunkId = `party-website-${page.id}`;

  // Build citation
  const citation = {
    who: 'Sósíalistaflokkur Íslands',
    when: metadata.lastUpdated,
    context: `Á heimasíðu flokksins (${metadata.source})`,
    section: page.title,
    url: page.url,
  };

  console.log(`   [${page.id}] ${page.title}`);

  if (!DRY_RUN) {
    let embedding = null;
    if (!SKIP_EMBEDDINGS && page.content.length > 10) {
      try {
        embedding = await embeddingService.generateEmbedding(page.content);
      } catch (err) {
        console.error(`   ⚠️  Embedding failed: ${err.message}`);
      }
    }

    await vectorSearch.upsertDocument({
      sourceType: 'party-website',
      sourceUrl: page.url,
      sourceDate: `${metadata.lastUpdated}-01`,
      chunkId,
      title: page.title,
      content: page.content,
      citation,
      embedding,
    });
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log('🌐 Party Website Indexer');
  console.log('='.repeat(50));
  console.log(`   Source: ${WEBSITE_CONTENT.metadata.source}`);
  console.log(`   Dry Run: ${DRY_RUN}`);
  console.log(`   Skip Embeddings: ${SKIP_EMBEDDINGS}`);

  try {
    const { metadata, pages } = WEBSITE_CONTENT;

    console.log(`\n📄 Indexing ${pages.length} pages...`);
    for (const page of pages) {
      await indexPage(page, metadata);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Indexing complete!');
    console.log(`   Pages: ${pages.length}`);

    if (DRY_RUN) {
      console.log('\n⚠️  DRY RUN - no changes were made');
    } else {
      // Show database stats
      const dbStats = await vectorSearch.getDocumentStats();
      console.log('\n📊 Database stats:');
      for (const row of dbStats) {
        console.log(`   ${row.source_type}: ${row.count} docs (${row.with_embedding} with embeddings)`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
