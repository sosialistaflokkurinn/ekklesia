# Ekklesia Shared Services

Listi yfir allar þjónustur sem Ekklesia býður upp á fyrir ytri kerfi (t.d. xj-site).

**Uppfært:** 2026-01-19

> **Athugið:** Þessi skjölun inniheldur ~45+ functions. Sjá nákvæmar útfærslur í
> `services/svc-members/functions/main.py` og Cloud Run services.

---

## Cloud Run Services

| Nafn | Tegund | Region | Tilgangur |
|------|--------|--------|-----------|
| `elections-service` | Container | europe-west1 | Kosningar API - atkvæðagreiðslur, framboð |
| `events-service` | Source | europe-west1 | AI spjallbotar, RAG, greining |
| `handlekenniauth` | Source | europe-west2 | OAuth token exchange fyrir kenni.is |
| `django-socialism` | Source | europe-west1 | Legacy admin (read-only) |

### elections-service

**Base URL:** `https://elections-service-[PROJECT_NUMBER].europe-west1.run.app`

| Endpoint | Method | Auth | Lýsing |
|----------|--------|------|--------|
| `GET /api/elections` | GET | JWT | Listi yfir kosningar sem notandi má kjósa í |
| `GET /api/elections/:id` | GET | JWT | Nákvæmar upplýsingar um kosningu |
| `POST /api/elections/:id/vote` | POST | JWT | Greiða atkvæði |
| `GET /api/elections/:id/results` | GET | JWT | Niðurstöður kosningar |
| `GET /api/candidates/:electionId` | GET | JWT | Frambjóðendur í kosningu |

### events-service

**Base URL:** `https://events-service-[PROJECT_NUMBER].europe-west1.run.app`

| Endpoint | Method | Auth | Lýsing |
|----------|--------|------|--------|
| `POST /api/member-assistant/chat` | POST | JWT | RAG spjallbot með web search |
| `POST /api/party-wiki` | POST/GET | JWT | Wikipedia-stílaður spjallbot |
| `POST /api/kimi/chat` | POST | Admin | Kimi AI sysadmin spjallbot |
| `POST /api/email-template-assistant/chat` | POST | Admin | AI aðstoð við tölvupóst |
| `GET/POST /api/external-events` | GET/POST | JWT | Ytri viðburðir |
| `GET /api/analytics/*` | GET | Admin | Greiningargögn |
| `POST /api/errors` | POST | - | Error logging |

---

## Firebase Functions (europe-west2)

**Base URL:** `https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net`

### Public Functions (engin auðkenning)

| Endpoint | Method | Lýsing |
|----------|--------|--------|
| `list_unions` | GET | Stéttarfélög fyrir dropdown |
| `list_job_titles` | GET | Starfsheiti fyrir dropdown |
| `list_countries` | GET | Lönd fyrir dropdown |
| `list_postal_codes` | GET | Póstnúmer fyrir dropdown |
| `search_addresses` | GET | Heimilisfang autocomplete |
| `validate_address` | POST | Staðfesta heimilisfang |
| `validate_postal_code` | POST | Staðfesta póstnúmer |
| `get_cells_by_postal_code` | GET | Fá kjördæmi eftir póstnúmeri |
| `unsubscribe` | GET | Afskrá af póstlista (signed token) |

**Dæmi:**
```javascript
// Sækja stéttarfélög
const response = await fetch(
  'https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net/list_unions'
);
const unions = await response.json();
```

### Auth Functions (JWT Token / Bearer)

| Endpoint | Method | Auth | Lýsing |
|----------|--------|------|--------|
| `register_member` | POST | Bearer | Skrá nýjan félaga |
| `handleKenniAuth` | POST | - | OAuth callback frá kenni.is |

**Dæmi:**
```javascript
// Skrá nýjan félaga (eftir auðkenningu)
const response = await fetch(
  'https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net/register_member',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${firebaseToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Jón Jónsson',
      email: 'jon@example.com',
      // ...
    })
  }
);
```

### Member Functions (JWT Token / on_call)

Þessar functions nota Firebase `on_call` protocol og krefjast Firebase Auth token.

| Function | Lýsing |
|----------|--------|
| `getMemberSelf` | Sækja eigin gögn (nafn, netfang, símanúmer, heimilisfang) |
| `updatememberprofile` | Uppfæra eigin prófíl |
| `verifyMembership` | Staðfesta aðild (til að kíkja hvort þú sért félagi) |
| `softDeleteSelf` | Segja sig úr flokknum (soft delete) |
| `reactivateSelf` | Endurvirkja aðild |

> **Athugið:** `getEmailPreferences` og `updateEmailPreferences` eru **admin-scoped**,
> ekki member-scoped. Sjá Admin Functions hér að neðan.

**Dæmi (JavaScript SDK):**
```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions(app, 'europe-west2');
const getMemberSelf = httpsCallable(functions, 'getMemberSelf');

const result = await getMemberSelf();
// result.data = { name, email, phone, address, ... }
```

### Admin Functions (Admin Role Required)

#### Member Management

| Function | Lýsing |
|----------|--------|
| `listMembers` | Listi yfir félaga (paginering) |
| `getMember` | Sækja einn félaga |
| `getMemberStats` | Tölfræði um félaga |
| `softDeleteAdmin` | Eyða félaga (soft delete) |
| `getEmailPreferences` | Sækja tölvupóstsniðurstöður félaga (admin) |
| `updateEmailPreferences` | Uppfæra tölvupóstsniðurstöður félaga (admin) |

#### Email System (13 functions)

| Function | Lýsing |
|----------|--------|
| `listEmailTemplates` | Listi yfir tölvupóstsniðmát |
| `getEmailTemplate` | Sækja eitt sniðmát |
| `saveEmailTemplate` | Vista/uppfæra sniðmát |
| `deleteEmailTemplate` | Eyða sniðmáti |
| `sendEmail` | Senda tölvupóst (SendGrid + Resend fallback) |
| `listEmailCampaigns` | Listi yfir herferðir |
| `createEmailCampaign` | Búa til nýja herferð |
| `sendCampaign` | Senda herferðarpóst |
| `getEmailStats` | Tölfræði um tölvupósta |
| `listEmailLogs` | Saga tölvupósta |
| `getMunicipalities` | Sveitarfélög (fyrir targeting) |
| `previewRecipientCount` | Forskoða fjölda viðtakenda |

#### SMS System (11 functions)

| Function | Lýsing |
|----------|--------|
| `listSmsTemplates` | Listi yfir SMS sniðmát |
| `getSmsTemplate` | Sækja eitt SMS sniðmát |
| `saveSmsTemplate` | Vista/uppfæra SMS sniðmát |
| `deleteSmsTemplate` | Eyða SMS sniðmáti |
| `sendSms` | Senda SMS (Twilio) |
| `listSmsCampaigns` | Listi yfir SMS herferðir |
| `createSmsCampaign` | Búa til SMS herferð |
| `sendSmsCampaign` | Senda SMS herferð |
| `getSmsStats` | Tölfræði um SMS |
| `listSmsLogs` | Saga SMS |
| `previewSmsRecipientCount` | Forskoða fjölda SMS viðtakenda |

#### Heatmap System (2 functions)

| Function | Lýsing |
|----------|--------|
| `get_member_heatmap_data` | Sækja heatmap gögn (callable) |
| `compute_member_heatmap_stats` | Reikna heatmap tölfræði (scheduled hourly) |

### Superuser Functions (Superuser Role Required)

| Function | Lýsing |
|----------|--------|
| `setUserRole` | Setja hlutverk á notanda |
| `getUserRole` | Sækja hlutverk notanda |
| `checkSystemHealth` | Heilsufarsskoðun allra þjónusta |
| `getAuditLogs` | Sækja audit logs |
| `getLoginAudit` | Sækja innskráningarsögu |
| `hardDeleteMember` | Eyða félaga (permanent) |
| `anonymizeMember` | Nafnlaust félaga (GDPR) |
| `listElevatedUsers` | Listi yfir admin/superuser |
| `getDeletedCounts` | Fjöldi eyddra félaga |
| `purgedeleted` | Hreinsa eytt gögn (Pub/Sub triggered) |

### Deprecated/Removed Functions

Þessar functions eru enn deployed en ekki notaðar:

| Function | Ástæða |
|----------|--------|
| `cleanupauditlogs` | Ekki lengur flutt út |
| `auditmemberchanges` | Cloud SQL er nú source of truth |
| `get_django_token` | Linode decommissioned 2025-12-11 |
| `sync_from_django` | Ekki lengur þörf |
| `syncmembers` | Ekki lengur þörf |

---

## Auth Flow

### Kenni.is OAuth (PKCE)

```
┌──────────┐     ┌───────────┐     ┌──────────────────┐
│  xj-site │────▶│  kenni.is │────▶│  handleKenniAuth │
│  /skraning│    │   OAuth   │     │   (Cloud Run)    │
└──────────┘     └───────────┘     └──────────────────┘
                                            │
                                            ▼
                                   ┌──────────────────┐
                                   │  Firebase Auth   │
                                   │  (Custom Token)  │
                                   └──────────────────┘
```

1. Notandi fer á `/skraning` og smellir á "Auðkenna með kenni.is"
2. Redirect til kenni.is með PKCE code_challenge
3. Eftir auðkenningu, redirect til `/skraning/callback` með auth code
4. Frontend kallar á `handleKenniAuth` með code + code_verifier
5. `handleKenniAuth` skiptir út code fyrir tokens og býr til Firebase Custom Token
6. Frontend notar Firebase token til að skrá notanda

### Firebase Auth Roles

| Claim | Lýsing |
|-------|--------|
| `member` | Venjulegur félagi |
| `admin` | Stjórnandi - getur séð félaga, sent tölvupósta |
| `superuser` | Ofurstjórnandi - allt aðgengi |

---

## Rate Limits

| Endpoint Type | Limit |
|---------------|-------|
| Public lookups | 100/mín |
| Member API | 30/mín |
| Admin API | 60/mín |
| Vote submission | 10/mín |

---

## Villukóðar

| Code | Lýsing |
|------|--------|
| `unauthenticated` | Vantar auth token |
| `permission-denied` | Ekki réttindi |
| `not-found` | Gögn finnast ekki |
| `already-exists` | Kennitala/netfang þegar skráð |
| `invalid-argument` | Ógild gögn |
| `resource-exhausted` | Rate limit |
| `internal` | Villa í þjónustu |

---

## GCP Project

- **Project ID:** `ekklesia-prod-10-2025`
- **Region (Functions):** `europe-west2`
- **Region (Cloud Run):** `europe-west1`
