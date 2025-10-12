# Project Identity and Political Context

**Document Type**: Project Identity & Political Clarification
**Created**: 2025-10-12
**Status**: ✅ OFFICIAL - Required Reading
**Purpose**: Clarify the political organization this system serves and prevent identity confusion

---

## ⚠️ CRITICAL: Political Identity

### This System Is Built For:

**Sósíalistaflokkur Íslands (SÍ)**
- **English Name**: The Socialist Party of Iceland
- **Political Character**: Genuine class-struggle socialist party
- **Domain**: sosialistaflokkurinn.is
- **GitHub Organization**: github.com/sosialistaflokkurinn

### This System Is NOT Built For:

**Samfylkingin - Jafnaðarmannaflokkur Íslands**
- **English Name**: The Social Democratic Alliance
- **Common Nickname**: "Krattaflokkur" (in everyday Icelandic speech)
- **Political Character**: Social democratic/center-left party
- **Clarification**: Completely different political organization

---

## Why This Distinction Matters

### Political Difference

**Sósíalistaflokkur Íslands (SÍ)**:
- Genuine socialist party
- Class-struggle politics
- Revolutionary/transformative political project

**Samfylkingin (Social Democratic Alliance)**:
- Social democratic party
- Reformist politics
- Different political tradition entirely

### Reputational Risk

Confusing SÍ with Samfylkingin would be:
- **Politically offensive** to SÍ members
- **Factually incorrect**
- **Potentially damaging** to the party's reputation
- **Embarrassing** for the development team

**Consequence**: Members would be **"mjög mogaðir"** (very offended/upset) if this confusion occurred.

---

## Documentation Audit: "Samstaða" References

### Problem Identified

The term **"Samstaða"** (meaning "Solidarity") appears in several project documents. This is:
1. **Ambiguous** - could refer to any political movement
2. **Potentially confusing** - Samfylkingin sometimes uses solidarity language
3. **Not the official name** - should be "Sósíalistaflokkurinn"

### Where "Samstaða" Appears (Incorrect Usage)

Found in:
- `docs/specifications/MEMBERS_OIDC_SPEC.md` - UI mockups
- `docs/specifications/members-oidc-v1.0.md` - UI mockups
- `docs/guides/MEMBERS_DEPLOYMENT_GUIDE.md` - ZITADEL project names
- `docs/status/SECURITY_HARDENING_PLAN.md` - Example domain references
- `docs/status/CLOUDFLARE_SETUP_PLAN.md` - Domain ownership questions
- `docs/security/SECURITY_HARDENING_MAP.md` - Domain references

### Correct References (Already Used)

✅ Properly identified in:
- **README.md**: "kosningakerfi Sósíalistaflokksins" (Socialist Party's voting system)
- **Git repository**: `github.com/sosialistaflokkurinn/ekklesia`
- **Email domain**: `@sosialistaflokkurinn.is`
- **Architecture docs**: References to "Socialist Party"

---

## Official Naming Standards

### In Icelandic Documentation

**Use**:
- ✅ **Sósíalistaflokkur Íslands** (full official name)
- ✅ **Sósíalistaflokkurinn** (the Socialist Party)
- ✅ **SÍ** (abbreviation)
- ✅ **Flokkurinn** (the Party) when context is clear

**Avoid**:
- ❌ **Samstaða** (ambiguous, not official name)
- ❌ **Vinstri græn** (that's a different party)
- ❌ **Samfylkingin** (that's the Social Democratic Alliance)
- ❌ **Jafnaðarmannaflokkur** (that's the Social Democratic Alliance's full name)

### In English Documentation

**Use**:
- ✅ **Socialist Party of Iceland** (full official name)
- ✅ **The Socialist Party** (short form)
- ✅ **SÍ** (abbreviation, when context is clear)

**Avoid**:
- ❌ **Social Democratic Party** (incorrect political character)
- ❌ **Social Democratic Alliance** (that's Samfylkingin)
- ❌ **Solidarity Party** (not the official translation)
- ❌ **Samstaða** (don't use Icelandic nickname in English docs)

### In Code and Technical Documentation

**Use**:
- ✅ `sosialistaflokkurinn` (domain name, lowercase)
- ✅ `SI` or `si` (abbreviation in code)
- ✅ `socialist-party` (kebab-case in URLs/paths)

**Avoid**:
- ❌ `samstada` (ambiguous)
- ❌ `social-democratic` (wrong party)
- ❌ `sdp` (wrong abbreviation)

---

## Domain and Infrastructure Naming

### Correct Domain

**Official Domain**: `sosialistaflokkurinn.is`

This should be used for all public-facing services:
- `auth.sosialistaflokkurinn.is` - OAuth authentication
- `verify.sosialistaflokkurinn.is` - Membership verification
- `api.sosialistaflokkurinn.is` - Events API
- `vote.sosialistaflokkurinn.is` - Elections/Voting API

### GCP Project

**Project ID**: `ekklesia-prod-10-2025`
- Uses neutral term "ekklesia" (Greek: assembly/congregation)
- No party name in GCP project (internal infrastructure)
- Correct approach: technical infrastructure doesn't need political branding

### GitHub Organization

**Organization**: `github.com/sosialistaflokkurinn`
- Correctly uses official domain name
- Repository: `ekklesia` (neutral technical name)

---

## User-Facing Branding

### Application Titles

**Correct**:
```html
<title>Meðlimir - Sósíalistaflokkur Íslands</title>
<h1>Velkomin í meðlimakerfið</h1>
```

**Incorrect** (found in old specs):
```html
<title>Samstaða Members</title>  <!-- ❌ Wrong, ambiguous -->
<h1>Welcome to Samstaða Members</h1>  <!-- ❌ Wrong -->
```

### Application Headers

**For Members Portal**:
- Icelandic: `Meðlimakerfið - Sósíalistaflokkur Íslands`
- English: `Members Portal - Socialist Party of Iceland`

**For Voting Portal**:
- Icelandic: `Kosningakerfi - Sósíalistaflokkur Íslands`
- English: `Voting System - Socialist Party of Iceland`

---

## Domain Ownership and History

### SÍ Official Domains (Verified Oct 12, 2025)

**Primary Domain**: `sosialistaflokkurinn.is`
- **Registrant**: SI320-IS (SÍ)
- **Status**: ✅ Active (WordPress site)
- **Created**: March 23, 2017
- **Expires**: March 23, 2026
- **Use for Ekklesia**: All public-facing services (auth, api, vote, verify)

**Short Domain**: `xj.is`
- **Registrant**: SI320-IS (SÍ - same as sosialistaflokkurinn.is)
- **Status**: ✅ Active (redirects to sosialistaflokkurinn.is)
- **Created**: September 25, 2017
- **Expires**: September 25, 2028
- **Note**: Could be used for short URLs (e.g., vote.xj.is)

### Historical/Unrelated Domains

**samstodin.is** (NOT SÍ):
- **Registrant**: SE5217-IS (NOT SI320-IS)
- **Status**: Different organization
- **Note**: Was previously connected to SÍ but is no longer
- **Created**: March 20, 2020
- **Expires**: March 20, 2026
- **Do NOT use for Ekklesia**

**malgagnid.is** (Unrelated):
- **Registrant**: JFE43-IS (different organization)
- **Status**: Unrelated to SÍ
- **Created**: July 31, 2025 (very recent)
- **Expires**: July 31, 2026
- **Do NOT use for Ekklesia**

### Domain Decision for Ekklesia

**✅ DECISION (Oct 12, 2025): Use `si-xj.org`**

**Rationale**:
- Full developer access (no approval delays)
- Already on Cloudflare (bristol.ns.cloudflare.com, jakub.ns.cloudflare.com)
- Can proceed immediately with security hardening
- Temporary or permanent use (flexible)
- Existing DNS record: members.si-xj.org → 34.117.214.88

**Cloudflare Status**: ✅ Active
- Nameservers: bristol.ns.cloudflare.com, jakub.ns.cloudflare.com
- Cloudflare API access: Available
- Can create DNS records immediately

**Subdomains for Ekklesia**:
- `auth.si-xj.org` → handlekenniauth (OAuth)
- `verify.si-xj.org` → verifymembership (Membership verification)
- `api.si-xj.org` → events-service (Token issuance)
- `vote.si-xj.org` → elections-service (Voting)

**Future Options** (if party decides):
- Can migrate to `sosialistaflokkurinn.is` (SI320-IS) later
- Can use `xj.is` (SI320-IS) for shorter URLs
- DNS change is straightforward (just update CNAME records)
- All infrastructure remains the same (only DNS changes)

**Do NOT use**: `samstodin.is` or `malgagnid.is`
- Not owned by SÍ
- Would create confusion

---

## Historical Context: Why "Samstaða" Appeared

### Likely Origin

The term "Samstaða" probably appeared in early documentation because:
1. **Generic placeholder**: Used "Solidarity" as a neutral term during early design
2. **Specification documents**: UI mockups needed a party name, used generic term
3. **ZITADEL project names**: Early authentication setup used placeholder
4. **Not politically reviewed**: Technical specs created without party review
5. **Domain confusion**: samstodin.is was historically connected to SÍ

### Why It Persisted

- **Copy-paste**: Later documents copied from early specs
- **Technical focus**: Developers focused on functionality, not political identity
- **No harm intended**: Simply a placeholder that wasn't corrected
- **Historical domain**: samstodin.is connection may have influenced naming

### Why It Must Be Fixed

- **Political clarity**: SÍ is a specific party with specific politics
- **Respect**: Using correct name shows respect for the organization
- **Professionalism**: Correct branding is basic professionalism
- **Avoid confusion**: Prevent accidental association with other parties

---

## Action Items: Documentation Cleanup

### High Priority (User-Facing)

- [ ] Update `members/public/index.html` - Change page titles
- [ ] Update `members/public/dashboard.html` - Change headers
- [ ] Update `members/public/profile.html` - Change branding
- [ ] Review all UI text for "Samstaða" references

### Medium Priority (Technical Docs)

- [ ] Update `docs/specifications/MEMBERS_OIDC_SPEC.md` - Use correct party name
- [ ] Update `docs/specifications/members-oidc-v1.0.md` - Use correct party name
- [ ] Update `docs/guides/MEMBERS_DEPLOYMENT_GUIDE.md` - Note historical ZITADEL naming
- [ ] Update recent security docs - Use sosialistaflokkurinn.is consistently

### Low Priority (Internal References)

- [ ] Review all Markdown docs for "Samstaða" - replace or add clarification
- [ ] Update ZITADEL project names (if still in use)
- [ ] Add note in old specs: "Historical document, used placeholder name"

---

## Political Education for Developers

### Understanding Icelandic Left Politics

**Iceland has multiple left-wing parties**:
1. **Sósíalistaflokkur Íslands (SÍ)** - Socialist Party (this project)
2. **Samfylkingin** - Social Democratic Alliance ("Krattaflokkur")
3. **Vinstri hreyfingin - grænt framboð** - Left-Green Movement
4. **Píratar** - Pirate Party (progressive/digital rights)
5. **Viðreisn** - Reform Party (liberal/centrist)

These are **different political organizations** with different:
- Political philosophies
- Organizational structures
- Membership bases
- Electoral strategies
- Historical traditions

### Key Distinction: Socialist vs. Social Democratic

**Socialist (SÍ)**:
- Class struggle politics
- Anti-capitalist
- Revolutionary or transformative change
- Independent working-class politics

**Social Democratic (Samfylkingin)**:
- Reformist politics
- Work within capitalism
- Incremental change
- Coalition/mainstream politics

**Why it matters**: Calling SÍ "social democratic" misrepresents their politics.

### Cultural Note: "Krattaflokkur"

**"Krattaflokkur"** is a colloquial/slightly derogatory nickname for Samfylkingin:
- Implies: "neat/tidy/proper party" (establishment, conventional)
- Used by: People to the left of Samfylkingin
- Political meaning: Criticism of their reformist politics

**SÍ members would be offended** if SÍ were confused with "Krattaflokkur" because:
- It implies SÍ is reformist (they're not)
- It suggests establishment politics (they're not)
- It erases their socialist identity

---

## Official Statement for Developers

### Project Identity Statement

**This system is built for Sósíalistaflokkur Íslands (Socialist Party of Iceland).**

We are developing:
- A **members system** for managing party membership
- An **events system** for administering internal elections
- A **voting system** for secure, anonymous ballot recording

This is **not**:
- A system for Samfylkingin (Social Democratic Alliance)
- A system for any other political party
- A generic voting system for multiple organizations

When in doubt about naming:
1. **Use**: "Sósíalistaflokkurinn" or "Socialist Party"
2. **Use**: Domain "sosialistaflokkurinn.is"
3. **Never use**: "Samstaða", "Social Democratic", or references to other parties
4. **When unsure**: Ask before using any political labels

---

## Testing and Review Checklist

### Before Any Public Deployment

- [ ] All user-facing text reviewed for correct party name
- [ ] No references to "Samstaða" in UI
- [ ] No references to other political parties
- [ ] Domain names use sosialistaflokkurinn.is
- [ ] Page titles use correct Icelandic party name
- [ ] Headers and footers use correct branding

### Code Review Standards

When reviewing code:
- Check for hardcoded party names - must be correct
- Check UI text - must use official names
- Check comments - avoid political labels unless necessary
- Check documentation - use correct terminology

### Pull Request Requirements

Any PR touching user-facing text must:
- ✅ Use correct party name
- ✅ No ambiguous references
- ✅ No references to other parties
- ✅ Reviewed by someone familiar with Icelandic politics

---

## Emergency Contact

### If You're Unsure About Political Context

**Questions to ask**:
1. Is this the correct party name?
2. Could this be confused with another party?
3. Is this respectful to SÍ's political identity?

**When in doubt**:
- Use the full official name: "Sósíalistaflokkur Íslands"
- Check the official domain: sosialistaflokkurinn.is
- Ask someone familiar with Icelandic politics
- **Do not guess** - political identity is too important

---

## Appendix: Quick Reference

### Correct Names

| Language | Official Name | Abbreviation | Domain |
|----------|--------------|--------------|--------|
| Icelandic | Sósíalistaflokkur Íslands | SÍ | sosialistaflokkurinn.is |
| English | Socialist Party of Iceland | SÍ | sosialistaflokkurinn.is |
| Code | sosialistaflokkurinn | si | sosialistaflokkurinn.is |

### Common Mistakes to Avoid

| ❌ Wrong | ✅ Correct | Why Wrong |
|----------|-----------|-----------|
| Samstaða | Sósíalistaflokkurinn | Ambiguous, not official name |
| Social Democratic Alliance | Socialist Party | That's Samfylkingin, different party |
| Krattaflokkur | Sósíalistaflokkurinn | That's a nickname for Samfylkingin |
| SDP | SÍ | Wrong abbreviation |
| Solidarity Party | Socialist Party | Not official translation |

### Safe Patterns

```
✅ Sósíalistaflokkur Íslands
✅ Socialist Party of Iceland
✅ sosialistaflokkurinn.is
✅ Meðlimakerfið - Sósíalistaflokkur Íslands
✅ github.com/sosialistaflokkurinn
```

---

## Summary

### The Core Issue

**"Samstaða" is ambiguous and must be replaced with the official name: "Sósíalistaflokkurinn"**

### Why It Matters

- **Political identity**: SÍ is a specific socialist party, not a generic "solidarity" movement
- **Respect**: Using correct name shows respect for the organization
- **Clarity**: Prevents confusion with Samfylkingin (Social Democratic Alliance)
- **Professionalism**: Correct branding is basic professionalism

### Action Required

1. **Update all user-facing text** - Use "Sósíalistaflokkur Íslands"
2. **Update documentation** - Replace "Samstaða" references
3. **Use correct domain** - sosialistaflokkurinn.is for all services
4. **Train developers** - Understand Icelandic political context

### Remember

**SÍ members would be "mjög mogaðir" (very offended) if confused with Samfylkingin.**

Don't make that mistake.

---

**Document Version**: 1.0
**Last Updated**: 2025-10-12
**Status**: ✅ OFFICIAL - Required reading for all developers
**Next Review**: Before any public deployment
**Authority**: Project identity clarification (political requirements)
