# xj-site Integration with Ekklesia

Skjölun um hvernig xj-site (Next.js frontend) tengist Ekklesia backend.

**Uppfært:** 2026-01-19

---

## Núverandi Integration

### Skráning (`/skraning`)

xj-site notar Ekklesia til að skrá nýja félaga:

```
/skraning           → Landing page með "Auðkenna" takka
/skraning/callback  → OAuth callback frá kenni.is
/skraning/form      → Skráningarform (3 skref)
/skraning/takk      → Staðfestingarsíða
```

**Ekklesia þjónustur notaðar:**

| Þjónusta | Tilgangur |
|----------|-----------|
| `handleKenniAuth` | OAuth token exchange |
| `register_member` | Skrá nýjan félaga |
| `list_unions` | Stéttarfélög dropdown |
| `list_job_titles` | Starfsheiti dropdown |
| `search_addresses` | Heimilisfang autocomplete |

### Firebase Config

xj-site og Ekklesia deila sama Firebase project:

```env
# .env.local (xj-site/next/)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ekklesia-prod-10-2025.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ekklesia-prod-10-2025
```

---

## Ekki enn útfært

### 1. Mínar síður (`/minar-sidur`)

Félagar geta:
- Skoðað prófíl
- Breytt netfangi, síma, heimilisfangi
- Séð félagsaðild og sögu
- Sagt sig úr flokknum

**Ekklesia functions:**
- `getMemberSelf` - Sækja eigin gögn
- `updatememberprofile` - Uppfæra prófíl
- `softDeleteSelf` - Segja sig úr
- `reactivateSelf` - Endurvirkja aðild

> **Athugið:** `getEmailPreferences` og `updateEmailPreferences` eru **admin-scoped**.
> Fyrir member-scoped email preferences þarf að útfæra nýja function eða breyta
> scope á núverandi functions.

### 2. Kosningar (`/kosningar`)

Félagar geta:
- Séð opnar kosningar
- Greitt atkvæði
- Skoðað niðurstöður

**Ekklesia services:**
- `elections-service` Cloud Run

### 3. Spjallbot

Félagar geta:
- Spurt um flokkinn (party-wiki)
- Fengið aðstoð (member-assistant með RAG og web search)

**Ekklesia services:**
- `events-service` Cloud Run
  - `POST /api/member-assistant/chat` - RAG spjallbot
  - `POST /api/party-wiki` - Wikipedia spjallbot

---

## Technical Requirements

### CORS

Ekklesia þarf að leyfa þessar origins:

```javascript
// handleKenniAuth
const ALLOWED_ORIGINS = [
  'http://localhost:3000',           // Development
  'https://sosialistaflokkurinn.is', // Production
  'https://xj.is',                   // Alternative domain
];
```

### Environment Variables (xj-site)

```env
# Firebase Auth
NEXT_PUBLIC_FIREBASE_API_KEY=<from-firebase-console>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ekklesia-prod-10-2025.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ekklesia-prod-10-2025

# Kenni.is OAuth
NEXT_PUBLIC_KENNI_ISSUER_URL=https://idp.kenni.is/sosi-kosningakerfi.is
NEXT_PUBLIC_KENNI_CLIENT_ID=@sosi-kosningakerfi.is/rafr-nt-kosningakerfi-s-s
NEXT_PUBLIC_KENNI_AUTH_HANDLER_URL=https://handlekenniauth-[...].europe-west2.run.app

# Ekklesia Functions
NEXT_PUBLIC_EKKLESIA_FUNCTIONS_URL=https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net

# Elections Service (optional - for /kosningar)
NEXT_PUBLIC_ELECTIONS_SERVICE_URL=https://elections-service-[...].europe-west1.run.app

# Events Service (optional - for chatbot)
NEXT_PUBLIC_EVENTS_SERVICE_URL=https://events-service-[...].europe-west1.run.app
```

### Firebase SDK Setup (Next.js)

```typescript
// lib/firebase.ts
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

export const app = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

export const auth = getAuth(app);
export const functions = getFunctions(app, 'europe-west2');
```

### API Client Example

```typescript
// lib/ekklesia.ts
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

// Public API (no auth)
export async function listUnions() {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_EKKLESIA_FUNCTIONS_URL}/list_unions`
  );
  return res.json();
}

// Member API (Firebase on_call)
export const getMemberSelf = httpsCallable(functions, 'getMemberSelf');
export const updateProfile = httpsCallable(functions, 'updatememberprofile');
export const softDeleteSelf = httpsCallable(functions, 'softDeleteSelf');
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           xj-site (Next.js)                         │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────────────┐  │
│  │ /skraning│  │/kosningar│  │/minar-sidur│ │ /spjallbot        │  │
│  │ (exists) │  │(planned) │  │ (planned)  │ │ (planned)         │  │
│  └────┬─────┘  └────┬─────┘  └─────┬──────┘ └─────────┬─────────┘  │
│       │             │              │                   │           │
└───────┼─────────────┼──────────────┼───────────────────┼───────────┘
        │             │              │                   │
        ▼             ▼              ▼                   ▼
┌───────────────┐ ┌──────────┐ ┌───────────────┐ ┌──────────────┐
│handleKenniAuth│ │elections │ │ Firebase      │ │events-service│
│register_member│ │-service  │ │ Functions     │ │(Cloud Run)   │
│list_unions    │ │(Cloud    │ │ getMemberSelf │ │member-asst.  │
│search_address │ │ Run)     │ │ updateProfile │ │party-wiki    │
└───────────────┘ └──────────┘ └───────────────┘ └──────────────┘
        │             │              │                   │
        └─────────────┴──────────────┴───────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │    Cloud SQL      │
                    │   PostgreSQL      │
                    │ (members, votes)  │
                    └───────────────────┘
```

---

## See Also

- [SHARED_SERVICES.md](./SHARED_SERVICES.md) - Full list of Ekklesia services
- [MINAR_SIDUR_PLAN.md](./MINAR_SIDUR_PLAN.md) - Implementation plan for "Mínar síður"
