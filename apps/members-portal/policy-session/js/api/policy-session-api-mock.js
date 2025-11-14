/**
 * Mock Policy Session API
 *
 * Self-contained mock API for policy-session area.
 * Provides realistic mock data for testing without backend.
 * 
 * Note: Error messages are in Icelandic in mock.
 * Real API would return error codes that components translate via R.string.
 */

// Error message constants (would be error codes in real API)
const ERROR_MESSAGES = {
  NOT_FOUND: 'Stefnufundur fannst ekki',
  BREAK_ONLY: 'Breytingatillögur er aðeins hægt að leggja fram í hlé',
  MISSING_FIELDS: 'Vantar nauðsynleg gögn',
  INVALID_SECTION: 'Ógildur liður',
  ITEM_NOT_FOUND: 'Liður fannst ekki',
  ALREADY_VOTED: 'Þú hefur nú þegar greitt atkvæði',
  INVALID_VOTE: 'Atkvæði verður að vera "yes" eða "no"',
  VOTING_ONLY: 'Atkvæðagreiðsla er aðeins í boði á atkvæðagreiðslutíma',
  AMENDMENT_NOT_FOUND: 'Breytingatillaga fannst ekki',
  INVALID_FINAL_VOTE: 'Atkvæði verður að vera "yes", "no" eða "abstain"'
};

// Success message constants
const SUCCESS_MESSAGES = {
  AMENDMENT_SUBMITTED: 'Breytingatillaga send inn',
  VOTE_RECORDED: 'Atkvæði skráð'
};

// Mock data: Policy session
const MOCK_POLICY_SESSION = {
  id: 'policy-session-001',
  title: 'Málefni umsækjenda um alþjóðlega vernd og íbúa af erlendum uppruna',
  type: 'policy_session',
  status: 'discussion', // 'discussion', 'break', 'voting', 'closed'
  
  // Timeline
  discussion_starts_at: new Date(Date.now() - 3600000).toISOString(),
  break_starts_at: new Date(Date.now() + 3600000).toISOString(),
  break_ends_at: new Date(Date.now() + 7200000).toISOString(),
  voting_starts_at: new Date(Date.now() + 7200000).toISOString(),
  voting_ends_at: new Date(Date.now() + 14400000).toISOString(),
  
  policy_draft: {
    title: 'Málefni umsækjenda um alþjóðlega vernd og íbúa af erlendum uppruna',
    introduction: 'Stefna Sósíalistaflokks Íslands er…',
    sections: [
      {
        id: 'section-1',
        heading: 'Liður 1',
        text: 'Að sett verði mannúðleg stefna í málefnum fólks með erlendan bakgrunn, hvort heldur er þeirra sem sækja um alþjóðlega vernd eða annars fólks sem hingað kemur eða hér býr.',
        order: 1,
        has_voted: false
      },
      {
        id: 'section-2',
        heading: 'Liður 2',
        text: 'Að tryggja að málefni fólks af erlendum uppruna séu vel fjármögnuð þannig að fólk sem hingað flyst eða leitar ásjár njóti mannréttinda.',
        order: 2,
        has_voted: false
      },
      {
        id: 'section-3',
        heading: 'Liður 3',
        text: 'Að sett verði á laggirnar ráðuneyti í málefnum flóttafólks og íbúa af erlendum uppruna sem heldur uppi skipulagi, þjónustu og upplýsingum um allt er varðar málefni þeirra.',
        order: 3,
        has_voted: false
      },
      {
        id: 'section-4',
        heading: 'Liður 4',
        text: 'Að útlendingastofnun í núverandi mynd verði lögð niður og í hennar stað verði sett á laggirnar miðstöð sem heyrir undir ráðuneyti fólks af erlendum uppruna. Hún byggi á mannréttindum og mannúð, með djúpum skilningi á heimsvaldastefnu.',
        order: 4,
        has_voted: false
      },
      {
        id: 'section-5',
        heading: 'Liður 5',
        text: 'Að settur verði umboðsmaður í útlendingamálum sem styður við réttindi, þarfir og hagsmuni fólks af erlendum uppruna.',
        order: 5,
        has_voted: false
      },
      {
        id: 'section-6',
        heading: 'Liður 6',
        text: 'Að tryggja að upplýsingar séu auðsóttar, skýrar og réttar og úrskurðum um vernd fylgi ávallt rökstuðningur.',
        order: 6,
        has_voted: false
      },
      {
        id: 'section-7',
        heading: 'Liður 7',
        text: 'Að fólk sem hér fær vernd njóti viðeigandi stuðnings í allt að fimm ár.',
        order: 7,
        has_voted: false
      },
      {
        id: 'section-8',
        heading: 'Liður 8',
        text: 'Að íslenskukennsla fyrir íbúa af erlendum uppruna sé gjaldfrjáls og boðið sé upp á hana á þeim tíma sem hentar fólki, svo sem á vinnutíma.',
        order: 8,
        has_voted: false
      },
      {
        id: 'section-9',
        heading: 'Liður 9',
        text: 'Að íslenskukennsla fyrir íbúa af erlendum uppruna sé aukin, hún sé fjölbreytt og kennt sé á öllum getu og aldursstigum.',
        order: 9,
        has_voted: false
      },
      {
        id: 'section-10',
        heading: 'Liður 10',
        text: 'Að túlkaþjónusta verði aukin og hæfi ávallt aðstæðum. Alltaf sé vandað til verka.',
        order: 10,
        has_voted: false
      },
      {
        id: 'section-11',
        heading: 'Liður 11',
        text: 'Að hugað sé að mannlegum þörfum fólks af erlendum uppruna sem fengið er hingað til starfa þegar skortur er á fólki í tilteknum starfsgreinum. Ekki sé einungis horft á það sem vinnuafl heldur félagsauð.',
        order: 11,
        has_voted: false
      },
      {
        id: 'section-12',
        heading: 'Liður 12',
        text: 'Að innflutningur á sérhæfðu starfsfólki lúti skýrum reglum svo ekki sé hægt að misnota það og nota sem ódýrt vinnuafl. Sett verði ströng lög um starfsmannaleigur.',
        order: 12,
        has_voted: false
      },
      {
        id: 'section-13',
        heading: 'Liður 13',
        text: 'Að löggjöf sé bætt og sett séu viðurlög við launaþjófnaði, mansali og fleiru sem getur skaðað íbúa af erlendum uppruna á vinnumarkaði.',
        order: 13,
        has_voted: false
      },
      {
        id: 'section-14',
        heading: 'Liður 14',
        text: 'Að tryggt sé að sjálfboðaliðavinna og samfélagsvinna sé takmörkuð við ákveðinn tíma svo ekki sé hægt að misnota fólk í slíkum störfum.',
        order: 14,
        has_voted: false
      },
      {
        id: 'section-15',
        heading: 'Liður 15',
        text: 'Reynsla og menntun fólks af erlendum uppruna sé viðurkennd og að fólk sé aðstoðað við að inngilda sérhæfingu sína og/eða auka hæfni sína fyrir íslenskan vinnumarkað.',
        order: 15,
        has_voted: false
      },
      {
        id: 'section-16',
        heading: 'Liður 16',
        text: 'Að börn af erlendum uppruna sem hér búa fái, auk íslenskukennslu, kennslu í sínu móðurmáli og að hugað verði að inngildingu, þannig að fjölbreytileikinn sé alltaf viðurkenndur og virtur.',
        order: 16,
        has_voted: false
      },
      {
        id: 'section-17',
        heading: 'Liður 17',
        text: 'Að ferlið við að sækja um ríkisborgararétt sé einfaldað og dregið sé úr kostnaði við það.',
        order: 17,
        has_voted: false
      },
      {
        id: 'section-18',
        heading: 'Liður 18',
        text: 'Að bætt sé úr upplýsingaflæði ríkisins um innflytjendamál. Upplýsingar séu auknar og gerðar aðgengilegar í gegnum miðlæga gátt. Þær séu á skiljanlegu máli og á mörgum tungumálum svo að almenningur geti nýtt sér þær.',
        order: 18,
        has_voted: false
      }
    ]
  },
  
  amendments: [
    {
      id: 'amendment-001',
      section_id: 'section-8',
      section_heading: 'Liður 8',
      original_text: 'Að íslenskukennsla fyrir íbúa af erlendum uppruna sé gjaldfrjáls og boðið sé upp á hana á þeim tíma sem hentar fólki, svo sem á vinnutíma.',
      proposed_text: 'Að íslenskukennsla fyrir íbúa af erlendum uppruna sé gjaldfrjáls.',
      rationale: 'Stytting á liðnum til að einfalda hann. Tímasetn kennslu er útfærsluatriði sem ekki þarf að tilgreina í stefnunni.',
      submitted_at: new Date(Date.now() - 300000).toISOString(),
      voting_order: 1,
      has_voted: false
    },
    {
      id: 'amendment-002',
      section_id: 'section-4',
      section_heading: 'Liður 4',
      original_text: 'Að útlendingastofnun í núverandi mynd verði lögð niður og í hennar stað verði sett á laggirnar miðstöð sem heyrir undir ráðuneyti fólks af erlendum uppruna. Hún byggi á mannréttindum og mannúð, með djúpum skilningi á heimsvaldastefnu.',
      proposed_text: 'Að útlendingastofnun verði endurskipulögð og í hennar stað verði sett á laggirnar miðstöð sem heyrir undir ráðuneyti fólks af erlendum uppruna. Hún byggi á mannréttindum og mannúð, með djúpum skilningi á heimsvaldastefnu.',
      rationale: 'Breyta "lögð niður" í "endurskipulögð" til að vera nákvæmari um að þjónustan heldur áfram en í nýrri mynd.',
      submitted_at: new Date(Date.now() - 240000).toISOString(),
      voting_order: 2,
      has_voted: false
    }
  ],
  
  final_vote: {
    question: 'Samþykkja endanlega stefnu með samþykktum breytingum?',
    has_voted: false
  }
};

/**
 * Simulate network delay
 */
async function delay(ms = 500) {
  return new Promise(resolve => setTimeout(resolve, ms + Math.random() * 300));
}

/**
 * Mock Policy Session API
 */
export const PolicySessionAPI = {
  
  /**
   * Get policy session by ID
   */
  async getPolicySession(sessionId) {
    await delay();

    if (sessionId !== MOCK_POLICY_SESSION.id) {
      throw new Error(`Policy session not found: ${sessionId}`);
    }

    // Return deep copy to prevent mutations
    return {
      ...MOCK_POLICY_SESSION,
      policy_draft: { 
        ...MOCK_POLICY_SESSION.policy_draft, 
        sections: MOCK_POLICY_SESSION.policy_draft.sections.map(s => ({ ...s }))
      },
      amendments: MOCK_POLICY_SESSION.amendments.map(a => ({ ...a })),
      final_vote: { ...MOCK_POLICY_SESSION.final_vote }
    };
  },

  /**
   * Submit amendment during break period
   */
  async submitAmendment(sessionId, amendmentData) {
    await delay(600);

    if (sessionId !== MOCK_POLICY_SESSION.id) {
      throw new Error(ERROR_MESSAGES.NOT_FOUND);
    }

    // Validate break period
    const now = Date.now();
    const breakStart = new Date(MOCK_POLICY_SESSION.break_starts_at).getTime();
    const breakEnd = new Date(MOCK_POLICY_SESSION.break_ends_at).getTime();

    if (now < breakStart || now > breakEnd) {
      throw new Error(ERROR_MESSAGES.BREAK_ONLY);
    }

    // Validate required fields
    if (!amendmentData.section_id || !amendmentData.proposed_text) {
      throw new Error(ERROR_MESSAGES.MISSING_FIELDS);
    }

    // Find section
    const section = MOCK_POLICY_SESSION.policy_draft.sections.find(s => s.id === amendmentData.section_id);
    if (!section) {
      throw new Error(ERROR_MESSAGES.INVALID_SECTION);
    }

    // Create new amendment
    const newAmendment = {
      id: `amendment-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      section_id: amendmentData.section_id,
      section_heading: section.heading,
      original_text: section.text,
      proposed_text: amendmentData.proposed_text,
      rationale: amendmentData.rationale || '',
      submitted_at: new Date().toISOString(),
      voting_order: MOCK_POLICY_SESSION.amendments.length + 1,
      has_voted: false
    };

    // Add to session
    MOCK_POLICY_SESSION.amendments.push(newAmendment);

    return {
      success: true,
      message: SUCCESS_MESSAGES.AMENDMENT_SUBMITTED,
      amendment_id: newAmendment.id
    };
  },

  /**
   * Vote on a policy item (original section)
   */
  async voteOnPolicyItem(sessionId, itemId, vote) {
    await delay(500);

    if (sessionId !== MOCK_POLICY_SESSION.id) {
      throw new Error(ERROR_MESSAGES.NOT_FOUND);
    }

    // Find item in sections
    const item = MOCK_POLICY_SESSION.policy_draft.sections.find(s => s.id === itemId);
    
    if (!item) {
      throw new Error(ERROR_MESSAGES.ITEM_NOT_FOUND);
    }

    // Check if already voted
    if (item.has_voted) {
      throw new Error(ERROR_MESSAGES.ALREADY_VOTED);
    }

    // Validate vote
    if (!['yes', 'no'].includes(vote)) {
      throw new Error(ERROR_MESSAGES.INVALID_VOTE);
    }

    // Record vote
    item.has_voted = true;

    return {
      success: true,
      message: SUCCESS_MESSAGES.VOTE_RECORDED,
      item_id: itemId,
      vote: vote
    };
  },

  /**
   * Vote on amendment (Yes/No)
   */
  async voteOnAmendment(sessionId, amendmentId, vote) {
    await delay(600);

    if (sessionId !== MOCK_POLICY_SESSION.id) {
      throw new Error(ERROR_MESSAGES.NOT_FOUND);
    }

    // Validate voting period
    if (MOCK_POLICY_SESSION.status !== 'voting') {
      throw new Error(ERROR_MESSAGES.VOTING_ONLY);
    }

    const amendment = MOCK_POLICY_SESSION.amendments.find(a => a.id === amendmentId);

    if (!amendment) {
      throw new Error(ERROR_MESSAGES.AMENDMENT_NOT_FOUND);
    }

    // Prevent double voting
    if (amendment.has_voted) {
      throw new Error(ERROR_MESSAGES.ALREADY_VOTED);
    }

    // Validate vote value
    if (vote !== 'yes' && vote !== 'no') {
      throw new Error(ERROR_MESSAGES.INVALID_VOTE);
    }

    // Mark as voted
    amendment.has_voted = true;

    return {
      success: true,
      message: SUCCESS_MESSAGES.VOTE_RECORDED,
      vote_id: `vote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  },

  /**
   * Vote on final policy (Yes/No/Abstain)
   */
  async voteOnFinalPolicy(sessionId, vote) {
    await delay(600);

    if (sessionId !== MOCK_POLICY_SESSION.id) {
      throw new Error(ERROR_MESSAGES.NOT_FOUND);
    }

    // Validate voting period
    if (MOCK_POLICY_SESSION.status !== 'voting') {
      throw new Error(ERROR_MESSAGES.VOTING_ONLY);
    }

    // Prevent double voting
    if (MOCK_POLICY_SESSION.final_vote.has_voted) {
      throw new Error(ERROR_MESSAGES.ALREADY_VOTED);
    }

    // Validate vote value
    if (vote !== 'yes' && vote !== 'no' && vote !== 'abstain') {
      throw new Error(ERROR_MESSAGES.INVALID_FINAL_VOTE);
    }

    // Mark as voted
    MOCK_POLICY_SESSION.final_vote.has_voted = true;

    return {
      success: true,
      message: SUCCESS_MESSAGES.VOTE_RECORDED,
      vote_id: `vote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  },

  /**
   * Get policy session results
   */
  async getPolicyResults(sessionId) {
    await delay();

    if (sessionId !== MOCK_POLICY_SESSION.id) {
      throw new Error(ERROR_MESSAGES.NOT_FOUND);
    }

    // Mock aggregated results
    return {
      session_id: sessionId,
      total_participants: 9, // Málefnastjórn has 9 primary members
      
      amendment_results: MOCK_POLICY_SESSION.amendments.map((amendment) => ({
        amendment_id: amendment.id,
        voting_order: amendment.voting_order,
        section_heading: amendment.section_heading,
        yes_votes: Math.floor(Math.random() * 6) + 2, // 2-7 yes votes
        no_votes: Math.floor(Math.random() * 4) + 1,  // 1-4 no votes
        accepted: Math.random() > 0.3 // 70% acceptance rate for realism
      })),
      
      final_policy_results: {
        yes_votes: Math.floor(Math.random() * 5) + 4,   // 4-8 yes votes
        no_votes: Math.floor(Math.random() * 2),        // 0-1 no votes
        abstain_votes: Math.floor(Math.random() * 2),   // 0-1 abstentions
        approved: Math.random() > 0.2 // 80% approval rate
      }
    };
  }
};

export default PolicySessionAPI;
