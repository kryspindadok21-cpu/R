# Auto SEO/GEO Tool — analiza rynku + plan budowy

## Context

Repo `/home/user/R` jest **puste** (git zainicjowany, zero commitów, zero plików). Budujemy od zera.

Zadanie: przeanalizować ~20 najpopularniejszych narzędzi SEO/GEO, wyekstrahować **jak działa każda funkcja**, ustalić **ile funkcji** musi mieć naprawdę dobre autonomiczne narzędzie auto-SEO, i zaplanować jego budowę.

Kluczowy wniosek z researchu: rynek dzieli się na **narzędzia które MIERZĄ** (Ahrefs, Semrush, Profound, Peec, Otterly — mówią co jest źle) i **narzędzia które ROBIĄ** (BabyLoveGrowth, SEObot, AirOps, Okara — wykonują). Prawie nikt nie zamyka pętli: *wykryj lukę → wygeneruj → opublikuj → zmierz czy zadziałało → naucz się*. **To jest nasza przewaga.**

---

## Część 1 — Analiza 20 narzędzi (jak działa każda funkcja)

### Grupa A: Klasyczne suity danych

**1. Ahrefs**
- *Keywords Explorer* — własny indeks klikstreamu + SERP; liczy `Traffic Potential` (nie samo volume, tylko realne kliknięcia po odjęciu SERP features), `KD` z regresji na liczbie ref. domen do top10.
- *Site Explorer* — własny crawler (AhrefsBot, 2. największy po Googlebocie) buduje graf linków; stąd DR/UR jako logarytmiczna funkcja PageRank.
- *Content Gap* — przecięcie zbiorów keywordów: `keywords(competitors) − keywords(me)`, do **10 konkurentów** naraz.
- *Rank Tracker* — snapshot SERP tygodniowo (dziennie tylko w płatnym dodatku Project Boost).
- *Brand Radar* — ich wejście w GEO: śledzi wzmianki marki w AI Overviews.

**2. Semrush**
- *Position Tracking* — SERP **codziennie**, granulacja do poziomu miasta; liczy `Visibility Score` = ważona suma pozycji przez CTR-curve.
- *Site Audit* — ~140 checków, każdy z wagą; wynik = `Site Health %`.
- *On-Page SEO Checker* — porównuje stronę do top10 dla danej frazy i wypluwa listę „idei" (content/technical/backlink/UX).
- *AI Visibility Toolkit* — moduł GEO wewnątrz suity: tracking promptów, wzmianki w ChatGPT, brand perception. **$189/mc za 100 promptów, $989 za 1000.**
- Przewaga: szerokość (PPC, social, PR). Wada: GEO to u nich dodatek, nie core.

**3. Moz Pro** — Domain Authority (model ML predykujący ranking), Keyword Explorer z `Priority Score` (volume × difficulty × CTR × twoje szanse), Link Explorer, Spam Score.

**4. SE Ranking** — tańszy klon Semrusha; ma własny AI Visibility tracker; mocny w white-label dla agencji.

**5. Serpstat / Majestic** — Majestic: Trust Flow / Citation Flow (dwuwymiarowa metryka jakości linków — TF/CF ratio wykrywa spam).

### Grupa B: Crawlery techniczne

**6. Screaming Frog SEO Spider**
- Desktop, wielowątkowy crawler. Tryb `Spider` (podąża za linkami) i `List` (podana lista URL).
- *JS Rendering* — headless Chromium; robi **diff między raw HTML a rendered DOM** (pokazuje co ginie bez JS).
- *Custom Extraction* — XPath / CSS selector / regex, do 100 ekstraktorów naraz.
- *Log File Analyser* (osobny produkt) — parsuje logi serwera, pokazuje realne wizyty Googlebota vs crawl budget, strony crawlowane a nieindeksowane.
- API pull: GA, GSC, PageSpeed Insights, Ahrefs, Majestic — wzbogaca crawl o dane zewnętrzne.
- Wykrywa: orphan pages (crawl ∪ sitemap ∪ GA/GSC → różnica), łańcuchy przekierowań, hreflang bez zwrotności, canonical loops.

**7. Sitebulb** — **300+ checków** z priorytetyzacją i wyjaśnieniem „dlaczego to ważne"; Evergreen Chromium; wizualizacje architektury (crawl maps jako graf force-directed); „Hints" zamiast surowych błędów.

**8. Lumar (ex-DeepCrawl) / Botify / Conductor** — enterprise: łączą crawl + logi + GSC + analytics w jeden model; Botify ma `Activation` — wypycha strony do indeksacji przez API. Skala: miliony URL.

**9. ContentKing / Ryte** — monitoring *real-time* (nie batch crawl): wykrywa zmianę na stronie w minutach, alertuje o regresji.

### Grupa C: Optymalizacja treści (NLP)

Wspólny mechanizm wszystkich: **reverse-engineering SERP**. Pobierają top 10–30 wyników, ekstrahują termy (TF-IDF / embeddingi / entity extraction), budują model „co musi zawierać strona żeby rankować", i skorują twój draft w czasie rzeczywistym.

**10. Surfer SEO** — `Content Editor` z live score 0–100; sugeruje NLP terms z częstotliwością (ile razy użyć), word count, liczbę nagłówków, gęstość obrazów. `Audit` porównuje istniejącą stronę do top-rankujących. `Content Planner` — klastruje frazy w topical map.

**11. Clearscope** — grade **A++ do F**; minimalistyczny UI, świadomie ogranicza liczbę sygnałów; nacisk na semantyczne pokrycie + czytelność. Najczystszy sygnał, najmniej „gamifikacji".

**12. MarketMuse** — nie TF-IDF, tylko **własne topic modeling**; robi `Content Inventory` całej domeny (klasyfikuje każdą stronę: keep / update / consolidate / delete) i liczy `Topical Authority` oraz `Personalized Difficulty` (twoja szansa, nie ogólna).

**13. Frase** — pełny workflow research → brief → draft → optymalizacja; automatyczne generowanie briefów z SERP.

### Grupa D: Automatyzacja AI-SEO (wykonawcze)

**14. BabyLoveGrowth.ai** ⭐ (to o co pytasz)
- *Onboarding*: analizuje branżę, konkurencję i audience z samego URL-a.
- *Content calendar*: klastrowanie oparte na SERP → kalendarz tematów.
- **1 artykuł dziennie / do 30 miesięcznie**, 20+ języków; każdy artykuł zawiera: cytowania źródeł, linkowanie wewnętrzne, infografiki, **JSON-LD schema**.
- *Backlinki*: automatyczna sieć wymiany **4000+ zweryfikowanych partnerów** — linki kontekstowe w pełnych artykułach na realnych domenach (nie PBN-owe stopki).
- *GEO tracking*: cytowania marki w ChatGPT / Perplexity / Claude / Gemini + jakie prompty wywołują wzmiankę.
- *Technical*: audyty schema, metadanych, struktury pod AI search.
- *Publikacja natywna*: WordPress, Webflow, Shopify, Wix, Ghost, Duda, BigCommerce, Snapps + API/Webhook dla reszty.
- Efekty raportowane: 60–90 dni do mierzalnego wzrostu.

**15. SEObot** — w pełni autonomiczny agent dla founderów: keyword research → strategia → long-form → internal linking → obrazy → cytowania → publikacja do CMS. Mocny w programmatic SEO (wysokowolumenowe long-tail).

**16. AirOps** — enterprise workflow platform, CMS-agnostyczna. Import kolekcji treści, publikacja do Webflow/WordPress/Contentful/Sanity/Storyblok/Strapi/HubSpot, routing zadań przez Asana/ClickUp/Slack, gating publikacji, **bulk refresh setek URL-i naraz** (naprawa linków, fact-checking, aktualizacja pozycjonowania).

**17. SEOmatic** — programmatic: szablon + dane strukturalne → masowa publikacja stron (city pages, comparison, glossary, integration pages); auto-sitemap, auto-related-linking; **task board agenta: needs-you / in-flight / measuring / done**.

**18. Okara** — najbliżej naszej wizji: monitoring + egzekucja w jednym za $129/mc flat. Writer agent (artykuły „answer-first" pod przegrywane prompty), Reddit agent (znajduje i odpowiada w wątkach rekomendacyjnych), SEO/coding agent (2 fixy techniczne dziennie). Draft-first z akceptacją.

### Grupa E: GEO / AI Visibility

**19. Profound** — lider ($155M raised, wycena $1B). Ma **realne wolumeny promptów (1.5 mld promptów)** posegmentowane po intencji — nikt inny tego nie ma. `Query explosion` (jak jedno pytanie rozpada się na wiele podzapytań). **Agent Analytics** — śledzi przyloty crawlerów AI na twoją stronę. Do 9 silników. $99 (tylko ChatGPT) / $399 (3 silniki) / enterprise.

**20. Peec AI** — najszybciej rosnący challenger ($29M raised, $4M ARR w 10 mies.). Share of voice, sentyment, pozycja w odpowiedzi, **fan-out query identification**, `Actions view` klastrujący cytowane źródła na owned/earned + scoring luk po wielkości. Unlimited seats. Scraping konsumenckiego interfejsu zamiast API. Od $95/mc.

**Pozostałe warte uwagi:** Otterly ($29/mc, GEO audit na 25+ czynników on-page, 50+ krajów, konektor Looker Studio), AthenaHQ (9 modeli, natywna integracja GA4+GSC, próba atrybucji przychodu, Action Center), Scrunch/Sitecore (Agent Traffic, AI Delivery layer formatujący treść pod konsumpcję przez AI, white-label multi-brand), Promptwatch (6 modeli + analiza logów crawlerów w każdym planie).

---

## Część 2 — Ile funkcji musi mieć naprawdę dobre auto-SEO?

Rozbiłem cały rynek na atomowe funkcje. Wyszło **~110 funkcji** w 9 warstwach. Ale nie buduje się 110 naraz — oto uczciwy podział:

| Warstwa | Funkcje | W MVP | W v1.0 |
|---|---|---|---|
| A. Discovery / research | 15 | 6 | 12 |
| B. Crawl techniczny i audyt | 19 | 8 | 15 |
| C. Content intelligence | 18 | 5 | 13 |
| D. GEO / AI visibility | 14 | 4 | 12 |
| E. Rank & performance | 9 | 3 | 7 |
| F. Off-page / authority | 7 | 0 | 4 |
| G. Egzekucja / automatyzacja | 13 | 5 | 11 |
| H. Warstwa agentowa | 7 | 4 | 7 |
| I. Reporting / multi-tenancy | 8 | 1 | 6 |
| **RAZEM** | **110** | **36** | **87** |

**Odpowiedź wprost:**
- **36 funkcji** = MVP, który realnie działa i zamyka pętlę (4–6 tygodni)
- **~87 funkcji** = wersja „zajebista w chuj", bijąca każde pojedyncze narzędzie z listy (6–9 miesięcy)
- **110 funkcji** = pełna platforma enterprise (roadmapa 2–3 lata)

Liczba sama w sobie nie jest przewagą. **Przewagą jest pętla zwrotna** — 7 funkcji z warstwy H (scoring okazji, task board, autonomiczny scheduler, framework eksperymentów, pomiar zwrotny, budget governor, policy engine). Żadne z 20 przeanalizowanych narzędzi nie ma kompletu tej warstwy.

### Pełna lista warstw (skrót)

**A. Discovery (15)** — ekspansja seedów, volume+trend, KD, klasyfikacja intencji, traffic potential, snapshot SERP + features, klastrowanie po overlapie SERP, mapa encji/topical map, content gap vs N konkurentów, wykrywanie konkurentów, mining pytań (PAA/Reddit/fora), ekspansja lokalna, sezonowość, **discovery promptów GEO**, detekcja fan-out.

**B. Crawl (19)** — silnik crawlera (HTML+JS), robots/sitemap, statusy i łańcuchy przekierowań, canonical/hreflang/paginacja, indeksowalność + orphany, duplikaty i thin content, metadane, walidacja schema, Core Web Vitals, parity mobile, graf linków wewnętrznych, analiza logów Googlebota, **analityka crawlerów AI (GPTBot/ClaudeBot/PerplexityBot)**, głębokość architektury, custom extraction, diff raw↔rendered, HTTPS/mixed content, crawl budget, detekcja zmian + alerty regresji.

**C. Content (18)** — reverse-engineering SERP, ekstrakcja termów NLP + pokrycie, grade treści, generowanie briefów, outline, inwentaryzacja treści (keep/update/consolidate/delete), detekcja decay, decyzja refresh-vs-new, kanibalizacja, czytelność, audyt E-E-A-T, detekcja AI-slop, wielojęzyczność + hreflang, obrazy + alt, silnik sugestii linków wewnętrznych, wstawianie cytowań, generowanie JSON-LD per typ strony, **optymalizacja chunków pod retrieval LLM**.

**D. GEO (14)** — zarządzanie zestawem promptów, runner multi-engine, detekcja wzmianki + pozycja w odpowiedzi, share of voice, sentyment, ekstrakcja cytowanych źródeł, klasyfikacja owned/earned/competitor, luki promptowe, GEO audit on-page (25+ czynników), generowanie/walidacja llms.txt, spójność encji (NAP, Wikidata, knowledge graph), optymalizacja powierzchni third-party (Reddit, G2, listicle), tracking AI Overviews, **warstwa statystyczna (N przebiegów, wariancja, przedział ufności)**.

**E. Rank (9)** — rank tracker (dzienny, device, miasto), visibility score, ownership SERP features, integracja GSC, integracja GA4, forecasting ruchu, monitoring konkurencji, kanibalizacja z danych GSC, **atrybucja ruchu z LLM-ów (detekcja referrali)**.

**F. Off-page (7)** — indeks linków, monitoring new/lost, detekcja toksycznych, link gap, prospecting + outreach, monitoring wzmianek/digital PR, sculpting autorytetu wewnętrznego.

**G. Egzekucja (13)** — kalendarz treści, pipeline artykułu (brief→draft→fact-check→optymalizacja), generowanie stron programatycznych, bulk refresh, adaptery CMS, **publikacja przez Git/PR (dla stron kodowych)**, aplikowanie linkowania wewnętrznego, deploy schema, generowanie PR-ów z fixami technicznymi, auto-sitemap, mapa przekierowań, workflow akceptacji, rollback.

**H. Agent (7)** ⭐ — scoring i priorytetyzacja okazji, task board (needs-you/in-flight/measuring/done), autonomiczny scheduler, framework eksperymentów (zmiana → pomiar → wniosek), pętla zwrotna atrybucji, governor budżetu, policy engine (co agent może bez pytania).

**I. Reporting (8)** — dashboard, raporty cykliczne, white-label multi-brand, konektor BI/Looker, alerty, API + webhooki, role i uprawnienia, portal klienta.

---

## Część 3 — Skill pack: który jest najlepszy (odpowiedź na Twoje główne pytanie)

Pytałeś czy skill packi są lepsze od plugin packów i który pack jest najlepszy. Odpowiedź:

**To nie jest konkurencja — to dwie różne rzeczy.** Plugin = kontener, który może zawierać skille + komendy + serwery MCP + agentów + hooki. Skill = pojedyncza instrukcja proceduralna. Plugin pack to po prostu opakowane skille plus dodatki. Więc pytanie nie brzmi „skille czy pluginy", tylko **„która konkretna kolekcja"**.

Przejrzałem ekosystem (skills.sh, tonsofskills.com — 471 pluginów/3069 skilli, superpowers-marketplace, Twój katalog `knowledge-work-plugins`). Dla tego projektu wygrywa **kombinacja trzech warstw**, nie jeden pack:

### Warstwa 1 — Domena SEO/GEO: `coreyhaines31/marketingskills` ⭐ ZWYCIĘZCA

**To jest ten pack, o który pytasz.** 45,8k gwiazdek, licencja MIT, 48 skilli, darmowy.

Zawiera dokładnie to, co budujemy:
- `seo-audit` — 195k instalacji, najpopularniejszy skill SEO w ekosystemie
- `ai-seo` — **AEO / GEO / LLMO**, czyli nasza warstwa D
- `programmatic-seo` — 124k instalacji, generowanie stron z szablonów
- `schema` — structured data
- `site-architecture` — hierarchia i struktura URL
- `content-strategy` — 130k instalacji
- `competitors` — strony porównawcze i „alternatywy"
- `analytics` + `attribution` — pomiar i ROI
- plus 40 skilli około-marketingowych (CRO, copywriting, pricing, launch, directory-submissions)

```bash
npx skills add coreyhaines31/marketingskills
# albo wybiórczo:
npx skills add coreyhaines31/marketingskills --skill seo-audit ai-seo programmatic-seo schema
```

### Warstwa 2 — Metodyka budowy: `obra/superpowers`

170k+ gwiazdek, najbardziej rozbudowany ekosystem pluginów Claude Code. Nie daje wiedzy SEO — daje **dyscyplinę budowania**: `/brainstorm` → `/write-plan` → `/execute-plan`, wymuszony TDD, dispatch subagentów, wstrzykiwanie kontekstu na starcie sesji.

```
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

Przy projekcie tej wielkości budowanym przez wiele sesji to realnie ratuje przed chaosem. **Ostrzeżenie:** wymusza pełny proces, więc na drobne poprawki bywa uciążliwy.

### Warstwa 3 — Twój katalog (`knowledge-work-plugins`)

Masz **zero włączonych pluginów**. Warto włączyć:

| Plugin | Co daje | Kiedy |
|---|---|---|
| **`searchfit-seo`** | 11 skilli + 6 komend: `seo-audit`, `technical-seo`, `on-page-seo`, `keyword-clustering`, `content-brief`, `internal-linking`, `schema-markup`, `broken-links`, `ai-visibility`, `content-translation` | **Od razu** — pokrywa się z warstwą 1, ale jest zweryfikowany i `reach: contained` (nie wymaga zewnętrznych kont) |
| **`brightdata-plugin`** | 18 skilli: `search` (SERP jako JSON), `scrape` z omijaniem bot-detekcji, `competitive-intel`, `brand-listening` | **Gdy będziesz mieć klientów** — wymaga płatnego konta |
| **`marketing`** | MCP do **Ahrefs** i Similarweb | **Dopiero z budżetem** — MCP jest darmowe, ale konto Ahrefs nie |
| **`nimble`** | `seo-intel`, `brand-mention-monitor`, agenci researchowi | Backup dla Bright Data |

### Rekomendacja końcowa

**Na start, za zero złotych:**
```bash
npx skills add coreyhaines31/marketingskills     # domena SEO/GEO
```
```
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace   # metodyka
/plugin install searchfit-seo                          # z Twojego katalogu
```

`brightdata-plugin` i `marketing` dokładasz **dopiero gdy pojawią się klienci** — bo wymagają płatnych kont, a Ty startujesz bez kasy.

### ⚠️ Krytyczne rozróżnienie, żeby nie stracić miesiąca

**Skill = instrukcja dla mnie, działa tylko gdy jestem uruchomiony.**
**Produkt = Twój kod, działa 24/7 gdy śpisz i gdy klient płaci.**

Skille przyspieszą *budowę* i podniosą jakość tego, co napiszemy. Ale nie da się sprzedać klientowi dostępu do skilla — sprzedaje się działającą platformę. Nie mylimy tych warstw. Skille to rusztowanie, nie budynek.

---

## Część 4 — Stack w 100% darmowy (Twoje ograniczenie: zero budżetu)

Powiedziałeś: *„ma działać jak płatne za darmo"*. Poniżej uczciwa odpowiedź — co się da, a czego się nie da.

### Dlaczego płatne narzędzia kosztują (i gdzie mają słaby punkt)

Ahrefs i Semrush sprzedają **własne indeksy** — graf linków budowany przez lata przez własne crawlery i dane klikstreamowe kupowane od dostawców przeglądarek. Tego **nie da się odtworzyć za darmo. Nigdy.**

**Ale indeks to tylko ~20% wartości.** Pozostałe 80% to **analiza** — a analiza to dokładnie to, w czym LLM jest mocny i za co nie musisz płacić:

| Co sprzedają za $$$ | Jak zrobić za 0 zł |
|---|---|
| Keyword Difficulty | Scrawluj top10 na żywo, zmierz ich głębokość/strukturę/wiek → policz własny KD |
| Search intent | LLM klasyfikuje — **lepiej niż płatne narzędzia**, bo rozumie kontekst |
| Content gap | Zassij sitemapy konkurentów, wyekstrahuj tematy LLM-em, odejmij od swoich |
| Content score (Surfer/Clearscope) | Crawl top10 + embeddingi + ekstrakcja termów — to dosłownie ten sam algorytm |
| Briefy i outline'y | LLM, za darmo |
| **Wolumeny wyszukiwań** | **Bing Webmaster Tools API — DOKŁADNE liczby, nie widełki, za darmo** |
| GEO / AI visibility | Odpytuj modele bezpośrednio — to i tak **jedyna uczciwa metoda**, płatni robią to samo |
| Audyt techniczny | Własny crawler na Playwright + Chromium |

### Konkretne darmowe źródła

| Warstwa | Źródło | Limit | Co daje |
|---|---|---|---|
| **Prawda o Twojej stronie** | GSC Search Analytics API | 50 000 wierszy/dzień/site, 16 mies. historii | zapytania, strony, kliknięcia, CTR, pozycja, kraj, urządzenie |
| Indeksacja | GSC URL Inspection API | ~2000 URL/dzień | status indeksacji, canonical wybrany przez Google |
| Dane masowe | GSC Bulk Export → BigQuery | BQ free: 1 TB zapytań/mc | omija limit 1000 wierszy z UI |
| **Wolumeny fraz** ⭐ | **Bing Webmaster Tools API** | darmowe | **dokładne wolumeny + filtr „Question" — złoto pod GEO** |
| Long-tail | Google Autocomplete + People Also Ask | darmowe | podpowiedzi, pytania |
| Sezonowość | Google Trends | darmowe | momentum, trendy |
| Wydajność | PageSpeed Insights API | 25 000/dzień | Core Web Vitals, Lighthouse |
| Konwersje | GA4 Data API | darmowe | ruch, cele, **referrale z ChatGPT/Perplexity** |
| Crawl | Playwright + Chromium | darmowe | Chromium jest już w tym środowisku |
| Indeksowanie | IndexNow | darmowe | natychmiastowe zgłoszenie do Bing/Yandex |
| Encje | Wikidata / Wikipedia API | darmowe | mapa encji, spójność marki |
| **GEO** | Gemini free tier + Groq (do 14 400 req/dzień) + OpenRouter (28+ darmowych modeli) | darmowe | odpytywanie o widoczność marki |
| SERP awaryjnie | Serper 2500 kredytów startowych | jednorazowo | walidacja własnych pomiarów |
| Hosting | Cloudflare Workers (100k req/dzień) + Pages (nielimitowany transfer) + Neon 0,5 GB Postgres | **$0/mc** | cała platforma |

### Czego NIE da się za darmo — uczciwie

1. **Backlinki konkurencji.** GSC pokaże Twoje linki. Reszta to Common Crawl — nieaktualny i dziurawy. To jedyne miejsce, gdzie płatne realnie wygrywają. Warstwę F (off-page) odkładamy do momentu, aż będą klienci.
2. **Wolumeny Google.** Bing daje dokładne dane, ale to Bing. Korelacja z Google jest wysoka, nie idealna. GSC pokrywa lukę dla fraz, na które **już** się wyświetlasz.
3. **Skala SERP-ów.** Darmowo zrobisz setki zapytań dziennie, nie setki tysięcy. Wystarczy dla Ciebie i pierwszych klientów.

**Wniosek:** zbudujemy platformę, która na starcie realnie zastępuje ~75% Ahrefsa i ~90% Surfera/Clearscope, a w warstwie GEO jest **równorzędna z Profound i Peec** — bo tam wszyscy robią to samo, tylko odpytują modele.

---

## Część 5 — Plan budowy (fazy)

Cel biznesowy: platforma dla Ciebie → potem sprzedaż dostępu innym. Więc **multi-tenancy projektujemy od początku w schemacie bazy, ale nie budujemy billingu, dopóki nie ma klienta.**

### Faza 0 — Fundament (dni 1–3)
Monorepo TypeScript (pnpm + Turborepo), Postgres na Neon (free), Drizzle ORM, schemat bazy z `tenant_id` od pierwszej tabeli. OAuth do Google Search Console. **Kamień milowy: realne dane z Twojej GSC lądują w bazie.**

### Faza 1 — Crawler + audyt (tydzień 1–2)
Silnik crawlera (Playwright/Chromium, kolejka, respekt dla robots.txt), rules engine z ~40 checkami, diff raw↔rendered, graf linków wewnętrznych, PSI API. **Kamień milowy: pełny raport techniczny Twojej strony.**

### Faza 2 — GEO tracker (tydzień 3–4)
Zarządzanie promptami, runner multi-engine (Gemini/Groq/OpenRouter free), detekcja wzmianek + pozycja w odpowiedzi, share of voice, ekstrakcja cytowanych źródeł, **warstwa statystyczna (N przebiegów + wariancja — LLM-y są niedeterministyczne, jeden przebieg to szum)**, generator llms.txt. **Kamień milowy: wiesz, w których promptach jesteś niewidoczny.**

### Faza 3 — Silnik treści (tydzień 5–6)
Klastrowanie fraz (Bing API + GSC + autocomplete), reverse-engineering SERP, scoring treści, generator briefów, pipeline artykułu (brief → draft → fact-check → schema → linkowanie wewnętrzne), adaptery publikacji (WordPress REST, webhook, **publikacja przez PR do repo**). **Kamień milowy: pierwszy artykuł opublikowany automatycznie.**

### Faza 4 — Pętla agentowa (tydzień 7–8) ⭐ *tu jest przewaga*
Scoring okazji, task board (needs-you / in-flight / measuring / done), autonomiczny scheduler, **pętla zwrotna: opublikowana zmiana → pomiar po 14/30/60 dniach → wniosek**, policy engine (co agent może bez pytania), governor budżetu. **Kamień milowy: system działa bez Ciebie przez tydzień i raportuje, co zadziałało.**

### Faza 5 — Dashboard i sprzedaż
Next.js App Router, wykresy, raporty white-label, onboarding, limity per tenant, billing (Stripe) — **dopiero gdy Faza 4 dowiedzie, że system daje wyniki na Twojej stronie.**

### Zasada nadrzędna
Nie sprzedajesz obietnicy. Najpierw **Twoja własna strona ma urosnąć dzięki tej platformie** — to jest Twój case study i jedyny uczciwy dowód. Dopiero potem klienci.

---

## Część 6 — Architektura techniczna

Kluczowa zasada, która sprawia, że zero budżetu **nie blokuje** późniejszej skali:

### Zasada 1 — Silniki są czyste, wejście/wyjście na krawędziach
Analiza crawla, reguły audytu, scoring treści, klastrowanie, statystyka GEO i scoring okazji to **czyste funkcje na zwykłych strukturach danych**. Nigdy nie dotykają bazy, HTTP ani kolejki. To kupuje trzy rzeczy:
- Ten sam kod działa w trybie **CLI z SQLite (zero infrastruktury, zero kosztu)** i w SaaS z Postgresem. Nie dwie wersje — jedna, z inną krawędzią.
- Silniki testujesz na fixture'ach HTML. To jedyny sposób, żeby 300 reguł audytu pozostało poprawne.
- Możesz uruchomić całość lokalnie, bez żadnego serwisu w tle.

### Zasada 2 — Warstwa providerów to Twoja polisa ubezpieczeniowa ⭐
**To najważniejszy plik w całym repo dla Ciebie**, bo zaczynasz bez kasy i chcesz dokupić później:

```ts
interface SerpProvider {
  readonly id: 'gsc' | 'bing-wmt' | 'autocomplete' | 'serper' | 'dataforseo' | 'fixture'
  readonly capabilities: SerpCapability[]
  search(q: SerpQuery): Promise<SerpResult>
  estimateCost(qs: SerpQuery[]): Cents      // dla darmowych = 0
}
interface KeywordProvider { volume(...); ideas(...); difficulty(...) }
interface LlmEngineProvider {
  readonly engine: 'chatgpt'|'claude'|'gemini'|'perplexity'|'copilot'|'grok'|'ai_overview'
  ask(prompt: string, opts): Promise<EngineAnswer>   // tekst + citations[] + raw
}
```

Startujesz z adapterami `gsc`, `bing-wmt`, `autocomplete`, `groq`, `gemini`. Gdy pojawi się klient i budżet — dopisujesz adapter `dataforseo` w jeden wieczór i **nic innego w kodzie się nie zmienia**. To dokładnie realizuje Twoje „zaczynam za darmo, dokupię pakiety gdy znajdę klientów".

### Struktura repo

```
/home/user/R
├── apps/
│   ├── cli/          `seo` — binarka, tryb SQLite (BUDUJEMY PIERWSZE)
│   ├── web/          Next.js dashboard (Faza 5)
│   ├── api/          Hono — webhooki (Faza 5)
│   └── worker/       handlery zadań (Faza 5)
├── packages/
│   ├── core/         typy, ID, normalizacja URL
│   ├── db/           Drizzle — jeden schemat, dialekty SQLite + Postgres
│   ├── jobs/         interfejs Queue + adaptery local/pg-boss
│   ├── http/         grzeczny fetcher (robots, rate limit, cache)
│   ├── render/       pula Chromium (Playwright)
│   ├── crawler/      frontier, decyzja o renderze, graf linków
│   ├── parse/        HTML → PageFacts
│   ├── rules/        silnik reguł + paczki reguł
│   ├── providers/    interfejsy + adaptery ⭐
│   ├── keywords/     klastrowanie, difficulty, content gap
│   ├── content/      reverse-engineering SERP, scoring, briefy
│   ├── geo/          prompty, runner, statystyka share-of-voice
│   ├── logs/         parsowanie logów, weryfikacja botów AI
│   ├── publish/      adaptery CMS
│   ├── llm/          router modeli + rejestr kosztów
│   ├── agent/        scoring okazji, planer, polityki, task board
│   └── report/       raporty
└── fixtures/         prawdziwy HTML + prawdziwe SERP-y + golden outputs
```

Reguła zależności (wymuszana w CI): silniki (`parse`, `rules`, `content`, `keywords`, `geo`, `agent`) **nigdy** nie zależą od `db`, `http`, `jobs`, `providers`. Tylko `apps/*` i `crawler` łączą I/O z silnikami.

### Stack (darmowy wariant)

| Warstwa | Wybór | Dlaczego |
|---|---|---|
| Język | TypeScript 7 + Node 22 LTS | Jeden język na całość |
| Monorepo | pnpm + Turborepo | Izolacja zależności przy 15 pakietach |
| Baza | **SQLite (better-sqlite3)** → Postgres na Neon free | Drizzle ORM celuje w oba tym samym schematem |
| Kolejka | **in-process (p-queue)** → pg-boss | Ten sam interfejs `Queue` |
| Crawl | undici + Playwright/Chromium | Chromium już jest w tym środowisku |
| LLM | Groq (14 400 req/dzień) + Gemini free + OpenRouter | Zero kosztu |
| Hosting | Cloudflare Workers + Pages | $0/mc |

### Kluczowe decyzje techniczne

**Dwustopniowy fetch.** Każdy URL najpierw zwykłym fetchem. Playwright uruchamiamy **tylko** gdy heurystyka wykryje SPA (pusty `<body>` przy dużym `<script>`, `__NEXT_DATA__` bez treści, `<noscript>` z „enable JavaScript"). W praktyce renderujesz 5–20% URL-i zamiast 100% — **10–20× taniej** na najdroższej części crawla.

**Requesty warunkowe.** `ETag`/`Last-Modified` per URL. Przy ponownym crawlu stabilnej strony 60–80% odpowiedzi to 304. Najtańsza optymalizacja w całym produkcie.

**Adaptacyjna współbieżność (AIMD).** Start od 2 równoległych per host. Co 20 udanych odpowiedzi +1. Przy 429/503 — połowa współbieżności i podwojone opóźnienie. To różnica między crawlerem, który dostaje bana, a takim, który go nie dostaje.

**Klastrowanie po overlapie SERP, nie po embeddingach.** Jeśli dwie frazy dzielą ≥3 te same URL-e w top10, Google uważa je za tę samą intencję. To bezpośredni pomiar opinii samego algorytmu. Embeddingi tylko jako druga warstwa, do sklejenia singletonów.

**Word count jako przedział, nie liczba.** „Napisz 2347 słów" to najczęściej kopiowany i najgorszy pomysł w branży — produkuje lanie wody, czyli dokładnie to, co Google karze.

### Statystyka GEO — tu wszyscy oszukują, my nie ⭐

Pojedynczy przebieg promptu to **próba Bernoulliego, nie pomiar**. Przy prawdziwym prawdopodobieństwie wzmianki p = 0,3 i n = 3 przebiegach błąd standardowy wynosi **±26 punktów procentowych**. Czyli: cotygodniowe wykresy „widoczności" z 1–3 przebiegów to szum, a sprzedawanie tego jako trendu to główna wada tej kategorii narzędzi.

Co robimy zamiast tego:
- **m = 50 promptów × n = 3 przebiegi tygodniowo** — rozdzielczość ok. 8–10 pp tydzień do tygodnia
- **Raportujemy różnice sparowane, nigdy surowe poziomy** — wariancja między promptami dominuje i jest stała przy stałym zestawie
- **Szare, wyłączone iskierki i etykieta „jeszcze nieistotne"**, gdy zmiana mieści się w przedziale ufności
- **Nigdy nie mieszamy `access_mode`** (API z groundingiem vs. przechwytywanie interfejsu konsumenckiego) w jednej linii trendu
- **Głośny alert przy zmianie `model_version`** — upgrade modelu to skokowa zmiana procesu, musi być adnotacją na wykresie jak core update

Groq z limitem 14 400 requestów dziennie w darmowym tierze spokojnie unosi 50 promptów × 3 przebiegi × 5 silników.

### Warstwa agentowa — pętla

```
SENSE   crawl, GSC, GA4, GEO, logi, cytowania
  ↓
SCORE   generatory kandydatów → Opportunity[] → ranking
        score = (impact × confidence × fit) / (effort × risk)
  ↓
PLAN    policy engine: auto | approve | never
  ↓
ACT     agent_task → zadania → CMS/PR
  ↓
MEASURE okno eksperymentu, DiD vs. grupa kontrolna, werdykt
  ↓
        aktualizacja priors → z powrotem do SCORE
```

**Scoring to deterministyczna arytmetyka, nie wywołanie LLM.** LLM dostaje jedno wąskie zadanie: ułożyć top 30 okazji w spójny plan (sekwencja, grupowanie, wykrywanie konfliktów). LLM-y są w tym dobre, a w konsekwentnym rankingu liczbowym złe.

**Planer nie może niczego wykonać.** Emituje tylko wiersze `agent_task` w stanie `proposed`. Wykonanie idzie przez policy engine i system zadań — deterministyczny kod. Agent, który może proponować, ale nie wykonywać, ma z definicji ograniczony zasięg rażenia.

**Pomiar metodą difference-in-differences:** `(treatment_post − treatment_pre) − (control_post − control_pre)`. To absorbuje core update'y, sezonowość i ruchy konkurencji, które czynią naiwne porównanie „przed/po" bezwartościowym. To jest rzecz, której **żaden konkurent z listy 20 nie robi** — i jedyny sposób, żeby powiedzieć klientowi „nasze zmiany dały +6,4% CTR, 95% CI [2,1%, 10,7%], zmierzone na Twojej stronie".

### Bezpieczniki (nieprzekraczalne)

| Akcja | Domyślnie |
|---|---|
| Crawl, audyt, tracking, GEO, logi | **auto** (tylko odczyt) |
| Generowanie briefu i draftu | **auto** (nic nie publikujemy) |
| Wstawienie linków wewnętrznych (≤3) | **auto** (odwracalne) |
| Przepisanie title/description | **auto z 24h cofnięciem** |
| Wstrzyknięcie JSON-LD | **zatwierdzenie** |
| Publikacja nowego artykułu | **zatwierdzenie** (auto dopiero po 10 akceptacjach ≥90%) |
| Strony programatyczne | **zawsze zatwierdzenie, per szablon** |
| Przekierowania, canonical, robots/noindex | **zawsze zatwierdzenie** (może skasować ruch strony) |
| Wymiana linków / outreach | **zawsze zatwierdzenie** |

Trzy globalne wyłączniki, nie do obejścia:
1. **Limit tempa publikacji** — max(3/dzień, 10% zaindeksowanych stron/miesiąc)
2. **Limit zasięgu rażenia** — żadna auto-akcja nie dotyka >5% stron bez zatwierdzenia
3. **Zatrzymanie przy regresji** — spadek kliknięć >20% tydzień do tygodnia wstrzymuje wszystkie akcje zapisu. Zasada „nie pozwól robotowi kopać szybciej, gdy jesteś w dole".

### Bramki anty-slop (egzystencjalne, nie kosmetyczne)

Strony publikujące duże wolumeny nieredagowanej treści AI dostały **50–80% spadków ruchu** przy egzekwowaniu polityki scaled content abuse. System musi być zbudowany tak, żeby **strukturalnie nie mógł** produkować masowo bezwartościowych stron:

- **Bramka oryginalności:** odrzuć draft z podobieństwem cosinusowym >0,85 do wyniku z top10 lub do własnej istniejącej treści klienta. Blokująco, przed publikacją.
- **Wymóg unikalnego zasobu:** każdy artykuł musi mieć własne dane/analizę, cytat pierwszej ręki, autorski zrzut/diagram albo podpis eksperta. Brak zasobu = brak auto-publikacji.
- **Strony programatyczne wymagają realnego źródła danych.** Szablon z 400 permutacjami tych samych trzech zdań jest odrzucany przez system.
- **Nazwany, prawdziwy autor z `sameAs`.** Nigdy zmyślone encje autorskie.
- **Strażnik po publikacji:** artykuł z zerowymi wyświetleniami po 60 dniach automatycznie generuje zadanie `prune-or-improve`. System sprząta po sobie.
- **Najpierw konsoliduj, potem twórz.** Jeśli istniejąca strona pokrywa klaster, domyślną akcją jest `refresh`, nie `create`.

### ⚠️ Ostrzeżenia, które muszę Ci powiedzieć wprost

**1. Nie buduj sieci wymiany linków.** BabyLoveGrowth ma 4000+ partnerów i to sprzedaje. To jest link scheme. To jedyna funkcja z całej listy z **bezpośrednim ryzykiem manualnej kary** dla Twoich klientów, i zatruje wiarygodność wszystkiego innego, co platforma rekomenduje. Buduj prospecting i pisanie outreachu — ta sama robota do wykonania, zero ekspozycji na karę.

**2. `llms.txt` generuj, ale nie buduj na nim narracji.** Google oficjalnie stwierdziło, że nie jest potrzebny dla AI Overviews ani AI Mode i nie planuje wsparcia. Żaden duży dostawca nie zobowiązał się do czytania go w otwartym webie. Generator zrób, bo klienci pytają, wrzuć do audytu jako uwagę o niskim priorytecie — a wysiłek włóż w czynniki strukturalne (samodzielność chunków, odpowiedź wprost, dostępność bez JS, znaczniki encji), które **realnie** wpływają na retrieval.

**3. Strona renderowana po stronie klienta jest niewidoczna dla AI.** Kilka crawlerów retrievalowych nie wykonuje JavaScriptu. Strona może świetnie rankować w Google i być kompletnie nieobecna w odpowiedziach AI. Nasz crawler to wykrywa, bo i tak porównuje surowy HTML z wyrenderowanym.

**4. Dyscyplina zakresu.** Te 20 narzędzi to około 400 lat pracy inżynierskiej. Wygrywającym ruchem nie jest parytet funkcji — tylko bycie jedynym narzędziem, które **zamyka pętlę i dowodzi efektu**. Każda funkcja z Fazy 1 musi dać się uzasadnić zdaniem: „to jest niezbędne, żeby zadanie przeszło od sygnału do zmierzonego werdyktu".

### Pliki, które powstają pierwsze (każdy jest nośny)

1. `packages/core/src/url.ts` — normalizacja URL + `NORMALIZER_VERSION`. Decyduje, czy crawler, rank tracker, deduplikator cytowań i graf linków zgadzają się co do tego, czym jest „strona". Każdy późniejszy JOIN od tego zależy.
2. `packages/db/src/schema.ts` — schemat Drizzle neutralny dialektowo (SQLite + Postgres). Największa dźwignia na to, czy tryb CLI i SaaS zostaną jedną bazą kodu.
3. `packages/providers/src/interfaces.ts` ⭐ — **Twoja polisa na przyszłość.** Tu wchodzą darmowe adaptery dziś i płatne jutro.
4. `packages/rules/src/rule.ts` — interfejs reguły, zwłaszcza `requires: Capability[]` i `autofix?: AutofixSpec`. `autofix` to most od „narzędzia audytowego" do „platformy agentowej".
5. `packages/agent/src/opportunity.ts` — generatory kandydatów i scorer. To jest realny wyróżnik produktu.
6. `packages/geo/src/statistics.ts` — przedziały ufności i bramka „jeszcze nieistotne". Plik, który decyduje, czy liczby GEO są wiarygodne, czy to teatr.

---

## Weryfikacja

- **Faza 0:** `pnpm test` na adapterze GSC; ręczne porównanie liczby kliknięć w bazie z UI Search Console — muszą się zgadzać.
- **Faza 1:** crawl na Twojej stronie vs darmowy audyt Screaming Frog (500 URL) — nasze findings powinny pokrywać jego w ≥80%.
- **Faza 2:** ten sam prompt puszczony 10× — wariancja share-of-voice musi być raportowana, nie ukrywana. Porównanie z darmowym tierem Otterly.
- **Faza 3:** wygenerowany artykuł przechodzi walidację schema (Google Rich Results Test) i ma niezerowe linkowanie wewnętrzne.
- **Faza 4:** tydzień pracy bez ingerencji; sprawdzenie, czy task board odzwierciedla realny stan i czy pomiar zwrotny wpiął się do właściwych akcji.

