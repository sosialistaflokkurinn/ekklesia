# About Ekklesia E-Democracy Platform

**Document**: Background information on the Ekklesia open-source platform
**Last Updated**: 2025-10-07

---

## What is Ekklesia?

**Ekklesia** is an open-source e-democracy platform designed to provide tools for direct electronic democracy. The name comes from the ancient Greek "ekklesia" (ἐκκλησία), meaning "assembly" or "gathering of citizens."

### Official Description

> "The aim of the Ekklesia project is to provide an open, extensible platform for direct electronic democracy."

Rather than creating a one-size-fits-all solution, Ekklesia aims to integrate existing free software and provide open interfaces that can be customized for different democratic workflows.

---

## Project Information

### Development Team

**Active Authors**:
- Tobias 'dpausp' - Lead developer
- Nico 'kaenganxt' - Developer
- Holger 'plexar' - Developer

### License

**AGPLv3** (GNU Affero General Public License v3)
- Free and open-source
- Requires derived works to also be open-source
- Ensures community-driven development

### Repository

**GitHub Organization**: [edemocracy](https://github.com/edemocracy)

**Main Repositories**:
- [ekklesia-portal](https://github.com/edemocracy/ekklesia-portal) - Motion portal with web UI
- [ekklesia-voting](https://github.com/edemocracy/ekklesia-voting) - Pseudonymous voting component
- [ekklesia-notify](https://github.com/edemocracy/ekklesia-notify) - User notification API
- [ekklesia](https://github.com/edemocracy/ekklesia) - Documentation

### Documentation

**Official Docs**: https://docs.ekklesiademocracy.org

---

## History

### Origins

Ekklesia Portal **"started as an improved implementation of Wikiarguments"** - a previous project for collaborative argumentation.

The project evolved to:
- Use modern web frameworks (Morepath instead of Flask)
- Explore ideas from the Ruby project [Trailblazer](https://trailblazer.to)
- Focus on customizable democratic workflows

### Development Status

**Active**: The project is actively maintained with regular updates
- Latest release uses Python 3.11
- Regular dependency updates
- Active community contributions

---

## Who Uses Ekklesia?

### German Pirate Party (Piratenpartei Deutschland)

**Primary Known User**: The German Pirate Party has been using and customizing Ekklesia since at least 2020.

**GitHub Organization**: [Piratenpartei](https://github.com/Piratenpartei)

**Customizations**:
- [Piratenpartei/ekklesia-portal](https://github.com/Piratenpartei/ekklesia-portal) - "Motion portal for the Ekklesia eDemocracy platform, with modifications for the German Pirate Party"
- [Piratenpartei/keycloak-ekklesia](https://github.com/Piratenpartei/keycloak-ekklesia) - Keycloak extension for Ekklesia integration

**About the Pirate Party Germany**:
- Founded: September 2006
- Focus: Digital democracy, privacy rights, government transparency
- Notable success in early 2010s state elections
- Uses Ekklesia for internal democratic decision-making

### Other Users

The platform is **open-source and available for any organization**, though specific other deployments are not publicly documented in search results.

**Potential Users**:
- Political parties
- NGOs and advocacy groups
- Community organizations
- Student governments
- Cooperatives

---

## What Does Ekklesia Do?

### Core Purpose

**Proposition/Motion Management**: Create, discuss, and vote on policy proposals through a structured democratic process.

**Not For**:
- ❌ Candidate elections (picking officers, board members)
- ❌ Simple yes/no referendums
- ❌ Time-bound election events

**Designed For**:
- ✅ Policy proposals and motions
- ✅ Collaborative policy development
- ✅ Argument-based discussion
- ✅ Deliberative democracy
- ✅ Continuous participation (not event-driven)

---

## Features

### Ekklesia Portal

**Proposition/Motion Management**:
- Create and edit propositions in Markdown
- Collaborative drafting and refinement
- Full-text search across propositions
- Multi-language support (including Icelandic)

**Argumentation**:
- Pro/contra argument mapping
- Community rating of arguments (helpful/not helpful)
- Structured debate format
- Argument quality scoring

**Workflow**:
- Draft → Discussion → Gather Supporters → Voting → Accepted/Rejected
- Configurable thresholds (e.g., 50 supporters needed to reach vote)
- Flexible timelines (not fixed election dates)

**Administration**:
- Admin interface for workflow configuration
- User management
- Proposition moderation
- Analytics and reporting

### Ekklesia Voting

**Voting Methods**:
- **Score Voting**: Assign points (0-5) to multiple options
- Anonymous ballot casting
- Pseudonymous voting (verifiable but anonymous)
- One-vote-per-person enforcement

**Security**:
- Cryptographic security features
- Optional integration with VVVote (cryptographic voting system)
- Audit trail without compromising anonymity
- Tamper-resistant ballot recording

**Integration**:
- REST API for external systems
- Server-to-server ballot creation
- Result fetching and display

### Ekklesia Notify

**Notifications**:
- Email notifications
- Matrix (encrypted chat) integration
- Customizable notification rules
- Event-driven alerts

---

## Technology Stack

### Backend

**Language**: Python 3.11

**Web Framework**: [Morepath](https://morepath.readthedocs.io)
- Lightweight, flexible Python web framework
- RESTful routing
- Dependency injection
- Modern Python features

**Testing**: pytest, WebTest

### Frontend

**Templates**: [PyPugJS](https://github.com/kakulukia/pypugjs) (Pug-like syntax for Python)
- Uses Jinja2 template engine
- Clean, readable template syntax

**CSS Framework**: Bootstrap 4

**JavaScript**: [htmx](https://htmx.org)
- Modern AJAX requests directly from HTML
- No heavy frontend framework required
- Progressive enhancement approach

### Database

**PostgreSQL 15**
- Relational database for complex data
- Full-text search support
- JSON/JSONB for flexible data

### Build & Deployment

**Build Tool**: [Nix](https://nixos.org/nix)
- Reproducible builds
- Dependency management
- Consistent development environment

**Deployment Options**:
- Docker/Podman containers
- NixOS module (included)
- Cloud platforms (GCP, AWS, etc.)

### Documentation

**Sphinx** with [MyST Markdown](https://myst-parser.readthedocs.io)
- Write docs in Markdown
- Generate HTML, PDF
- Automatic API documentation

---

## Design Principles

### Privacy-Focused

**Pseudonymous Participation**:
- Users can participate without revealing identity
- Ballots are anonymous (no PII)
- Argument authorship can be pseudonymous

**Data Minimization**:
- Collect only necessary data
- No tracking of voting patterns
- Privacy-by-design architecture

### Customizable

**Workflow Configuration**:
- Configurable voting thresholds
- Custom supporter requirements
- Flexible proposition lifecycle
- Organization-specific rules

**Extensible**:
- Plugin architecture
- REST API for integrations
- Open interfaces for external tools

### Open and Transparent

**Open Source**:
- AGPLv3 license (copyleft)
- All code publicly available
- Community contributions welcome

**Democratic Transparency**:
- All propositions visible
- Voting results public (with anonymous ballots)
- Audit trail for accountability

---

## External Integrations

Ekklesia can integrate with:

**Identity Management**:
- [Keycloak](https://www.keycloak.org) - Single sign-on, identity management
- OIDC/OAuth providers
- LDAP/Active Directory

**Discussion Platforms**:
- [Discourse](https://www.discourse.org) - Forum integration for extended discussion

**Voting Systems**:
- [VVVote](https://github.com/vvvote/vvvote) - Cryptographic anonymized online voting

**Assembly Management**:
- [OpenSlides](https://openslides.com) - Motion and assembly system

**Communication**:
- [Matrix](https://matrix.org) - Encrypted notifications and chat
- Email (SMTP)

---

## How It Compares to Our Original Vision

### Original Vision (SYSTEM_ARCHITECTURE_OVERVIEW.md)

**Focus**: Elections (officer selection, board votes, referendums)
**Model**: Simple event-driven voting

**Example Use Cases**:
- "Vote for party treasurer: A, B, or C"
- "Board member election"
- "Yes/no referendum on policy"

### Ekklesia Platform

**Focus**: Propositions (policy development, collaborative decisions)
**Model**: Continuous deliberative democracy

**Example Use Cases**:
- "Proposal: Strengthen climate targets to 80% reduction by 2030"
- "Motion: Change party stance on housing policy"
- "Policy decision: Should we support X initiative?"

### Key Differences

| Aspect | Original Vision | Ekklesia Platform |
|--------|----------------|-------------------|
| **Type** | Candidate elections | Policy propositions |
| **Process** | Nominate → Vote | Propose → Discuss → Vote |
| **Timeline** | Fixed dates | Flexible (gather supporters first) |
| **Discussion** | Minimal | Central feature (pro/contra arguments) |
| **Voting Method** | Single choice | Score voting (0-5 points) |
| **Focus** | Picking people | Deciding policies |

---

## Why We Chose Ekklesia

### Advantages for Samstaða

**1. Production-Ready**
- Proven in real political party use (German Pirate Party)
- Actively maintained and updated
- Security-tested and hardened

**2. Cost-Effective**
- Open-source (no licensing fees)
- Runs on modest infrastructure (~$13/month)
- Much cheaper than building custom solution

**3. Rich Features**
- Argument mapping and deliberation
- Score voting (more nuanced than yes/no)
- Multi-language support (Icelandic ready)
- Admin interface included

**4. Privacy & Security**
- Anonymous voting by design
- Audit trail without compromising privacy
- Optional cryptographic voting (VVVote)

**5. Faster Deployment**
- Use existing platform (4-6 weeks)
- vs Build custom (3-6 months)
- Lower risk, faster time-to-value

**6. Open-Source Community**
- Active development community
- Shared improvements across organizations
- Can contribute back features

### Trade-offs

**Less Suited For**:
- ❌ Officer/board elections (candidate selection)
- ❌ Fixed-date referendums
- ❌ Simple yes/no votes

**Can Be Extended For**:
- ✅ Election features can be added if needed
- ✅ Custom workflows possible
- ✅ Integration with external election tools

---

## Our Implementation

### Samstaða Deployment

**Components**:
1. **Members** (Firebase + Kenni.is) - Authentication and member registry
2. **Portal** (Ekklesia Portal) - Proposition management
3. **Voting** (Ekklesia Voting) - Score voting on propositions

**Customizations Planned**:
- Icelandic language interface
- Integration with Firebase authentication
- Kennitala-based membership verification
- Custom supporter thresholds for Icelandic context

**Status**:
- Members: ✅ Production (https://ekklesia-prod-10-2025.web.app)
- Portal: 🟡 Deployed but 503 (https://portal-ymzrguoifa-nw.a.run.app)
- Voting: 📦 Ready to deploy

**See**: [UPDATED_SYSTEM_VISION.md](UPDATED_SYSTEM_VISION.md) for complete implementation details

---

## Learning Resources

### Documentation

**Official Docs**: https://docs.ekklesiademocracy.org
- Getting started guides
- Development environment setup
- API documentation
- Operations manual

### GitHub

**Main Repository**: https://github.com/edemocracy/ekklesia-portal
- Source code
- Issue tracker
- Contributing guidelines

**German Pirate Party Fork**: https://github.com/Piratenpartei/ekklesia-portal
- Real-world customization example
- Production configuration

### Community

**GitHub Discussions**: Available on repositories
**Issues**: Report bugs, request features

---

## Related Projects

### Ancient Greek Democracy

The name "Ekklesia" (ἐκκλησία) refers to the **assembly of citizens in ancient Athens** where democratic decisions were made.

**Historical Connection**:
- Direct democracy (citizens vote directly, not through representatives)
- Public deliberation and debate
- Collective decision-making
- Democratic participation as civic duty

**Modern Parallel**:
- Digital platform for direct democracy
- Online deliberation and voting
- Participatory decision-making
- Democratic engagement through technology

### Wikiarguments (Predecessor)

**Original Project**: Collaborative argumentation platform
**Evolution**: Ekklesia improved and extended the concept
**Innovation**: Added democratic workflow and voting integration

---

## Conclusion

**Ekklesia is a mature, production-ready platform for proposition-based democracy.**

**Strengths**:
- ✅ Open-source with active development
- ✅ Used by real political party (German Pirate Party)
- ✅ Rich deliberation and argumentation features
- ✅ Privacy-focused anonymous voting
- ✅ Customizable and extensible
- ✅ Cost-effective deployment

**Considerations**:
- ⚠️ Designed for policy propositions, not candidate elections
- ⚠️ Learning curve for administration
- ⚠️ Requires technical setup and maintenance

**For Samstaða**:
- Perfect fit for policy development and collaborative decision-making
- Can be extended for other democratic needs
- Faster and cheaper than building custom solution
- Aligns with modern democratic participation practices

**This is the right choice for our e-democracy platform.**

---

## References

**Official Resources**:
- Website: https://ekklesiademocracy.org (redirects to docs)
- Documentation: https://docs.ekklesiademocracy.org
- GitHub: https://github.com/edemocracy

**Portal**:
- Repository: https://github.com/edemocracy/ekklesia-portal
- License: AGPLv3

**Voting**:
- Repository: https://github.com/edemocracy/ekklesia-voting
- License: AGPLv3

**German Pirate Party**:
- Portal Fork: https://github.com/Piratenpartei/ekklesia-portal
- Wikipedia: https://en.wikipedia.org/wiki/Pirate_Party_Germany

**Our Documentation**:
- [UPDATED_SYSTEM_VISION.md](UPDATED_SYSTEM_VISION.md) - Our implementation vision
- [NAMING_CLARIFICATION.md](NAMING_CLARIFICATION.md) - Why we chose Ekklesia
- [CURRENT_PRODUCTION_STATUS.md](../CURRENT_PRODUCTION_STATUS.md) - Deployment status
