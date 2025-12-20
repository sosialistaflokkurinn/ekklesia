/**
 * Single Transferable Vote (STV) Implementation
 * Also known in Icelandic as "Forgangsröðun" or "Persónukjör með valkostum"
 *
 * Implements Scottish STV rules:
 * - Droop quota: floor(total_votes / (seats + 1)) + 1
 * - Gregory method for surplus transfer
 * - Eliminates candidate with fewest votes when no one reaches quota
 *
 * Reference: Used in Iceland's 2010 Constitutional Assembly elections
 */

/**
 * Run STV election calculation
 * @param {Object} options
 * @param {number} options.seatsToFill - Number of seats/winners to elect
 * @param {string[]} options.candidates - Array of candidate IDs
 * @param {Array<{weight: number, preferences: string[]}>} options.votes - Ballots with rankings
 * @param {Function} [options.report] - Callback for round-by-round reporting
 * @returns {{winners: string[]}}
 */
function stv({ seatsToFill, candidates, votes, report = () => {} }) {
  // Security: Input validation to prevent DoS via algorithmic complexity
  const MAX_CANDIDATES = 100;
  const MAX_VOTES = 10000;

  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error('At least one candidate required');
  }
  if (candidates.length > MAX_CANDIDATES) {
    throw new Error(`Maximum ${MAX_CANDIDATES} candidates allowed`);
  }
  if (!Array.isArray(votes)) {
    throw new Error('Votes must be an array');
  }
  if (votes.length > MAX_VOTES) {
    throw new Error(`Maximum ${MAX_VOTES} votes allowed`);
  }
  if (seatsToFill < 1 || seatsToFill > candidates.length) {
    throw new Error('Invalid seats to fill');
  }

  // Initialize vote counts with fractional weights
  const activeCandidates = new Set(candidates);
  const winners = [];

  // Each ballot tracks current weight and position in preferences
  const ballots = votes.map(v => ({
    weight: v.weight || 1,
    preferences: v.preferences.filter(p => candidates.includes(p)),
  }));

  // Calculate Droop quota
  const totalVotes = ballots.reduce((sum, b) => sum + b.weight, 0);
  const quota = Math.floor(totalVotes / (seatsToFill + 1)) + 1;

  report(`Quota: ${quota} (Droop quota from ${totalVotes} votes for ${seatsToFill} seats)`);

  let round = 0;
  const MAX_ROUNDS = candidates.length * 2; // Safety limit

  while (winners.length < seatsToFill && activeCandidates.size > 0 && round < MAX_ROUNDS) {
    round++;
    report(`Round ${round}:`);

    // Count current preferences
    const counts = new Map();
    activeCandidates.forEach(c => counts.set(c, 0));

    for (const ballot of ballots) {
      // Find first preference among active candidates
      const currentPref = ballot.preferences.find(p => activeCandidates.has(p));
      if (currentPref) {
        counts.set(currentPref, counts.get(currentPref) + ballot.weight);
      }
    }

    // Report current standings
    for (const [candidate, count] of counts) {
      report(`  ${candidate}: ${count.toFixed(2)} votes`);
    }

    // Check if any candidate meets quota
    let elected = null;
    let electedVotes = 0;
    for (const [candidate, count] of counts) {
      if (count >= quota) {
        if (!elected || count > electedVotes) {
          elected = candidate;
          electedVotes = count;
        }
      }
    }

    if (elected) {
      // Candidate elected
      winners.push(elected);
      activeCandidates.delete(elected);
      report(`  -> ${elected} elected with ${electedVotes.toFixed(2)} votes (quota: ${quota})`);

      // Transfer surplus votes (Gregory method)
      const surplus = electedVotes - quota;
      if (surplus > 0 && winners.length < seatsToFill) {
        const transferValue = surplus / electedVotes;
        report(`  -> Transferring surplus of ${surplus.toFixed(2)} votes (transfer value: ${transferValue.toFixed(4)})`);

        // Reduce weight of ballots that voted for elected candidate
        for (const ballot of ballots) {
          const currentPref = ballot.preferences.find(p => p === elected);
          if (currentPref) {
            ballot.weight *= transferValue;
          }
        }
      }
    } else if (activeCandidates.size > (seatsToFill - winners.length)) {
      // No one reached quota, eliminate lowest candidate
      let lowestCandidate = null;
      let lowestVotes = Infinity;

      for (const [candidate, count] of counts) {
        if (count < lowestVotes) {
          lowestVotes = count;
          lowestCandidate = candidate;
        }
      }

      if (lowestCandidate) {
        activeCandidates.delete(lowestCandidate);
        report(`  -> ${lowestCandidate} eliminated with ${lowestVotes.toFixed(2)} votes`);
      }
    } else {
      // Remaining candidates fill remaining seats
      for (const candidate of activeCandidates) {
        if (winners.length < seatsToFill) {
          winners.push(candidate);
          report(`  -> ${candidate} elected (remaining seat filled)`);
        }
      }
      activeCandidates.clear();
    }
  }

  report(`Final result: ${winners.length} candidates elected`);

  return { winners };
}

module.exports = { stv };
