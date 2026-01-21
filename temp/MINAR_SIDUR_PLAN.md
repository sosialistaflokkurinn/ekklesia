# Mínar síður - Implementation Plan

Áætlun um að útfæra "Mínar síður" á xj-site (sosialistaflokkurinn.is).

**Uppfært:** 2026-01-19

---

## Yfirlit

"Mínar síður" er svæði þar sem félagar geta:
- Skoðað og breytt prófíl
- Séð félagsaðild og sögu
- Tekið þátt í kosningum
- Spjallað við AI aðstoðarmann

---

## Routes

```
/minar-sidur                   → Yfirlit (dashboard)
/minar-sidur/profill           → Skoða/breyta prófíl
/minar-sidur/stillingar        → Stillingar (notifications, etc.)
/minar-sidur/kosningar         → Listi yfir kosningar
/minar-sidur/kosningar/[id]    → Kjósa í tiltekinni kosningu
/minar-sidur/spjallbot         → AI spjallbot
```

---

## Þarf að útfæra í xj-site

### 1. Firebase Auth Integration

**Skrár:**
```
next/lib/firebase.ts          → Firebase SDK setup
next/lib/auth-context.tsx     → React context fyrir auth state
next/middleware.ts            → Protect /minar-sidur routes
```

**AuthContext:**
```typescript
// lib/auth-context.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';

type AuthContextType = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### 2. Ekklesia API Client

**Skrár:**
```
next/lib/ekklesia/index.ts    → Main exports
next/lib/ekklesia/member.ts   → Member functions
next/lib/ekklesia/elections.ts → Elections API
next/lib/ekklesia/chat.ts     → Chat API
```

**Member API:**
```typescript
// lib/ekklesia/member.ts
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export interface MemberData {
  name: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    postalCode: string;
  };
  union?: string;
  jobTitle?: string;
  joinedAt: string;
  status: 'active' | 'inactive' | 'deleted';
}

export const getMemberSelf = httpsCallable<void, MemberData>(
  functions,
  'getMemberSelf'
);

export const updateMemberProfile = httpsCallable<
  Partial<MemberData>,
  { success: boolean }
>(functions, 'updatememberprofile');

export const softDeleteSelf = httpsCallable<void, { success: boolean }>(
  functions,
  'softDeleteSelf'
);

export const getEmailPreferences = httpsCallable<
  void,
  { marketing: boolean; newsletter: boolean }
>(functions, 'getEmailPreferences');
```

### 3. UI Components

**Skrár:**
```
next/components/minar-sidur/
├── MemberDashboard.tsx       → Main dashboard
├── ProfileForm.tsx           → Edit profile form
├── MembershipCard.tsx        → Membership status card
├── ElectionsList.tsx         → List of elections
├── ElectionVote.tsx          → Voting UI
├── SettingsForm.tsx          → Email/notification settings
└── ChatWidget.tsx            → AI chat widget
```

---

## Ekklesia Functions til að nota

### Tilbúin (þarf ekki breyta)

| Function | Tilgangur |
|----------|-----------|
| `getMemberSelf` | Sækja eigin gögn |
| `updatememberprofile` | Uppfæra prófíl |
| `softDeleteSelf` | Segja sig úr flokknum |
| `reactivateSelf` | Endurvirkja aðild |

> **Athugið um email preferences:**
>
> `getEmailPreferences` og `updateEmailPreferences` eru **admin-scoped**, ekki member-scoped.
> Fyrir "Mínar síður" þurfum við annaðhvort að:
> 1. Búa til nýjar member-scoped functions (`getMemberEmailPreferences`, `updateMemberEmailPreferences`)
> 2. Eða breyta scope á núverandi functions til að leyfa members að sækja eigin preferences

### Elections Service (Cloud Run)

| Endpoint | Tilgangur |
|----------|-----------|
| `GET /api/elections` | Listi yfir kosningar |
| `GET /api/elections/:id` | Nákvæmar upplýsingar |
| `POST /api/elections/:id/vote` | Greiða atkvæði |
| `GET /api/elections/:id/results` | Niðurstöður |

### Events Service (Cloud Run)

| Endpoint | Tilgangur |
|----------|-----------|
| `POST /api/member-assistant/chat` | RAG spjallbot með web search |
| `POST /api/party-wiki` | Wikipedia spjallbot |

---

## Implementation Steps

### Phase 1: Auth & Profile (MVP)

1. **Firebase SDK setup** í xj-site
2. **AuthProvider** React context
3. **Protected routes** middleware
4. **getMemberSelf** integration
5. **Profile view** UI component
6. **Profile edit** form

### Phase 2: Settings & Account

1. **Email preferences** UI
2. **Segja sig úr** flow (softDeleteSelf)
3. **Logout** functionality

### Phase 3: Elections

1. **Elections list** page
2. **Election detail** page
3. **Voting UI** (single choice, multiple choice, ranked)
4. **Results view** (after voting)

### Phase 4: AI Assistant

1. **Chat widget** component
2. **Party wiki** integration
3. **Member assistant** integration (RAG)

---

## Environment Variables

Bæta við í xj-site `.env`:

```env
# Firebase (þegar til fyrir /skraning)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=ekklesia-prod-10-2025.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=ekklesia-prod-10-2025

# Ekklesia Functions
NEXT_PUBLIC_EKKLESIA_FUNCTIONS_URL=https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net

# Elections Service (nýtt)
NEXT_PUBLIC_ELECTIONS_SERVICE_URL=https://elections-service-[...].europe-west1.run.app

# Events Service (nýtt)
NEXT_PUBLIC_EVENTS_SERVICE_URL=https://events-service-[...].europe-west1.run.app
```

---

## CORS Updates (Ekklesia)

Elections service þarf að bæta við:
```javascript
// services/svc-elections/src/config/cors.js
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://sosialistaflokkurinn.is',
  'https://xj.is',
];
```

Events service þarf að bæta við:
```javascript
// services/svc-events/src/config/cors.js
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://sosialistaflokkurinn.is',
  'https://xj.is',
];
```

---

## Styling Conventions (xj-site/next/CLAUDE.md)

**MIKILVÆGT:** Lesa `xj-site/next/CLAUDE.md` áður en byrjað er!

| Tækni | Notkun |
|-------|--------|
| Tailwind CSS v4 | `@theme inline` fyrir CSS variables |
| `tailwind-variants` (`tv`) | **ALLTAF** fyrir component variants |
| React Aria Components | **EKKI** búa til eigin buttons/inputs |
| `cx()` frá `@/lib/primitive` | Fyrir className composition |
| react-hook-form + zod | **ALLTAF** fyrir forms |
| Server Components | Prefer - `"use client"` aðeins þegar nauðsynlegt |

**Brand color:** `--primary` (socialist red: `oklch(0.55 0.22 25)`)

**Component locations:**
- Shared UI: `src/components/ui/`
- Page-specific: `app/minar-sidur/_components/`

---

## Testing Plan

### Unit Tests
- Auth context
- API client functions
- Form validation

### Integration Tests
- Login → Profile view
- Profile edit → Submit → Verify
- Elections list → Vote → Confirm

### E2E Tests (Playwright)
- Full registration → login → mínar síður flow
- Voting flow

---

## See Also

- [XJ_INTEGRATION.md](./XJ_INTEGRATION.md) - Technical integration details
- [SHARED_SERVICES.md](./SHARED_SERVICES.md) - All available services
