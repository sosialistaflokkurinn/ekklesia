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
Sósíalistaflokkurinn er andvígur hernaðarbandalögum og vill friðsamlegri leið í alþjóðasamstarfi.

ATHUGASEMD: Orðið "heimsvaldastefna" er ekki notað beint í stefnu flokksins. Hins vegar kemur efnið skýrt fram í stefnunni um herlaust land, friðarbandalag og andstöðu við hernaðarbandalög.

NATO OG ÞJÓÐARATKVÆÐAGREIÐSLA:
• Flokkurinn bendir á að innganga Íslands í NATO var aldrei borin undir þjóðina
• Krefst þjóðaratkvæðagreiðslu um áframhaldandi aðild að NATO
• Vill að Ísland stofni friðarbandalag með öðrum smáþjóðum í stað þátttöku í hernaðarbandalagi

HERLAUST ÍSLAND:
• Flokkurinn er mjög sammála því að Ísland eigi að vera herlaust land (5/5 í kosningaprófi)
• Vill að Ísland gerist hluti af friðarbandalagi þjóða án heraflans

VARNARSAMNINGUR VIÐ BANDARÍKIN:
• Flokkurinn er andvígur varnarsamningnum við Bandaríkin
• Andvígur hernaðarsamstarfi við Bandaríkin (1/5 í kosningaprófi)

ALÞJÓÐLEG STAÐA:
• Leggur áherslu á sjálfstæði Íslands í utanríkismálum
• Styður alþjóðlegt samstarf sem byggt er á friði og réttlæti, ekki hernaðarhyggju

MIKILVÆGT: Flokkurinn segir ekki beint "við viljum ganga úr NATO" - hann leggur áherslu á að þjóðin eigi að fá að kjósa um málið þar sem hún fékk aldrei tækifæri til þess upphaflega.`,
    citation: {
      who: 'Kimi viðtalsgreinandi',
      when: '2025-12-25',
      context: 'Greining á stefnu flokksins um hernað og alþjóðasamstarf, byggt á stefnuskjali um utanríkismál',
      url: 'https://sosialistaflokkurinn.is/malefnaflokkar/utanrikismal/',
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
Flokkurinn er frekar sammála því að Ísland eigi að vera utan ESB, en leggur áherslu á lýðræðislega ákvörðun.

ATHUGASEMD: ESB er ekki fjallað um sérstaklega í stefnuskjölum flokksins. Afstaðan kemur fram í kosningaprófum og er í samræmi við almenna stefnu flokksins um sjálfstæði og lýðræði.

AFSTAÐA Í KOSNINGAPRÓFI (RÚV 2024):
• 4/5 stig - "Frekar sammála" því að Ísland eigi að vera utan ESB
• Þetta er ekki alger andstaða (5/5) heldur frekar varfærin afstaða

LÝÐRÆÐISLEG NÁLGUN:
• Flokkurinn styður þjóðaratkvæðagreiðslu ef spurning um aðild kemur upp
• Sama nálgun og með NATO - fólkið á að ráða
• Ef til kemur aðildarumsókn ætti fólkið að fá að greiða atkvæði

MÖGULEGIR ÞÆTTIR Í AFSTÖÐU:
• Sjálfstæði í efnahagsmálum (samræmist stefnu um auðlindavernd)
• Lýðræðisleg ákvörðunarvald (samræmist stefnu um þjóðaratkvæðagreiðslur)
• Vernd vinnumarkaðar (samræmist stefnu um réttindi launafólks)

MIKILVÆGT: Þetta er ekki "á móti ESB" í þeim skilningi að flokkurinn vilji hætta öllum samskiptum - heldur varkárni gagnvart fullri aðild.`,
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
  {
    id: 'stefna-stjornarskra',
    title: 'Afstaða Sósíalistaflokksins til stjórnarskrár',
    questionVariations: [
      'Hvað segir flokkurinn um stjórnarskrána?',
      'Vill flokkurinn nýja stjórnarskrá?',
      'Afstaða til stjórnarskrár',
      'Stjórnarskrá sósíalista',
      'Hvað finnst flokknum um stjórnarskrána?',
      'Er flokkurinn fyrir nýja stjórnarskrá?',
      'Hvað segir flokkurinn um þjóðkjörnu stjórnarskrána?',
      'Afstaða til stjórnarskrárbreytinga',
      'Vill flokkurinn breyta stjórnarskránni?',
      'Hvað segir flokkurinn um 2012 stjórnarskrána?',
      'Þjóðaratkvæðagreiðsla um stjórnarskrá',
    ],
    content: `SPURNING: Hvað segir flokkurinn um stjórnarskrána?

SVAR:
Sósíalistaflokkurinn vill innleiða nýju stjórnarskrána sem samþykkt var í þjóðaratkvæðagreiðslu 2012.

ATHUGASEMD UM KOSNINGAPRÓF:
Í RÚV kosningaprófi 2024 svaraði flokkurinn "Ósammála" við fullyrðingunni "Alþingi á að vinna markvisst að endurskoðun stjórnarskrárinnar."

MIKILVÆGT: Þetta þýðir EKKI að flokkurinn vilji halda núverandi stjórnarskrá!

Ástæðan er að:
- Ný stjórnarskrá hefur ÞEGAR verið samþykkt með þjóðaratkvæðagreiðslu 2012
- Flokkurinn vill að hún taki STRAX gildi - ekki að hefja nýja endurskoðunarvinnu
- Þjóðin hefur talað - það þarf bara að virða niðurstöðuna

ÚR STEFNU (Lýðræðismál):
"Forgangsröðun innleiðingar nýrrar stjórnarskrár" og "Niðurstöður þjóðaratkvæðagreiðslna verði alltaf virtar."

SAMANTEKT:
Flokkurinn er FYRIR nýja stjórnarskrá - þá sem þjóðin samþykkti 2012. Hann er á móti því að Alþingi "vinni markvisst að endurskoðun" vegna þess að það er óþarfi - þjóðin hefur þegar ákveðið. Það þarf að innleiða, ekki endurskoða.`,
    citation: {
      who: 'Kimi viðtalsgreinandi',
      when: '2026-01-03',
      context: 'Greining á afstöðu flokksins til stjórnarskrár, byggt á stefnu í lýðræðismálum og RÚV kosningaprófi',
      url: 'https://sosialistaflokkurinn.is/malefnaflokkar/lydraedismal/',
    },
  },
  {
    id: 'stefna-fikniefni',
    title: 'Afstaða Sósíalistaflokksins til fíkniefnastefnu',
    questionVariations: [
      'Hvað segir flokkurinn um fíkniefni?',
      'Vill flokkurinn afglæpavæða fíkniefni?',
      'Afstaða til fíkniefna',
      'Fíkniefnastefna sósíalista',
      'Hvað finnst flokknum um vímuefni?',
      'Er flokkurinn fyrir afglæpavæðingu?',
      'Hvað segir flokkurinn um neysluskammta?',
      'Afstaða til afglæpavæðingar',
      'Vill flokkurinn lögleiða kannabis?',
      'Hvað segir flokkurinn um fíkniefnavandann?',
    ],
    content: `SPURNING: Hvað segir flokkurinn um fíkniefni?

SVAR:
Sósíalistaflokkurinn er mjög sammála afglæpavæðingu neysluskammta fíkniefna.

ATHUGASEMD: Flokkurinn hefur ekki samþykkt sérstaka stefnu um fíkniefnamál. Afstaðan kemur fram í kosningaprófum.

KOSNINGAPRÓF 2024:

Kjóstu rétt:
- "Afglæpavæða neysluskammta fíkniefna": Mjög sammála (3/3)
- Þetta er merkt sem mikilvægt mál fyrir flokkinn

NÁLGUN FLOKKSINS:
Flokkurinn lítur á fíkniefnavandann sem heilbrigðisvanda, ekki glæpavanda:
- Neysla ætti ekki að vera refsiverð
- Áhersla á meðferð og skaðaminnkun
- Fanga ekki fólk fyrir að vera með neysluefni

HVAÐ ÞÝÐIR AFGLÆPAVÆÐING:
- Neysla og vörslur á neysluskammti verða ekki refsiverð
- Sala og dreifing er áfram ólögleg
- Þetta er EKKI sama og lögleggjing

MIKILVÆGT:
Þetta er heilbrigðismál, ekki refsimál. Flokkurinn vill hjálpa fólki, ekki refsa því.`,
    citation: {
      who: 'Kimi viðtalsgreinandi',
      when: '2026-01-03',
      context: 'Greining á afstöðu flokksins til fíkniefna, byggt á Kjóstu rétt kosningaprófi 2024',
      url: 'https://kjosturett.is/',
    },
  },
  {
    id: 'stefna-innflytjendur',
    title: 'Afstaða Sósíalistaflokksins til innflytjenda og flóttamanna',
    questionVariations: [
      'Hvað segir flokkurinn um innflytjendur?',
      'Hvað segir flokkurinn um flóttamenn?',
      'Afstaða til innflytjenda',
      'Innflytjendastefna sósíalista',
      'Hvað finnst flokknum um útlendinga?',
      'Er flokkurinn á móti innflytjendum?',
      'Hvað segir flokkurinn um hælisleitendur?',
      'Afstaða til flóttamanna',
      'Vill flokkurinn taka á móti fleiri flóttamönnum?',
      'Hvað segir flokkurinn um aðlögun innflytjenda?',
      'Útlendingastefna flokksins',
    ],
    content: `SPURNING: Hvað segir flokkurinn um innflytjendur og flóttamenn?

SVAR:
Sósíalistaflokkurinn er mjög á móti hertum reglum um innflytjendur og flóttamenn.

ATHUGASEMD: Flokkurinn hefur ekki samþykkt sérstaka stefnu um innflytjendamál. Afstaðan kemur fram í kosningaprófum og er í samræmi við almenna jafnréttisstefnu flokksins.

KOSNINGAPRÓF 2024:

RÚV:
- "Herða ætti lög eða reglur til að færri sæki hér um alþjóðlega vernd": Mjög ósammála (1/5)
- Útskýring: "Erum á móti innflytjendahöftum"

Kjóstu rétt:
- "Ísland tekur á móti of mörgum flóttamönnum": Mjög ósammála (0/3)
- "Útgjöld til aðlögunar innflytjenda": Mun meira (4/5)
- Útskýring: "Leggja áherslu á aðlögun frekar en samruna"

NÁLGUN FLOKKSINS:
- Á móti hertum reglum og höftum
- Vill auka útgjöld til aðlögunar
- Leggur áherslu á aðlögun fremur en "samruna" (þ.e. virða menningu innflytjenda)
- Styður réttindi flóttamanna og hælisleitenda

TENGSL VIÐ JAFNRÉTTISSTEFNU:
Í jafnréttisstefnu flokksins segir: "Allir skulu vera jafnir fyrir lögum samfélagsins óháð efnahag, félagslegri stöðu, uppruna eða líkamlegu atgervi."

SAMANTEKT:
Flokkurinn er á móti innflytjendahöftum og vill auka stuðning við aðlögun. Þetta er í samræmi við almenna jafnréttisstefnu flokksins.`,
    citation: {
      who: 'Kimi viðtalsgreinandi',
      when: '2026-01-03',
      context: 'Greining á afstöðu flokksins til innflytjenda, byggt á RÚV og Kjóstu rétt kosningaprófum 2024',
      url: 'https://kjosturett.is/',
    },
  },
  {
    id: 'stefna-virkjanir',
    title: 'Afstaða Sósíalistaflokksins til virkjana og hálendisverndar',
    questionVariations: [
      'Hvað segir flokkurinn um virkjanir?',
      'Vill flokkurinn virkja meira?',
      'Afstaða til virkjana',
      'Hvað finnst flokknum um vatnsaflsvirkjanir?',
      'Er flokkurinn á móti virkjunum?',
      'Hvað segir flokkurinn um hálendið?',
      'Vill flokkurinn hálendisþjóðgarð?',
      'Afstaða til hálendisverndar',
      'Hvað segir flokkurinn um orkumál?',
      'Vill flokkurinn selja orkufyrirtæki?',
      'Afstaða til einkavæðingar orkuframleiðslu',
      'Hvað segir flokkurinn um náttúruvernd?',
    ],
    content: `SPURNING: Hvað segir flokkurinn um virkjanir og hálendisvernd?

SVAR:
Sósíalistaflokkurinn er á móti aukinni virkjun og vill vernda hálendið sem þjóðgarð.

ÚR STEFNU (Auðlindamál):
- "Orkuframleiðsla ekki aukin óþarflaust umfram þörf almennings"
- "Einkavæðing orkuframleiðslu lögð af; orkuvelar færðar í þjóðareign"

ÚR STEFNU (Byggðamál):
- "Óspillt víðerni, hálendið skilgreind sem þjóðgarðar, vernduð fyrir ágangi"

KOSNINGAPRÓF 2024:

| Kosningapróf | Fullyrðing | Afstaða |
|--------------|-----------|---------|
| RÚV | Nauðsynlegt að virkja meira á Íslandi | Mjög ósammála |
| RÚV | Hagsmunir náttúrunnar vega þyngra en fjárhagslegir | Mjög sammála |
| Kjóstu rétt | Ríkið ætti að selja hlut sinn í orkufyrirtækjum | Mjög ósammála ⭐ |
| Kjóstu rétt | Stofna ætti hálendisþjóðgarð | Mjög sammála |
| Kjóstu rétt | Einkavæða ætti orkuframleiðslu | Mjög ósammála ⭐ |

ATHUGASEMD:
Flokkurinn er ekki alfarið á móti orkuframleiðslu - heldur á móti:
1. Óþarflegri aukningu umfram þörf almennings
2. Einkavæðingu orkuframleiðslu
3. Sölu á hlutum ríkisins í orkufyrirtækjum

Flokkurinn vill að orkuframleiðsla sé í þjóðareign og þjóni almenningi, ekki fjárfestum.`,
    citation: {
      who: 'Kimi viðtalsgreinandi',
      when: '2026-01-03',
      context: 'Greining á afstöðu flokksins til virkjana og orkumála, byggt á stefnu og kosningaprófum',
      url: 'https://sosialistaflokkurinn.is/malefnaflokkar/audlindamal/',
    },
  },
  {
    id: 'stefna-rikisbanki',
    title: 'Afstaða Sósíalistaflokksins til ríkisbanka og bankakerfis',
    questionVariations: [
      'Hvað segir flokkurinn um ríkisbanka?',
      'Vill flokkurinn ríkisbanka?',
      'Afstaða til ríkisbanka',
      'Hvað finnst flokknum um banka?',
      'Vill flokkurinn samfélagsbanka?',
      'Hvað segir flokkurinn um bankakerfið?',
      'Afstaða til bankamála',
      'Á ríkið að eiga banka?',
      'Hvað segir flokkurinn um einkabanka?',
    ],
    content: `SPURNING: Hvað segir flokkurinn um ríkisbanka?

SVAR:
Sósíalistaflokkurinn vill að ríkið eigi og reki banka - samfélagsbanka í þjónustu almennings.

ÚR STEFNU (Ríkisfjármál):
- "13. Stofna samfélagsbanka"
- "15. Binda endi á fullkomna bankaleynd"

KOSNINGAPRÓF 2024:

| Kosningapróf | Fullyrðing | Afstaða |
|--------------|-----------|---------|
| Kjóstu rétt | Ríkið ætti að eiga og reka að minnsta kosti einn banka á Íslandi | Mjög sammála |

ATHUGASEMD:
Orðið "ríkisbanki" getur verið villandi - flokkurinn notar frekar hugtakið "samfélagsbanki". Munurinn:

- **Ríkisbanki** (gömlu skilningi): Seðlabanki eða banki í ríkiseigu sem keppt við einkabanka
- **Samfélagsbanki** (stefna flokksins): Banki sem þjónar almannahagsmunum, ekki hagnaðarsjónarmiðum

HVERS VEGNA SAMFÉLAGSBANKI:
1. Tryggir aðgang allra að grunnbankaþjónustu
2. Lægri vextir og gjöld fyrir almenning
3. Fjármögnun samfélagslegra verkefna (húsnæði, innviðir)
4. Kemur í veg fyrir að hagnaður rynni til erlendra eigenda

Flokkurinn er ekki að tala um að þjóðnýta alla banka - heldur að ríkið eigi að minnsta kosti einn banka sem þjónar almenningi.`,
    citation: {
      who: 'Kimi viðtalsgreinandi',
      when: '2026-01-03',
      context: 'Greining á afstöðu flokksins til ríkisbanka, byggt á stefnu í ríkisfjármálum og Kjóstu rétt 2024',
      url: 'https://sosialistaflokkurinn.is/malefnaflokkar/rikisfjormal/',
    },
  },
  {
    id: 'stefna-vegatoll',
    title: 'Afstaða Sósíalistaflokksins til vegatolla',
    questionVariations: [
      'Hvað segir flokkurinn um vegatolla?',
      'Vill flokkurinn vegatolla?',
      'Afstaða til vegatolla',
      'Hvað finnst flokknum um veggjöld?',
      'Er flokkurinn á móti vegatollum?',
      'Hvað segir flokkurinn um samgöngusáttmálann?',
      'Afstaða til samgöngumála',
      'Hvernig á að fjármagna vegakerfið?',
      'Hvað segir flokkurinn um samgöngugjöld?',
      'Styður flokkurinn vegatolla?',
    ],
    content: `SPURNING: Hvað segir flokkurinn um vegatolla?

SVAR:
Sósíalistaflokkurinn er mjög á móti vegatollum sem leið til að fjármagna samgöngubætur.

ÚR STEFNU (Byggðamál):
- "7. Bætt vegakerfi án veggjalda og sterk almenningssamgöngur á samfélagslegum forsendum."

ÚR KOSNINGAÁÆTLUN (Gjaldfrjáls grunnþjónusta):
- "Ókeypis strætisvagnar og almenningssamgöngur"
- Sérstök áhersla á landsbyggðina

KOSNINGAPRÓF 2024:

| Kosningapróf | Fullyrðing | Afstaða |
|--------------|-----------|---------|
| Kjóstu rétt | Fjármagna ætti uppbyggingu vegakerfisins í nágrenni höfuðborgarsvæðisins með vegatollum | Mjög ósammála ⭐ |
| RÚV | Ríkið á að halda áfram að styðja Samgöngusáttmála höfuðborgarsvæðisins | Hlutlaus |

ATHUGASEMD UM SAMGÖNGUSÁTTMÁLANN:
Flokkurinn svaraði "Hlutlaus" við Samgöngusáttmálanum - EKKI vegna þess að hann sé á móti almenningssamgöngum, heldur:

- Flokkurinn STYÐUR bættar almenningssamgöngur og borgarlínu
- Flokkurinn er Á MÓTI vegatollum sem fjármögnunarleið
- Samgöngusáttmálinn gerir ráð fyrir vegatollum - þess vegna "Hlutlaus"

ÖNNUR FJÁRMÖGNUN:
Flokkurinn vill fjármagna innviði með:
1. Auðlegðarskatti (á þá efnuðu)
2. Hærri fjármagnstekjuskatti
3. Auðlindagjöldum
4. Ekki með gjöldum á venjulegt launafólk (vegatollum)

SAMANTEKT:
Flokkurinn vill betri vegi og almenningssamgöngur - en vill EKKI að launafólk borgi fyrir þær með vegatollum. Auðmenn eiga að borga, ekki bifreiðaeigendur.`,
    citation: {
      who: 'Kimi viðtalsgreinandi',
      when: '2026-01-03',
      context: 'Greining á afstöðu flokksins til vegatolla, byggt á stefnu í byggðamálum og kosningaprófum 2024',
      url: 'https://sosialistaflokkurinn.is/malefnaflokkar/byggdamal/',
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
