import { jest } from '@jest/globals';

// Use fake timers to control the session flow, but keep real timers for async/await delays
const START_TIME = new Date('2025-11-08T12:00:00Z').getTime();
jest.useFakeTimers({
  now: START_TIME,
  doNotFake: ['setTimeout', 'clearTimeout', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'nextTick']
});

// Mock the R string loader
jest.unstable_mockModule('../../i18n/strings-loader.js', () => ({
  R: {
    string: (key) => key
  }
}));

describe('PolicySessionAPI Mock', () => {
  let PolicySessionAPI;
  const sessionId = 'policy-session-001';

  beforeAll(async () => {
    // Import the module AFTER setting up mocks and timers
    const module = await import('./policy-session-api-mock.js');
    PolicySessionAPI = module.PolicySessionAPI;
  });

  test('getPolicySession returns session data', async () => {
    const session = await PolicySessionAPI.getPolicySession(sessionId);
    expect(session).toBeDefined();
    expect(session.id).toBe(sessionId);
    expect(session.policy_draft).toBeDefined();
    expect(session.status).toBe('discussion'); // Initial status
  });

  test('submitAmendment adds an amendment during break', async () => {
    // Advance time to break period (Start + 1.5 hours)
    // Break is from T+1h to T+2h
    jest.setSystemTime(START_TIME + 1.5 * 60 * 60 * 1000);

    const amendmentData = {
      section_id: 'section-1',
      proposed_text: 'New text for section 1',
      rationale: 'Better wording'
    };

    const result = await PolicySessionAPI.submitAmendment(sessionId, amendmentData);
    expect(result.success).toBe(true);
    expect(result.amendment_id).toBeDefined();

    // Verify it was added
    const session = await PolicySessionAPI.getPolicySession(sessionId);
    expect(session.status).toBe('break');
    const added = session.amendments.find(a => a.id === result.amendment_id);
    expect(added).toBeDefined();
    expect(added.proposed_text).toBe(amendmentData.proposed_text);
  });

  test('voteOnAmendment records a vote during voting', async () => {
    // Advance time to voting period (Start + 2.5 hours)
    // Voting is from T+2h to T+4h
    jest.setSystemTime(START_TIME + 2.5 * 60 * 60 * 1000);

    // Get an amendment to vote on
    const session = await PolicySessionAPI.getPolicySession(sessionId);
    expect(session.status).toBe('voting');
    const amendmentId = session.amendments[0].id;

    const result = await PolicySessionAPI.voteOnAmendment(sessionId, amendmentId, 'yes');
    expect(result.success).toBe(true);
    expect(result.vote_id).toBeDefined();
  });

  test('voteOnPolicyItem records a vote', async () => {
    // Voting on policy items should be allowed (assuming it's allowed during voting or always?)
    // The mock implementation of voteOnPolicyItem doesn't check status, so it should work.
    
    const sectionId = 'section-1';
    const result = await PolicySessionAPI.voteOnPolicyItem(sessionId, sectionId, 'yes');
    expect(result.success).toBe(true);
    expect(result.item_id).toBe(sectionId);
  });

  test('getPolicyResults returns aggregated results', async () => {
    const results = await PolicySessionAPI.getPolicyResults(sessionId);
    expect(results).toBeDefined();
    expect(results.session_id).toBe(sessionId);
    expect(results.amendment_results).toBeDefined();
    expect(results.final_policy_results).toBeDefined();
  });
});
