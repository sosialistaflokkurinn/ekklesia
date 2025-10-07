# Naming Clarification: Vision vs Ekklesia Platform

**Issue**: Confusion about how the original architectural vision maps to Ekklesia platform components
**Created**: 2025-10-07

---

## The Problem

The **original architectural vision** (SYSTEM_ARCHITECTURE_OVERVIEW.md) uses these terms:

- **Members** (`Meðlimir`) - Authentication and member registry
- **Events** (`Atburðir`) - Election administration
- **Elections** (`Kosningar`) - Voting system

The **Ekklesia platform** (open-source) has these components:

- **Ekklesia Portal** - Motion/proposition portal
- **Ekklesia Voting** - Pseudonymous voting

**Question**: How do these map to each other? Did we rename "Events" to "Portal"?

---

## The Answer: No Renaming Happened

We **did NOT rename** anything. We're using the **Ekklesia open-source platform** as-is, which has different terminology than our original vision.

### What Ekklesia Platform Actually Does

From the Ekklesia documentation:

**Ekklesia Portal**:
> "It provides the **motion portal** Web UI, the public API and administrative interface."

- **Purpose**: Manage motions/propositions (policy proposals, initiatives)
- **Features**: Submit proposals, debate, discuss, build consensus
- **NOT about**: Election administration or voting events
- **Think**: Proposition management, not election management

**Ekklesia Voting**:
> "Pseudonymous voting component of the Ekklesia e-democracy platform."

- **Purpose**: Cast votes on propositions/motions
- **Features**: Anonymous ballot casting, vote tallying
- **Integration**: Works with Portal to vote on motions

### The Ekklesia Platform Flow

```
User → Ekklesia Portal → View/Submit Motions → Ekklesia Voting → Cast Vote on Motion
```

This is **NOT** the same as our vision:

```
User → Members → Events (Election Admin) → Elections (Voting) → Cast Vote in Election
```

---

## The Real Mapping

### What We Actually Need

Based on **SYSTEM_ARCHITECTURE_OVERVIEW.md**:

| Vision Component | Purpose | What We Need |
|------------------|---------|--------------|
| **Members** (`Meðlimir`) | Authentication, member registry, permissions | ✅ **Firebase + Kenni.is** (built) |
| **Events** (`Atburðir`) | Election administration, issue voting tokens, manage election lifecycle | ❓ **Not Built Yet** |
| **Elections** (`Kosningar`) | Accept voting tokens, record ballots anonymously | ❓ **Partially matches Ekklesia Voting** |

### What We Have (Ekklesia Platform)

| Component | Purpose | How We're Using It |
|-----------|---------|-------------------|
| **Ekklesia Portal** | Motion/proposition management | 🤔 **Unclear fit** |
| **Ekklesia Voting** | Vote on motions/propositions | 🤔 **Could work for elections?** |

---

## The Confusion Explained

### Why the Confusion Happened

1. **Similar names**: "Portal" sounds like it could manage "events"
2. **Voting component**: Ekklesia Voting handles ballots, which matches vision
3. **Assumed mapping**: We assumed Portal = Events, Voting = Elections

### Why This Might Not Work

**Ekklesia Portal** is designed for:
- **Motions**: Policy proposals, initiatives, propositions
- **Debate**: Discussion threads, comments, amendments
- **Lifecycle**: Draft → Discussion → Vote → Accepted/Rejected

**Our "Events" (`Atburðir`)** needs:
- **Elections**: Officer elections, board votes, referendums
- **Eligibility**: Who can vote (based on membership status, roles)
- **Token Issuance**: Generate one-time voting tokens for eligible members
- **Results**: Fetch results from voting system, display to authorized users

**These are different concepts:**
- **Motion**: "We propose to change party policy on X"
- **Election**: "Who should be party treasurer? Vote for A, B, or C"

---

## Three Possible Paths Forward

### Option 1: Use Ekklesia Platform As-Is (Adapt Vision)

**Approach**: Change our vision to match what Ekklesia Portal does

**Pros**:
- Mature, production-ready platform
- Already deployed (Portal at 503, fixable)
- Rich features (motion management, voting)

**Cons**:
- **Doesn't match original vision** (motions ≠ elections)
- May not support election-specific features (candidate lists, ranked choice, etc.)
- Token issuance model might not match S2S design

**Best for**: If party wants motion-based democracy more than elections

### Option 2: Build Custom "Events" Component (Keep Vision)

**Approach**: Build a custom Events (`Atburðir`) service that matches the vision

**Components**:
- Custom Events service (election administration)
- Ekklesia Voting (use for actual ballot casting)
- Custom integration layer (S2S token issuance)

**Pros**:
- ✅ Matches original architectural vision exactly
- ✅ Designed specifically for elections (not motions)
- ✅ S2S token issuance as designed
- ✅ Eligibility rules customized for party needs

**Cons**:
- Need to build Events service from scratch
- More development time
- Maintenance burden

**Best for**: If original vision is critical requirement

### Option 3: Hybrid Approach (Use Ekklesia + Extend)

**Approach**: Use Ekklesia Portal but extend it for election management

**Modifications**:
- Use Portal for both motions AND elections
- Add election-specific features to Portal
- Extend token issuance for S2S integration
- Customize eligibility rules

**Pros**:
- Leverage existing Ekklesia platform
- Add election-specific features as needed
- Keep mature voting component

**Cons**:
- Requires modifying Ekklesia Portal (fork or contribute upstream)
- Need to understand Ekklesia codebase deeply
- Maintenance overhead for custom changes

**Best for**: Want both motions AND elections in one platform

---

## Questions That Need Answers

1. **What does the party actually need?**
   - Elections (officer elections, board votes)?
   - Motions/propositions (policy decisions)?
   - Both?

2. **Can Ekklesia Portal handle elections?**
   - Need to review Ekklesia Portal features
   - Check if it supports election-style voting (vs motion voting)
   - Verify token issuance model

3. **Is the S2S token design critical?**
   - Original vision: Events → Voting (S2S token issuance)
   - Ekklesia: Portal → Voting (how does it work?)
   - Can we adapt the vision to Ekklesia's model?

4. **What did we deploy Portal for?**
   - Why did we deploy Ekklesia Portal if we need Events?
   - Was this a conscious decision or assumption?
   - What was the reasoning?

---

## Current Deployment Reality

**What's Actually Deployed**:

```
Members (Firebase) → ??? → Portal (503) → ??? → Voting (not deployed)
                      ↑                    ↑
                   UNCLEAR              UNCLEAR
```

**Issues**:
1. Portal is deployed but we haven't verified it matches our needs
2. Integration between Members → Portal is undefined
3. Integration between Portal → Voting is assumed but not designed
4. Original "Events" concept may not exist in current plan

---

## Recommended Next Steps

### Immediate (Before Fixing Portal 503)

1. **Clarify Requirements**
   - Review with party: Do we need elections, motions, or both?
   - Confirm if original vision (SYSTEM_ARCHITECTURE_OVERVIEW.md) is still valid
   - Define what "Events" actually means in practice

2. **Evaluate Ekklesia Portal**
   - Research Ekklesia Portal capabilities
   - Check if it supports election-style voting
   - Review integration model with Voting component
   - Assess if it can handle token issuance as designed

3. **Make Architectural Decision**
   - Option 1: Adapt vision to Ekklesia (motions-based)
   - Option 2: Build custom Events (elections-based)
   - Option 3: Extend Ekklesia (hybrid)

### After Decision

**If Option 1 (Use Ekklesia As-Is)**:
- Fix Portal 503 issue
- Update architectural vision document
- Design Members → Portal integration
- Deploy Voting service

**If Option 2 (Build Custom Events)**:
- Deprecate Portal deployment
- Design custom Events service
- Keep Ekklesia Voting (or build custom)
- Implement S2S token issuance

**If Option 3 (Hybrid)**:
- Fix Portal 503 issue
- Extend Portal for election support
- Customize token issuance
- Deploy Voting service

---

## Key Insight

**We deployed Ekklesia Portal (motions platform) but our vision described Events (election administration).**

**These are NOT the same thing.**

We need to decide:
1. Is our vision still valid?
2. Can Ekklesia Portal satisfy our vision?
3. Or do we need a different approach?

**This is an architectural decision that needs input from party stakeholders.**

---

## References

**Original Vision**:
- [SYSTEM_ARCHITECTURE_OVERVIEW.md](SYSTEM_ARCHITECTURE_OVERVIEW.md) - Original architectural vision

**Ekklesia Platform**:
- [Ekklesia Documentation](https://docs.ekklesiademocracy.org) - Official docs
- [portal/README.md](../portal/README.md) - "Motion portal Web UI"
- [voting/README.md](../voting/README.md) - "Pseudonymous voting component"

**Current Analysis**:
- [VISION_VS_IMPLEMENTATION_ANALYSIS.md](VISION_VS_IMPLEMENTATION_ANALYSIS.md) - Assumed Portal = Events (may be incorrect)

**Deployment Status**:
- [CURRENT_PRODUCTION_STATUS.md](../CURRENT_PRODUCTION_STATUS.md) - Portal deployed but 503
- [portal/DEPLOYMENT.md](../portal/DEPLOYMENT.md) - Portal deployment guide
