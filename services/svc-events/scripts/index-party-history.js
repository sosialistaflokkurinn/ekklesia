#!/usr/bin/env node
/**
 * Index Party History from discourse-archive
 *
 * Indexes historical events about Sósíalistaflokkur Íslands into the RAG database.
 */

// Set up environment
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'ekklesia-prod-10-2025';
process.env.DATABASE_HOST = process.env.DATABASE_HOST || 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT || '5433';
process.env.DATABASE_NAME = process.env.DATABASE_NAME || 'socialism';
process.env.DATABASE_USER = process.env.DATABASE_USER || 'socialism';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD || 'Socialism2025#Db';

const fs = require('fs');
const path = require('path');
const embeddingService = require('../src/services/service-embedding');
const vectorSearch = require('../src/services/service-vector-search');

const DISCOURSE_ARCHIVE = '/home/gudro/Development/discourse-archive';

// Party history document - compiled from timeline.json and web sources
const PARTY_HISTORY = {
  id: 'saga-flokksins',
  title: 'Saga Sósíalistaflokksins',
  sourceType: 'discourse-archive',
  sourceUrl: 'https://sosialistaflokkurinn.is/',
  content: `Saga Sósíalistaflokks Íslands

STOFNUN FLOKKSINS

Sósíalistaflokkur Íslands var formlega stofnaður 1. maí 2017, á baráttudegi verkalýðsins. Stofnfundurinn var haldinn í Tjarnarbíó við Tjarnargötu klukkan 16:00.

LYKILATBURÐIR:
- 3. apríl 2017: STOFNANDI_A tilkynnti stofnun flokksins í útvarpsþættinum Harmageddon á X-inu
- 25. apríl 2017: Tilkynnt að stofnfundur yrði haldinn 1. maí
- 1. maí 2017: Stofnfundur haldinn í Tjarnarbíó
- Um 1.250-1.400 stofnfélagar skráðu sig fyrir stofnfund

STOFNFUNDURINN:
Á stofnfundi flokksins var kosin bráðabirgðastjórn til að undirbúa sósíalistaþing haustið 2017. Bráðabirgðastjórnin skyldi starfa fram að þinginu en eigi síðar en til 1. nóvember 2017.

BRÁÐABIRGÐASTJÓRN:
Á fyrsta fundi bráðabirgðastjórnar 12. júní 2017 skipti stjórnin með sér verkum:
- STOFNANDI_A (formaður)
- STOFNANDI_B (varaformaður)
- Viðar Þorsteinsson (ritari)
- Benjamín Julian (gjaldkeri)
- PERSON_15 (meðstjórnandi)
- Laufey Ólafsdóttir (meðstjórnandi)
- Sigurður H. Einarsson (meðstjórnandi)
- PERSON_01 (meðstjórnandi)

María Gunnlaugsdóttir var upphaflega kosin í bráðabirgðastjórn en gekk úr stjórn í maímánuði 2017 sökum veikinda.

STOFNENDUR:
STOFNANDI_A var einn helsti drifkrafturinn á bak við stofnun flokksins. Hann er fæddur 11. janúar 1961 og hafði langa reynslu í fjölmiðlum, m.a. sem ritstjóri Pressunnar (1989), Eintaks (1993-94), og Fréttatímans (2015-2017).

STOFNANDI_B varð borgarfulltrúi flokksins. Hún bauð sig fram í Alþingiskosningunum í nóvember 2024 í Reykjavík Suður en náði ekki kjöri. STOFNANDI_A var nær því að ná kjöri í Reykjavík Norður.

SKIPULAG FLOKKSINS:
Flokkurinn hefur ekki einn formann. Í staðinn eru formenn í hverri stjórn. Framkvæmdastjórn er valdamesta stjórnin samkvæmt skipulagi og lögum flokksins - hún sér um öll mál sem ekki er getið í skipulagi, hefur eftirlit og er dómari í mörgum málum. Formaður kosningastjórnar hafði um tíma stöðu pólitísks leiðtoga sem fékk umboð beint frá félagsfundi, ekki viðkomandi stjórn.

KOSNINGAR:
- Alþingiskosningar 2017: Flokkurinn ákvað að bjóða ekki fram
- Sveitarstjórnarkosningar 2018: Flokkurinn bauð fram í Reykjavík (6,4% atkvæða) og Kópavogi (3,2% atkvæða). STOFNANDI_B var sú eina sem náði kjöri (í Reykjavík) og varð þar með fyrsti kjörni fulltrúi flokksins
- Alþingiskosningar 2021: Flokkurinn náði 4,1% fylgi en komst ekki yfir 5% þröskuldinn og fékk því ekkert þingsæti
- Sveitarstjórnarkosningar 2022: Flokkurinn fékk 2 borgarfulltrúa í Reykjavík (bætti við einum frá 2018)
- Alþingiskosningar 2024: Flokkurinn fékk 4,0% fylgi en náði ekki 5% þröskuldinum og fékk því ekkert þingsæti

STEFNUMÁL:
Samkvæmt stofnanda flokksins á flokkurinn að vera málsvari launafólks og allra þeirra sem búa við skort, ósýnileika og valdaleysi. Markmið hans er samfélag frelsis, jöfnuðar, mannhelgi og samkenndar.

Þegar flokkurinn talar um að "setja völdin í hendur fólksins" er átt við fjöldann á móti fáum sem hafa mikil völd - þ.e. lýðræði almennings gegn valdaeinokun auðmanna og yfirstéttar.

HEIMILDIR:
- Wikipedia: Sósíalistaflokkur Íslands (21. öld)
- sosialistaflokkurinn.is: "Sósíalistaflokkurinn stofnaður 1. maí" (25. apríl 2017)
- sosialistaflokkurinn.is: "Stofnfundur Sósíalistaflokksins markar fyrstu skrefin" (1. maí 2017)
- RÚV: "STOFNANDI_A stofnar Sósíalistaflokk Íslands" (2017)
- Morgunblaðið/timarit.is: "Draugur fortíðar eða nýtt afl til framtíðar?" (12. apríl 2017)`,
  citation: {
    who: 'Sósíalistaflokkur Íslands',
    when: '2017-2025',
    context: 'Saga flokksins frá stofnun til dagsins í dag',
    url: 'https://sosialistaflokkurinn.is/',
  },
};

// Key events from timeline
const KEY_EVENTS = [
  {
    id: 'kosningasaga',
    title: 'Kosningasaga Sósíalistaflokksins 2017-2024',
    content: `Kosningasaga Sósíalistaflokks Íslands

ALÞINGISKOSNINGAR 2017:
Flokkurinn ákvað að bjóða EKKI fram í Alþingiskosningunum haustið 2017. Þetta var meðvituð ákvörðun þar sem flokkurinn var of nýstofnaður.

SVEITARSTJÓRNARKOSNINGAR 2018:
Flokkurinn bauð fram í Reykjavík og Kópavogi:
- Reykjavík: 6,4% atkvæða
- Kópavogur: 3,2% atkvæða
STOFNANDI_B var sú eina sem náði kjöri (í Reykjavík) og varð þar með FYRSTI KJÖRNI FULLTRÚI flokksins.

ALÞINGISKOSNINGAR 2021:
Flokkurinn bauð fram og náði 4,1% fylgi. Þar sem flokkurinn komst EKKI yfir 5% þröskuldinn fékk hann ekkert þingsæti.

SVEITARSTJÓRNARKOSNINGAR 2022:
Flokkurinn fékk 2 borgarfulltrúa í Reykjavík (bætti við einum frá 2018).

ALÞINGISKOSNINGAR 2024:
Flokkurinn bauð fram 30. nóvember 2024 og fékk 4,0% fylgi. Þar sem flokkurinn komst EKKI yfir 5% þröskuldinn fékk hann ekkert þingsæti. STOFNANDI_B bauð sig fram í Reykjavík Suður en náði ekki kjöri. STOFNANDI_A var nær því að ná kjöri í Reykjavík Norður.`,
    citation: {
      who: 'Sósíalistaflokkur Íslands',
      when: '2017-2024',
      context: 'Kosningasaga flokksins',
      url: 'https://is.wikipedia.org/wiki/Sósíalistaflokkur_Íslands',
    },
  },
  {
    id: 'skipulag-flokksins',
    title: 'Skipulag Sósíalistaflokksins',
    content: `Skipulag Sósíalistaflokks Íslands

ENGINN EINN FORMAÐUR:
Flokkurinn hefur ekki einn formann. Í staðinn eru formenn í hverri stjórn - formaður framkvæmdastjórnar, formaður kosningastjórnar, o.s.frv.

FRAMKVÆMDASTJÓRN - VALDAMESTA STJÓRNIN:
Framkvæmdastjórn er valdamesta stjórn flokksins samkvæmt skipulagi og lögum. Hún:
- Sér um öll mál sem ekki er getið í skipulagi
- Hefur eftirlit með öðrum stjórnum
- Er dómari í mörgum málum

FORMAÐUR KOSNINGASTJÓRNAR:
Formaður kosningastjórnar hafði um tíma stöðu pólitísks leiðtoga sem fékk umboð beint frá félagsfundi, ekki viðkomandi stjórn. Þetta gerði hann/hana að helsta opinbera andliti flokksins.

VÖLDIN Í HENDUR FÓLKSINS:
Þegar flokkurinn talar um að "setja völdin í hendur fólksins" er átt við fjöldann á móti fáum sem hafa mikil völd - þ.e. lýðræði almennings gegn valdaeinokun auðmanna og yfirstéttar.`,
    citation: {
      who: 'Sósíalistaflokkur Íslands',
      when: '2017-2025',
      context: 'Skipulag og lög flokksins',
      url: 'https://sosialistaflokkurinn.is/',
    },
  },
  {
    id: 'frambjodendur-2018',
    title: 'Frambjóðendur Sósíalistaflokksins 2018',
    content: `Frambjóðendur Sósíalistaflokks Íslands í sveitarstjórnarkosningum 2018

REYKJAVÍK - 46 frambjóðendur (6,4% atkvæða):

1. SANNA MAGDALENA MÖRTUDÓTTIR (KJÖRIN BORGARFULLTRÚI)
Mannfræðingur með BA og MA gráðu. Ólst upp hjá einstæðri móður í byssufátækt - fjölskyldan átti ekki grunnþarfir eins og mat eða þvottavél. Flutti á félagslega íbúð í Breiðholti 10 ára. Bauð sig fram til að breyta "kerfisbundnu óréttlæti" og vinna að mannúðlegra kerfi.

2. DANÍEL ÖRN ARNARSSON
Bílstjóri og stjórnarmaður í Eflingu. Ólst upp í Breiðholti hjá einni móður, bjó á hóteli og leigubústöðum. Giftur með tvö börn, báðir hjón vinna. Kjörinn í stjórn Eflingar mars 2018.

3. ANNA MARIA WOJTYNSKA (Magdalena Kwiatkowska)
Rannsakandi frá Varsjá sem kom til Íslands 1996. Rannsakar pólska samfélagið á Íslandi. Hefur unnið sem ræstingakona á Þjóðminjasafni. Baráttumaður fyrir réttindum starfsmanna og gegn tímabundnum ráðningum.

4. HLYNUR MÁR VILHJÁLMSSON
Stofnandi Fósturheimilisbarna. Ólst upp í ríkisumsjá frá 8 ára aldri, fór á stofnun 13 ára. Þrátt fyrir erfiðleika varð fremsti námsmaður og körfuboltamaður. Glímir við alvarlegan kvíða. Stofnaði hagsmunasamtök fyrir fósturheimilisbörn.

5. ÁSTA DÍS GUÐJÓNSDÓTTIR
52 ára, úr Vesturlandi. Hefur unnið í byggingariðnaði, fiskveiðum, hárgreiðslu og skrifstofustörfum. Þjálfaður sjúkraliði í Svíþjóð. Formaður stuðningssamtaka í 6 ár, meðstjórnandi Pepp Íslands sem barðist fyrir fólki í fátækt.

6. SÓLVEIG ANNA JÓNSDÓTTIR - formaður Eflingar stéttarfélags (einnig á B-lista Eflingar)
7. REINHOLD RICHTER
9. LAUFEY LÍNDAL ÓLAFSDÓTTIR
14. HÓLMSTEINN A. BREKKAN - blikkari og framkvæmdastjóri Samtaka leigjenda
28. LUCIANO DUTRA
37. SIGRÚN UNNSTEINSDÓTTIR
42. KOLBRÚN - (líklegast Kolbrún Valvesdóttir sem einnig var á B-lista Eflingar)

KÓPAVOGUR - 22 frambjóðendur (3,2% atkvæða, enginn kjörinn):

1. ARNÞÓR SIGURÐSSON (oddviti) - kjötiðnaðarmaður, forritari og stjórnarmaður í VR
2. MARÍA PÉTURSDÓTTIR - myndlistarmaður, kennari og öryrki
3. RÚNAR EINARSSON - upplifði fjárhagserfiðleika í hruninu
4. HILDIGUNNUR ÞÓRSDÓTTIR SAARI
5. ALEXEY MATVEEV - baráttumaður gegn launamismunun innflytjenda
16. HELGA GUÐMUNDSDÓTTIR
17. KOLBRÚN VALVESDÓTTIR - einnig á B-lista Eflingar 2018 og 2022
22. ÖRN G. ELLINGSEN`,
    citation: {
      who: 'Sósíalistaflokkur Íslands',
      when: '2018-05-26',
      context: 'Sveitarstjórnarkosningar 2018',
      url: 'https://sosialistaflokkurinn.is/en/kosningar/reykjavik-2018-en/',
    },
  },
  {
    id: 'stofnun-2017',
    title: 'Stofnun Sósíalistaflokksins 2017',
    content: `Stofnun Sósíalistaflokks Íslands - 1. maí 2017

Sósíalistaflokkur Íslands var formlega stofnaður á baráttudegi verkalýðsins, 1. maí 2017, í Tjarnarbíó við Tjarnargötu í Reykjavík.

AÐDRAGANDINN:
- 3. apríl 2017: STOFNANDI_A tilkynnti stofnun flokksins í Harmageddon á X-inu
- Um 1.250-1.400 skráðu sig sem stofnfélagar fyrir stofnfundinn

STOFNFUNDURINN Í TJARNARBÍÓ:
- Haldinn 1. maí 2017 klukkan 16:00 í Tjarnarbíó
- Á annað hundrað manns mættu á fundinn
- STOFNANDI_B gekk út í rigninguna með grunnstefnuna
- Kosin var bráðabirgðastjórn til að undirbúa sósíalistaþing haustið 2017

ALÞINGISKOSNINGAR 2017:
Flokkurinn ákvað að bjóða EKKI fram í Alþingiskosningunum haustið 2017. Þetta var meðvituð ákvörðun - flokkurinn var of nýstofnaður til að bjóða fram.

FJÖLMIÐLAUMFJÖLLUN:
Morgunblaðið skrifaði 12. apríl 2017 greinina "Draugur fortíðar eða nýtt afl til framtíðar?" um stofnun flokksins.`,
    citation: {
      who: 'Sósíalistaflokkur Íslands',
      when: '2017-05-01',
      context: 'Stofnfundur flokksins',
      url: 'https://timarit.is/page/6895908',
    },
  },
  {
    id: 'frambjodendur-2021',
    title: 'Frambjóðendur Sósíalistaflokksins Alþingiskosningar 2021',
    content: `Frambjóðendur Sósíalistaflokks Íslands í Alþingiskosningum 2021

Flokkurinn bauð fram í 5 af 6 kjördæmum og fékk samtals 4,1% fylgi (komst ekki yfir 5% þröskuldinn).

REYKJAVÍK NORÐUR (22 frambjóðendur):
1. STOFNANDI_A (oddviti) - atvinnulaus blaðamaður, formaður framkvæmdastjórnar
2. PERSON_35 - námslausn
3. Atli Gíslason - tölvunarfræðingur
4. PERSON_01 - formaður Eflingar
5. PERSON_42 - rithöfundur
11. STOFNANDI_B - borgarfulltrúi

REYKJAVÍK SUÐUR (22 frambjóðendur):
1. Katrín Baldursdóttir (oddviti) - hagfræðingur, blaðamaður og kennari
2. PERSON_51 - kennari
3. PERSON_39 Kemp - lagadeild
4. Ólafur Jónsson - skipstjóri á lífeyri
5. PERSON_14 - kennari

SUÐVESTURKJÖRDÆMI (26 frambjóðendur):
1. María Pétursdóttir (oddviti) - listamaður, fötlunarbaráttukona
2. Þór Saari - hagfræðingur, fyrrverandi þingmaður (Borgarahreyfingin 2009-2013)
3. Agnieszka Sokolowska - bókasafnsfræðingur
4. Luciano Dutra - þýðandi
5. PERSON_21 - tónlistarmaður

SUÐURKJÖRDÆMI (20 frambjóðendur):
1. Guðmundur Auðunsson (oddviti) - pólitískur hagfræðingur
2. PERSON_17 - framhaldsskólakennari
3. PERSON_16 - þjálfari, varaformaður ASÍ-UNG
4. PERSON_11 - verkefnastjóri
5. PERSON_57 - hárgreiðslumeistari og kennari

NORÐVESTURKJÖRDÆMI (16 frambjóðendur):
1. Helga Thorberg (oddviti) - leikkona og garðyrkjufræðingur
2. PERSON_12 - mannréttindalögfræðingur
3. PERSON_47 - vélaverkfræðingur og sveitarstjórnarmaður
4. Aldís Schram - lögfræðingur og kennari
5. Bergvin Eyþórsson - þjónustufulltrúi

ATH: Flokkurinn bauð ekki fram í Norðausturkjördæmi 2021.`,
    citation: {
      who: 'Sósíalistaflokkur Íslands',
      when: '2021-09-25',
      context: 'Alþingiskosningar 2021',
      url: 'https://sosialistaflokkurinn.is/',
    },
  },
  {
    id: 'frambjodendur-2022',
    title: 'Frambjóðendur Sósíalistaflokksins Sveitarstjórnarkosningar 2022',
    content: `Frambjóðendur Sósíalistaflokks Íslands í sveitarstjórnarkosningum í Reykjavík 2022

J-listi Sósíalistaflokks Íslands með 46 frambjóðendur.

KJÖRNIR BORGARFULLTRÚAR:
1. STOFNANDI_B (KJÖRIN) - borgarfulltrúi síðan 2018
2. PERSON_56 (KJÖRINN) - stuðningsfulltrúi og nemi

VARAFULLTRÚAR:
3. PERSON_07 - starfsmaður leikskóla í Reykjavík
4. Ásta Þ. Skjalddal Guðjónsdóttir - samhæfingarstjóri Pepp Ísland
5. PERSON_02 - frístundaleiðbeinandi
6. PERSON_23 - öryrki
7. PERSON_53 - línukokkur
8. PERSON_55 - sérkennari
14. IAN MCDONALD - félagsmaður í Eflingu og stuðningsmaður B-lista

ÚRSLIT:
- Sósíalistaflokkurinn fékk um 6% atkvæða í Reykjavík
- 2 borgarfulltrúar kjörnir (STOFNANDI_B og Trausti Breiðfjörð)
- Andrea varaborgarfulltrúi

ATH: Trausti Breiðfjörð sagði af sér sem borgarfulltrúi 2024.`,
    citation: {
      who: 'Sósíalistaflokkur Íslands',
      when: '2022-05-14',
      context: 'Sveitarstjórnarkosningar 2022 í Reykjavík',
      url: 'https://sosialistaflokkurinn.is/2022/04/08/frambodslisti-sosialistaflokks-islands-i-borgarstjornarkosningum/',
    },
  },
  {
    id: 'frambjodendur-2024',
    title: 'Frambjóðendur Sósíalistaflokksins Alþingiskosningar 2024',
    content: `Frambjóðendur Sósíalistaflokks Íslands í Alþingiskosningum 2024

Flokkurinn bauð fram í öllum 6 kjördæmum 30. nóvember 2024 og fékk samtals 4,0% fylgi.

REYKJAVÍK SUÐUR (22 frambjóðendur):
1. STOFNANDI_B (oddviti) - borgarfulltrúi
2. PERSON_32 - fræðslu- og félagsmálafulltrúi Eflingar
3. PERSON_01 - formaður Eflingar
4. PERSON_23 - formaður íþróttafélags
5. PERSON_02 - tómstundakokkur
6. PERSON_38 - þýðandi og útgefandi
7. PERSON_42 - rithöfundur
8. PERSON_54 - kennari
9. Bára Halldórsdóttir - listamaður
10. Sigrún E Unnsteinsdóttir - aðgerðarsinni

REYKJAVÍK NORÐUR (22 frambjóðendur):
1. STOFNANDI_A (oddviti) - blaðamaður og stofnandi flokksins
2. María Pétursdóttir - sjónlistamaður
3. Guðmundur Auðunsson - sjálfstætt starfandi
4. PERSON_35 - útvarpsumsjónarmaður
5. PERSON_13 - skrifstofumaður
6. PERSON_29 - forritari
7. PERSON_31 Ocon - aðgerðarsinni
8. Anita da Silva Bjarnadóttir - öryrki
9. PERSON_14 - framhaldsskólakennari
10. PERSON_22 - leikstjóri

SUÐVESTURKJÖRDÆMI (27 frambjóðendur):
1. PERSON_19 (oddviti) - prestur
2. Margrét Pétursdóttir - verkamaður
3. PERSON_45 - bókasafns- og upplýsingafræðingur
4. PERSON_34 Ramos - teymisleiðtogi
5. PERSON_40 Svanlaugar - forritari
6. PERSON_21 - kennari
7. Sylviane Lecoultre - nemi
8. Hörður Svavarsson - leikskólastjóri
9. Edda Jóhannsdóttir - blaðamaður
10. PERSON_20 - rappari

SUÐURKJÖRDÆMI (18 frambjóðendur):
1. PERSON_57 (oddviti) - hárgreiðslukennari
2. Hallfríður Þórarinsdóttir - mannfræðingur
3. PERSON_10 - bifvélavirki
4. Kristín Tómasdóttir
5. Ingvar Kristjánsson
6. Herður Jóhannesdóttir
7. Árni Stefánsson
8. PERSON_28
9. PERSON_48
10. PERSON_33

NORÐAUSTURKJÖRDÆMI (20 frambjóðendur):
1. Þorsteinn Bergsson (oddviti) - þýðandi og rithöfundur
2. Ari Orrason - forstöðumaður félagsmiðstöðvar
3. Saga Unnsteinsdóttir - listaskapari
4. PERSON_04 - hestabóndi
5. Kristinn Hannesson - verkamaður
6. PERSON_36 - öryrki
7. PERSON_49 - kennari/fornleifafræðingur
8. PERSON_37 - öryrki
9. PERSON_27 - eftirlaunaþegi
10. Ása Ernudóttir - námsmaður

NORÐVESTURKJÖRDÆMI (14 frambjóðendur):
1. PERSON_25 (oddviti) - formaður Samtaka leigjenda á Íslandi
2. PERSON_30 - fiskverkakona
3. Ævar Kjartansson - útvarpsmaður
4. Ragnheiður Guðmundsdóttir - stjórnmálafræðingur og ljóðskáld
5. PERSON_43 - skipstjóri
6. PERSON_52 - safnakona
7. PERSON_46 - strandveiðimaður
8. PERSON_05 Ómarsdóttir - aðgerðarsinni
9. Brynjólfur Sigurbjörnsson - bifvélavirki
10. PERSON_06 - bóndi

ÚRSLIT 2024:
- Samtals 4,0% fylgi (náði ekki 5% þröskuldinum)
- Enginn kjörinn þar sem flokkurinn komst ekki yfir þröskuldinn`,
    citation: {
      who: 'Sósíalistaflokkur Íslands',
      when: '2024-11-30',
      context: 'Alþingiskosningar 2024',
      url: 'https://sosialistaflokkurinn.is/2024/10/30/allir-frambodslistar-sosialistaflokks-islands-til-althingiskosninga-2024/',
    },
  },
  {
    id: 'b-listi-eflingar',
    title: 'B-listi Eflingar - Tengsl við Sósíalistaflokkinn',
    content: `B-listi Eflingar (Baráttulistinn) - Tengsl við Sósíalistaflokkinn

B-listi Eflingar var stofnaður 2018 undir forystu PERSON_01. Margir á listanum voru einnig virkir í Sósíalistaflokknum.

KOSNINGAR 2018 - YFIRBURÐASIGUR:
B-listi hlaut 2.099 atkvæði (80%) gegn 519 atkvæðum A-lista (20%).
Þetta var í fyrsta sinn sem kosið var um formann Eflingar.

B-LISTI 2018:
1. PERSON_01 (formaður) - síðar á lista Sósíalista 2021 og 2024
2. Magdalena Kwiatkowska - Café Paris
3. Aðalgeir Björnsson - tækjastjóri hjá Eimskip
4. PERSON_09 - Náttúru þrif
5. PERSON_18 - einnig á lista Sósíalista í Reykjavík 2018
6. PERSON_03 - bílstjóri hjá Snæland Grímsson
7. Jamie McQuilkin - Resource International
8. Kolbrún Valvesdóttir - starfsmaður Reykjavíkurborgar

AFSÖGN SÓLVEIGAR ÖNNU 2021:
31. október 2021 sagði PERSON_01 af sér sem formaður Eflingar vegna deilna við starfsfólk.
Starfsfólk sakaði hana um "aftökulista" og kjarasamningsbrot.
Starfsmenn sendu síðar yfirlýsingu að þeir hefðu ekki viljað að hún segði af sér.

KOSNINGAR 2022 - SÓLVEIG NÁR AFTUR VÖLDUM:
Þrír listar buðu fram. B-listi hlaut 2.047 atkvæði (52,5%), A-listi 1.434 og C-listi 331.
PERSON_01 endurkjörin formaður.

B-LISTI 2022 (Baráttulistinn):
- PERSON_01 (formaður)
- Ísak Jónsson (gjaldkeri)
- PERSON_24
- Innocentia F. Friðgeirsson
- Kolbrún Valvesdóttir
- PERSON_41
- Olga Leonsdóttir
- PERSON_44

SAMANBURÐUR: HVERJIR VORU BÆÐI Á LISTA EFLINGAR OG Í FRAMBOÐI FYRIR SÓSÍALISTAFLOKKINN?

== Á B-LISTA EFLINGAR OG FRAMBOÐSLISTA SÓSÍALISTAFLOKKSINS ==

1. SÓLVEIG ANNA JÓNSDÓTTIR (formaður Eflingar):
   - B-listi Eflingar 2018: 1. sæti (formaður)
   - B-listi Eflingar 2022: 1. sæti (endurkjörin formaður)
   - Sósíalistaflokkur 2018 Reykjavík: 6. sæti
   - Sósíalistaflokkur 2021 Reykjavík Norður: 4. sæti
   - Sósíalistaflokkur 2024 Reykjavík Suður: 3. sæti

2. DANÍEL ÖRN ARNARSSON:
   - B-listi Eflingar 2018: 5. sæti (stjórnarmaður)
   - Sósíalistaflokkur 2018 Reykjavík: 2. sæti

3. MAGDALENA KWIATKOWSKA (PERSON_08):
   - B-listi Eflingar 2018: 2. sæti (stjórnarmaður)
   - Sósíalistaflokkur 2018 Reykjavík: 3. sæti

4. KOLBRÚN VALVESDÓTTIR:
   - B-listi Eflingar 2018: 8. sæti (stjórnarmaður)
   - B-listi Eflingar 2022: á listanum
   - Sósíalistaflokkur 2018 Kópavogur: 17. sæti

== EFLING-TENGSL EN EKKI Á B-LISTA ==

5. KARL HÉÐINN KRISTJÁNSSON (fræðslu- og félagsmálafulltrúi Eflingar):
   - Starfsmaður Eflingar
   - Sósíalistaflokkur 2024 Reykjavík Suður: 2. sæti

6. KRISTJÁN EINAR GUNNARSSON (stjórnarmaður í Eflingu):
   - Sósíalistaflokkur 2024 Reykjavík Suður: 10. sæti

7. IAN MCDONALD (félagsmaður í Eflingu, stuðningsmaður B-lista):
   - Skrifaði grein með B-listaflokki 2022
   - Sósíalistaflokkur 2022 Reykjavík: 14. sæti

HEIMILDIR:
- mbl.is 22.10.2024: "PERSON_01 gefur kost á sér á lista Sósíalistaflokksins"
- sosialistaflokkurinn.is: "Efstu þrjú sætin í Reykjavík Suður" (27.10.2024)
- ruv.is: "Listar Sósíalistaflokksins hafa tekið á sig mynd" (30.10.2024)`,
    citation: {
      who: 'Efling stéttarfélag',
      when: '2018-2022',
      context: 'Stjórnarkosningar Eflingar',
      url: 'https://efling.is/kynning-a-frambodum-til-stjornarkosninga-2022/',
    },
  },
  {
    id: 'gunnar-smari-ferill',
    title: 'STOFNANDI_A - Ferill',
    content: `STOFNANDI_A - Einn af stofnendum Sósíalistaflokksins

STOFNANDI_A (f. 1961) er íslenskur fjölmiðlamaður og frumkvöðull sem var einn af helstu drifkröftum á bak við stofnun Sósíalistaflokks Íslands.

FERILL Í FJÖLMIÐLUM:
- 1982: Hóf störf á Kvikmyndablaðinu
- 1985: Gekk inn á NT dagblað
- 1986-1988: Helgarpósturinn
- 1987: DV
- 1989: Ritstjóri Pressunnar
- 1993-1994: Ritstýrði Eintaki
- 1994-1995: Ritstýrði Morgunpóstinum og Helgarpóstinum
- 1997: Gaf út tímaritið Fjölni
- 1998: Ritstýrði Fókus
- 1999: Einn af stofnendum Fréttablaðsins
- 2015-2017: Aðaleigandi Fréttatímans

STOFNUN SÓSÍALISTAFLOKKSINS:
Gunnar tilkynnti stofnun Sósíalistaflokksins 3. apríl 2017 í útvarpsþættinum Harmageddon. Flokkurinn var formlega stofnaður 1. maí 2017.

HEIMILDIR:
- timarit.is - Pressan 20.12.1990
- timarit.is - Eintak 01.12.1993
- timarit.is - Fjölnir 04.07.1997
- DV/timarit.is 24.05.2013`,
    citation: {
      who: 'STOFNANDI_A',
      when: '1961-2025',
      context: 'Ferill stofnanda Sósíalistaflokksins',
      url: 'https://timarit.is/',
    },
  },
];

async function indexDocument(doc) {
  console.log(`  Indexing: ${doc.title}`);

  try {
    // Generate embedding
    const embedding = await embeddingService.generateEmbedding(doc.content);

    // Upsert to database
    await vectorSearch.upsertDocument({
      sourceType: doc.sourceType || 'discourse-archive',
      sourceUrl: doc.sourceUrl || 'https://discourse-archive.local/',
      sourceDate: new Date().toISOString().split('T')[0],
      chunkId: doc.id,
      title: doc.title,
      content: doc.content,
      citation: doc.citation,
      embedding,
    });

    console.log(`    ✅ Done (${doc.content.length} chars)`);
    return true;
  } catch (error) {
    console.error(`    ❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Indexing Party History from discourse-archive');
  console.log('='.repeat(60));

  let success = 0;
  let failed = 0;

  // Index main history document
  console.log('\n📚 Indexing main party history...');
  if (await indexDocument(PARTY_HISTORY)) success++; else failed++;

  // Index key events
  console.log('\n📅 Indexing key events...');
  for (const event of KEY_EVENTS) {
    event.sourceType = 'discourse-archive';
    if (await indexDocument(event)) success++; else failed++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Done! ${success} documents indexed, ${failed} failed`);
  console.log('='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
