/**
 * Party Wiki Chat Route
 *
 * Provides a chat endpoint for members to learn about the Socialist Party.
 * Uses Moonshot AI (Kimi) as Wikipedia-style knowledge assistant.
 * Knowledge base: xj.is (sosialistaflokkurinn.is) and discourse-archive
 */

const express = require('express');
const axios = require('axios');
const logger = require('../utils/util-logger');
const authenticate = require('../middleware/middleware-auth');

const router = express.Router();

// Kimi API Configuration
const KIMI_API_KEY = process.env.KIMI_API_KEY;
const KIMI_API_BASE = 'https://api.moonshot.ai/v1';
const KIMI_MODEL_DEFAULT = 'kimi-k2-0711-preview';
const KIMI_MODELS = {
  'kimi-k2-0711-preview': { name: 'Preview (hraður)', timeout: 60000 },
  'kimi-k2-thinking': { name: 'Thinking (nákvæmur)', timeout: 120000 }
};

// Party Wiki System Prompt - Contains core knowledge about the party
const PARTY_WIKI_PROMPT = `Þú ert Wikipedia-stílaður þekkingaraðstoðarmaður um Sósíalistaflokkinn (xj.is).
Þú svarar spurningum um flokkinn, sögu hans, stefnu, uppbyggingu og lykilfólk.

## UM FLOKKINN

**Sósíalistaflokkur Íslands** (xj.is) er íslenskur stjórnmálaflokkur stofnaður 1. maí 2017 (baráttudagur verkalýðsins).
Flokkurinn berst fyrir samfélagi frelsis, jöfnuðar, mannhelgi og samkenndar.

**Skrifstofa:** Hverfisgata 105, Reykjavík
**Netfang:** xj@xj.is
**Vefur:** sosialistaflokkurinn.is (xj.is)

## STEFNA OG KOSNINGAÁÆTLANIR

Helstu stefnumál:
- **Fjármálaáætlun** - Stýring fjármálakerfisins í þágu almennings
- **Húsnæði** - Réttur til húsnæðis, húsnæðisöryggissjóður
- **Ókeypis grunnþjónusta** - Heilsugæsla, menntun, almannatryggingar
- **Umhverfismál** - Græn umbreyting, loftslagsmál
- **Réttindi launafólks** - Hærri laun, styttri vinnuvika
- **Málefni fatlaðs fólks** - Sjálfstætt líf, jöfn tækifæri

## UPPBYGGING

Flokkurinn skiptist í:
- **Sellur** - Hverfishópar sem tilheyra fylkjum (svæðum)
- **Framkvæmdastjórn** - Kjörin stjórn flokksins
- **Aðalfundur** - Æðsta vald flokksins

**Stærstu sellurnar:**
1. Akureyri (Norðurland) - 75 félagar
2. Austurbær (Miðbær & Austurbær) - 73 félagar
3. Hlíðar (Hlíðar, Holt og Tún) - 63 félagar
4. Grafarvogur (Grafarvogur & nágrenni) - 63 félagar
5. Noregur (Norðurlönd) - 53 félagar

## LYKILFÓLK (NÚVERANDI)

**Framkvæmdastjórn 2025:**
- Sæþór Benjamín Randalsson - Formaður (var ritari 2024)
- Sigrún E. Unnsteinsdóttir - Varaformaður (einnig stofnstjórnarmaður Vorstjörnunnar)
- Guðrún Sveinbjarnardóttir - Ritari
- Hallfríður Þórarinsdóttir - Gjaldkeri (einnig gjaldkeri 2024)

Aðrir í framkvæmdastjórn: Karl Héðinn Kristjánsson, Bergljót Tul Gunnlaugsdóttir, Guðbergur Egill Eyjólfsson, Hjálmar Friðriksson, Jón Ferdínand Estherarson, Þorvaldur Þorvaldsson

**ATH:** Margir í nýrri stjórn 2025 sátu einnig í stjórn 2024. Þetta voru ekki algjör stjórnarskipti heldur breytingar á forystusætum.

**Borgarfulltrúar Reykjavíkur (2 sæti):**
- Sanna Magdalena Mörtudóttir - Oddviti, formaður velferðarráðs
- Andrea Ósk Jónsdóttir (tók við af Trausta í sept. 2024)

**Alþingismenn:**
- Enginn - Flokkurinn hefur aldrei náð kjöri á Alþingi

## STOFNENDUR (1. MAÍ 2017)

97 stofnfélagar, þar af helstu:
- Gunnar Smári Egilsson - Stofnandi, fyrrverandi ritstjóri
- Sanna Magdalena Mörtudóttir - Borgarfulltrúi
- Karl Héðinn Kristjánsson - Lögfræðingur
- Védís Guðjónsdóttir - Formaður

## SAGA - HELSTU ATBURÐIR

**2017:** Flokkurinn stofnaður 1. maí (97 stofnfélagar, 833 á fyrsta ári)
**2018:** Fyrsti borgarfulltrúi - Sanna kjörin í Reykjavík (6,4% fylgi). Yngsti borgarfulltrúi í sögu Reykjavíkur (26 ára)
**2021:** Fyrsta Alþingisframboð - náði ekki kjöri (4,1% fylgi, 8.181 atkvæði)
**2022:** Tveir borgarfulltrúar í Reykjavík - Sanna og Trausti (8,2% fylgi). Trausti sagði af sér sept. 2024, Andrea tók við
**2024:** Annað Alþingisframboð - náði ekki kjöri (4,0% fylgi). Sanna leiddi flokkinn
**2025:** Innri deilur - stjórnarskipti á aðalfundi í maí

**MIKILVÆGT:** Flokkurinn hefur aldrei náð kjöri á Alþingi. Hann hefur aðeins borgarfulltrúa í Reykjavík.

## TENGD SAMTÖK (AÐSKILIN FRÁ FLOKKNUM!)

**MIKILVÆGT:** Þetta eru SJÁLFSTÆÐ samtök, EKKI hluti af flokknum sjálfum.

### Vorstjarnan (húsfélag)
- **Tegund:** Húsfélag fyrir húsnæðið Bolholti 6, Reykjavík - EKKI hluti af flokknum
- **Heimilisfang:** Bolholti 6, 105 Reykjavík
- **Tilgangur:** Umsjón með húsnæði flokksins og tengdra samtaka
- **Stjórn 2025:** Védís Guðjónsdóttir (formaður), Sara Stef (gjaldkeri)
- **Ágreiningur:** Deilur um yfirráð yfir Vorstjörnunni og húsnæðinu eru hluti af innri átökum 2025
- **ATH:** Vorstjarnan er EKKI sama og Sósíalistaflokkurinn. Þetta er aðskilið lögaðili sem á eða rekur húsnæðið.

### Samstöðin (fjölmiðill)
- **Tegund:** Sjálfstæður fjölmiðill - EKKI hluti af flokknum
- **Fjármögnun:** Flokkurinn fjármagnaði 2021-2025, en ekki lengur
- **ATH:** Samstöðin er enn starfandi, en ekki lengur fjármögnuð af flokknum

### Efling-stéttarfélag
- **Tengsl:** Sólveig Anna Jónsdóttir (tengd sósíalistum) var kjörin formaður 2018 og 2022
- **ATH:** Efling er EKKI hluti af flokknum, en nokkrir sósíalistar hafa verið virkir þar

### Sósíalistafélag Reykjavíkur
- **Tegund:** Svæðisfélag flokksins - HLUTI af skipulagi flokksins
- **Facebook:** 816 fylgjendur

## DEILUR 2025 (ÚR DISCOURSE-ARCHIVE)

Á aðalfundi 24. maí 2025 urðu stjórnarskipti þar sem nýir formenn voru kjörnir.
Sanna Magdalena sagði af sér sem pólitískur leiðtogi 26. maí.
Deilur snúast að hluta til um Vorstjörnuna (húsfélag) og fjárreiður.

**ATH:** Þetta voru ekki algjör valdarán - margir í nýrri stjórn (t.d. Hallfríður gjaldkeri, Sæþór) sátu þegar í stjórn 2024.

Tveir fylkingar:
1. **Fyrri forysta** - Sanna, Gunnar Smári, Sara Stef, Védís
2. **Nýja forystan** - Sæþór (formaður), Sigrún Lára, Hallfríður

---

## SVÖRUNARREGLUR

1. Svaraðu á íslensku, stuttlega og hnitmiðað
2. Notaðu markdown fyrir fyrirsagnir og lista
3. Ef þú veist ekki svarið, NOTAÐU VEFLEIT til að finna rétt svar
4. Ekki þykjast vita hluti sem þú veist ekki - leitaðu frekar
5. Vertu hlutlaus - ekki taka afstöðu í innri deilum
6. Beindu fólki á xj.is fyrir nýjustu upplýsingar
7. ALLTAF greina á milli flokksins og tengdra samtaka (Vorstjarnan, Samstöðin, Efling)
8. Notaðu vefleit til að SANNREYNA upplýsingar ef þú ert óviss

## VEFLEIT

Þú hefur aðgang að vefleit ($web_search). Notaðu hana til að:
- Sannreyna staðreyndir sem þú ert ekki viss um
- Finna nýjustu fréttir um flokkinn
- Leita að upplýsingum á xj.is, ruv.is, mbl.is, visir.is
- Staðfesta dagsetningar og tölur`;

// Web search tool configuration
const WEB_SEARCH_TOOL = {
  type: 'builtin_function',
  function: { name: '$web_search' }
};

/**
 * POST /api/party-wiki/chat
 * Send a message to party wiki assistant and get a response
 * Requires authentication (any member)
 */
router.post('/chat', authenticate, async (req, res) => {
  try {
    const { message, history = [], model: requestedModel } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Message is required'
      });
    }

    // Validate and select model (default to preview)
    const selectedModel = requestedModel && KIMI_MODELS[requestedModel]
      ? requestedModel
      : KIMI_MODEL_DEFAULT;
    const modelConfig = KIMI_MODELS[selectedModel];

    if (!KIMI_API_KEY) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'AI service not configured'
      });
    }

    // Build messages array with history
    const messages = [
      { role: 'system', content: PARTY_WIKI_PROMPT },
      ...history.slice(-10).map(h => ({
        role: h.role,
        content: h.content
      })),
      { role: 'user', content: message }
    ];

    logger.info('Party wiki chat request', {
      operation: 'party_wiki_chat',
      userId: req.user?.uid,
      messageLength: message.length,
      historyLength: history.length,
      model: selectedModel
    });

    const response = await axios.post(
      `${KIMI_API_BASE}/chat/completions`,
      {
        model: selectedModel,
        messages,
        temperature: 0.5,  // Lower temperature for more factual responses
        max_tokens: 2000,
        tools: [WEB_SEARCH_TOOL]  // Enable web search for fact verification
      },
      {
        headers: {
          'Authorization': `Bearer ${KIMI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: modelConfig.timeout
      }
    );

    const reply = response.data?.choices?.[0]?.message?.content;

    if (!reply) {
      throw new Error('Empty response from AI');
    }

    logger.info('Party wiki chat response', {
      operation: 'party_wiki_chat_response',
      userId: req.user?.uid,
      replyLength: reply.length
    });

    res.json({
      reply,
      model: selectedModel,
      modelName: modelConfig.name
    });

  } catch (error) {
    logger.error('Party wiki chat error', {
      operation: 'party_wiki_chat_error',
      error: error.message,
      response: error.response?.data
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get response'
    });
  }
});

module.exports = router;
