/**
 * Mock Elections API
 *
 * Provides realistic mock data for testing without backend.
 * Simulates API delays (500-800ms) to mimic real network conditions.
 *
 * Used when USE_MOCK_API = true in elections-api.js
 */

// Mock data: Elections with realistic Icelandic scenarios
const MOCK_ELECTIONS = [
  // Election 1: Active - Formannskosning
  {
    id: 'election-001',
    title: 'Formannskosning Sósíalistaflokksins 2025-2026',
    question: 'Hver á að vera formaður Sósíalistaflokksins á kjörtímabilinu 2025-2026?',
    description: 'Kjör formanns félagsins fyrir komandi ár. Formaður situr í framkvæmdastjórn og hefur áhrif á stefnumótun.',
    status: 'active',
    voting_starts_at: new Date(Date.now() - 86400000).toISOString(), // Started 1 day ago
    voting_ends_at: new Date(Date.now() + 172800000).toISOString(), // Ends in 2 days
    eligibility: 'Öll félagsmenn með virka félagsaðild',
    answers: [
      { id: '001a', text: 'Lára Björnsdóttir', description: 'Núverandi varaformaður, reynsla í verkalýðshreyfingu' },
      { id: '001b', text: 'Sigurður Kristjánsson', description: 'Þingmaður, 8 ára reynsla í stjórnmálum' },
      { id: '001c', text: 'Anna Margrét Jónsdóttir', description: 'Aðstoðarmaður ráðherra, ungir sósíalistar' }
    ],
    has_voted: false,
    type: 'single_choice'
  },

  // Election 2: Upcoming - Varaformannskosning
  {
    id: 'election-002',
    title: 'Kjör varaformanns 2025',
    question: 'Hver á að vera varaformaður Sósíalistaflokksins?',
    description: 'Varaformaður tekur við hlutverkum formanns þegar þess gerist þörf.',
    status: 'upcoming',
    voting_starts_at: new Date(Date.now() + 259200000).toISOString(), // Starts in 3 days
    voting_ends_at: new Date(Date.now() + 604800000).toISOString(), // Ends in 7 days
    eligibility: 'Öll félagsmenn með virka félagsaðild',
    answers: [
      { id: '002a', text: 'Guðmundur Pétursson' },
      { id: '002b', text: 'Elín Sveinsdóttir' }
    ],
    has_voted: false,
    type: 'single_choice'
  },

  // Election 3: Active - Framkvæmdastjórn (multi-choice)
  {
    id: 'election-003',
    title: 'Kjör í framkvæmdastjórn 2025',
    question: 'Veljið allt að 5 fulltrúa í framkvæmdastjórn félagsins',
    description: 'Framkvæmdastjórn ber ábyrgð á daglegum rekstri og framkvæmd stefnu flokksins.',
    status: 'active',
    voting_starts_at: new Date(Date.now() - 43200000).toISOString(), // Started 12 hours ago
    voting_ends_at: new Date(Date.now() + 259200000).toISOString(), // Ends in 3 days
    eligibility: 'Öll félagsmenn með virka félagsaðild',
    answers: [
      { id: '003a', text: 'Kristín Davíðsdóttir', description: 'Hagfræðingur, félagsleg réttlæti' },
      { id: '003b', text: 'Jón Þór Ólafsson', description: 'Umhverfissinni, endurnýjanleg orka' },
      { id: '003c', text: 'Sigrún Magnúsdóttir', description: 'Kennari, menntamál' },
      { id: '003d', text: 'Páll Einarsson', description: 'Hjúkrunarfræðingur, heilbrigðismál' },
      { id: '003e', text: 'María Sigurðardóttir', description: 'Lögfræðingur, mannréttindi' },
      { id: '003f', text: 'Baldur Árnason', description: 'Verkfræðingur, samgöngumál' },
      { id: '003g', text: 'Hrefna Jónsdóttir', description: 'Félagsráðgjafi, félagsleg velferð' }
    ],
    has_voted: false,
    type: 'multi_choice',
    max_choices: 5,
    min_choices: 1
  },

  // Election 4: Closed - Past election with results
  {
    id: 'election-004',
    title: 'Framboð til sveitarstjórnarkosninga Reykjavíkur 2024',
    question: 'Samþykkir þú framboðslista Sósíalistaflokksins til sveitarstjórnarkosninga?',
    description: 'Atkvæðagreiðsla um framboðslista fyrir sveitarstjórnarkosningar í Reykjavík.',
    status: 'closed',
    voting_starts_at: new Date(Date.now() - 2592000000).toISOString(), // 30 days ago
    voting_ends_at: new Date(Date.now() - 2419200000).toISOString(), // 28 days ago
    eligibility: 'Félagsmenn í Reykjavík',
    answers: [
      { id: '004a', text: 'Samþykki' },
      { id: '004b', text: 'Hafna' },
      { id: '004c', text: 'Án álit' }
    ],
    has_voted: true,
    type: 'single_choice'
  },

  // Election 5: Draft - Being prepared
  {
    id: 'election-005',
    title: 'Kjör fulltrúa á þing Sósíalistaflokksins 2025',
    question: 'Veljið allt að 3 fulltrúa frá svæðinu þínu',
    description: 'Kjör fulltrúa á landsþing flokksins sem fer fram í júní 2025.',
    status: 'draft',
    voting_starts_at: new Date(Date.now() + 1209600000).toISOString(), // 14 days from now
    voting_ends_at: new Date(Date.now() + 1814400000).toISOString(), // 21 days from now
    eligibility: 'Öll félagsmenn',
    answers: [],
    has_voted: false,
    type: 'multi_choice',
    max_choices: 3
  }
];

// Mock results for closed elections
const MOCK_RESULTS = {
  'election-004': {
    election_id: 'election-004',
    title: 'Framboð til sveitarstjórnarkosninga Reykjavíkur 2024',
    total_votes: 247,
    results: [
      { answer_id: '004a', text: 'Samþykki', votes: 198, percentage: 80.16 },
      { answer_id: '004b', text: 'Hafna', votes: 31, percentage: 12.55 },
      { answer_id: '004c', text: 'Án álit', votes: 18, percentage: 7.29 }
    ],
    closed_at: new Date(Date.now() - 2419200000).toISOString()
  }
};

/**
 * Simulate network delay
 */
async function delay(ms = 500) {
  return new Promise(resolve => setTimeout(resolve, ms + Math.random() * 300));
}

/**
 * Mock API Implementation
 */
export const MockElectionsAPI = {

  /**
   * Get list of elections
   */
  async getElections(filters = {}) {
    await delay();

    let elections = [...MOCK_ELECTIONS];

    // Filter by status if provided
    if (filters.status) {
      elections = elections.filter(e => e.status === filters.status);
    }

    return elections;
  },

  /**
   * Get single election by ID
   */
  async getElectionById(electionId) {
    await delay();

    const election = MOCK_ELECTIONS.find(e => e.id === electionId);

    if (!election) {
      throw new Error(`Election not found: ${electionId}`);
    }

    // Return a copy to avoid mutations
    return { ...election };
  },

  /**
   * Submit a vote (with validation)
   */
  async submitVote(electionId, answerId) {
    await delay(600);

    const election = MOCK_ELECTIONS.find(e => e.id === electionId);

    if (!election) {
      throw new Error(`Election not found: ${electionId}`);
    }

    // Prevent voting in closed elections
    if (election.status === 'closed') {
      throw new Error('Cannot vote in closed election');
    }

    // Prevent voting in upcoming elections
    if (election.status === 'upcoming') {
      throw new Error('Election has not opened for voting yet');
    }

    // Prevent double voting
    if (election.has_voted) {
      throw new Error('You have already voted in this election');
    }

    // Validate answer exists
    if (!election.answers.find(a => a.id === answerId)) {
      throw new Error(`Invalid answer ID: ${answerId}`);
    }

    // Simulate successful vote submission
    // In real implementation, would call backend API
    election.has_voted = true;

    return {
      success: true,
      message: 'Atkvæði skráð með góðum árangri',
      ballot_id: `ballot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  },

  /**
   * Get election results (only available for closed elections)
   */
  async getResults(electionId) {
    await delay();

    const results = MOCK_RESULTS[electionId];

    if (!results) {
      throw new Error(`Results not available for election: ${electionId}`);
    }

    return results;
  },

  /**
   * Get policy session by ID
   */
  async getPolicySession(sessionId) {
    await delay();

    const session = MOCK_POLICY_SESSIONS.find(s => s.id === sessionId);

    if (!session) {
      throw new Error(`Policy session not found: ${sessionId}`);
    }

    // Return copy to prevent mutations
    return {
      ...session,
      policy_draft: { ...session.policy_draft, sections: [...session.policy_draft.sections] },
      amendments: session.amendments.map(a => ({ ...a })),
      final_vote: { ...session.final_vote }
    };
  },

  /**
   * Submit amendment during break period
   */
  async submitAmendment(sessionId, amendmentData) {
    await delay(600);

    const session = MOCK_POLICY_SESSIONS.find(s => s.id === sessionId);

    if (!session) {
      throw new Error(`Policy session not found: ${sessionId}`);
    }

    // Validate break period
    const now = Date.now();
    const breakStart = new Date(session.break_starts_at).getTime();
    const breakEnd = new Date(session.break_ends_at).getTime();

    if (now < breakStart || now > breakEnd) {
      throw new Error('Amendments can only be submitted during break period');
    }

    // Validate required fields
    if (!amendmentData.section_id || !amendmentData.proposed_text) {
      throw new Error('Missing required fields: section_id, proposed_text');
    }

    // Find section
    const section = session.policy_draft.sections.find(s => s.id === amendmentData.section_id);
    if (!section) {
      throw new Error(`Invalid section ID: ${amendmentData.section_id}`);
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
      voting_order: session.amendments.length + 1,
      has_voted: false
    };

    // Add to session
    session.amendments.push(newAmendment);

    return {
      success: true,
      message: 'Amendment submitted successfully',
      amendment_id: newAmendment.id
    };
  },

  /**
   * Vote on a policy item (original section)
   */
  async voteOnPolicyItem(sessionId, itemId, vote) {
    await delay(500);

    const session = MOCK_POLICY_SESSIONS.find(s => s.id === sessionId);

    if (!session) {
      throw new Error(`Policy session not found: ${sessionId}`);
    }

    // Find item in sections
    const item = session.policy_draft.sections.find(s => s.id === itemId);
    
    if (!item) {
      throw new Error(`Policy item not found: ${itemId}`);
    }

    // Check if already voted
    if (item.has_voted) {
      throw new Error('You have already voted on this item');
    }

    // Validate vote
    if (!['yes', 'no'].includes(vote)) {
      throw new Error('Invalid vote. Must be "yes" or "no"');
    }

    // Record vote
    item.has_voted = true;

    return {
      success: true,
      message: 'Vote recorded successfully',
      item_id: itemId,
      vote: vote
    };
  },

  /**
   * Vote on amendment (Yes/No)
   */
  async voteOnAmendment(sessionId, amendmentId, vote) {
    await delay(600);

    const session = MOCK_POLICY_SESSIONS.find(s => s.id === sessionId);

    if (!session) {
      throw new Error(`Policy session not found: ${sessionId}`);
    }

    // Validate voting period
    if (session.status !== 'voting') {
      throw new Error('Amendment voting is only allowed during voting period');
    }

    const amendment = session.amendments.find(a => a.id === amendmentId);

    if (!amendment) {
      throw new Error(`Amendment not found: ${amendmentId}`);
    }

    // Prevent double voting
    if (amendment.has_voted) {
      throw new Error('You have already voted on this amendment');
    }

    // Validate vote value
    if (vote !== 'yes' && vote !== 'no') {
      throw new Error('Vote must be "yes" or "no"');
    }

    // Mark as voted
    amendment.has_voted = true;

    return {
      success: true,
      message: 'Vote recorded successfully',
      vote_id: `vote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  },

  /**
   * Vote on final policy (Yes/No/Abstain)
   */
  async voteOnFinalPolicy(sessionId, vote) {
    await delay(600);

    const session = MOCK_POLICY_SESSIONS.find(s => s.id === sessionId);

    if (!session) {
      throw new Error(`Policy session not found: ${sessionId}`);
    }

    // Validate voting period
    if (session.status !== 'voting') {
      throw new Error('Final policy voting is only allowed during voting period');
    }

    // Prevent double voting
    if (session.final_vote.has_voted) {
      throw new Error('You have already voted on the final policy');
    }

    // Validate vote value
    if (vote !== 'yes' && vote !== 'no' && vote !== 'abstain') {
      throw new Error('Vote must be "yes", "no", or "abstain"');
    }

    // Mark as voted
    session.final_vote.has_voted = true;

    return {
      success: true,
      message: 'Vote recorded successfully',
      vote_id: `vote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  },

  /**
   * Get policy session results
   */
  async getPolicyResults(sessionId) {
    await delay();

    const session = MOCK_POLICY_SESSIONS.find(s => s.id === sessionId);

    if (!session) {
      throw new Error(`Policy session not found: ${sessionId}`);
    }

    // Mock aggregated results
    return {
      session_id: sessionId,
      total_participants: 9, // Málefnastjórn has 9 primary members
      
      amendment_results: session.amendments.map((amendment, index) => ({
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

export default MockElectionsAPI;
