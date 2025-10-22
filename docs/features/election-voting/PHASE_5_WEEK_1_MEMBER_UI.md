# Phase 5 Week 1 Implementation Plan - Epic #87

**Epic**: Member Election Discovery & Voting Interface (#87)
**Branch**: `feature/epic-87-election-discovery`
**Duration**: 1 week (5 business days), starts **Week 2 (after Epic #24 & #43 foundation)**
**Status**: 🟡 Preparation Phase
**Target**: Complete UI structure and API integration framework by end of Week 1

---

## Week 1 Overview: Preparation

**Important**: Epic #87 **starts Week 2**, not Week 1.

- **Week 1 (Oct 28-Nov 1)**: Epics #24 & #43 build foundation
- **Week 2 (Nov 4-8)**: Epic #87 starts, using APIs from #24 & #43

### Week 1 Tasks for Epic #87 (Preparation)

1. **UI Design & Mockups** - Create visual designs
2. **Component Architecture** - Plan component structure
3. **API Integration Plan** - Document how UI calls backend APIs
4. **Environment Setup** - Prepare development environment
5. **Test Strategy** - Plan testing approach

By end of Week 1:
- ✅ UI mockups completed
- ✅ Component structure designed
- ✅ API integration documented
- ✅ Development environment ready
- ✅ Ready to implement Week 2

---

## UI/UX Design

### Pages Required

#### 1. Elections List Page
**Route**: `/elections`
**Purpose**: Show all elections member can vote in

**Layout**:
```
┌─────────────────────────────────────────┐
│  Ekklesia | Member Dashboard            │
├─────────────────────────────────────────┤
│                                         │
│  My Elections                          │
│  ─────────────────                     │
│                                         │
│  [ Active (2) ]  [ Past (5) ]  [ All ] │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ 📊 Annual Membership Vote        │  │
│  │                                  │  │
│  │ Voting: Oct 28 - Nov 1           │  │
│  │ Status: Open - Vote Now →        │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ 📋 Board Member Election 2026    │  │
│  │                                  │  │
│  │ Voting: Nov 4 - Nov 8            │  │
│  │ Status: Upcoming (2 days)        │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │ ✓ Policy Ratification            │  │
│  │                                  │  │
│  │ Voting: Oct 1 - Oct 15           │  │
│  │ Status: Closed - Results posted  │  │
│  └──────────────────────────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

**Components**:
- `ElectionsList` - Main container
- `ElectionCard` - Individual election summary
- `StatusBadge` - Visual status indicator (Open, Upcoming, Closed, Results)
- `CountdownTimer` - Show time remaining
- `ElectionFilter` - Filter by status

#### 2. Election Detail & Voting Page
**Route**: `/elections/:id`
**Purpose**: Show election details and voting form

**Layout**:
```
┌─────────────────────────────────────────┐
│  Annual Membership Vote | ← Back         │
├─────────────────────────────────────────┤
│                                         │
│  Question: Who should be president?    │
│                                         │
│  Voting closes in: 2 days, 5 hours     │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ◯ Alice Johnson                 │   │
│  │   Co-founder, 15 years exp      │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ◯ Bob Smith                     │   │
│  │   Treasurer, 8 years exp        │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ ◯ Charlie Brown                 │   │
│  │   Secretary, 3 years exp        │   │
│  └─────────────────────────────────┘   │
│                                         │
│          [ Cast Vote ] [ Cancel ]      │
│                                         │
└─────────────────────────────────────────┘
```

**Components**:
- `ElectionDetail` - Main container
- `Question` - Question text and context
- `VoteOption` - Individual voting option
- `VoteForm` - Form for casting vote
- `ConfirmationDialog` - Confirm vote before submitting
- `CountdownTimer` - Time remaining

#### 3. Results Page
**Route**: `/elections/:id/results`
**Purpose**: Show election results after voting closes

**Layout**:
```
┌─────────────────────────────────────────┐
│  Annual Membership Vote Results         │
├─────────────────────────────────────────┤
│                                         │
│  Question: Who should be president?    │
│                                         │
│  Voting closed: Oct 29, 2025            │
│  Total votes: 145 of 200 eligible      │
│  Participation: 72.5%                  │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Alice Johnson          ███ 45%   │   │
│  │ (65 votes)                      │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Bob Smith              ███ 35%   │   │
│  │ (51 votes)                      │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Charlie Brown          █ 20%    │   │
│  │ (29 votes)                      │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

**Components**:
- `ResultsDetail` - Main container
- `ResultsSummary` - Vote counts and participation
- `ResultBar` - Visual vote distribution
- `VoteBreakdown` - Detailed vote counts

---

## Component Architecture

### Folder Structure
```
services/members/src/
├── pages/
│   ├── ElectionsPage.js         # /elections list
│   ├── ElectionDetailPage.js    # /elections/:id
│   └── ResultsPage.js           # /elections/:id/results
│
├── components/
│   ├── elections/
│   │   ├── ElectionsList.js     # Container for list
│   │   ├── ElectionCard.js      # Individual card
│   │   ├── ElectionFilter.js    # Filter controls
│   │   ├── StatusBadge.js       # Status indicator
│   │   └── CountdownTimer.js    # Time remaining
│   │
│   ├── voting/
│   │   ├── VoteForm.js          # Vote submission form
│   │   ├── VoteOption.js        # Individual option
│   │   ├── ConfirmDialog.js     # Confirmation dialog
│   │   └── VotingInstructions.js# How to vote guide
│   │
│   └── results/
│       ├── ResultsDetail.js     # Results container
│       ├── ResultsSummary.js    # Summary stats
│       ├── ResultBar.js         # Vote distribution bar
│       └── ParticipationChart.js# Participation metrics
│
├── api/
│   ├── electionsApi.js          # API client for elections
│   ├── votingApi.js             # API client for voting
│   └── resultsApi.js            # API client for results
│
├── hooks/
│   ├── useElections.js          # Fetch elections list
│   ├── useElectionDetail.js     # Fetch election detail
│   ├── useVoting.js             # Submit vote
│   ├── useResults.js            # Fetch results
│   └── useCountdown.js          # Countdown timer
│
├── store/
│   ├── electionsSlice.js        # Redux: elections state
│   ├── votingSlice.js           # Redux: voting state
│   └── resultsSlice.js          # Redux: results state
│
└── styles/
    ├── elections.css            # Elections list styles
    ├── voting.css               # Voting form styles
    └── results.css              # Results styles
```

### Component Hierarchy
```
App
├── ElectionsPage (route: /elections)
│   ├── ElectionsList
│   │   ├── ElectionFilter
│   │   └── ElectionCard[] (mapped)
│   │       ├── StatusBadge
│   │       └── CountdownTimer
│
├── ElectionDetailPage (route: /elections/:id)
│   ├── ElectionDetail
│   │   ├── Question
│   │   ├── CountdownTimer
│   │   ├── VotingInstructions
│   │   └── VoteForm
│   │       └── VoteOption[]
│   └── ConfirmDialog
│
└── ResultsPage (route: /elections/:id/results)
    └── ResultsDetail
        ├── ResultsSummary
        ├── ResultBar[]
        └── ParticipationChart
```

---

## API Integration Points

### Elections List API
```javascript
// GET /api/elections?status=active&limit=10

// Response:
{
  "elections": [
    {
      "id": 1,
      "title": "Annual Membership Vote",
      "description": "Annual leadership election",
      "status": "open",
      "question": "Who should be president?",
      "voting_start_time": "2025-10-28T00:00:00Z",
      "voting_end_time": "2025-11-01T23:59:59Z",
      "created_at": "2025-10-20T10:00:00Z"
    }
  ],
  "total": 15,
  "page": 1
}

// Call from useElections hook:
const { elections, loading, error } = useElections({
  status: 'active',
  limit: 10
});
```

### Election Detail API
```javascript
// GET /api/elections/:id

// Response:
{
  "election": {
    "id": 1,
    "title": "Annual Membership Vote",
    "description": "Vote for our leadership...",
    "status": "open",
    "question": "Who should be president?",
    "answers": [
      { "id": 1, "text": "Alice Johnson" },
      { "id": 2, "text": "Bob Smith" },
      { "id": 3, "text": "Charlie Brown" }
    ],
    "voting_start_time": "2025-10-28T00:00:00Z",
    "voting_end_time": "2025-11-01T23:59:59Z",
    "has_voted": false,  // Did I vote?
    "vote_id": null      // My vote ID if voted
  }
}
```

### Submit Vote API
```javascript
// POST /api/elections/:id/vote
// Body: { "answer_id": 1, "token": "unique-voting-token" }

// Response:
{
  "success": true,
  "message": "Vote cast successfully",
  "vote_id": "vote-uuid-123",
  "confirmation_number": "CONF-2025-1001"
}

// Call from useVoting hook:
const { submitVote, loading } = useVoting(electionId);
await submitVote({ answerId: 1 });
```

### Results API
```javascript
// GET /api/elections/:id/results

// Response:
{
  "election": {
    "id": 1,
    "title": "Annual Membership Vote",
    "status": "closed",
    "question": "Who should be president?"
  },
  "results": {
    "answers": [
      {
        "id": 1,
        "text": "Alice Johnson",
        "votes": 65,
        "percentage": 45.1
      },
      {
        "id": 2,
        "text": "Bob Smith",
        "votes": 51,
        "percentage": 35.2
      },
      {
        "id": 3,
        "text": "Charlie Brown",
        "votes": 29,
        "percentage": 20.1
      }
    ],
    "total_votes": 145,
    "eligible_members": 200,
    "participation_rate": 72.5,
    "voting_closed_at": "2025-11-01T23:59:59Z"
  }
}
```

---

## Tech Stack

### Frontend
- **Framework**: React 18+ (already in Members service)
- **State Management**: Redux Toolkit (existing)
- **API Client**: Axios (existing)
- **Styling**: CSS Modules or Tailwind
- **Forms**: React Hook Form
- **HTTP Calls**: Custom hooks + SWR/React Query for caching

### Backend Integration
- **Elections Service**: REST API at `https://events-prod.../api`
- **Auth**: Firebase ID token in `Authorization` header
- **Error Handling**: Consistent error responses with error codes

---

## Development Timeline

### Week 1 (Prep): Oct 28 - Nov 1
- **Mon-Tue**: UI Design & Mockups (with design lead)
- **Wed**: Component Architecture planning
- **Thu**: API Integration planning
- **Fri**: Environment setup & sprint close

### Week 2 (Implementation): Nov 4-8
- **Mon-Tue**: Build elections list page
- **Wed-Thu**: Build voting page + form
- **Fri**: Testing + integration with Epic #24 APIs

### Week 3 (Integration): Nov 11-15
- **Mon-Tue**: Build results page
- **Wed-Thu**: Error handling + edge cases
- **Fri**: Load testing + performance optimization

### Week 4 (Polish): Nov 18-22
- **Mon-Tue**: Mobile responsiveness
- **Wed-Thu**: Accessibility (a11y)
- **Fri**: Documentation + sprint close

---

## API Dependencies

### Requires from Epic #24 (Admin API)

**By Week 2 start, Epic #24 must provide**:
1. ✅ `GET /api/elections` - List elections
   - Member-facing endpoint (not admin-only)
   - Filter by status: active, upcoming, closed
   - Include voting period times

2. ✅ `GET /api/elections/:id` - Get election detail
   - Include question and answer options
   - Include voting period info
   - Check if member already voted

3. ✅ `POST /api/elections/:id/vote` - Submit vote
   - Accept voting token
   - Require member authentication
   - Return vote confirmation

4. ✅ `GET /api/elections/:id/results` - Get results
   - Return vote counts by answer
   - Calculate percentages
   - Show participation rate

### Requires from Epic #43 (Membership Sync)

**By Week 2 start, Epic #43 must provide**:
1. Member eligibility data
   - Which elections can I vote in?
   - Am I eligible?

---

## Success Criteria

### Week 1 (Preparation) Checklist

**Design** ✅
- [ ] UI mockups created (Figma/Sketch)
- [ ] All 3 pages designed
- [ ] Desktop + mobile layouts
- [ ] Accessibility considered (color contrast, font sizes)
- [ ] Design approved by UX lead

**Architecture** ✅
- [ ] Component structure documented
- [ ] Folder structure created
- [ ] Component hierarchy diagram created
- [ ] State management plan documented

**API Planning** ✅
- [ ] API endpoints documented
- [ ] Request/response formats defined
- [ ] Error handling plan created
- [ ] Dependency list documented

**Environment** ✅
- [ ] Dev environment set up
- [ ] Dependencies installed
- [ ] Build process working
- [ ] Hot reload enabled

**Team Readiness** ✅
- [ ] Team briefed on design
- [ ] Architecture explained
- [ ] Dependencies clarified
- [ ] Timeline reviewed

---

## Testing Strategy (Week 2+)

### Unit Tests
- Component rendering
- Props validation
- Event handlers
- Conditional rendering

### Integration Tests
- API calls work
- Data flows through components
- State updates correctly
- Errors handled gracefully

### E2E Tests
- User can view elections
- User can vote
- User can see results
- Can handle concurrent votes

### Manual Testing
- Mobile responsiveness
- Accessibility features
- Network error scenarios
- Slow network conditions

---

## Accessibility Requirements

### WCAG 2.1 AA Compliance
- [ ] Keyboard navigation for all elements
- [ ] Screen reader support (ARIA labels)
- [ ] Color contrast ratios met (4.5:1 for text)
- [ ] Font size minimum 16px
- [ ] Touch targets minimum 48px × 48px
- [ ] Focus indicators visible
- [ ] Alternative text for images

### Testing Tools
- axe DevTools (automated)
- WAVE (accessibility audit)
- Screen readers (NVDA, JAWS)
- Keyboard-only navigation test

---

## Responsive Design

### Breakpoints
- **Mobile**: 320px - 480px
- **Tablet**: 481px - 768px
- **Desktop**: 769px+

### Mobile Optimizations
- Touch-friendly buttons (48px)
- Stacked layout on small screens
- Single-column for vote options
- Simplified navigation

### Desktop Enhancements
- Multi-column layouts
- Hover effects
- Sidebar navigation
- Larger fonts

---

## Dependency Resolution Strategy

**Issue**: Epic #87 depends on #24 & #43 APIs
**Solution**: Mock APIs during Week 1 development

```javascript
// File: services/members/src/api/__mocks__/electionsApi.js

// Mock elections API for Week 1 development
const mockElections = [
  {
    id: 1,
    title: "Annual Membership Vote",
    status: "open",
    question: "Who should be president?",
    answers: [
      { id: 1, text: "Alice Johnson" },
      { id: 2, text: "Bob Smith" }
    ]
  }
];

export const getElections = async () => mockElections;
export const getElectionDetail = async (id) => mockElections[0];

// By Week 2, replace mock with real API calls
```

---

## Week 1 Deliverables

**Design**:
- [ ] Figma/Sketch file with all mockups
- [ ] Design system documentation
- [ ] Component storybook examples

**Code**:
- [ ] Component structure created
- [ ] Folder structure set up
- [ ] Mock API created
- [ ] Basic routing set up

**Documentation**:
- [ ] API integration guide
- [ ] Component props documentation
- [ ] Development setup guide
- [ ] Week 2 implementation plan

**Team**:
- [ ] Design kickoff completed
- [ ] Team understands architecture
- [ ] Ready to implement Week 2

---

## Next Steps (Week 2)

**Monday Week 2**: Start implementing elections list page
- Components not yet built
- Mock APIs used for development
- Ready to integrate with real Epic #24 APIs by mid-week

---

**Epic Status**: 🟡 Week 1 Preparation Ready to Start
**Last Updated**: 2025-10-22
**Branch**: `feature/epic-87-election-discovery`
