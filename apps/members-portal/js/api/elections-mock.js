/**
 * Mock Elections API
 *
 * Provides realistic mock data for testing without backend.
 * Simulates API delays (500-800ms) to mimic real network conditions.
 *
 * Used when USE_MOCK_API = true in elections-api.js
 */

// Mock data: Single sample election
const MOCK_ELECTIONS = [
  // Election 1: Active (can vote now)
  {
    id: '1',
    title: 'Árleg félagsfundarkosning 2025',
    question: 'Hver ætti að vera formaður félagsins?',
    status: 'active',
    voting_starts_at: new Date().toISOString(),
    voting_ends_at: new Date(Date.now() + 3600000).toISOString(),
    answers: [
      { id: '1a', text: 'Alice Johnson' },
      { id: '1b', text: 'Bob Smith' },
      { id: '1c', text: 'Carol Williams' },
      { id: '1d', text: 'David Brown' }
    ],
    has_voted: false
  }
];

// Mock results (empty - no closed elections)
const MOCK_RESULTS = {};

// Mock data: Policy sessions
const MOCK_POLICY_SESSIONS = [
  {
    id: 'policy-session-001',
    title: 'Innflytjendastefna - Vinnuhópur stefnuráðs',
    type: 'policy_session',
    status: 'break', // 'discussion', 'break', 'voting', 'closed'
    
    // Timeline (use same pattern as elections)
    discussion_starts_at: new Date(Date.now() - 3600000).toISOString(),
    break_starts_at: new Date(Date.now() - 600000).toISOString(),
    break_ends_at: new Date(Date.now() + 600000).toISOString(),
    voting_starts_at: new Date(Date.now() + 600000).toISOString(),
    voting_ends_at: new Date(Date.now() + 7200000).toISOString(),
    
    policy_draft: {
      title: 'Innflytjendastefna',
      sections: [
        {
          id: 'section-1',
          heading: 'Kafli 1: Bakgrunnur',
          text: 'Ísland þarf skýra og mannúðlega innflytjendastefnu sem styður við efnahag og mannréttindi.',
          order: 1
        },
        {
          id: 'section-2', 
          heading: 'Kafli 2: Megintillögur',
          text: 'Tillögurnar fela í sér aukin réttindi fyrir innflytjendur og skýrari ferli fyrir ríkisborgararétt.',
          order: 2
        },
        {
          id: 'section-3',
          heading: 'Kafli 3: Framkvæmd',
          text: 'Framkvæmdaráætlun með tímalínu fyrir innleiðingu stefnunnar á næstu 2 árum.',
          order: 3
        }
      ]
    },
    
    amendments: [
      {
        id: 'amendment-001',
        section_id: 'section-1',
        section_heading: 'Kafli 1: Bakgrunnur',
        original_text: 'Ísland þarf skýra og mannúðlega innflytjendastefnu sem styður við efnahag og mannréttindi.',
        proposed_text: 'Ísland þarf skýra, mannúðlega og réttláta innflytjendastefnu sem styður við efnahag, mannréttindi og félagslegt réttlæti.',
        rationale: 'Bæta við "réttláta" og "félagslegt réttlæti" til að undirstrika jafnréttissjónarmið stefnunnar.',
        submitted_at: new Date(Date.now() - 300000).toISOString(),
        voting_order: 1,
        has_voted: false
      },
      {
        id: 'amendment-002',
        section_id: 'section-2',
        section_heading: 'Kafli 2: Megintillögur',
        original_text: 'Tillögurnar fela í sér aukin réttindi fyrir innflytjendur og skýrari ferli fyrir ríkisborgararétt.',
        proposed_text: 'Tillögurnar fela í sér aukin réttindi fyrir innflytjendur, skýrari ferli fyrir ríkisborgararétt og aukinn stuðning við aðlögun.',
        rationale: 'Bæta við stuðningi við aðlögun sem mikilvægum þætti í velgengi innflytjenda.',
        submitted_at: new Date(Date.now() - 240000).toISOString(),
        voting_order: 2,
        has_voted: false
      }
    ],
    
    final_vote: {
      question: 'Samþykkja endanlega stefnu með samþykktum breytingum?',
      has_voted: false
    }
  }
];

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
