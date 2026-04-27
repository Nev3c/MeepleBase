# MeepleBase – Projektdokumentation für Claude Code

## Projektübersicht

**MeepleBase** ist eine mobile-first Web-App für leidenschaftliche Brettspieler:innen. Sie verbindet
Spielebibliothek, Partien-Tracking, Spielnotizen und soziale Vernetzung in einer modernen,
intuitiven App – und schließt die Lücken, die BGG, Board Game Stats und Brettspieler-gesucht
einzeln hinterlassen.

**Zielgruppe:** Hobbyist bis Enthusiast (1–5 Spieleabende pro Monat), 18–45 Jahre,
smartphone-affin, teilweise bereits BGG-Nutzer.

**Technologie-Stack (MVP):**
- Framework: Next.js 14+ (App Router)
- Styling: Tailwind CSS + shadcn/ui
- Datenbank: Supabase (PostgreSQL + Auth + Storage)
- State: Zustand (global), React Query / SWR (server state)
- Deployment: Vercel

---

## Namensgebung & Branding

**Produktname:** MeepleBase

- „Meeple" = universelles Brettspielsymbol, sofort erkennbar in der Zielgruppe
- „Base" = Heimatbasis + Datenbank (double meaning: Zuhause & Datenbasis)
- Kurz, international, domain-tauglich, app-store-tauglich
- Keine bekannten Konflikte in der Brettspieler-Bubble (geprüft April 2026)
- Tagline: *„Deine Brettspielwelt. Alles an einer Base."*

**App-Icon (kanonische Quelle):**
- Datei: `C:\Users\User\Desktop\Claude - Meeple Base\MeepleBase_Icon.png` (1024×1024)
- Auch kopiert nach: `public/MeepleBase_Icon_source.png`
- Beschreibung: Oranges Rounded-Square mit weißem Meeple auf gestapelten goldenen Karten, freigestellt (transparenter Außenbereich)
- Generierungsprozess: Schwarzen Außenrand per Flood-Fill entfernen → auf Quadrat zentrieren → auf Zielgröße skalieren, **kein neuer Hintergrund hinzufügen** (OS legt eigenen Hintergrund/Masking an)
- Generierte Dateien: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180px, orangener Hintergrund für iOS), `favicon.ico`, `icon.svg`
- **Wichtig:** Nie hochskalieren über native Auflösung (300px effektiv), nie Farbverläufe hinzufügen, nie den Meeple umfärben

---

## Architektur-Überblick

```
meeplebase/
├── app/                    # Next.js App Router
│   ├── (auth)/             # Login, Register, Onboarding
│   ├── (app)/              # Authenticated routes
│   │   ├── library/        # Spielebibliothek
│   │   ├── plays/          # Partien-Tracking
│   │   ├── games/[id]/     # Spieldetail + Notizen
│   │   ├── discover/       # Spieler/Gruppen/Events suchen
│   │   ├── profile/        # Eigenes Profil + Stats
│   │   └── settings/       # BGG-Sync, Präferenzen
│   └── api/                # Route Handlers
│       ├── bgg/            # BGG API Proxy + Sync
│       └── games/          # Interne Spieldaten
├── components/
│   ├── ui/                 # shadcn/ui Basiskomponenten
│   ├── library/            # Bibliothek-spezifische Komponenten
│   ├── plays/              # Partien-Tracking Komponenten
│   └── shared/             # Wiederverwendbare App-Komponenten
├── lib/
│   ├── bgg-api.ts          # BGG XML API Wrapper
│   ├── supabase/           # Client + Server Supabase Clients
│   └── utils/
└── types/                  # Globale TypeScript-Typen
```

---

## Datenbankschema (Supabase / PostgreSQL)

```sql
-- Nutzerprofil (erweitert Supabase Auth)
profiles (id, username, display_name, avatar_url, bgg_username, location, created_at)

-- Spielebibliothek
games (id, bgg_id, name, year, min_players, max_players, min_playtime, max_playtime,
       complexity, thumbnail_url, image_url, description, categories, mechanics)

user_games (id, user_id, game_id, status[owned|wishlist|previously_owned|for_trade],
            acquired_date, notes, bgg_synced_at)

-- Partien-Tracking
plays (id, user_id, game_id, played_at, duration_minutes, location, notes,
       incomplete, bgg_play_id)

play_players (id, play_id, user_id, display_name, score, winner, color, seat_order)

-- Spielnotizen
game_notes (id, user_id, game_id, title, content_markdown, note_type[rules|house_rules|strategy|links],
            is_pinned, created_at, updated_at)

game_note_attachments (id, note_id, file_url, file_type, label)

-- Soziales
user_groups (id, name, description, location, avatar_url, is_public, created_by)
group_members (id, group_id, user_id, role[admin|member], joined_at)

events (id, group_id, created_by, title, description, location, event_date,
        max_players, is_public)
event_participants (id, event_id, user_id, status[going|maybe|declined])
```

---

## BGG API Integration

Die BGG XML API 2 wird als Proxy über `/api/bgg` angesprochen, um CORS zu umgehen.

**Wichtige Endpoints:**
- `GET /api/bgg/search?q=` – Spielsuche
- `GET /api/bgg/game/:id` – Spieldetails
- `POST /api/bgg/sync` – Bidirektionaler Sync (Sammlung + Plays)

**Sync-Logik:**
1. BGG → MeepleBase: Sammlung importieren, neue Spiele anlegen, `bgg_synced_at` setzen
2. MeepleBase → BGG: Neue Plays via BGG API posten (erfordert BGG-Login des Users)
3. Konfliktauflösung: MeepleBase ist „source of truth" für Notizen, BGG für Metadaten

**Rate Limiting:** BGG-API ist nicht offiziell, daher konservativ cachen (24h für Spielmetadaten,
1h für Sammlungen). Redis oder Supabase-basiertes Caching verwenden.

---

## Design-System & UI-Richtlinien

Siehe Skill `frontend-design` (nativ in Claude Code App) für vollständige Designguidelines.

**MeepleBase Ästhetik:**
- Tone: Warm, leicht spielerisch, aber erwachsen und aufgeräumt. Kein „Gaming-Kitsch".
- Primärfarbe: Warmes Bernstein/Orange (`#E8821A`) – erinnert an Holz-Spielkomponenten
- Sekundär: Tiefes Schiefer (`#1E2A3A`) – für Text und dunkle Flächen
- Akzent: Frisches Grün (`#3DB87A`) – für Erfolge, CTAs
- Typografie: Display-Font `Fraunces` (variabel, leicht verspielt) + Body `Instrument Sans`
- Border-radius: großzügig (12–16px) für Cards, 8px für Buttons
- Mobile-first: alle Views primär für 375–430px Breite designt

**Komponenten-Prinzipien:**
- Spielcover-Bilder sind zentrales visuelles Element – immer prominent zeigen
- Leere Zustände (Empty States) sorgfältig gestalten – motivierend, nicht trist
- Ladeanimationen: Skeleton-Screens statt Spinner

---

## Performance-Richtlinien

Siehe Skill `vercel-react-best-practices` (nativ in Claude Code App) für vollständige Regeln.

**Kritische Regeln für MeepleBase:**
- BGG-API-Calls immer mit `Promise.all()` parallelisieren (`async-parallel`)
- Schwere Komponenten (Charts, Karten-Viewer) via `next/dynamic` laden (`bundle-dynamic-imports`)
- React Query für alle Server-State-Fetches – kein manuelles `useEffect` für Daten
- Spielcover-Bilder: `next/image` mit `priority` für above-fold, `loading="lazy"` sonst
- Lange Listen (Bibliothek 100+ Spiele): Virtualisierung mit `@tanstack/react-virtual`

---

## Entwicklungsphasen

### Phase 1 – MVP (Monate 1–3)

**Ziel:** Kernwert lieferbar, solo nutzbar ohne soziale Komponente.

| Feature | Beschreibung | Priorität |
|---------|-------------|-----------|
| Auth | E-Mail + OAuth (Google) via Supabase | P0 ✅ |
| Spielebibliothek | Sammlung verwalten, Status, Sort, Filter | P0 ✅ |
| BGG-Sync (Import) | CSV-Import + Wikidata-Suche + Einzelsuche per BGG-ID | P0 ✅ |
| Partien-Tracking | Partie erfassen, bearbeiten, löschen, Spieler/Score/Gewinner | P0 ✅ |
| Spieldetail | Cover, Metadaten editierbar, Notizen, Bilder, Bewertung | P0 ✅ |
| Spielnotizen | Hausregeln + allgemeine Notizen pro Spiel | P1 ✅ |
| Basisstatistiken | Profil: Spiele, Partien, Lieblingsspiel | P1 ✅ |
| PWA | Offline-fähig für Bibliothek und Partien erfassen | P1 ❌ |
| BGG-Sync (Export) | Neue Plays zurück zu BGG schreiben | P2 ❌ |

**MVP Definition of Done:**
- Nutzer kann Sammlung von BGG importieren
- Nutzer kann Partien erfassen und sehen
- Nutzer kann Notizen zu Spielen hinterlegen
- App funktioniert auf Mobile-Browser einwandfrei

---

### Phase 2 – Soziales & Entdecken (Monate 4–6)

| Feature | Beschreibung |
|---------|-------------|
| Nutzerprofile | Öffentliche Profile mit Sammlung + Stats |
| Spielerabend-Planer | Gruppe einladen, Verfügbarkeit + Spielvorschläge |
| Gruppen | Spielgruppen erstellen/beitreten |
| Events | Spieleabende anlegen, RSVP |
| Spieler finden | Suche nach Standort, Spielpräferenzen |
| Aktivitätsfeed | Was spielen Freunde gerade? |

---

### Phase 3 – Intelligenz & Wachstum (Monate 7–12)

| Feature | Beschreibung |
|---------|-------------|
| KI-Empfehlungen | Spielvorschläge basierend auf History + Kontext |
| Regelhilfe-Assistent | Schnellantworten auf Regelstreit-Fragen |
| Tiefe Statistiken | Jahresrückblick, Win-Rates, Trend-Analysen |
| Leihen & Tauschen | Community-basiertes Verleihsystem |
| Preisalarm | Wunschliste mit Preisbenachrichtigungen |
| Turniere | Einfaches Turnier-/Liga-Management |

---

## Coding-Konventionen

- **Sprache:** TypeScript strict mode, kein `any`
- **Komponenten:** Functional components, keine Class-Komponenten
- **Dateinamen:** kebab-case für Dateien, PascalCase für Komponenten
- **API-Typen:** Zod-Schemas für alle externen API-Responses (BGG, Supabase)
- **Fehlerbehandlung:** Error Boundaries für alle Hauptbereiche, Toast-Notifications für User-Feedback
- **Tests:** Vitest + Testing Library für Komponenten, Playwright für E2E (kritische Flows)
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`)
- **i18n:** Vorbereitung für Mehrsprachigkeit (Deutsch + Englisch MVP), `next-intl`

---

## 🔒 Security — Pflichtregeln (Non-Negotiable)

> **Hintergrund:** Im April 2026 wurden `friendships` und `messages` ohne RLS angelegt.
> Supabase hat eine Sicherheitswarnung gesendet. Dieser Abschnitt stellt sicher, dass das nie
> wieder passiert. Claude Code muss diese Regeln bei JEDER Datenbankarbeit prüfen.

---

### Regel 1: Jede neue Tabelle bekommt sofort RLS

**Keine Ausnahmen.** Eine Tabelle ohne RLS ist öffentlich lesbar und schreibbar für jeden
der den `anon` Key kennt (der im Browser sichtbar ist).

**Checkliste für jede neue Tabelle — vor dem ersten `git push`:**

```
[ ] ALTER TABLE <tabelle> ENABLE ROW LEVEL SECURITY;
[ ] SELECT-Policy: Wer darf lesen? (nur eigene Rows? Freunde? alle authentifizierten?)
[ ] INSERT-Policy: Wer darf schreiben? (nur eigener user_id/from_id?)
[ ] UPDATE-Policy: Wer darf updaten? (Eigentümer? Empfänger für read_at?)
[ ] DELETE-Policy: Wer darf löschen? (meist nur Eigentümer)
[ ] Getestet: Anon-Zugriff schlägt fehl (kein Row zurück, kein Insert möglich)
```

**Template für nutzerbezogene Tabellen:**
```sql
ALTER TABLE <tabelle> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "<Tabelle>: Nutzer sieht eigene Einträge"
  ON <tabelle> FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "<Tabelle>: Nutzer erstellt eigene Einträge"
  ON <tabelle> FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "<Tabelle>: Nutzer bearbeitet eigene Einträge"
  ON <tabelle> FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "<Tabelle>: Nutzer löscht eigene Einträge"
  ON <tabelle> FOR DELETE
  USING (auth.uid() = user_id);
```

---

### Regel 2: Service-Role-Key nur serverseitig, niemals im Client

| ✅ Erlaubt | ❌ Verboten |
|-----------|-----------|
| `SUPABASE_SERVICE_ROLE_KEY` in API Route Handlers (`/api/...`) | `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` (würde Key exponieren) |
| Admin-Client für Cross-User-Queries (z.B. Spielersuche) | Service-Role-Client in `"use client"` Komponenten |
| Admin-Client für Storage-Uploads | Service-Role-Key in `.env.local` ohne `.local`-Suffix comitten |

**Wann Admin-Client verwenden:**
- Profile anderer Nutzer lesen (Search, Nearby) — RLS würde das blockieren
- Systeminterne Operationen (Cleanup, Aggregation)
- Storage-Uploads (Supabase SSR-Client wirft bei Storage Exceptions)

**Wann normalen Server-Client verwenden:**
- Alles was im Kontext des eingeloggten Users passiert
- Friendship-Status abfragen (eigene Rows)
- Nachrichten lesen/senden

---

### Regel 3: API-Routes immer mit Auth-Check beginnen

Jede Route in `/api/` die Daten liest oder schreibt MUSS als erstes den User prüfen:

```typescript
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
```

**Niemals** auf `session` oder `getSession()` verlassen — nur `getUser()` validiert serverseitig.

---

### Regel 4: User-Inputs niemals ungefiltert in Queries

- Supabase-Queries mit `.eq()`, `.neq()` etc. sind parametrisiert — kein SQL-Injection-Risiko
- **Niemals** rohe Strings in `.rpc()` oder direkte SQL-Strings interpolieren
- IDs aus URL-Params (z.B. `[userId]`) immer als String behandeln, nie als Zahl in SQL

---

### Regel 5: Keine sensiblen Daten in API-Responses

Beispiele was NICHT zurückgegeben werden darf:
- `location_lat` / `location_lng` (exakte Koordinaten — nur `distance_km` zurückgeben)
- `email` aus `auth.users` (nur `username`, `display_name`, `avatar_url`)
- Passwort-Hashes, interne IDs die Rückschlüsse ermöglichen

---

### RLS-Status aller Tabellen (Stand April 2026)

| Tabelle | RLS | Policies |
|---------|-----|---------|
| `profiles` | ✅ | authenticated read all; update own |
| `games` | ✅ | public read; authenticated insert/update |
| `user_games` | ✅ | own rows only |
| `plays` | ✅ | own rows only |
| `play_players` | ✅ | via play ownership |
| `game_notes` | ✅ | own rows only |
| `game_note_attachments` | ✅ | via note ownership |
| `friendships` | ✅ | requester OR addressee (April 2026 nachgerüstet) |
| `messages` | ✅ | from_id OR to_id (April 2026 nachgerüstet) |
| `user_groups` | ⚠️ | noch nicht angelegt (Phase 2 offen) |
| `group_members` | ⚠️ | noch nicht angelegt (Phase 2 offen) |
| `events` | ⚠️ | noch nicht angelegt (Phase 2 offen) |
| `event_participants` | ⚠️ | noch nicht angelegt (Phase 2 offen) |

> **Wenn eine Tabelle auf ⚠️ steht:** Bevor sie produktiv genutzt wird, MUSS RLS aktiviert
> und diese Tabelle auf ✅ gesetzt werden.

---

### Security-Checkliste vor jedem Feature-Merge

```
[ ] Neue Tabellen? → RLS aktiviert + alle 4 Policies (SELECT/INSERT/UPDATE/DELETE)
[ ] Neue API-Route? → Auth-Check am Anfang (getUser())
[ ] Koordinaten oder sensible Daten? → Werden sie aus der Response herausgefiltert?
[ ] Service-Role verwendet? → Nur in /api/, nicht in Client-Komponenten
[ ] Neue Env-Variable? → Hat kein NEXT_PUBLIC_ Prefix wenn es ein Secret ist?
[ ] Supabase Dashboard → Security Advisor geprüft? (kein neuer roter Alert)
```

---

## Umgebungsvariablen

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# BGG (kein Key nötig, aber Rate-Limit-Config)
BGG_CACHE_TTL_SECONDS=86400

# YouTube Data API v3 (für Spielmusik-Suche im Sound-Tab)
# Kostenlos: Google Cloud Console → APIs & Services → YouTube Data API v3 aktivieren → API-Key erstellen
# Quota: 10.000 units/Tag kostenlos; eine Suche kostet 100 units → 100 Suchen/Tag gratis
YOUTUBE_DATA_API_KEY=

# Optional: KI (Phase 3)
ANTHROPIC_API_KEY=
```

---

## Wichtige externe Ressourcen

- BGG XML API 2 Docs: https://boardgamegeek.com/wiki/page/BGG_XML_API2
- BGG API Wrapper (npm): `bgg-js` oder eigener Wrapper in `/lib/bgg-api.ts`
- Supabase Docs: https://supabase.com/docs
- shadcn/ui: https://ui.shadcn.com
- Fraunces Font: https://fonts.google.com/specimen/Fraunces

---

## Skills & Hilfsressourcen

Diese Skills sind nativ in der Claude Code App hinterlegt und werden über das Skill-Tool aufgerufen (nicht als Dateien im Projektverzeichnis). Claude Code soll sie eigenständig nutzen wenn die Situation es erfordert.

| Skill | Name | Wann nutzen |
|-------|------|-------------|
| `frontend-design` | frontend-design | Bei jedem neuen UI-Screen, Komponente oder Layout – für Ästhetik, Tonalität, kreative Richtung |
| `ui-ux-pro-max` | ui-ux-pro-max | Bei UX-Entscheidungen, Komponenten-Patterns, Accessibility, Design System |
| `vercel-react-best-practices` | vercel-react-best-practices | Bei jedem React/Next.js-Task – Performance, Data Fetching, Bundle Size |
| `vercel-composition-patterns` | vercel-composition-patterns | Bei Komponenten-Architektur, wiederverwendbaren APIs, Refactoring |
| `webapp-testing` | webapp-testing | Wenn Tests geschrieben oder debuggt werden (ab Phase 1 Ende) |

**Faustregel:** Vor dem Schreiben von UI-Code immer `frontend-design` + `ui-ux-pro-max` aufrufen.
Vor dem Schreiben von React-Komponenten immer `vercel-react-best-practices` + `vercel-composition-patterns` aufrufen.

---

## ⚖️ Rechtlich sicher — Pflichtregeln (Non-Negotiable)

> Gilt unabhängig davon ob Geld verdient wird. Die DSGVO gilt sobald personenbezogene Daten
> von EU-Bürgern verarbeitet werden. Kleinprojekte haben geringes Enforcement-Risiko,
> aber die Pflichten bestehen trotzdem.

---

### Regel 1: Neue Datenverarbeitung → Datenschutzerklärung updaten

Jedes Mal wenn ein neues Feature personenbezogene Daten verarbeitet, muss `/app/privacy/page.tsx`
**vor dem Commit** aktualisiert werden.

**Besonders relevant:**
- Neue Felder in `profiles` oder anderen Tabellen mit Personenbezug
- Neue Drittanbieter / APIs die Daten empfangen (auch nur IP-Adresse)
- Neue Standort-, Kamera- oder Mikrofon-Nutzung
- Neue Drittanbieter-Embeds (YouTube, Maps, etc.)

---

### Regel 2: Einwilligung vor sensitiven Daten

| Datentyp | Anforderung |
|---|---|
| GPS / Standort-Koordinaten | Explizite Einwilligung via Browser-Prompt; in DSE dokumentiert |
| Push-Benachrichtigungen | Browser-Permission + in DSE dokumentiert |
| Fotos / Kamera | Browser-Permission; Nutzer lädt aktiv hoch |
| Gesundheitsdaten, Religionsdaten | Gar nicht erheben (Art. 9 DSGVO – besondere Kategorien) |

---

### Regel 3: Drittanbieter-Checkliste

Vor Integration eines neuen Drittanbieters:
```
[ ] Was wird übermittelt? (IP? E-Mail? User-ID?)
[ ] Ist ein AVV (Auftragsverarbeitungsvertrag) nötig? → Ja wenn Auftragsverarbeiter
[ ] In Datenschutzerklärung aufgenommen?
[ ] Nutzer informiert (falls nicht offensichtlich)?
```

**Aktuelle Drittanbieter mit AVV (bereits erledigt):**
- Supabase ✅ (Datenbank, EU-Region Frankfurt)
- Vercel ✅ (Hosting)

**Drittanbieter ohne AVV (keine Auftragsverarbeitung, nur Datenweitergabe):**
- Google OAuth — Nutzer stimmt bei Login zu
- OpenStreetMap/Nominatim — nur Koordinaten, kein Personenbezug
- BGG, Melodice — nur Metadaten/Suchanfragen

---

### Regel 4: Impressum vollständig halten

Das Impressum unter `/impressum` ist **abmahnfähig** wenn unvollständig.
Pflichtangaben nach § 5 TMG:
- Vollständige Postanschrift (Straße, PLZ, Ort)
- Telefonnummer (E-Mail allein reicht nicht)
- Bei gewerblicher Tätigkeit: Handelsregisternummer

→ **TODO:** Postanschrift und Telefonnummer in `/app/impressum/page.tsx` eintragen.

---

### Regel 5: Urheberrecht bei Drittinhalten

| Inhalt | Status | Hinweis |
|---|---|---|
| Spielcover / Thumbnails von BGG | 🟡 Toleriert | Urheberrecht liegt bei Verlagen; BGG duldet es |
| Spielbeschreibungen von BGG | 🟡 Toleriert | Gleiches gilt |
| Google Translate gtx-API | 🟡 ToS-Verletzung | Bei Monetarisierung auf offizielle API wechseln |
| YouTube Soundboard | 🔴 Risiko | AGB schreibt vor: nur lizenzfreie Inhalte |
| Wikidata SPARQL | ✅ Unbedenklich | CC0-Lizenz |
| Nutzer-Uploads (Fotos) | ✅ | Nutzer ist verantwortlich (AGB Abschnitt 3) |

---

### Rechtliche Checkliste vor jedem Feature-Merge

```
[ ] Werden neue personenbezogene Daten verarbeitet? → DSE updaten
[ ] Neuer Drittanbieter? → AVV prüfen + DSE ergänzen
[ ] Standort/Kamera/Sensoren? → Einwilligungsflow implementieren
[ ] Nutzerinhalte? → AGB deckt die Nutzungsrechte ab
[ ] Urheberrechtlich geschützte Drittinhalte? → Lizenz prüfen
```

---

## 📋 Changelog-Pflicht (Non-Negotiable)

> Jede Code-Änderung die committed wird MUSS vorher in `CHANGELOG.md` dokumentiert sein.
> Das ist genauso verbindlich wie die Security-Regeln oben.

**Format:** `CHANGELOG.md` im Projekt-Root folgt [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

**Wann updaten:**
- Vor jedem `git commit` — niemals danach
- Neue Features → `### Added` im `[Unreleased]` Abschnitt
- Bugfixes → `### Fixed`
- Breaking Changes → `### Changed`
- Entfernte Features → `### Removed`

**Vor jedem Release (version bump):**
- `[Unreleased]` → `[x.y.z] — YYYY-MM-DD` umbenennen
- Neuen leeren `[Unreleased]` Abschnitt oben einfügen
- `package.json` version entsprechend setzen

**Versionierung (SemVer):**
- `0.x.0` — neues Feature / Tab / Seite (Minor)
- `0.x.y` — Bugfix / kleines UI-Update (Patch)
- `1.0.0` — Produkt-Launch / Public Beta

**Claude-Regel:** Wenn ich Code-Änderungen committe, MUSS ich vorher prüfen ob `CHANGELOG.md` aktuell ist. Wenn nicht, zuerst updaten, dann committen.

---

## Arbeitsweise & Kommunikation

**Wie der Entwickler kommuniziert:**
Der Entwickler kommuniziert in natürlicher Sprache, nicht als Terminal-Befehle.
Anfragen kommen z.B. so: „Bau mir das Formular für eine neue Partie" oder
„Die Bibliotheksseite lädt zu langsam, was können wir tun?" – nicht als
strukturierte Bullet-Listen oder technische Specs.

**Was das von Claude Code erwartet:**
- Anfragen verstehen und eigenständig in konkrete Umsetzungsschritte übersetzen
- Bei Unklarheiten **eine** gezielte Rückfrage stellen, nicht mehrere auf einmal
- Nach erledigten Tasks kurz zusammenfassen was gemacht wurde und was logisch als nächstes käme – aber nicht selbst anfangen ohne grünes Licht
- Architekturentscheidungen kurz begründen wenn sie vom bisherigen Weg abweichen
- Wenn eine Anfrage mehrere sinnvolle Umsetzungswege hat, kurz die Optionen nennen und empfehlen – nicht einfach den erstbesten Weg nehmen

**Nach jeder abgeschlossenen Einheit:**
- Diese CLAUDE.md aktualisieren wenn sich Architektur, Stack oder Konventionen geändert haben
- Neue Entscheidungen unter „Bekannte Herausforderungen & Entscheidungen" dokumentieren

**Kontextverwaltung:**
- Der Entwickler arbeitet in der Claude Code App, nicht im Terminal
- Bei sehr langen Sessions kann der Kontext voll werden – dann darauf hinweisen und vorschlagen den Kontext zu clearen
- Wichtige Entscheidungen immer in CLAUDE.md festhalten, nicht nur im Chat-Verlauf

**Modell:** Claude Sonnet für den Alltag. Nur bei komplexen Architekturentscheidungen
oder hartnäckigen Problemen auf Opus wechseln (in den Claude Code Einstellungen).

---

## Phase 2 Status (Stand April 2026)

| Feature | Status |
|---------|--------|
| Freundschaftssystem (gegenseitig, pending/accepted/declined) | ✅ fertig |
| Spielersuche nach Username/Anzeigename | ✅ fertig |
| Freundesprofil-Seite mit abgespeckter Bibliotheksansicht | ✅ fertig |
| Async-Nachrichten (Posteingang + Gesprächs-Thread) | ✅ fertig |
| Bibliotheks-Sichtbarkeit (privat/Freunde/öffentlich) | ✅ fertig |
| Navigation: "Entdecken" → "Spieler" (/players) | ✅ fertig |
| Spieler finden nach Standort (GPS + Radius-Filter) | ✅ fertig |
| Aktivitätsfeed | ❌ offen |

---

## Phase 1 Status (Stand April 2026)

| Feature | Status |
|---------|--------|
| Auth (E-Mail + Google OAuth) | ✅ fertig |
| Spielebibliothek (Status, Filter, Sort) | ✅ fertig |
| BGG-Import via CSV | ✅ fertig |
| Spielsuche via Wikidata SPARQL | ✅ fertig (BGG-API von Vercel-IPs geblockt seit Okt 2025) |
| Spieldetail (Metadaten, Bilder, Notizen) | ✅ fertig |
| Partien-Tracking (erfassen, bearbeiten, löschen) | ✅ fertig |
| Eigene Bewertung (1–10) | ✅ fertig (immer auf Karte sichtbar, auch ohne Wertung) |
| Partien-Sortierung | ✅ fertig (Datum, Spiel A–Z) |
| Partien-Fotos | ✅ fertig (Bucket + Spalte vorhanden) |
| PWA-Icons (192, 512, apple-touch) | ✅ fertig — solid orange bg, kein Transparent-Rand mehr |
| Profil-Stats (Spiele, Partien, Lieblingsspiel) | ✅ fertig |
| Onboarding Wizard (6 Schritte) | ✅ fertig — neue User auto-erkannt via created_at < 30 min |
| Beschreibungen DE übersetzen | ✅ Google gtx-API (kein Key), Button in Einstellungen |
| PWA / Offline | ✅ fertig (@ducanh2912/next-pwa, Workbox, /~offline Fallback) |
| BGG Weight/Complexity importieren | ✅ fertig — item.stats.avgweight → games.complexity |
| BGG Best-Players Poll | ✅ fertig — parseBestPlayers() → games.best_players int[] (SQL-Migration nötig) |
| BGG-Sync Export | ❌ offen (Phase 1 P2) |

---

## Bekannte Herausforderungen & Entscheidungen

**BGG API von Cloud-IPs geblockt (seit Okt 2025):**
BGG blockiert alle Anfragen von Vercel/Cloud-IPs mit 401.
→ Spielsuche läuft über Wikidata SPARQL (BGG-IDs via P2339), Details via `boardgamegeek.com/api/geekitems?objectid=ID`.

**BGG-Login für Export:** BGG hat kein OAuth.
→ MVP: Nur Import. Export später mit BGG-Credentials oder manuellem Export.

**Spielbeschreibungen nur auf Englisch (BGG-Quelle):**
→ Google Translate unofficial gtx-API (kein Key, kein Account) für Batch-Übersetzung.
→ Ergebnis in `games.description_de`. Manuell überschreibbar via `user_games.custom_fields`.
→ Batch-Endpoint: `POST /api/translate/batch` (20 Spiele pro Aufruf).
→ Aufruf via Button "20 Beschreibungen übersetzen" in Einstellungen → mehrfach klicken bis fertig.

**BGG rating_avg oft null nach CSV-Import:**
→ Wird nur befüllt wenn geekitems-Lookup beim Hinzufügen erfolgt. CSV-Import füllt es nicht.
→ Sortierung nach Bewertung nutzt `personal_rating ?? game.rating_avg ?? 0`.

**`user_games.custom_fields` (JSONB):**
→ Speichert Nutzer-Overrides für Name, Beschreibung, Spieleranzahl, Spielzeit, Kategorien.
→ Wird beim CSV-Reimport **nicht** überschrieben wenn gesetzt.
→ SQL-Migration nötig: `ALTER TABLE user_games ADD COLUMN IF NOT EXISTS custom_fields JSONB;`

**`games.description_de` (TEXT):**
→ SQL-Migration nötig: `ALTER TABLE games ADD COLUMN IF NOT EXISTS description_de TEXT;`

**`games.best_players` (integer[]):**
→ Speichert BGG-Community-Empfehlung ("Best: 4, 6, 8") als Integer-Array.
→ SQL-Migration nötig: `ALTER TABLE games ADD COLUMN IF NOT EXISTS best_players integer[];`
→ Parser: `parseBestPlayers()` in import/route.ts und import-csv/route.ts.
→ Threshold: "Best"-Votes > 25% aller Stimmen UND mind. 5 Gesamtstimmen.

**Auth-Redirect-Logik:**
→ `emailRedirectTo` und OAuth `redirectTo` IMMER als plain `/auth/callback` (kein `?next=` — Supabase validiert gegen Whitelist).
→ Callback erkennt neue User via `user.created_at < 30 min` → /onboarding, sonst → /library.
→ Explizites `?next=` im Callback-URL bleibt als Override möglich (z.B. Deep-Links).

**Supabase Storage Bucket "game-images":** ✅ angelegt
→ Public bucket, max 5 MB. Bilder werden clientseitig auf max 1200px/JPEG85 komprimiert.
→ Service-Role-Key nötig für Upload (in `SUPABASE_SERVICE_ROLE_KEY`).

**Supabase Storage Bucket "play-images":** ✅ angelegt
→ Public bucket für Partien-Fotos, max 5 MB.
→ `plays.image_url TEXT`: ✅ vorhanden (Schema-Dump April 2026).
→ API: `POST /api/play-images` (multipart/form-data, Feld `file`), returns `{ url: string }`.

**`plays.cooperative` Spalte:** ✅ vorhanden (DEFAULT false)
→ Beim Einschalten von Kooperativ werden alle Spieler-Winner-Flags client-seitig gecleart.

**Cold Start Soziale Features:**
→ Solo-Wert zuerst. Soziale Features erst wenn 500+ aktive User.

**Preview/Testing:**
→ Testaccount: meepletest@ulm-dsl.de / meepletest@ulm-dsl.de
→ Nach Code-Änderungen immer `git push` damit Vercel neu baut (lokaler dev-server reicht nicht für Produktionstests).
→ Preview-Tool kann React-State nicht über DOM-Value triggern — Spieler/Scores beim Testen direkt in der App eingeben.

**Bottom-Sheet Tastatur-Verhalten (hart gelernt, April 2026 — Android + iOS):**
→ Sheet benutzt `height: min(92svh, 100dvh)` (KEIN `max-height`, KEIN JS, KEIN `translateY`).
→ `min(92svh, 100dvh)` Logik: Tastatur geschlossen → `dvh ≈ svh` → Ergebnis = 92svh (normales Sheet). Tastatur offen → `dvh` schrumpft stark → 100dvh < 92svh → Ergebnis = 100dvh (Sheet füllt Raum über Tastatur). Autocomplete-Bar: `dvh` ändert sich leicht, Sheet passt sich via CSS an — kein JS-Tracking nötig.
→ `height` statt `max-height` ist entscheidend: bei `max-height` ändert sich die Sheet-Höhe wenn Suchergebnisse laden → sichtbares Rucken. Bei fester `height` bleibt das Sheet stabil, Inhalt scrollt intern.
→ `overflow: hidden` auf dem Sheet-Div verhindert, dass wachsender Inhalt das Sheet aufbläht.
→ Viewport-Meta muss `interactiveWidget: "resizes-visual"` haben (in `layout.tsx`): Android Chrome 108+ schrumpft dann das Visual-Viewport wenn die Tastatur aufgeht — `position:fixed; bottom:0` bleibt über der Tastatur (wie iOS 15+ nativ).
→ iOS 15+: `position:fixed; bottom:0` folgt automatisch dem Visual-Viewport. `translateY` darf NICHT verwendet werden (würde Bewegung verdoppeln und Sheet nach unten schleudern).
→ Das `dvh`-basierte Keyword-Tracking per JS (`visualViewport.resize`) wurde entfernt — es verursachte auf iOS die Doppelverschiebung und auf Android Layout-Instabilität.

**Mobile Bottom-Nav: Stabilitätsregeln (hart gelernt, April 2026):**
→ ALLE Seiten-Wrapper in `(app)/` MÜSSEN `min-h-[calc(100dvh-72px)]` haben. Fehlt diese Klasse auf einer Seite, ist die Seite kürzer als alle anderen → Android Chrome passt beim Navigieren dorthin die Viewport-Höhe an → `position:fixed` Bottom-Nav springt kurz.
→ Flex-Inputs in flex-Containern MÜSSEN `min-w-0` haben. Browser-Default ist `min-width: auto` für `<input>`, was das Element am Schrumpfen hindert → horizontaler Overflow → auf Android Chrome verliert `position:fixed` seinen Viewport-Bezug und scrollt mit dem Inhalt.
→ Bottom-Nav darf KEIN `backdrop-blur` verwenden (bekannter Android-Chrome-Bug mit `backdrop-filter` auf `position:fixed`-Elementen während Seitenübergängen).
→ Bottom-Nav braucht `style={{ transform: "translateZ(0)", willChange: "transform" }}` für stabilen GPU-Layer.
→ Bottom-Nav aktiver Indikator immer im DOM lassen, nur Farbe wechseln (`bg-transparent` ↔ `bg-amber-500`). Konditionelles DOM-Einfügen/-Entfernen löst Repaints aus.
→ Icon `strokeWidth` und Label `font-weight` im Nav immer konstant (nicht pro aktivem/inaktivem State unterschiedlich) — unterschiedliche Werte verschieben das Layout minimal.

**BGG geekitems API — Bild-Felder (KRITISCH — Datenschutz):**
→ `item.imageurl` = **offizielle Cover-Art des Verlags** (sicher, kein Personenbezug). Dieses Feld IMMER für `thumbnail_url` UND `image_url` verwenden.
→ `item.topimageurl` = **höchstbewertetes Community-Upload** — kann Fotos von Spielern/Personen enthalten. **NIEMALS** für `thumbnail_url` oder `image_url` verwenden (Datenschutzrisiko, DSGVO).
→ `item.images.thumb.url` ist ein inkompatibles Format — führt zu falschen/leeren Thumbnails. Nicht verwenden.
→ Regel: In ALLEN Routen gilt `thumbnail_url = image_url = item.imageurl`. Kein anderes Feld.
→ Bei `games/ensure`: Client übergibt `name` und `thumbnail_url` direkt (bereits via lookup gefetcht), Endpoint nutzt diese als primäre Quelle und fällt nur auf geekitems zurück wenn nicht vorhanden.
→ **Hintergrund (April 2026):** Ein Commit setzte versehentlich `image_url = item.topimageurl`, was Community-Fotos als Hero-Bild anzeigen konnte. Wurde sofort reverted. Diese Regel ist Non-Negotiable.

**Soziale Features — Datenbankschema (Phase 2):**
→ `friendships` Tabelle: requester_id, addressee_id, status (pending/accepted/declined). Unique auf (requester_id, addressee_id).
→ `messages` Tabelle: from_id, to_id, content, read_at. Async, kein Realtime.
→ `profiles.library_visibility` TEXT DEFAULT 'friends' — CHECK IN ('private', 'friends', 'public').
→ Service-Role wird serverseitig für Profile-Suche genutzt (RLS auf profiles muss authenticated-read erlauben).
→ Abgespekte Bibliotheksansicht zeigt: Cover, Name, Anzahl Partien — KEIN Preis, keine Bewertung, keine Notizen.
→ `/players` ersetzt `/discover`. `/discover` leitet permanent weiter. Spiele-Tab (Ungespielt + Was heute?) bleibt als zweiter Tab in /players.

**Supabase Storage — Admin-Client für Uploads:**
→ Für Storage-Admin-Operationen (Upload, Bucket-Verwaltung) IMMER `createClient` aus `@supabase/supabase-js` direkt verwenden, NICHT `createServerClient` aus `@supabase/ssr`.
→ `createServerClient` mit service_role kann bei Storage-Operationen unbehandelte Exceptions werfen statt `{error}` zurückzugeben.

**Friendship DELETE — Admin-Client Pflicht:**
→ `DELETE /api/friendships/[id]` MUSS den Admin-Client verwenden, nicht den anon SSR-Client.
→ Hintergrund: RLS-Policy erlaubt DELETE nur für requester/addressee — der anon-Client prüft das korrekt, löscht aber "erfolgreich" (HTTP 200) ohne tatsächliche Rows zu löschen wenn Supabase intern einen Fehler hat. Admin-Client + `{ count: "exact" }` liefert echte Zeilenzählung.
→ Ownership-Prüfung passiert weiterhin explizit via `.or(requester_id.eq.${user.id},addressee_id.eq.${user.id})` — kein Sicherheitsproblem.
→ Wenn `count === 0` nach DELETE → 404 zurückgeben (verhindert stilles Scheitern).

**Friendship Re-Add nach "declined":**
→ PATCH /api/friendships/[id] mit `action: "decline"` setzt Status auf "declined" (löscht nicht).
→ Damit ein neues Freundschaftsgesuch möglich ist, muss POST /api/friendships einen existierenden "declined"-Record zuerst via Admin-Client löschen, dann frisch inserieren.
→ Logik: `if (existing && existing.status !== "declined") return 409; if (existing?.status === "declined") await admin.delete(existing.id);`

**Spieler-Suche — Sofortanzeige ohne Eingabe:**
→ `/api/players/search` gibt bei leerem `q` alle Spieler A-Z zurück (Limit 50) statt early-return [].
→ `page.tsx` lädt alle Spieler server-seitig (parallel zu Friendships + Messages via `Promise.all`), inkl. Friendship-Status aus dem bereits geholten Friendship-Map.
→ `PlayersClient` erhält `initialSearchResults: SearchPlayer[]` als Prop und setzt `searchResults` damit initial. Beim Löschen der Suche → Reset auf `initialSearchResults` (nicht `null`).

**SucheTab — Moduswechsler als primäre Navigation:**
→ A-Z / Entfernung Toggle ist der primäre Moduswechsler (oben, volle Breite), nicht eine Sortierfunktion unter den Ergebnissen.
→ A-Z-Modus: Text-Suche API-basiert. Entfernung-Modus: GPS auto-triggert beim ersten Wechsel.
→ Im Entfernung-Modus: kompakte Radius-Chips (25/50/100 km), optional client-seitiger Textfilter wenn Ergebnisse geladen.
→ Kein separater "In meiner Nähe"-Button mehr — der Moduswechsel erledigt das.

**Projekt-Deployment-Setup (Stand April 2026):**
→ Lokaler Ordner: `C:\Users\User\Desktop\Claude - Meeple Base\meeplebase`
→ GitHub: `https://github.com/Nev3c/MeepleBase` (Branch: `main`)
→ Vercel: Auto-Deploy bei jedem Push auf `main`
→ Pre-push Hook: TypeScript-Check (`tsc --noEmit`) läuft automatisch vor jedem `git push`
→ Für Code-Änderungen via Chat: immer `git push` am Ende — Vercel baut dann automatisch
→ claude.ai Browser/Android: nur für Planung/Diskussion geeignet; Datei-Edits und git-Befehle erfordern Claude Code Desktop
