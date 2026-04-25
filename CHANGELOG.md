# Changelog

All notable changes to MeepleBase are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Spieler-Seite: Geplante Partien — Spieleabend mit mehreren Spielen planen, Freunde einladen
- Spieler-Seite: Vergangene Partien — mehrere Spiele pro Session auswählbar
- Spieler-Seite: Einladungen-Tab im Spieler-Menü für ausstehende Spieleabend-Einladungen
- Vergangen/Geplant-Tab-Toggle auf der Partien-Seite
- **Statistiken-Seite** (`/stats`): persönliche Stats (Partien/Monat als CSS-Balkendiagramm, Siegquote W/L, Lieblingsspiel) + Freunde-Rankings (Meistgespielt / Siegquote / Meistgekauft) per Monat/Jahr/Gesamt
- Finanzen-Bereich (Sammlungswert + Ausgaben/Monat) standardmäßig verborgen mit Auge-Toggle für Datenschutz
- Profil-Stats-Band ist jetzt klickbar (→ /stats) mit BarChart2-Icon als CTA
- "Statistiken & Rankings" Menüeintrag im Profil
- Onboarding überarbeitet: neue Slides für Spieler, Spielerabend-Planer, Statistiken/Rankings; Entdecken-Slide entfernt
- Onboarding erscheint jetzt zuverlässig nach Registrierung: Register-Form erkennt sofortige Session (Auto-Confirm) und leitet direkt zu /onboarding weiter
- Onboarding-Banner in der Bibliothek für neue Accounts (< 30 Tage, noch kein Onboarding abgeschlossen)

### Changed
- Sammlungswert aus dem Profil-Stats-Band entfernt — liegt jetzt exklusiv hinter dem Privacy-Toggle auf /stats
- Auth-Callback: Onboarding-Erkennung von 30 Minuten auf 7 Tage ausgedehnt (deckt E-Mail-Bestätigungs-Delays ab)

### Fixed
- Geplante Partien: Einladungen senden funktioniert nicht — POST /api/play-sessions verwendete den User-Client für alle INSERTs, was eine zirkuläre RLS-Auswertung auslöste (`play_sessions` SELECT-Policy referenziert `play_session_invites`; `play_session_invites` INSERT-Policy referenziert `play_sessions`). Alle Writes jetzt via Admin-Client (Service Role), Auth bleibt via `getUser()` gesichert, Ownership explizit mit `created_by: user.id` gesetzt.
- Einladung annehmen/ablehnen: Gleiches RLS-Zirkular-Problem in POST /api/play-sessions/[id]/respond behoben — Update jetzt via Admin-Client mit expliziter Ownership-Prüfung (`.eq("invited_user_id", user.id)`)

---

## [0.9.0] — 2026-04-25

### Added
- Spieler-Seite komplett überarbeitet: 3-Tab-Layout (Chats | Freunde | Suche)
- Chats als vollwertiger Tab (WhatsApp-Stil: Nachrichtenvorschau, Unread-Badge, Zeitstempel)
- FriendCard als tappbarer Button — kein Inline-Chat-Icon, kein Dreipunkte-Menü mehr
- iOS-Style Bottom Sheet beim Tippen auf einen Freund (Nachricht / Bibliothek / Partie / Freund entfernen)
- Echtzeit-Unread-Clearing: Optimistisches State-Update + `visibilitychange` + `router.refresh()`
- Server-seitiges Data-Fetching konsolidiert (2× parallele `Promise.all`)
- Web Push Notifications (VAPID): Service Worker, Subscribe/Unsubscribe, Banner im Chat-Tab

### Fixed
- Unread-Badge verschwand erst nach manuellem Seitenrefresh — jetzt sofortige Aktualisierung

---

## [0.8.0] — 2026-04-20

### Added
- Spieler finden nach Standort: GPS-Ortung + Radius-Filter (25/50/100 km)
- Entfernung-Modus im Such-Tab der Spieler-Seite
- A-Z / Entfernung Moduswechsler als primäre Navigation im Such-Tab

### Changed
- `/discover` → `/players` (permanente Weiterleitung bleibt)

---

## [0.7.0] — 2026-04-15

### Added
- Freundschaftssystem (pending / accepted / declined)
- Async-Nachrichten (Posteingang + Gesprächs-Thread)
- Spielersuche nach Username / Anzeigename
- Freundesprofil-Seite mit abgespeckter Bibliotheksansicht
- Bibliotheks-Sichtbarkeit (privat / Freunde / öffentlich)
- Friendships + Messages RLS nachgerüstet

---

## [0.6.0] — 2026-04-08

### Added
- Partien-Fotos (Upload → Supabase Bucket `play-images`)
- Kooperativ-Modus Toggle bei Partienerfassung
- BGG Best-Players Poll → `games.best_players int[]`
- BGG Complexity / Weight Import

### Fixed
- BGG Thumbnail-Feld: `item.imageurl` statt `item.images.thumb.url`

---

## [0.5.0] — 2026-03-28

### Added
- Spieldetail: Custom Fields (Name, Beschreibung, Spieleranzahl, Spielzeit, Kategorien)
- Hero-Image Upload pro Spiel
- Spielnotizen (Hausregeln, Strategie, Links, Komponenten)
- Batch-Übersetzung Spielbeschreibungen DE (Google gtx-API, kein Key)
- Onboarding-Wizard (6 Schritte, auto-erkannt via `created_at < 30 min`)

---

## [0.4.0] — 2026-03-15

### Added
- Partien-Tracking: erfassen, bearbeiten, löschen
- Score-Erfassung, Gewinner-Markierung, Spieler-Reihenfolge
- Partien-Sortierung (Datum, Spiel A–Z)
- Prefill-Support: Score-Tracker → Partien-Erfassung

---

## [0.3.0] — 2026-03-05

### Added
- Spielebibliothek: Status, Filter, Sortierung
- BGG-Import via CSV
- Spielsuche via Wikidata SPARQL (BGG-API von Cloud-IPs geblockt)
- Eigene Bewertung (1–10), immer auf Karte sichtbar

---

## [0.2.0] — 2026-02-20

### Added
- Auth: E-Mail + Google OAuth via Supabase
- PWA-Icons (192, 512, apple-touch)
- Offline-Fallback (`/~offline`)

---

## [0.1.0] — 2026-02-01

### Added
- Initiales Projekt-Setup (Next.js 14, Tailwind, shadcn/ui, Supabase)
- Basis-Datenbankschema
- Vercel-Deployment-Pipeline
