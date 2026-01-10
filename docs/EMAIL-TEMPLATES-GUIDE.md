# Email Templates Guide

User guide for creating and sending emails through the Ekklesia platform.

---

## Getting Started

1. Go to https://felagar.sosialistaflokkurinn.is/
2. Sign in with Íslykill
3. Click **Tölvupóstur** (Email) in the menu

---

## Templates

### Viewing Templates

Go to **Tölvupóstur → Sniðmát** to see all templates.

### Creating a Template

1. Click **+ Nýtt sniðmát** (New template)
2. Fill in:
   - **Heiti** (Name) - Template name (e.g., "Kópavogur meeting invite")
   - **Efnislína** (Subject) - Email subject line
   - **Tegund** (Type) - Choose "Fjöldapóstur" for mass email
   - **Tungumál** (Language) - Icelandic
   - **Meginmál** (Body) - Email text
3. Click **Vista sniðmát** (Save template)

### Template Variables

Variables are automatically replaced with member data:

| Variable | Description |
|----------|-------------|
| `{{ member.first_name }}` | Member's first name |
| `{{ member.name }}` | Full name |
| `{{ member.email }}` | Email address |
| `{{unsubscribe_url}}` | Unsubscribe link |

**Example:**
```
Sæl/l {{ member.first_name }},

Við bjóðum þér á fund...
```

### Editing Templates

1. Find template in list
2. Click **Breyta sniðmáti** (Edit template)
3. Make changes
4. Click **Vista sniðmát** (Save template)

---

## Sending Email

Go to **Tölvupóstur → Senda póst** (Send email)

### Three Sending Modes

#### 1. Use Template (Individual)
- Select template from list
- Enter recipient email or kennitala
- Click **Senda póst** (Send email)

#### 2. Quick Email (Individual)
- Write subject and body directly
- Enter recipient email
- Click **Senda póst** (Send email)

#### 3. Mass Email (Multiple Recipients)
- Click **Fjöldapóstur** (Mass email) button
- Enter campaign name (e.g., "Kópavogur jan 2026")
- Select municipality (or "All members")
- Select template
- View recipient count
- Click **Senda fjöldapóst** (Send mass email)
- Confirm sending

---

## AI Template Editor

The email editor includes an AI assistant for improving your templates.

### Quick Actions

| Action | Description |
|--------|-------------|
| **Sósíalistasnið** | Apply socialist party tone/style |
| **Sniða** | Improve text clarity |
| **Listi** | Convert to bullet list |
| **Breytur** | Add template variables |

### Using the AI Assistant

1. Open a template for editing
2. Select text you want to improve
3. Click one of the quick action buttons
4. Or type a custom instruction in the chat
5. Review and apply suggested changes

---

## Best Practices

### Keep It Simple
- Write like a normal letter
- Avoid bullet lists and complex formatting
- Short and to the point

### Test First
- Always send a test email to yourself first
- Check how it looks in Gmail/Outlook

### Unsubscribe Link
- For mass email, always include `{{unsubscribe_url}}` at the bottom
- This is legally required for marketing emails

---

## Example Template

```
Sæl/l {{ member.first_name }},

Við erum að undirbúa framboð Sósíalistaflokksins í [sveitarfélag]
fyrir sveitarstjórnarkosningarnar vorið 2026.

Félagsfundur verður haldinn [dagur og tími] að [staðsetning].
Þar munum við ræða framboðið og tilnefningar.

Ef þú hefur áhuga á að bjóða þig fram, hafðu samband á [netfang]

Vonumst til að sjá þig!

Kveðja,
[Svæðisfélag]

---
Afþakka frekari tölvupóst: {{unsubscribe_url}}
```

---

## Problems?

Contact Guðröður if something isn't working.
