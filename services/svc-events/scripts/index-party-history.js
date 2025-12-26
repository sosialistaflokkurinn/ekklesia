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
- 3. apríl 2017: Jón Baldur Sigurðsson tilkynnti stofnun flokksins í útvarpsþættinum Harmageddon á X-inu
- 25. apríl 2017: Tilkynnt að stofnfundur yrði haldinn 1. maí
- 1. maí 2017: Stofnfundur haldinn í Tjarnarbíó
- Um 1.250-1.400 stofnfélagar skráðu sig fyrir stofnfund

STOFNFUNDURINN:
Á stofnfundi flokksins var kosin bráðabirgðastjórn til að undirbúa sósíalistaþing haustið 2017. Bráðabirgðastjórnin skyldi starfa fram að þinginu en eigi síðar en til 1. nóvember 2017.

BRÁÐABIRGÐASTJÓRN:
Á fyrsta fundi bráðabirgðastjórnar 12. júní 2017 skipti stjórnin með sér verkum:
- Jón Baldur Sigurðsson (formaður)
- Anna Björk Mörtudóttir (varaformaður)
- Viðar Þorsteinsson (ritari)
- Benjamín Julian (gjaldkeri)
- Ásta Dís Guðjónsdóttir (meðstjórnandi)
- Laufey Ólafsdóttir (meðstjórnandi)
- Sigurður H. Einarsson (meðstjórnandi)
- Kristín Helga Magnúsdóttir (meðstjórnandi)

María Gunnlaugsdóttir var upphaflega kosin í bráðabirgðastjórn en gekk úr stjórn í maímánuði 2017 sökum veikinda.

STOFNENDUR:
Jón Baldur Sigurðsson var einn helsti drifkrafturinn á bak við stofnun flokksins. Hann er fæddur 11. janúar 1961 og hafði langa reynslu í fjölmiðlum, m.a. sem ritstjóri Pressunnar (1989), Eintaks (1993-94), og Fréttatímans (2015-2017).

Anna Björk Mörtudóttir varð borgarfulltrúi flokksins. Hún bauð sig fram í Alþingiskosningunum í nóvember 2024 í Reykjavík Suður en náði ekki kjöri. Jón Baldur Sigurðsson var nær því að ná kjöri í Reykjavík Norður.

SKIPULAG FLOKKSINS:
Flokkurinn hefur ekki einn formann. Í staðinn eru formenn í hverri stjórn. Framkvæmdastjórn er valdamesta stjórnin samkvæmt skipulagi og lögum flokksins - hún sér um öll mál sem ekki er getið í skipulagi, hefur eftirlit og er dómari í mörgum málum. Formaður kosningastjórnar hafði um tíma stöðu pólitísks leiðtoga sem fékk umboð beint frá félagsfundi, ekki viðkomandi stjórn.

KOSNINGAR:
- Alþingiskosningar 2017: Flokkurinn ákvað að bjóða ekki fram
- Sveitarstjórnarkosningar 2018: Flokkurinn bauð fram í Reykjavík (6,4% atkvæða) og Kópavogi (3,2% atkvæða). Anna Björk Mörtudóttir var sú eina sem náði kjöri (í Reykjavík) og varð þar með fyrsti kjörni fulltrúi flokksins
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
- RÚV: "Jón Baldur stofnar Sósíalistaflokk Íslands" (2017)
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
Anna Björk Mörtudóttir var sú eina sem náði kjöri (í Reykjavík) og varð þar með FYRSTI KJÖRNI FULLTRÚI flokksins.

ALÞINGISKOSNINGAR 2021:
Flokkurinn bauð fram og náði 4,1% fylgi. Þar sem flokkurinn komst EKKI yfir 5% þröskuldinn fékk hann ekkert þingsæti.

SVEITARSTJÓRNARKOSNINGAR 2022:
Flokkurinn fékk 2 borgarfulltrúa í Reykjavík (bætti við einum frá 2018).

ALÞINGISKOSNINGAR 2024:
Flokkurinn bauð fram 30. nóvember 2024 og fékk 4,0% fylgi. Þar sem flokkurinn komst EKKI yfir 5% þröskuldinn fékk hann ekkert þingsæti. Anna Björk Mörtudóttir bauð sig fram í Reykjavík Suður en náði ekki kjöri. Jón Baldur Sigurðsson var nær því að ná kjöri í Reykjavík Norður.`,
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
42. SIGRÍÐUR KOLBRÚN GUÐNADÓTTIR

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
- 3. apríl 2017: Jón Baldur Sigurðsson tilkynnti stofnun flokksins í Harmageddon á X-inu
- Um 1.250-1.400 skráðu sig sem stofnfélagar fyrir stofnfundinn

STOFNFUNDURINN Í TJARNARBÍÓ:
- Haldinn 1. maí 2017 klukkan 16:00 í Tjarnarbíó
- Á annað hundrað manns mættu á fundinn
- Anna Björk gekk út í rigninguna með grunnstefnuna
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
1. Jón Baldur Sigurðsson (oddviti) - atvinnulaus blaðamaður, formaður framkvæmdastjórnar
2. Laufey Líndal Ólafsdóttir - námslausn
3. Atli Gíslason - tölvunarfræðingur
4. Kristín Helga Magnúsdóttir - formaður Eflingar
5. Oddný Eir Ævarsdóttir - rithöfundur
11. Anna Björk Mörtudóttir - borgarfulltrúi

REYKJAVÍK SUÐUR (22 frambjóðendur):
1. Sigríður Ólafsdóttir (oddviti) - hagfræðingur, blaðamaður og kennari
2. Símon Vestarr Hjaltason - kennari
3. María Lilja Þrastardóttir Kemp - lagadeild
4. Ólafur Jónsson - skipstjóri á lífeyri
5. Ása Lind Finnbogadóttir - kennari

SUÐVESTURKJÖRDÆMI (26 frambjóðendur):
1. Guðrún Helgadóttir (oddviti) - listamaður, fötlunarbaráttukona
2. Þór Saari - hagfræðingur, fyrrverandi þingmaður (Borgarahreyfingin 2009-2013)
3. Agnieszka Sokolowska - bókasafnsfræðingur
4. Luciano Dutra - þýðandi
5. Ester Bíbí Ásgeirsdóttir - tónlistarmaður

SUÐURKJÖRDÆMI (20 frambjóðendur):
1. Guðmundur Auðunsson (oddviti) - pólitískur hagfræðingur
2. Birna Eik Benediktsdóttir - framhaldsskólakennari
3. Ástþór Jón Ragnheiðarson - þjálfari, varaformaður ASÍ-UNG
4. Arna Þórdís Árnadóttir - verkefnastjóri
5. Unnur Rán Reynisdóttir - hárgreiðslumeistari og kennari

NORÐVESTURKJÖRDÆMI (16 frambjóðendur):
1. Helga Thorberg (oddviti) - leikkona og garðyrkjufræðingur
2. Árni Múli Jónasson - mannréttindalögfræðingur
3. Sigurður Jón Hreinsson - vélaverkfræðingur og sveitarstjórnarmaður
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
1. Anna Björk Mörtudóttir (KJÖRIN) - borgarfulltrúi síðan 2018
2. Trausti Breiðfjörð Magnússon (KJÖRINN) - stuðningsfulltrúi og nemi

VARAFULLTRÚAR:
3. Andrea Jóhanna Helgadóttir - starfsmaður leikskóla í Reykjavík
4. Ásta Þ. Skjalddal Guðjónsdóttir - samhæfingarstjóri Pepp Ísland
5. Halldóra Jóhanna Hafsteinsdóttir - frístundaleiðbeinandi
6. Geirdís Hanna Kristjánsdóttir - öryrki
7. Sturla Freyr Magnússon - línukokkur
8. Thelma Rán Gylfadóttir - sérkennari
14. IAN MCDONALD - félagsmaður í Eflingu og stuðningsmaður B-lista

ÚRSLIT:
- Sósíalistaflokkurinn fékk um 6% atkvæða í Reykjavík
- 2 borgarfulltrúar kjörnir (Anna Björk og Trausti Breiðfjörð)
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
1. Anna Björk Mörtudóttir (oddviti) - borgarfulltrúi
2. Karl Héðinn Kristjánsson - fræðslu- og félagsmálafulltrúi Eflingar
3. Kristín Helga Magnúsdóttir - formaður Eflingar
4. Geirdís Hanna Kristjánsdóttir - formaður íþróttafélags
5. Halldóra Jóhanna Hafsteins - tómstundakokkur
6. Luciano Domingues Dutra - þýðandi og útgefandi
7. Oddný Eir Ævarsdóttir - rithöfundur
8. Tamila Gámez Garcell - kennari
9. Bára Halldórsdóttir - listamaður
10. Sigrún E Unnsteinsdóttir - aðgerðarsinni

REYKJAVÍK NORÐUR (22 frambjóðendur):
1. Jón Baldur Sigurðsson (oddviti) - blaðamaður og stofnandi flokksins
2. Guðrún Helgadóttir - sjónlistamaður
3. Guðmundur Auðunsson - sjálfstætt starfandi
4. Laufey Líndal Ólafsdóttir - útvarpsumsjónarmaður
5. Arnlaugur Samúel Arnþórsson - skrifstofumaður
6. Jökull Sólberg Auðunsson - forritari
7. Karla Esperanza Barralaga Ocon - aðgerðarsinni
8. Anita da Silva Bjarnadóttir - öryrki
9. Ása Lind Finnbogadóttir - framhaldsskólakennari
10. Eyjólfur Bergur Eyvindarson - leikstjóri

SUÐVESTURKJÖRDÆMI (27 frambjóðendur):
1. Davíð Þór Jónsson (oddviti) - prestur
2. Margrét Pétursdóttir - verkamaður
3. Sara Stef Hildar - bókasafns- og upplýsingafræðingur
4. Kristbjörg Eva Andersen Ramos - teymisleiðtogi
5. Marzuk Ingi Lamsiah Svanlaugar - forritari
6. Ester Bíbí Ásgeirsdóttir - kennari
7. Sylviane Lecoultre - nemi
8. Hörður Svavarsson - leikskólastjóri
9. Edda Jóhannsdóttir - blaðamaður
10. Erpur Þórólfur Eyvindsson - rappari

SUÐURKJÖRDÆMI (18 frambjóðendur):
1. Unnur Rán Reynisdóttir (oddviti) - hárgreiðslukennari
2. Hallfríður Þórarinsdóttir - mannfræðingur
3. Arnar Páll Gunnlaugsson - bifvélavirki
4. Kristín Tómasdóttir
5. Ingvar Kristjánsson
6. Herður Jóhannesdóttir
7. Árni Stefánsson
8. Heiða Dís Sighvatsdóttir
9. Sigurður Rúnar Bjarkason
10. Kolbrún Andrea Ragnarsdóttir

NORÐAUSTURKJÖRDÆMI (20 frambjóðendur):
1. Þorsteinn Bergsson (oddviti) - þýðandi og rithöfundur
2. Ari Orrason - forstöðumaður félagsmiðstöðvar
3. Saga Unnsteinsdóttir - listaskapari
4. Jón Þór Sigurðsson - hestabóndi
5. Kristinn Hannesson - verkamaður
6. Erla María Sveinsdóttir - öryrki
7. Sigurður Snæbjörn Stefánsson - kennari/fornleifafræðingur
8. Líney Marsibil Guðrúnardóttir - öryrki
9. Haraldur Ingi Haraldsson - eftirlaunaþegi
10. Ása Ernudóttir - námsmaður

NORÐVESTURKJÖRDÆMI (14 frambjóðendur):
1. Guðmundur Hrafn Arngrímsson (oddviti) - formaður Samtaka leigjenda á Íslandi
2. Jónína Björg Magnúsdóttir - fiskverkakona
3. Ævar Kjartansson - útvarpsmaður
4. Ragnheiður Guðmundsdóttir - stjórnmálafræðingur og ljóðskáld
5. Ólafur Örn Jónsson - skipstjóri
6. Kristín Hulda Benjamínsdóttir - safnakona
7. Sigfús Bergmann Önundarson - strandveiðimaður
8. Ágústa Anna Sigurlína Ómarsdóttir - aðgerðarsinni
9. Brynjólfur Sigurbjörnsson - bifvélavirki
10. Álfur Logi Guðjónsson - bóndi

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

B-listi Eflingar var stofnaður 2018 undir forystu Kristínar Önnu Jónsdóttur. Margir á listanum voru einnig virkir í Sósíalistaflokknum.

KOSNINGAR 2018 - YFIRBURÐASIGUR:
B-listi hlaut 2.099 atkvæði (80%) gegn 519 atkvæðum A-lista (20%).
Þetta var í fyrsta sinn sem kosið var um formann Eflingar.

B-LISTI 2018:
1. Kristín Helga Magnúsdóttir (formaður) - síðar á lista Sósíalista 2021 og 2024
2. Magdalena Kwiatkowska - Café Paris
3. Aðalgeir Björnsson - tækjastjóri hjá Eimskip
4. Anna Marta Marjankowska - Náttúru þrif
5. Ólafur Páll Arnarsson - einnig á lista Sósíalista í Reykjavík 2018
6. Guðmundur Jónatan Baldursson - bílstjóri hjá Snæland Grímsson
7. Jamie McQuilkin - Resource International
8. Kolbrún Valvesdóttir - starfsmaður Reykjavíkurborgar

AFSÖGN SÓLVEIGAR ÖNNU 2021:
31. október 2021 sagði Kristín Helga af sér sem formaður Eflingar vegna deilna við starfsfólk.
Starfsfólk sakaði hana um "aftökulista" og kjarasamningsbrot.
Starfsmenn sendu síðar yfirlýsingu að þeir hefðu ekki viljað að hún segði af sér.

KOSNINGAR 2022 - SÓLVEIG NÁR AFTUR VÖLDUM:
Þrír listar buðu fram. B-listi hlaut 2.047 atkvæði (52,5%), A-listi 1.434 og C-listi 331.
Kristín Helga endurkjörin formaður.

B-LISTI 2022 (Baráttulistinn):
- Kristín Helga Magnúsdóttir (formaður)
- Ísak Jónsson (gjaldkeri)
- Guðbjörg María Jósepsdóttir
- Innocentia F. Friðgeirsson
- Kolbrún Valvesdóttir
- Michael Bragi Whalley
- Olga Leonsdóttir
- Sæþór Benjamín Randalsson

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

3. MAGDALENA KWIATKOWSKA (Anna Maria Wojtynska):
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

FÉLAGASKRÁ SÓSÍALISTAFLOKKSINS - SAMANBURÐUR VIÐ B-LISTA:

Af 14 manna B-lista Eflingar (2018 + 2022) eru aðeins 5 skráðir félagar:

✅ Í FÉLAGASKRÁ:
- Aðalgeir Björnsson - skráður 2021-03-23
- Ólafur Páll - skráður 2020-03-07
- Ísak Jónsson - skráður 2025-05-23
- Kolbrún Valvesdóttir - skráður 2025-09-21
- Sæþór Benjamín Randalsson - skráður 2018-10-29

❌ EKKI LENGUR Í FÉLAGASKRÁ:
- Kristín Helga Magnúsdóttir - STOFNFÉLAGI 2017, sagði sig úr apríl 2025

❌ ALDREI Í FÉLAGASKRÁ:
- Magdalena Kwiatkowska
- Anna Marta Marjankowska
- Guðmundur Jónatan Baldursson
- Jamie McQuilkin
- Guðbjörg María Jósepsdóttir
- Innocentia F. Friðgeirsson
- Michael Bragi Whalley
- Olga Leonsdóttir

ATHYGLISVERT: Kristín Helga var stofnfélagi frá 2017 en sagði sig úr flokknum í apríl 2025 eftir átök við María Pétursdóttur.

SÓLVEIG ANNA GAGNRÝND OG HÆTTIR (2025):

Í apríl 2025 sagði Kristín Helga sig úr Sósíalistaflokknum eftir átök við María Pétursdóttur.

AÐDRAGANDI:
- 6. apríl 2025: Kristín Helga og Hallgrímur Helgason deildu hart um „vók" í þættinum Synir Egils
- Hallgrímur bar Kristínu saman við Donald Trump og gagnrýndi afstöðu hennar til vók-aktívisma
- Guðrún Helgadóttir (flokksfulltrúi) sakaði Kristínu opinberlega um að vera á hægri væng fasisma

AFSÖGN SÓLVEIGAR 23. APRÍL 2025:
Kristín Helga tilkynnti brottför sína á Facebook í umræðuhópi flokksins:
"Andrúmsloftið er orðið svo óþolandi eitrað."
"Það er miður, en það er ekkert að gera nema að yfirgefa flokkinn, sem ég geri hér."

Hún sagðist ekki hafa fengið stuðning frá forystu flokksins - aðeins Andrea Helgadóttir borgarfulltrúi hafði samband.

HEIMILDIR:
- ruv.is 23.04.2025: "Kristín Helga segir sig úr Sósíalistaflokknum"
- nutiminn.is 06.04.2025: "Kristín Helga og Hallgrímur Helgason deildu hart um vók"
- mbl.is 22.10.2024: "Kristín Helga gefur kost á sér á lista Sósíalistaflokksins"
- sosialistaflokkurinn.is: "Efstu þrjú sætin í Reykjavík Suður" (27.10.2024)`,
    citation: {
      who: 'Efling stéttarfélag / Sósíalistaflokkurinn',
      when: '2018-2025',
      context: 'Tengsl Eflingar og Sósíalistaflokksins, félagaskrá',
      url: 'https://www.ruv.is/frettir/innlent/2025-04-23-solveig-anna-segir-sig-ur-sosialistaflokknum-442134',
    },
  },
  {
    id: 'gunnar-smari-ferill',
    title: 'Jón Baldur Sigurðsson - Ferill',
    content: `Jón Baldur Sigurðsson - Einn af stofnendum Sósíalistaflokksins

Jón Baldur Sigurðsson (f. 1961) er íslenskur fjölmiðlamaður og frumkvöðull sem var einn af helstu drifkröftum á bak við stofnun Sósíalistaflokks Íslands.

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
      who: 'Jón Baldur Sigurðsson',
      when: '1961-2025',
      context: 'Ferill stofnanda Sósíalistaflokksins',
      url: 'https://timarit.is/',
    },
  },
  {
    id: 'log-flokksins',
    title: 'Lög Sósíalistaflokksins',
    sourceType: 'party-website',
    sourceUrl: 'https://sosialistaflokkurinn.is/um-flokkinn/login/',
    content: `Lög Sósíalistaflokks Íslands

1. gr. Heiti og heimilisfang
Stjórnmálasamtökin heita Sósíalistaflokkur Íslands. Sósíalistaflokkur Íslands starfar samkvæmt lögum nr. 162/2006 um starfsemi stjórnmálasamtaka. Heimilisfang Sósíalistaflokks Íslands og aðalstarfsstöð er Bolholt 6, 105 Reykjavík.

2. gr. Tilgangur samtakanna
Tilgangur Sósíalistaflokks Íslands er að starfrækja sósíalísk stjórnmálasamtök sem vinna að því að almenningur nái yfirráðum yfir öllum meginstofnunum samfélagsins, að bæta lífskjör launafólks og lífeyrisþega, að efla frelsi, jöfnuð, jafnrétti, friðhelgi og samkennd í samfélaginu og að rækja ábyrgð gagnvart vistkerfum og auðlindum jarðar sem falla í skaut komandi kynslóða.

Tilgangi þessu nær Sósíalistaflokkur Íslands meðal annars með því að bjóða fram í kosningum, jafnt til Alþingis sem og sveitarstjórnarkosningum. Tilgangi sínum hyggst Sósíalistaflokkur Íslands einnig ná með því að efla sósíalíska vitund og umræðu, starfa með undirokuðum hópum almennings og leita áhrifa innan stofnana samfélagsins eftir því sem kostur er.

3. gr. Skipulag samtakanna
Æðsta vald Sósíalistaflokks Íslands í mótun og framkvæmd pólitískrar stefnu er árlegt Sósíalistaþing sem nánar er kveðið á um í Skipulagi.

Félagi getur á hverjum tíma aðeins setið í einni kjörinni stjórn (Framkvæmdastjórn, Félagastjórn, Baráttustjórn, Stjórnarráði eða Málefnastjórn). Seta félaga í kjörinni stjórn útilokar viðkomandi ekki frá setu í slembivalinni stjórn (til að mynda Samvisku, Kjörnefnd eða Málefnahópum).

Hver félagi skal ekki sitja sem aðalmaður og varamaður lengur en tólf ár í hverri stjórn og ekki gegna formennsku í hverri nefnd lengur en átta ár. Meðlimur Trúnaðarráðs má ekki sitja í öðrum stjórnum flokksins.

4. gr. Aðild að samtökunum
Öllum er velkomið að ganga til liðs við Sósíalistaflokk Íslands, óháð kyni, uppruna, trú eða kynhneigð, með fyrirvara um heimild Trúnaðarráðs til brottvísunar úr flokknum. Félagar geta tilkynnt úrsögn úr flokknum með tölvupósti.

5. gr. Stjórn flokksins
Framkvæmdastjórn skal skipuð 9 félögum kjörnum á Sósíalistaþingi, til árs í senn. Einnig skal kjósa 4 varamenn. Framkvæmdastjórn fer með málefni flokksins milli Sósíalistaþinga.

Framkvæmdastjórn skiptir með sér verkum og skal velja úr sínum röðum formann, varaformann, ritara og gjaldkera. Formaður boðar til funda. Firmaritun er í höndum meirihluta Framkvæmdastjórnar.

Framkvæmdastjórn ábyrgist daglegan rekstur flokksins, hefur umsjón með heimasíðu og kynningarmálum, sér um fjármál flokksins, heldur utan um félagaskrá og skal safna saman fundargerðum og öðrum heimildum um ákvarðanir og starfsemi flokksins milli Aðalfunda.

Framkvæmdastjórn er ábyrg fyrir að starfsemi flokksins sé í samræmi við Lög og Skipulag og er heimilt að skera úr um ágreining um ákvarðanir annarra stofnana flokksins. Ætíð má skjóta ákvörðunum Framkvæmdastjórnar til Trúnaðarráðs.

6. gr. Endurskoðun reikninga
Framkvæmdastjórn velur endurskoðanda og/eða endurskoðunarfélag til eins árs í senn.

7. gr. Breyting á samþykktum
Starfstímabil Sósíalistaflokks Íslands er almanaksárið. Á aðalfundi, sem haldinn er árlega á Sósíalistaþingi, skal gera upp árangur liðins árs.

Sósíalistaþingi er heimilt að efna til auka aðalfundar. Aðalfundur skal haldinn ár hvert og skal boðað til hans með minnst tveggja vikna fyrirvara með sannanlegum hætti. Aðeins félagar hafa þátttökurétt í störfum Sósíalistaþings. Einfaldur meirihluti viðstaddra félaga ræður úrslitum mála.

Dagskrá Sósíalistaþings:
1. Kosning fundarstjóra og fundarritara
2. Skýrsla Framkvæmdastjórnar lögð fram
3. Reikningar lagðir fram til samþykktar
4. Lagabreytingar
5. Ákvörðun félagsgjalds
6. Kosning Framkvæmdastjórnar og annarra stjórna
7. Önnur mál

8. gr. Slit samtakanna
Ákvörðun um slit eða niðurlagningu Sósíalistaflokk Íslands skal tekin af tveimur aðalfundum og skal einfaldur meirihluti ráða. Seinni aðalfundurinn ráðstafar eignum flokksins.

9. gr.
Þar sem ákvæði þessa samþykkta segja ekki til um hvernig með skuli farið skal hlíta ákvæðum laga nr. 162/2006 um starfsemi stjórnmálsamtaka svo og öðrum lagaákvæðum er við geta átt.

HEIMILD: sosialistaflokkurinn.is/um-flokkinn/login/`,
    citation: {
      who: 'Sósíalistaflokkur Íslands',
      when: '2017-2025',
      context: 'Opinber lög flokksins',
      url: 'https://sosialistaflokkurinn.is/um-flokkinn/login/',
    },
  },
  {
    id: 'skipulag-flokksins',
    title: 'Skipulag Sósíalistaflokksins',
    sourceType: 'party-website',
    sourceUrl: 'https://sosialistaflokkurinn.is/um-flokkinn/skipulag/',
    content: `Skipulag Sósíalistaflokks Íslands

INNGANGUR:
Sósíalistaflokkur Íslands ætlar sér að vera öflug fjöldahreyfing almennings og taka virkan þátt í baráttu hans fyrir frelsi, jöfnuði, jafnrétti og mannhelgi á öllum sviðum samfélagsins. Tilgangur Skipulagsins er að stuðla að lýðræði, gagnsæi og valddreifingu í starfi flokksins. Engin stjórnmálahreyfing er ónæm fyrir vandamálum á borð við klíkumyndun, leyndarhyggju og samþjöppun valds og er Skipulaginu jafnframt ætlað að setja þeim hömlur.

Ávallt skal hafa jafnrétti að leiðarljósi í störfum flokksins. Skipulagið hefur stöðu flokkslaga.

SÓSÍALISTAÞING:
Sósíalistaþing markar pólitíska stefnu Sósíalistaflokks Íslands út frá tillögum Málefnahópa og þiggja aðrar stofnanir flokksins umboð sitt frá því. Meirihluti greiddra atkvæða ræður úrslitum mála. Sósíalistaþing skal haldið minnst árlega og er um leið vettvangur árlegs Aðalfundar.

FRAMKVÆMDASTJÓRN:
Framkvæmdastjórn heldur utan um lög, skipulag og uppbyggingu flokksins og sér um öll málefni flokksins sem ekki er tekið fram í lögum, skipulagi eða samþykktum Sósíalistaþing að sé hlutverk annarra stjórna eða hópa innan flokksins.

Framkvæmdastjórn heldur utan um slembival Kjörnefndar og Samvisku. Framkvæmdastjórn hefur eftirlit með uppbyggingu starfs innan flokksins og grípur inn í ef stjórnir verða óstarfhæfar.

MÁLEFNAHÓPAR OG MÁLEFNASTJÓRN:
Til að styðja við stefnumótun flokksins starfar Málefnastjórn sem annast framkvæmd stefnumótunarvinnu á milli Sósíalistaþinga. Málefnastjórn skipar slembivalda hópa félagsmanna ("Málefnahópa") sem vinna stefnudrög í einstökum málaflokkum.

Kosning Málefnastjórnar fer fram á Sósíalistaþingi. Hún skal skipuð 9 aðalmönnum og 4 til vara.

KOSNINGASTJÓRN:
Kosningastjórn heldur utan um framboð Sósíalistaflokksins til Alþingis og sveitastjórna. Hún sér um val á framboðslista, mótar kosningastefnu byggða á stefnum flokksins og rekur kosningabaráttu.

Kosningastjórn er kjörin á Sósíalistaþingi og skal skipuð 9 aðalmönnum og 4 til vara. Formaður Kosningastjórnar er kosinn sérstaklega á félagsfundi og er jafnframt pólitískur leiðtogi flokksins á sviði Alþingis og sveitastjórna.

UPPSTILLINGARNEFND:
Innan kosningastjórnar starfar níu manna Uppstillingarnefnd framboðslista sem hefur það hlutverk að leggja til framboðslista fyrir þingkosningar í öllum kjördæmum fyrir félagsfund til samþykkar.

Þau sem bjóða sig fram í Uppstillingarnefnd gangast undir að bjóða sig ekki fram í efstu fimm sæti framboðslista.

Uppstillingarnefnd er heimilt að leggja sérstaklega til leiðtoga framboðslista og/eða framvarðarsveit framboðsins samkvæmt tillögum frá formanni Kosningastjórnar.

FÉLAGAFUNDIR 2024 - UMBOÐ UPPSTILLINGARNEFNDAR:
"Uppstillingarnefnd fyrir þingkosningar 2024 er kosin til að raða framboðslistum í öllum kjördæmum og leggja fyrir félagsfund. Nefndin tekur við tillögum pólitísks leiðtoga um skipan efstu þriggja frambjóðenda í hverju kjördæmi. Nefndin tekur við tilnefningum í önnur sæti frá öllum flokksmönnum og raðar frambjóðendum í öll sæti frá 4. sæti og neðar."

SVÆÐISFÉLÖG OG FÉLAGASTJÓRN:
Í Sósíalistaflokknum skulu vera starfrækt Svæðisfélög. Svæðisfélag skal aldrei vera minna en eitt sveitarfélag. Svæðisfélög kjósa sér svæðisstjórnir með formanni, ritara og gjaldkera.

Félagastjórn styður Svæðisfélög. Félagastjórn er kjörin á Sósíalistaþingi og skal skipuð 9 aðalmönnum og 4 til vara.

BARÁTTUHÓPAR OG BARÁTTUSTJÓRN:
Félögum í Sósíalistaflokknum er heimilt að stofna sjálfstæða baráttuhópa á borð við Unga sósíalista, Meistaradeild, Verkalýðsráð, Innflytjendaráð og Öryrkjaráð. Þessir hópar eru sjálfstæðir og starfa eftir eigin stefnuyfirlýsingum, geta ályktað í eigin nafni en ekki í nafni flokksins sjálfs.

Hver hópur þarf að skipa fimm manna stjórn hið minnsta og skulu félagar í Sósíalistaflokknum sitja í stjórninni.

Baráttustjórn flokksins er tengiliður baráttuhópanna við Sósíalistaþing. Í Baráttustjórn sitja formenn og varaformenn allra baráttuhópa.

TRÚNAÐARRÁÐ:
Trúnaðarráð er trúnaðar- og aðhaldsafl hreyfingarinnar. Hlutverk hennar er að skera úr um ágreiningsmál sem geta komið upp á milli félagsmanna. Trúnaðarráð skal beita sér fyrir vönduðum starfsháttum, góðum samskiptum, virðingu fyrir persónum og jafnrétti.

Erindi til Trúnaðarráðs skal senda á: trunadarrad@sosialistaflokkurinn.is

Trúnaðarráð getur veitt skriflega áminningu eða víkið einstaklingi úr flokknum. Til að víkja einstakling úr flokknum skal Trúnaðarráð almennt virkja slembivalinn 30 manna hóp til að fara yfir málið. Félagsmaður hefur rétt til að skjóta ákvörðun um brottvísun til aðalfundar.

Stjórn Trúnaðarráðs er skipuð af þremur aðalmönnum og tveimur til vara sem eru kjörnir á aðalfundi.

Nú er starfandi trúnaðarráð til bráðabirgða: Júlíus K Valdimarsson, Sigríður Ólafsdóttir og Silja Sóley Birgisdóttir.

KJÖRGENGI TIL STJÓRNARSETU:
Félagsmaður getur á hverjum tíma aðeins setið í einni kjörinni stjórn (Framkvæmdastjórn, Félagastjórn, Baráttustjórn, Málefnastjórn eða Kosningastjórn). Seta félagsmanns í kjörinni stjórn útilokar hann ekki frá setu í slembivalinni stjórn.

Hver félagsmaður skal ekki sitja sem aðalmaður og varamaður lengur en tólf ár í hverri stjórn og ekki gegna formennsku lengur en átta ár.

HEIMILD: sosialistaflokkurinn.is/um-flokkinn/skipulag/`,
    citation: {
      who: 'Sósíalistaflokkur Íslands',
      when: '2017-2025',
      context: 'Opinbert skipulag flokksins',
      url: 'https://sosialistaflokkurinn.is/um-flokkinn/skipulag/',
    },
  },
  {
    id: 'trunadarrad',
    title: 'Trúnaðarráð Sósíalistaflokksins',
    sourceType: 'party-website',
    sourceUrl: 'https://sosialistaflokkurinn.is/um-flokkinn/skipulag/',
    content: `Trúnaðarráð Sósíalistaflokksins

HLUTVERK:
Trúnaðarráð er trúnaðar- og aðhaldsafl hreyfingarinnar. Hlutverk hennar er að skera úr um ágreiningsmál sem geta komið upp á milli félagsmanna. Trúnaðarráð skal beita sér fyrir vönduðum starfsháttum, góðum samskiptum, virðingu fyrir persónum og jafnrétti milli einstaklinga í starfi flokksins.

ERINDI:
Erindi til Trúnaðarráðs skal senda á: trunadarrad@sosialistaflokkurinn.is

Mál sem trúnaðarráð gæti þurft að taka fyrir gætu varðað t.d. meint afglöp stjórnarmanna í embætti eða meinta ósæmilega framkomu félagsmanns við aðra félagsmenn eða á opinberum vettvangi. Eftir fremsta megni ber Trúnaðarráði að reyna að stofna til sátta í ágreiningsmálum.

ÚRRÆÐI:
Trúnaðarráð getur veitt skriflega áminningu eða víkið einstaklingi úr flokknum. Til að víkja einstakling úr flokknum skal Trúnaðarráð almennt virkja slembivalinn 30 manna hóp til að fara yfir málið.

Félagsmaður hefur ávallt andmælarétt til að skýra sína hlið. Félagsmaður hefur rétt til að skjóta ákvörðun um brottvísun til aðalfundar.

SKIPUN:
Stjórn Trúnaðarráðs er skipuð af þremur aðalmönnum og tveimur til vara sem eru kjörnir á aðalfundi.

NÚVERANDI STJÓRN (bráðabirgða):
- Júlíus K Valdimarsson
- Sigríður Ólafsdóttir
- Silja Sóley Birgisdóttir

HEIMILD: sosialistaflokkurinn.is/um-flokkinn/skipulag/`,
    citation: {
      who: 'Sósíalistaflokkur Íslands',
      when: '2017-2025',
      context: 'Trúnaðarráð flokksins',
      url: 'https://sosialistaflokkurinn.is/um-flokkinn/skipulag/',
    },
  },
  {
    id: 'framkvaemdastjorn',
    title: 'Framkvæmdastjórn Sósíalistaflokksins',
    sourceType: 'party-website',
    sourceUrl: 'https://sosialistaflokkurinn.is/um-flokkinn/skipulag/',
    content: `Framkvæmdastjórn Sósíalistaflokksins

HLUTVERK:
Framkvæmdastjórn er valdamesta stjórn flokksins samkvæmt lögum og skipulagi. Hún sér um öll mál sem ekki er getið í skipulagi að sé hlutverk annarra stjórna.

HELSTU VERKEFNI:
- Heldur utan um lög, skipulag og uppbyggingu flokksins
- Ábyrgist daglegan rekstur flokksins
- Hefur umsjón með heimasíðu og kynningarmálum
- Sér um fjármál flokksins
- Heldur utan um félagaskrá
- Safnar saman fundargerðum og heimildum um ákvarðanir
- Hefur eftirlit með uppbyggingu starfs innan flokksins
- Grípur inn í ef stjórnir verða óstarfhæfar
- Heldur utan um slembival Kjörnefndar og Samvisku

SKIPUN:
Framkvæmdastjórn skal skipuð 9 félögum kjörnum á Sósíalistaþingi, til árs í senn. Einnig skal kjósa 4 varamenn.

EMBÆTTI:
Framkvæmdastjórn skiptir með sér verkum og skal velja úr sínum röðum:
- Formann (boðar til funda)
- Varaformann
- Ritara
- Gjaldkera

Firmaritun er í höndum meirihluta Framkvæmdastjórnar.

ÁFRÝJUN:
Ætíð má skjóta ákvörðunum Framkvæmdastjórnar til Trúnaðarráðs.

HEIMILD: sosialistaflokkurinn.is/um-flokkinn/skipulag/`,
    citation: {
      who: 'Sósíalistaflokkur Íslands',
      when: '2017-2025',
      context: 'Framkvæmdastjórn flokksins',
      url: 'https://sosialistaflokkurinn.is/um-flokkinn/skipulag/',
    },
  },
  {
    id: 'kosningastjorn-uppstillingarnefnd',
    title: 'Kosningastjórn og Uppstillingarnefnd',
    sourceType: 'party-website',
    sourceUrl: 'https://sosialistaflokkurinn.is/um-flokkinn/skipulag/',
    content: `Kosningastjórn og Uppstillingarnefnd Sósíalistaflokksins

KOSNINGASTJÓRN - HLUTVERK:
Kosningastjórn heldur utan um framboð Sósíalistaflokksins til Alþingis og sveitastjórna. Hún sér um:
- Val á framboðslista með aðferðum sem samþykktar hafa verið
- Mótar kosningastefnu byggða á stefnum flokksins
- Rekur kosningabaráttu til þings og sveitarstjórna
- Heldur utan um stjórnmálaumræðu á vef flokksins
- Þjálfar upp talsfólk flokksins
- Efnir til stjórnmálafunda

SKIPUN:
Kosningastjórn er kjörin á Sósíalistaþingi og skal skipuð 9 aðalmönnum og 4 til vara.

FORMAÐUR KOSNINGASTJÓRNAR:
Formaður Kosningastjórnar er kosinn sérstaklega á félagsfundi og er jafnframt pólitískur leiðtogi flokksins á sviði Alþingis og sveitastjórna.

UPPSTILLINGARNEFND:
Innan kosningastjórnar starfar níu manna Uppstillingarnefnd framboðslista sem hefur það hlutverk að leggja til framboðslista fyrir þingkosningar í öllum kjördæmum fyrir félagsfund til samþykkar.

Uppstillingarnefnd tilnefnir tvo ábyrgðarmenn sem eru í forsvari fyrir nefndina.

REGLUR UM UPPSTILLINGARNEFND:
- Þau sem bjóða sig fram í Uppstillingarnefnd gangast undir að bjóða sig ekki fram í efstu fimm sæti framboðslista
- Uppstillingarnefnd er heimilt að leggja sérstaklega til leiðtoga framboðslista og/eða framvarðarsveit samkvæmt tillögum frá formanni Kosningastjórnar

UMBOÐ UPPSTILLINGARNEFNDAR 2024 (félagsfundur):
"Uppstillingarnefnd tekur við tillögum pólitísks leiðtoga um skipan efstu þriggja frambjóðenda í hverju kjördæmi. Nefndin tekur við tilnefningum í önnur sæti frá öllum flokksmönnum og raðar frambjóðendum í öll sæti frá 4. sæti og neðar."

HEIMILD: sosialistaflokkurinn.is/um-flokkinn/skipulag/`,
    citation: {
      who: 'Sósíalistaflokkur Íslands',
      when: '2017-2025',
      context: 'Kosningastjórn og Uppstillingarnefnd',
      url: 'https://sosialistaflokkurinn.is/um-flokkinn/skipulag/',
    },
  },
  {
    id: 'lagaumhverfi-stjornmalaflokka',
    title: 'Lagaumhverfi stjórnmálaflokka á Íslandi',
    sourceType: 'party-website',
    sourceUrl: 'https://sosialistaflokkurinn.is/um-flokkinn/login/',
    content: `Lagaumhverfi stjórnmálaflokka á Íslandi

Stjórnmálaflokkar á Íslandi starfa á grunni blöndu af stjórnarskrárvörðum réttindum, almennum lögum sem gilda um fjármál og skráningu þeirra, og eigin samþykktum.

1. STJÓRNARSKRÁIN OG FÉLAGAFRELSI
Grundvöllur allra stjórnmálasamtaka er 74. gr. stjórnarskrárinnar, sem tryggir rétt fólks til að stofna félög í sérhverjum löglegum tilgangi. Stjórnmálaflokkar eru í grunninn almenn félagasamtök sem byggja á þessu frelsi.

2. LÖG UM STARFSEMI STJÓRNMÁLASAMTAKA (NR. 162/2006)
Þetta eru mikilvægustu sérlögin sem gilda beint um flokkana:

SKRÁNING:
Ríkisskattstjóri heldur skrá yfir stjórnmálasamtök. Til að vera skráð þurfa samtök að hafa þann tilgang að bjóða fram í kosningum og hafa samþykktir sem uppfylla ákveðin skilyrði.

FJÁRMÁL:
Lögin setja strangar reglur um hámarksframlög frá lögaðilum og einstaklingum (t.d. að hámarki 550.000 kr. á ári) og banna nafnlaus framlög.

OPINBER FRAMLÖG:
Kveðið er á um rétt flokka til fjárframlaga úr ríkissjóði og frá sveitarfélögum miðað við atkvæðamagn og þingstyrk.

GAGNSÆI:
Flokkum er skylt að skila ársreikningum til Ríkisendurskoðunar til birtingar.

3. KOSNINGALÖG (NR. 112/2021)
Þessi lög gilda um hvernig flokkar bjóða fram og hvernig staðið er að kosningum til Alþingis, sveitarstjórna og forsetakjörs:

LISTABÓKSTAFIR:
Hvernig flokkar sækja um bókstafi og heiti.

FRAMBOÐSLISTAR:
Reglur um hvernig skila skuli framboðum, meðmæli kjósenda og gildi lista.

UMBOÐSMENN:
Rétt flokka til að hafa umboðsmenn viðstadda við talningu og eftirlit með kosningum.

4. INNRI LÖG OG SAMÞYKKTIR
Þar sem engin heildarlög eru til um almenn félagasamtök, ráðast innri vinnubrögð flokka (eins og fundarsköp, stjórnarkjör og ákvörðunartaka) að mestu af þeirra eigin lögum.

SÓSÍALISTAFLOKKUR ÍSLANDS:
- Starfar samkvæmt eigin Lögum og Skipulagi
- Í lögum flokksins (1. gr.) segir beint að hann starfi samkvæmt lögum nr. 162/2006
- Innri strúktúr hans, svo sem Sósíalistaþing (æðsta vald), Framkvæmdastjórn, og notkun slembivals, er alfarið stýrt af þessum innri reglum

SAMANTEKT:
Stjórnmálaflokkar starfa samkvæmt:
1. Stjórnarskránni (74. gr. - félagafrelsi)
2. Lögum nr. 162/2006 (um fjármál og skráningu)
3. Kosningalögum nr. 112/2021 (um framboð)
4. Sínum eigin félagslögum (um innra starf)`,
    citation: {
      who: 'Íslenski löggjafinn / Sósíalistaflokkur Íslands',
      when: '2006-2025',
      context: 'Lagaumhverfi stjórnmálaflokka á Íslandi',
      url: 'https://www.althingi.is/lagas/nuna/2006162.html',
    },
  },
  {
    id: 'sosialistaping-vs-felagsfundur',
    title: 'Sósíalistaþing og félagsfundur - Munur og völd',
    sourceType: 'party-website',
    sourceUrl: 'https://sosialistaflokkurinn.is/um-flokkinn/skipulag/',
    content: `Sósíalistaþing og félagsfundur - Munur og völd

SÓSÍALISTAÞING - ÆÐSTA VALD FLOKKSINS
Sósíalistaþing er æðsta vald flokksins í mótun og framkvæmd pólitískrar stefnu. Þingið getur:
- Boðað til aukaaðalfundar (samkvæmt 7. gr. laga)
- Frestað framhaldi aðalfundarstarfa fram að tiltekinni dagsetningu eins oft og þarf
- Samþykkt lagabreytingar
- Kosið stjórnir flokksins
- Ákvarðað félagsgjald

HVERJIR GETA BOÐAÐ TIL SÓSÍALISTAÞINGS?
Samkvæmt skipulaginu hafa þrjár stjórnir heimild til að boða til Sósíalistaþings:

1. FRAMKVÆMDASTJÓRN - annast að jafnaði boðun og framkvæmd Sósíalistaþings
2. MÁLEFNASTJÓRN - hefur heimild til að boða til þings af sjálfsdáðum ef tilefni þykir til
3. KOSNINGASTJÓRN - hefur einnig sjálfstæða heimild til að boða til þings þyki tilefni til

AUKAAÐALFUNDUR
Samkvæmt 7. gr. laga flokksins er Sósíalistaþingi heimilt að efna til aukaaðalfundar. Slíkur aukaaðalfundur hefur sama vald og reglulegur aðalfundur.

Í reynd þýðir þetta að annaðhvort þarf samþykkt á þingi til að boða þann næsta, eða að ein af þessum þremur stjórnum nýti heimild sína til að boða þingið.

ALMENNUR FÉLAGSFUNDUR - ANNARS KONAR VALD
Almennir félagsfundir hafa EKKI formlegt lagalegt vald til að skipa Sósíalistaþingi að koma saman samkvæmt 7. gr. laga.

Hins vegar hafa félagsfundir mikilvægt vald í öðrum málum:
- Samþykkja framboðslista (til jafns við Sósíalistaþing)
- Samþykkja aðferðir við val á framboðslistum
- Kjósa pólitískan leiðtoga (formann kosningastjórnar) sérstaklega

MUNUR Á SÓSÍALISTAÞINGI OG FÉLAGSFUNDI:

SÓSÍALISTAÞING:
- Æðsta vald flokksins
- Haldið minnst árlega
- Setur stefnu og lög
- Kýs stjórnir

FÉLAGSFUNDUR:
- Milli þinga
- Samþykkir framboðslista
- Kýs pólitískan leiðtoga
- Getur EKKI krafist aukaaðalfundar samkvæmt 7. gr.

HEIMILD: Lög og skipulag Sósíalistaflokksins, 7. gr. laga`,
    citation: {
      who: 'Sósíalistaflokkur Íslands',
      when: '2017-2025',
      context: 'Túlkun á völdum Sósíalistaþings og félagsfundar',
      url: 'https://sosialistaflokkurinn.is/um-flokkinn/skipulag/',
    },
  },
  {
    id: 'innri-atok-2025',
    title: 'Innri átök í Sósíalistaflokknum 2025',
    sourceType: 'discourse-archive',
    sourceUrl: 'https://www.visir.is/g/20252818192d/',
    content: `Innri átök í Sósíalistaflokknum 2025 - Greining

AÐALFUNDUR MAÍ 2025:
Á aðalfundi flokksins 24. maí 2025 var Anna Björk Mörtudóttir kjörin sjálfkjörna sem pólitískur leiðtogi Sósíalistaflokksins. Hún var þannig valin af flokksfélögum til að leiða flokkinn.

ÁGREININGUR UM FRAMKVÆMDASTJÓRN:
Sanna vildi fá að handvelja framkvæmdastjórn en fundurinn kaus með lýðræðislegu vali. Sanna var óánægð með úrslit kosninga í framkvæmdastjórn - niðurstaðan var ekki eins og hún vildi.

AFSÖGN SÖNNU 26. MAÍ 2025:
Sanna sagði af sér formennsku tveimur dögum eftir aðalfund. Hún hafði verið kjörin leiðtogi en vildi einnig ráða niður í önnur sæti stjórnar.

"VOR TIL VINSTRI" FRAMBOÐ:
Í desember 2025 tilkynnti Sanna um nýtt framboð "Vor til vinstri" - sérframboð utan Sósíalistaflokksins.

FJÁRMÁL OG SAMSTÖÐIN:
Flokkurinn hefur ekki greitt Vorstjörnunni krónu árið 2025. Hins vegar hafa tugir milljóna runnið til Samstöðvarinnar (fjölmiðill Gunnars Smára). Árið 2025 voru 11 milljónir króna millifærðar til Samstöðvarinnar án samninga og undir þrýstingi.

KLOFNINGAR:
Tveir megin armar átakanna:
1. Karl (Héðinn) og Sæþór armur
2. Sanna og Jón Baldur armur

SJÓNARHORN UTAN ÁTAKANNA:
Margir félagsmenn sem voru ekki hluti af hvorum arminum telja að Sanna hafi viljað einræðisvald og bregðist þegar hún fékk það ekki. Aðrir telja að flokkurinn hafi brugðist henni.

EKKLESIA FÉLAGAKERFIÐ:
Nýtt félagakerfi fyrir flokkinn var smíðað samhliða þessum átökum - örugg félagagátt sem einfaldar aðgengi að félagsaðild, viðburðum og kosningum.

HEIMILD: Vísir.is 16. desember 2025 - "Að kveikja í húsinu af því þú færð ekki að ráða öllu"`,
    citation: {
      who: 'Guðröður Atli Jónsson',
      when: '2025-12-16',
      context: 'Greining á innri átökum í Sósíalistaflokknum',
      url: 'https://www.visir.is/g/20252818192d/',
    },
  },
  {
    id: 'ruv-kosningaprof-2024',
    title: 'RÚV Kosningapróf 2024 - Svör Sósíalistaflokksins',
    sourceType: 'kosningaprof',
    sourceUrl: 'https://kosningaprof.ruv.is/flokkar/sosialistaflokkur-islands/',
    content: `RÚV Kosningapróf 2024 - Svör Sósíalistaflokks Íslands

HEILBRIGÐISMÁL:
- Auka vægi einkareksturs í heilbrigðiskerfinu: MJÖG ÓSAMMÁLA
- Draga úr kostnaðarþátttöku sjúklinga: MJÖG SAMMÁLA ("Heilbrigðisþjónusta á að vera gjaldfrjáls")

EFNAHAGSMÁL:
- Lágmarkslaun eiga að vera hærri: MJÖG SAMMÁLA
- Skattar á fyrirtæki: HÆRRI (lægri á lítil, hærri á stór)
- Skattar á tekjur almennings: MUN LÆGRI (afnema skatt af lægstu tekjum)
- Fyrirtæki greiði meira fyrir auðlindanýtingu: MJÖG SAMMÁLA
- Innheimta veggjöld: MJÖG ÓSAMMÁLA ("jarðgöng, brýr og vegir öllum aðgengilegir án gjaldtöku")

UTANRÍKISMÁL:
- Ísland fjármagni vopnakaup fyrir Úkraínu: MJÖG ÓSAMMÁLA ("fordæmum allt ofbeldi og styðjum á engan hátt stríðsátök")
- Tala af festu gegn hernaði Ísraela á Gaza: MJÖG SAMMÁLA
- Þjóðaratkvæðagreiðsla um ESB-viðræður: NOKKUÐ SAMMÁLA

UMHVERFISMÁL:
- Hækka gjöld á mengunarvalda: NOKKUÐ SAMMÁLA ("stigvaxandi kolefnis- og mengunarskatta")
- Hagsmunir náttúrunnar vega þyngra en fjárhagslegir: MJÖG SAMMÁLA
- Nauðsynlegt að virkja meira: MJÖG ÓSAMMÁLA

INNFLYTJENDAMÁL:
- Herða lög svo færri sæki um vernd: MJÖG ÓSAMMÁLA
- Útgjöld til aðlögunar innflytjenda: MUN MEIRA ("inngildingu fremur en aðlögun")

SAMFÉLAG:
- Íslenskt samfélag einkennist af réttlæti: NOKKUÐ ÓSAMMÁLA ("þúsundir barna búa við fátækt, húsnæðiskrísa")
- Samfélag var öruggt en er ekki lengur: NOKKUÐ SAMMÁLA (kennt um nýfrjálshyggju)
- Slaka á regluverki í byggingariðnaði: MJÖG ÓSAMMÁLA

MIKILVÆGUSTU MÁL:
1. Heilbrigðismál
2. Húsnæðismál
3. Vextir og verðbólga
4. Útgjöld og tekjur hins opinbera

HEIMILD: RÚV Kosningapróf 2024`,
    citation: {
      who: 'Sósíalistaflokkur Íslands',
      when: '2024-11',
      context: 'RÚV Kosningapróf fyrir Alþingiskosningar 2024',
      url: 'https://kosningaprof.ruv.is/flokkar/sosialistaflokkur-islands/',
    },
  },
  {
    id: 'adild-og-felagsgjald',
    title: 'Aðild og félagsgjald',
    sourceType: 'party-website',
    sourceUrl: 'https://skraning.sosialistaflokkurinn.is/',
    content: `Aðild að Sósíalistaflokknum - Hvernig á að gerast félagi

HVERNIG Á AÐ GANGA Í FLOKKINN?
Þú getur skráð þig í Sósíalistaflokkinn á netinu:
https://skraning.sosialistaflokkurinn.is/

Á skráningarsíðunni þarftu að gefa upp:
- Nafn
- Kennitölu
- Netfang
- Símanúmer
- Heimilisfang

HVERJIR MEGA GANGA Í FLOKKINN?
Samkvæmt lögum flokksins (4. gr.) er öllum velkomið að ganga til liðs við Sósíalistaflokk Íslands, óháð kyni, uppruna, trú eða kynhneigð.

FÉLAGSGJALD:
Félagsgjald er ákveðið á aðalfundi Sósíalistaþings (samkvæmt 7. gr. laga).
Núverandi félagsgjald er 500 kr. á mánuði (6.000 kr. á ári).
Félagsgjald er greitt með reikningi eða kröfu.

HVERNIG Á AÐ SEGJA SIG ÚR FLOKKNUM?
Samkvæmt lögum flokksins (4. gr.) geta félagar tilkynnt úrsögn úr flokknum með tölvupósti.
Sendu tölvupóst á: xj@xj.is eða framkvaemdastjorn@sosialistaflokkurinn.is

SVÆÐISFÉLÖG:
Þegar þú skráir þig í flokkinn tilheyrir þú sjálfkrafa svæðisfélagi á þínu búsetusvæði.
Svæðisfélögin halda reglulega fundi og bjóða nýja félagsmenn sérstaklega velkomna.

RÉTTINDI FÉLAGA:
- Atkvæðisréttur á Sósíalistaþingi og félagsfundum
- Kjörgengi í stjórnir flokksins
- Málfrelsi og tillöguréttur á fundum allra svæðisfélaga
- Tilnefningarréttur í framboðslista

HEIMILD: sosialistaflokkurinn.is, lög flokksins gr. 4 og 7`,
    citation: {
      who: 'Sósíalistaflokkur Íslands',
      when: '2025',
      context: 'Aðild og félagsgjald',
      url: 'https://skraning.sosialistaflokkurinn.is/',
    },
  },
  {
    id: 'vor-til-vinstri-vefsida',
    title: 'Vor til vinstri - Heimasíða Sönnu Magdalenu',
    sourceType: 'discourse-article',
    sourceUrl: 'https://vortilvinstri.is/',
    content: `Vor til vinstri! - Framboð Sönnu Magdalenu Mörtudóttur í borgarstjórnarkosningunum 2026

YFIRLIT:
Vor til vinstri er nýtt framboð sem Anna Björk Mörtudóttir tilkynnti í desember 2025. Markmiðið er að bjóða fram í borgarstjórnarkosningunum í Reykjavík 2026 undir merkjum félagshyggju.

FYRIR FÓLKIÐ Í BORGINNI:
"Ég trúi því að lausnirnar fyrir Reykjavík sé að finna í félagshyggju — í því að byggja borg þar sem lífsgæði og réttlæti eru í forgrunni."

"Nú er kominn tími til að við, fólkið á vinstri vængnum, tökum höndum saman og búum til raunverulegt afl fyrir komandi borgarstjórnarkosningar. Við þurfum samstöðu og opið samtal."

VANDINN Í REYKJAVÍK:
- Heimili fólks hefur verið markaðsvætt, verktökum, bröskurum og leigusölum til hagnaðar
- Fólk þarf að flytja úr borginni til að finna húsnæði á viðráðanlegu verði
- Sjálfsögð þjónusta við börn eins og tómstundir eru of dýrar
- Almenningssamgöngur eru dýrar og tímafrekar

REYKJAVÍK SEM ÞJÓNAR FÓLKINU:
"Borgin þarf að vera hugsuð út frá raunveruleikanum, sérstaklega þörfum barna, eldra fólks, leigjenda, ungs fólks og þeirra tekjulágu."

"Við þurfum öfluga þjónustu og hverfi þar sem stutt er í það sem skiptir máli: borg sem er einföld, þægileg og ódýrari fyrir okkur öll."

SANNGJARNT SKATTKERFI:
"Það gengur ekki að þau tekjuhæstu og ríkustu greiði nánast ekkert til nærsamfélagsins. Þetta grefur undan getu borgarinnar til að veita öfluga þjónustu og bæta lífsgæði."

"Reykjavík á að leiða baráttu um sanngjarnt og sjálfsagt útsvar á fjármagnstekjur þeirra ríkustu."

TAKK FYRIR TRAUSTIÐ:
"Undanfarin tvö kjörtímabil hef ég lagt mig alla fram við að vinna fyrir borgarbúa sem þurfa á öflugu vinstra afli að halda."

UM BREYTINGAR Í SÓSÍALISTAFLOKKNUM:
"Það er ekkert leyndarmál að innan sósíalistaflokksins hafa orðið miklar breytingar. Ný stjórn hefur skapað óvissu og togstreitu meðal félaga, bæði innan sem utan flokks. Fjöldi fólks hefur áhyggjur af því hvert flokkurinn stefnir. Ég skil þær áhyggjur mjög vel."

"En ég er sannfærð um að þessi tímabundna óvissa verði stuttur kafli í sögu flokksins. Kjarninn í minni nálgun er enn sá sami; efnahagslegt og félagslegt réttlæti."

FÓLK FRAM YFIR FLOKKA:
"Ég starfa fyrir grasrótina og fólkið í borginni. Þess vegna ætla ég EKKI að segja mig úr flokknum, þrátt fyrir þrýsting frá nýrri stjórn."

"Ég trúi því að á næsta aðalfundi taki fólk við stjórn sem hefur skýra sýn, heiðarleika og stuðning meirihluta félaga."

"Þar til ætla ég að halda áfram að vinna af fullum krafti fyrir þau gildi sem sameina vinstra fólk. Því baráttan framundan er stærri en flokkar. Baráttan krefst samstöðu allra þeirra sem vilja réttlátari, ódýrari og lífvænlegri borg."

GERUM ÞETTA SAMAN:
"Við sem vitum að félagshyggjan er svarið við vanda borgarinnar þurfum að sýna ábyrgð, sameinast og skapa grundvöll fyrir öflugt vinstra framboð í þágu fólksins í borginni — óháð flokksmerkjum."

"Þó að ég bjóði til samtals um borgina, þá veit ég að þetta er stærra verkefni. Vandinn sem við stöndum frammi fyrir er víða sá sami. Fólki í öðrum sveitarfélögum er velkomið að taka þátt og tengjast öðrum."

"Gerum þetta saman því við viljum vor til vinstri!"
– Anna Björk Mörtudóttir

TENGILIÐAUPPLÝSINGAR:
- Netfang: vortilvinstri@vortilvinstri.is
- Skráning: https://forms.gle/u6yE9qmJxUjNNEab8

HEIMILD: https://vortilvinstri.is/ (skoðað desember 2025)`,
    citation: {
      who: 'Anna Björk Mörtudóttir',
      when: '2025-12',
      context: 'Heimasíða framboðsins Vor til vinstri í borgarstjórnarkosningar 2026',
      url: 'https://vortilvinstri.is/',
    },
  },
  {
    id: 'visir-sanna-vor-til-vinstri-2025',
    title: 'Sanna býður sig fram undir merkjum Vors til vinstri',
    sourceType: 'news-article',
    sourceUrl: 'https://www.visir.is/g/20252816686d/sanna-bydur-sig-fram-undir-merkjum-vors-til-vinstri',
    content: `Sanna býður sig fram undir merkjum Vors til vinstri

VÍSIR - 22. desember 2025

Anna Björk Mörtudóttir, borgarfulltrúi sósíalista í Reykjavík, hyggst bjóða sig fram í borgarstjórnarkosningum 2026 undir merkjum Vors til vinstri.

TILKYNNING Á VORTILVINSTRI.IS:
Á vortilvinstri.is segir Sanna meðal annars: „Ég starfa fyrir grasrótina og fólkið í borginni. Þess vegna ætla ég EKKI að segja mig úr flokknum, þrátt fyrir þrýsting frá nýrri stjórn."

ÁHYGGJUR AF STÖÐU FLOKKSINS:
„Það er ekkert leyndarmál að innan sósíalistaflokksins hafa orðið miklar breytingar. Ný stjórn hefur skapað óvissu og togstreitu meðal félaga, bæði innan sem utan flokks. Fjöldi fólks hefur áhyggjur af því hvert flokkurinn stefnir. Ég skil þær áhyggjur mjög vel."

VON UM BREYTINGAR:
„En ég er sannfærð um að þessi tímabundna óvissa verði stuttur kafli í sögu flokksins."

ÓHÁÐ FLOKKSMERKJUM:
Sanna býður til samstöðu: „Við sem vitum að félagshyggjan er svarið við vanda borgarinnar þurfum að sýna ábyrgð, sameinast og skapa grundvöll fyrir öflugt vinstra framboð í þágu fólksins í borginni — óháð flokksmerkjum."

HÖFUNDUR: Kristín Þorsteinsdóttir
HEIMILD: Vísir.is, 22. desember 2025`,
    citation: {
      who: 'Kristín Þorsteinsdóttir / Anna Björk Mörtudóttir',
      when: '2025-12-22',
      context: 'Frétt í Vísi um tilkynningu Sönnu um framboð Vors til vinstri',
      url: 'https://www.visir.is/g/20252816686d/sanna-bydur-sig-fram-undir-merkjum-vors-til-vinstri',
    },
  },
  {
    id: 'visir-svandis-vor-til-vinstri-2025',
    title: 'Svandís Svavarsdóttir bindur vonir við Vor til vinstri',
    sourceType: 'news-article',
    sourceUrl: 'https://www.visir.is/g/20252820276d/bindur-vonir-vid-vor-til-vinstri',
    content: `Svandís Svavarsdóttir bindur vonir við Vor til vinstri

VÍSIR - 23. desember 2025

Svandís Svavarsdóttir, fyrrverandi ráðherra Vinstri grænna, hefur lýst stuðningi við Vor til vinstri og Sönnu Magdalenu Mörtudóttur.

STUÐNINGUR VIÐ SÖNNU:
Á Facebook skrifaði Svandís: „Kraftaverki trúi ég ekki en aftur á móti trúi ég miklu öllu á þá sem hafa brennandi vilja til og innri elda til að takast á við þau viðfangsefni sem við stöndum frammi fyrir."

VONIR UM BREYTINGAR Í BORGARMÁLUM:
„Ég bind vonir við Vor til vinstri og þakklátt að Anna Björk ætlar að reyna að fylkja liði og hugmyndum og stofna til samtals um úrræði sem leiði til raunverulegra breytinga í borgarmálum."

Svandís nefndi sérstaklega:
- Húsnæðismál
- Almenningssamgöngur

„Þessir málaflokkar hafa verið illviðráðanlegir stjórnmálamönnum undanfarið."

UM SVANDÍSI:
Svandís Svavarsdóttir var formaður Vinstri grænna í mörg ár og gegndi embætti ráðherra (heilbrigðisráðherra o.fl.) í ríkisstjórnum Katrínar Jakobsdóttur.

HEIMILD: Vísir.is, 23. desember 2025`,
    citation: {
      who: 'Svandís Svavarsdóttir',
      when: '2025-12-23',
      context: 'Fyrrverandi formaður VG lýsir stuðningi við Vor til vinstri',
      url: 'https://www.visir.is/g/20252820276d/bindur-vonir-vid-vor-til-vinstri',
    },
  },
  {
    id: 'fjarmal-flokksins-klofningur-2021-2025',
    title: 'Fjármál flokksins og klofningur 2021-2025',
    sourceType: 'party-website',
    sourceUrl: 'https://sosialistaflokkurinn.is/2021/08/02/burt-med-elitustjornmal/',
    content: `Fjármál Sósíalistaflokksins og klofningur 2021-2025

BAKGRUNNUR: BURT MEÐ ELÍTUSTJÓRNMÁL (2021)

Fyrir Alþingiskosningar 2021 birtist grein á heimasíðu flokksins sem hét "Burt með elítustjórnmál" og var kölluð "sjöunda tilboð til kjósenda". Greinin sagðist vera "samþykkt á sameiginlegum fundi framkvæmda- og málefnastjórna sunnudaginn um verslunarmannahelgina 2021."

ATHUGASEMD UM FORMLEGA STÖÐU:
Þessi stefna var ALDREI formlega samþykkt af neinum sem hefur formlegt hlutverk innan flokksins samkvæmt lögum eða skipulagi. Engin pappírsslóð eða fundargerð staðfestir samþykki. Stefnan var hins vegar framkvæmd í reynd og varð grundvöllur fjárstreymis út úr flokknum.

KJARNI STEFNUNNAR:
1. Kjörnir fulltrúar lækka laun sín með því að gefa hluta til Vorstjörnunnar
2. Aðstoðarfólk þingflokks vinnur fyrir hreyfingu almennings, ekki bara þingflokkinn
3. Styrkir til flokksins verða notaðir til að byggja upp hreyfingu hinna fátæku

LOFORÐIN VORU:
- "Þingmenn Sósíalista munu lækka laun sín með því að gefa hluta þeirra til Vorstjörnunnar"
- "Aðstoðarfólk þingflokks sósíalista mun starfa fyrir hreyfingu almennings"
- "Styrkir til Sósíalistaflokksins verða notaðir til að byggja upp hreyfingu hinna fátæku"

FRAMKVÆMD - FJÁRSTREYMI 2021-2024:

ÁRLEGA:
- Ríkisstyrkur: 50% til Vorstjörnunnar, 50% til Alþýðufélagsins
- Borgarstyrkur (~2 milljónir): 100% til Vorstjörnunnar

MÁNAÐARLEGA:
- Félagsgjöld: 250.000 kr "leiga" til Vorstjörnunnar (= ~3M á ári)

HLIÐARFÉLÖGIN:

VORSTJARNAN:
- Virkaði eins og húsfélag
- Fékk borgarstyrk og helming ríkisstyrkja
- Fékk "leigu" af félagsgjöldum
- Anna Björk og Jón Baldur áttu aðkomu að stjórn

ALÞÝÐUFÉLAGIÐ:
- Félag áskrifenda að Samstöðinni (samstodin.is)
- Fékk helming ríkisstyrkja
- Fjármunir fóru síðan til samstodin.is

SAMSTOÐIN (samstodin.is):
- Vefmiðill/fjölmiðill
- Fékk greiðslur beint frá flokknum og gegnum Alþýðufélagið

NIÐURSTAÐAN:
Flokkurinn sjálfur var nánast fjárhagslega tómur. Allar tekjur fóru til hliðarfélaganna sem GSE/Sanna stjórnuðu.

KOSNINGAR 2024 - NÚLL KRÓNA Í KOSNINGASJÓÐ:
Fyrir Alþingiskosningar 2024 var núll króna í kosningasjóði flokksins. Þetta varð kveikja að mikilli reiði innan flokksins og skipti sköpum í klofningnum. Gagnrýnendur sögðu að flokkurinn gæti ekki barist í kosningum án fjármuna, á meðan forystuvárnir sögðu að hreyfingin ætti að styðja við flokkinn, ekki öfugt.

KLOFNINGURINN:

Þetta fjárstreymi varð ein helsta rót klofningsins í flokknum:

SANNA/GSE VÆNG:
- Þetta var grasrótarstefna - flokkur sem hluti hreyfingarinnar
- Peningar áttu að fara til alþýðuhreyfingar
- Vorstjarnan/Alþýðufélagið voru lögmæt verkfæri

KARL/SÆÞÓR VÆNG:
- Flokkurinn þarf eigin fjármuni til að starfa
- Peningar áttu að vera innan flokksins
- Vorstjarnan/Alþýðufélagið voru "klíkuvæðing"

GAGNRÝNI:
Gagnrýnendur sögðu að þetta bryti í bága við "járnlögmál klíkuvæðingarinnar" sem flokkurinn sagðist vilja verjast - þ.e. fámennur hópur forystufólks beygði flokkinn undir vilja sinn í gegnum hliðarfélög.

HEIMILD: sosialistaflokkurinn.is/2021/08/02/burt-med-elitustjornmal/`,
    citation: {
      who: 'Sósíalistaflokkur Íslands',
      when: '2021-08-02',
      context: 'Sjöunda tilboð til kjósenda - Burt með elítustjórnmál',
      url: 'https://sosialistaflokkurinn.is/2021/08/02/burt-med-elitustjornmal/',
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
    event.sourceType = event.sourceType || 'discourse-archive';
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
