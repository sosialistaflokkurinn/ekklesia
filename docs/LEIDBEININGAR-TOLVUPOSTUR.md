# Tölvupóstur - Leiðbeiningar

## Innskráning

1. Farðu á https://felagar.sosialistaflokkurinn.is/
2. Skráðu þig inn með Íslykli
3. Smelltu á **Tölvupóstur** í valmyndinni

---

## Sniðmát

### Skoða sniðmát
Farðu á **Tölvupóstur → Sniðmát** til að sjá öll sniðmát.

### Búa til nýtt sniðmát

1. Smelltu á **+ Nýtt sniðmát**
2. Fylltu út:
   - **Heiti** - Nafn sniðmátsins (t.d. "Kópavogur fundaboð")
   - **Efnislína** - Það sem birtist sem subject í póstinum
   - **Tegund** - Veldu "Fjöldapóstur" fyrir fjöldapóst
   - **Tungumál** - Íslenska
   - **Meginmál** - Textinn í póstinum
3. Smelltu á **Vista sniðmát**

### Breytur í sniðmátum

Þú getur notað þessar breytur sem fylltast sjálfkrafa:

| Breyta | Lýsing |
|--------|--------|
| `{{ member.first_name }}` | Fornafn félaga |
| `{{ member.name }}` | Fullt nafn |
| `{{ member.email }}` | Netfang |
| `{{unsubscribe_url}}` | Hlekkur til að afþakka póst |

**Dæmi:**
```
Sæl/l {{ member.first_name }},

Við bjóðum þér á fund...
```

### Breyta sniðmáti

1. Finndu sniðmátið í listanum
2. Smelltu á **Breyta sniðmáti**
3. Gerðu breytingar
4. Smelltu á **Vista sniðmát**

---

## Senda tölvupóst

Farðu á **Tölvupóstur → Senda póst**

### Þrír sendingarhamur

#### 1. Nota sniðmát (einstaklingur)
- Veldu sniðmát úr lista
- Sláðu inn netfang eða kennitölu viðtakanda
- Smelltu á **Senda póst**

#### 2. Fljótpóstur (einstaklingur)
- Skrifaðu efnislínu og meginmál beint
- Sláðu inn netfang viðtakanda
- Smelltu á **Senda póst**

#### 3. Fjöldapóstur (mörgum)
- Smelltu á **Fjöldapóstur** hnappinn
- Sláðu inn heiti herferðar (t.d. "Kópavogur jan 2026")
- Veldu sveitarfélag (eða "Allir félagar")
- Veldu sniðmát
- Sjáðu fjölda viðtakenda
- Smelltu á **Senda fjöldapóst**
- Staðfestu sendingu

---

## Ráð og ábendingar

### Einfalt snið
- Skrifaðu eins og venjulegt bréf
- Forðastu punktalista og flókið útlit
- Stuttur og hnitmiðaður texti

### Prófanir
- Sendu alltaf prufupóst til þín sjálfs fyrst
- Athugaðu hvernig pósturinn lítur út í Gmail/Outlook

### Afþakka hlekkur
- Fyrir fjöldapóst, hafðu alltaf `{{unsubscribe_url}}` neðst
- Þetta er lagaskylda fyrir markaðspóst

---

## Dæmi um gott sniðmát

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

## Vandamál?

Hafðu samband við Guðröð ef eitthvað virkar ekki.
