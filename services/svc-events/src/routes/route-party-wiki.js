/**
 * Party Wiki Chat Route
 *
 * Provides a chat endpoint for members to learn about the Socialist Party.
 * Uses Google Gemini as Wikipedia-style knowledge assistant.
 * Knowledge base: xj.is (sosialistaflokkurinn.is) and discourse-archive
 */

const express = require('express');
const logger = require('../utils/util-logger');
const { pool } = require('../config/config-database');
const authenticate = require('../middleware/middleware-auth');
const gemini = require('../services/service-gemini');
const webSearch = require('../services/service-web-search');

const router = express.Router();

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
- Anna Björk Mörtudóttir - Oddviti, formaður velferðarráðs
- Helga Sigríður Pálsdóttir (tók við af fyrirrennara í sept. 2024)

**Alþingismenn:**
- Enginn - Flokkurinn hefur aldrei náð kjöri á Alþingi

## STOFNENDUR (1. MAÍ 2017)

97 stofnfélagar, þar af helstu:
- Jón Baldur Sigurðsson - Stofnandi, fyrrverandi ritstjóri
- Anna Björk Mörtudóttir - Borgarfulltrúi
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
- **Tengsl:** Kristín Helga Magnúsdóttir (tengd sósíalistum) var kjörin formaður 2018 og 2022
- **ATH:** Efling er EKKI hluti af flokknum, en nokkrir sósíalistar hafa verið virkir þar

### Sósíalistafélag Reykjavíkur
- **Tegund:** Svæðisfélag flokksins - HLUTI af skipulagi flokksins
- **Facebook:** 816 fylgjendur

## DEILUR 2025 (ÚR DISCOURSE-ARCHIVE)

Á aðalfundi 24. maí 2025 urðu stjórnarskipti þar sem nýir formenn voru kjörnir.
Anna Björk sagði af sér sem pólitískur leiðtogi 26. maí.
Deilur snúast að hluta til um Vorstjörnuna (húsfélag) og fjárreiður.

**ATH:** Þetta voru ekki algjör valdarán - margir í nýrri stjórn (t.d. Hallfríður gjaldkeri, Sæþór) sátu þegar í stjórn 2024.

Tveir fylkingar:
1. **Fyrri forysta** - Sanna, Jón Baldur, Sara Stef, Védís
2. **Nýja forystan** - Sæþór (formaður), Sigrún Lára, Hallfríður

---

## SVÖRUNARREGLUR

1. Svaraðu á íslensku, stuttlega og hnitmiðað
2. Notaðu markdown fyrir fyrirsagnir og lista
3. Ef þú veist ekki svarið, segðu það hreinskilnislega
4. Ekki þykjast vita hluti sem þú veist ekki
5. Vertu hlutlaus - ekki taka afstöðu í innri deilum
6. Beindu fólki á xj.is fyrir nýjustu upplýsingar
7. ALLTAF greina á milli flokksins og tengdra samtaka (Vorstjarnan, Samstöðin, Efling)`;

/**
 * Save conversation to database for usage tracking
 */
async function saveConversation({
  userId,
  userName,
  question,
  response,
  model,
  responseTimeMs,
}) {
  try {
    await pool.query(
      `INSERT INTO rag_conversations
       (user_id, user_name, question, response, model, response_time_ms, assistant_type)
       VALUES ($1, $2, $3, $4, $5, $6, 'party-wiki')`,
      [userId, userName, question, response, model, responseTimeMs]
    );
    logger.info('Party wiki conversation saved', {
      operation: 'save_party_wiki_conversation',
      userId,
      questionLength: question.length,
    });
  } catch (error) {
    // Don't fail the request if saving fails
    logger.error('Failed to save party wiki conversation', {
      operation: 'save_party_wiki_conversation_error',
      error: error.message,
    });
  }
}

/**
 * Web search tool definition for Gemini
 */
const WEB_SEARCH_TOOL = {
  name: 'web_search',
  description: 'Leita á vefnum eftir upplýsingum um Sósíalistaflokkinn eða íslensk stjórnmál. Notaðu þetta til að finna nýjustu fréttir eða staðfesta staðreyndir.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Leitarstrengur á íslensku eða ensku'
      }
    },
    required: ['query']
  }
};

/**
 * Execute a tool call
 */
async function executeToolCall({ name, arguments: args }) {
  if (name === 'web_search') {
    const query = args.query;
    logger.info('Party wiki web search', {
      operation: 'party_wiki_web_search',
      query
    });

    const results = await webSearch.search(query);

    if (results.length === 0) {
      return 'Engar niðurstöður fundust.';
    }

    // Format results for the AI
    return results.map(r =>
      `**${r.title}**\n${r.description}\nHeimild: ${r.url}`
    ).join('\n\n');
  }

  return 'Óþekkt verkfæri';
}

/**
 * POST /api/party-wiki/chat
 * Send a message to party wiki assistant and get a response
 * Requires authentication (any member)
 */
router.post('/chat', authenticate, async (req, res) => {
  const startTime = Date.now();

  try {
    const { message, history = [], model: requestedModel } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Message is required'
      });
    }

    if (!gemini.isAvailable()) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'AI service not configured'
      });
    }

    // Map frontend model names to Gemini models
    const modelName = gemini.resolveModel(requestedModel);
    const modelConfig = gemini.getModelConfig(modelName);

    logger.info('Party wiki chat request', {
      operation: 'party_wiki_chat',
      userId: req.user?.uid,
      messageLength: message.length,
      historyLength: history.length,
      model: modelName
    });

    // Use Gemini with web search tool
    const result = await gemini.generateChatWithTools({
      systemPrompt: PARTY_WIKI_PROMPT,
      message,
      history,
      model: modelName,
      tools: [WEB_SEARCH_TOOL],
      executeToolCall,
      maxIterations: 3,
    });

    const responseTimeMs = Date.now() - startTime;

    logger.info('Party wiki chat response', {
      operation: 'party_wiki_chat_response',
      userId: req.user?.uid,
      replyLength: result.reply.length,
      responseTimeMs,
      toolIterations: result.toolIterations
    });

    // Save conversation for usage tracking (async, don't wait)
    saveConversation({
      userId: req.user?.uid,
      userName: req.user?.name || null,
      question: message,
      response: result.reply,
      model: result.model,
      responseTimeMs,
    });

    res.json({
      reply: result.reply,
      model: result.model,
      modelName: result.modelName
    });

  } catch (error) {
    logger.error('Party wiki chat error', {
      operation: 'party_wiki_chat_error',
      error: error.message,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Villa: Ekki tókst að fá svar frá AI'
    });
  }
});

module.exports = router;
