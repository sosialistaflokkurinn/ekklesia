# Epic #87: Member Election Discovery & Voting Interface

**Epic ID**: #87
**Status**: 🟡 In Planning
**Target Release**: Phase 5 (November 2025)
**Priority**: HIGH (Primary member-facing feature)

---

## Overview

Epic #87 implements the member-facing election discovery interface and voting experience. Members can view all active elections they're eligible to vote in, see election details, participate in voting, and view results.

## Problem Statement

Currently, members can authenticate but have:
- ❌ **No way to find elections**
- ❌ **No way to view election details**
- ❌ **No way to vote**
- ❌ **No way to see results**

This epic creates the complete member voting experience.

---

## Goals

### Primary Goals
1. **Election Discovery** - List all eligible elections for member
2. **Election Details** - Show questions, voting period, eligibility
3. **Voting Interface** - Simple UI for casting ballot
4. **Results Viewing** - Display results after voting closes
5. **Responsive Design** - Works on mobile and desktop

### Secondary Goals
1. **Election Notifications** - Notify members when voting opens
2. **Vote Confirmation** - Show confirmation after vote cast
3. **Voting History** - Show past elections member participated in
4. **Accessibility** - WCAG 2.1 AA compliance

### Nice to Have (Phase 5.5+)
1. **Real-time Results** - Live vote count during voting
2. **Election Recommendations** - Suggest relevant elections
3. **Accessibility Features** - Screen reader optimized
4. **Internationalization** - Multiple languages (i18n already done)

---

## Acceptance Criteria

### Must Have (MVP)
- [ ] Member can view all eligible elections
- [ ] Member can view election details (title, description, questions)
- [ ] Member can see voting period (when voting is open/closed)
- [ ] Member can cast a ballot (one vote per election)
- [ ] Member receives confirmation of vote cast
- [ ] Member can view results after voting closes
- [ ] UI responsive on mobile and desktop
- [ ] Voting works with poor network (some retry logic)

### Should Have (Phase 5)
- [ ] Email notification when election voting opens
- [ ] Show member's voting history
- [ ] Display member eligibility reason
- [ ] Show estimated time remaining to vote
- [ ] Display results with vote counts

### Nice to Have (Phase 5.5+)
- [ ] Real-time results updating
- [ ] Election recommendations
- [ ] Calendar view of upcoming elections
- [ ] Export voting history (CSV)

---

## Technical Specification

### UI Pages & Components

#### 1. Elections List Page
**Path**: `/elections`
**Purpose**: Show all elections member is eligible to vote in

```
Elections List
├── Filter/Sort (Open, Closed, Results)
├── Search (by title/description)
└── Election Cards (Grid or List)
    ├── Election title
    ├── Voting status (Open now / Closed / Results available)
    ├── Remaining time (if open)
    └── View/Vote button
```

#### 2. Election Details Page
**Path**: `/elections/:id`
**Purpose**: Show full election details and voting interface

```
Election Details
├── Header
│   ├── Title
│   ├── Description
│   └── Voting period (start/end time)
├── Questions Section
│   └── For each question:
│       ├── Question text
│       ├── Yes/No/Abstain options
│       └── Selected indicator
├── Actions
│   ├── Cast Vote (if open)
│   ├── View Results (if closed)
│   └── Back to Elections
└── Results Section (if voting closed)
    ├── Vote counts
    ├── Percentages
    └── Pie charts/visualization
```

#### 3. Components
```
<ElectionCard>          - List item showing election summary
<ElectionDetails>       - Full election details and voting UI
<VotingForm>           - Ballot casting form
<ResultsDisplay>        - Results visualization
<VoteConfirmation>     - Success message after vote cast
<LoadingSpinner>        - Loading state
<ErrorBoundary>         - Error handling
```

### API Endpoints (Events Service)

#### Member Election API
```
GET    /api/elections              List eligible elections
GET    /api/elections/:id          Get election details
GET    /api/elections/:id/results  Get election results (if closed)
```

#### Voting API
```
POST   /api/elections/:id/token    Request voting token
GET    /api/elections/:id/status   Check voting status
```

### Frontend Architecture

```
services/members/public/
├── features/
│   ├── elections/                  # NEW: Election discovery & voting
│   │   ├── pages/
│   │   │   ├── elections-list.html
│   │   │   └── election-detail.html
│   │   ├── components/
│   │   │   ├── election-card.js
│   │   │   ├── voting-form.js
│   │   │   ├── results-display.js
│   │   │   └── vote-confirmation.js
│   │   ├── services/
│   │   │   ├── elections-api.js    # API calls
│   │   │   ├── voting-service.js   # Voting logic
│   │   │   └── results-service.js  # Results calculation
│   │   ├── styles/
│   │   │   └── elections.css
│   │   └── elections-main.js       # Entry point
│   ├── auth/                       # Existing
│   ├── profile/                    # Existing
│   └── dashboard/                  # Existing
├── shared/                         # Existing
└── ...
```

### Database Queries

#### Get Eligible Elections for Member
```sql
SELECT e.* FROM elections e
WHERE e.status IN ('open', 'closed')
  AND e.voting_start_time <= NOW()
  AND kennitala_is_member(current_user_kennitala)
ORDER BY e.voting_start_time DESC;
```

#### Get Election Details
```sql
SELECT * FROM elections WHERE id = $1;
```

#### Get Results
```sql
SELECT question_id, answer, COUNT(*) as count
FROM ballots
WHERE election_id = $1
  AND election_status = 'published'
GROUP BY question_id, answer
ORDER BY question_id;
```

### UI/UX Specifications

#### Design System (Uses Existing)
- **Colors**: Socialist red (#CC0000), white, dark gray
- **Typography**: Icelandic fonts (already implemented in i18n)
- **Components**: Uses existing UI utilities (ui/dom.js, ui/nav.js)
- **Layout**: Mobile-first responsive design

#### Election Card
```
┌─────────────────────────────┐
│ Election Title              │ 20px padding
├─────────────────────────────┤
│ Description (2 lines)       │
├─────────────────────────────┤
│ Status: Open (2h remaining) │
│ or Closed                   │
│ or Results Available        │
├─────────────────────────────┤
│ [Vote] [Details] [Results]  │
└─────────────────────────────┘
```

#### Voting Form
```
Question: "Do you agree with proposal?"
○ Yes
○ No
○ Abstain

[Cast Vote] [Cancel]
```

---

## Implementation Plan

### Phase 5a: Frontend Setup (Week 1)
1. **Create UI Structure**
   - Create elections pages (list, detail)
   - Create voting form components
   - Create results visualization component
   - Add styling (CSS, responsive design)

2. **API Integration**
   - Create elections-api.js (GET /api/elections, etc.)
   - Implement token request logic
   - Implement error handling

3. **Navigation**
   - Add elections link to main navigation
   - Add breadcrumbs for navigation
   - Add back button to detail page

### Phase 5b: Voting Logic (Week 2)
1. **Voting Implementation**
   - Voting token request
   - Ballot submission to Elections service
   - Vote confirmation display
   - Error handling and retry logic

2. **Results Display**
   - Fetch results from Elections service
   - Display vote counts and percentages
   - Chart/visualization (pie chart or bar chart)

3. **Member Experience**
   - Loading states
   - Error messages (user-friendly)
   - Confirmation dialogs
   - Vote receipt/confirmation

### Phase 5c: Testing & Optimization (Week 3)
1. **Testing**
   - Unit tests for components
   - Integration tests with Events service
   - Manual testing on mobile/desktop
   - Accessibility testing (WCAG)

2. **Performance**
   - Optimize image loading
   - Lazy load election details
   - Cache API responses
   - Minimize bundle size

### Phase 5d: Documentation (Week 4)
1. **User Documentation**
   - How to find elections guide
   - How to vote guide
   - Troubleshooting guide

2. **Developer Documentation**
   - Component documentation
   - API integration guide
   - Extension points for future features

---

## Related Epics

| Epic | Title | Dependency | Status |
|------|-------|-----------|--------|
| #24 | Admin Election Lifecycle | **Epic #87 depends on #24** | Planned |
| #43 | Membership Sync (Django) | Independent | Planned |
| #88 | Token Generation | **Epic #87 depends on #88** | Planned |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-----------|--------|-----------|
| Poor mobile UX | Medium | High | Early mobile testing, iterate design |
| Network latency on voting | Low | Medium | Implement client-side retry logic |
| Result calculation errors | Low | Critical | Unit tests for result calculation |
| Member sees wrong elections | Very Low | High | Test member eligibility extensively |
| Vote not recorded | Very Low | Critical | Vote confirmation + audit log |

---

## Success Criteria

- [ ] Member can discover all eligible elections
- [ ] Member can view election details and questions
- [ ] Member can cast ballot and receive confirmation
- [ ] Results display correctly after voting closes
- [ ] UI responsive on mobile and desktop
- [ ] All error cases handled gracefully
- [ ] Network failures don't lose vote
- [ ] User testing validates UX is intuitive

---

## Questions for Opus/Team

1. **Results Display Timing**: When should results become visible?
   - Option A: Immediately after voting closes (1 second)
   - Option B: After admin publishes results (manual step)
   - Option C: 24 hours after voting closes (automatic)

2. **Vote Confirmation**: How detailed should confirmation be?
   - Option A: Simple "Your vote has been cast" message
   - Option B: Show selected answer + confirmation button
   - Option C: Transaction ID + voting trail

3. **Member Eligibility**: How to display ineligible elections?
   - Option A: Hide them entirely
   - Option B: Show as "You are not eligible to vote"
   - Option C: Show details why member is ineligible

4. **Results Visualization**: What style preferred?
   - Option A: Simple text (100 yes, 50 no, 25 abstain)
   - Option B: Pie chart
   - Option C: Bar chart
   - Option D: All of above (configurable)

---

## Implementation Checklist

### UI Pages & Components
- [ ] Elections list page (HTML + CSS)
- [ ] Election detail page (HTML + CSS)
- [ ] Election card component
- [ ] Voting form component
- [ ] Results display component
- [ ] Vote confirmation message

### Functionality
- [ ] Fetch elections from API
- [ ] Filter/sort elections
- [ ] Request voting token
- [ ] Submit ballot (POST to Elections service)
- [ ] Display results
- [ ] Handle voting errors
- [ ] Implement retry logic

### Styling & UX
- [ ] Responsive design (mobile, tablet, desktop)
- [ ] Loading states
- [ ] Error messages
- [ ] Confirmation dialogs
- [ ] Accessibility (WCAG 2.1 AA)

### Testing
- [ ] Unit tests for voting logic
- [ ] Integration tests with Events service
- [ ] Mobile responsiveness testing
- [ ] Accessibility testing
- [ ] End-to-end test (discover → vote → results)

### Documentation
- [ ] User guide for members
- [ ] Developer guide for extensions
- [ ] API integration documentation
- [ ] Component API documentation

---

## Timeline

| Week | Milestone | Status |
|------|-----------|--------|
| Week 1 | UI structure + API integration | Planned |
| Week 2 | Voting logic + results display | Planned |
| Week 3 | Testing + performance optimization | Planned |
| Week 4 | Documentation + polish | Planned |

---

## Related Issues

- #51-#62: Member UI components and pages
- #65-#67: Voting validation and error handling
- #68-#70: Results display and visualization
- #88-#92: Token generation and membership sync

---

**Last Updated**: 2025-10-22
**Author**: Phase 5 Planning
**Status**: 🟡 Ready for Implementation
