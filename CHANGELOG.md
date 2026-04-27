# Changelog

All notable changes to MeepleBase are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Spieler-Seite: Radius-Optionen 5 km und 15 km ergänzt (vorher: 25/50/100 km)
- Spieler-Seite: „Partie aufzeichnen" im Freund-Sheet navigiert zu `/plays?player=NAME` und öffnet das Erfassungs-Sheet mit dem Freund vorausgefüllt
- Plays-Client: `?player=NAME` Query-Param — öffnet Play-Sheet mit vorausgefülltem Spieler (Freund-Shortcut)
- In-App-Changelog: v0.7.0 Eintrag mit allen Änderungen dieser Session
- Onboarding: App-Tour „Spieler"-Slide zeigt jetzt Hinweis zur PLZ-Hinterlegung für Nähe-Suche
- Einstellungen: BGG-Spielekatalog-Bulk-Import — füllt lokale `games`-Tabelle mit ~100 populären Spielen für schnelle Offline-Suche (GET liefert Zählstand, POST importiert Batch für Batch)
- Spielsuche (`/api/games/search`): Lokale DB wird jetzt zuerst durchsucht (≥5 Treffer → sofortige Antwort ohne externe API)

### Changed
- Spieler-Suche (A-Z und Entfernung): Nur Spieler mit hinterlegter PLZ werden angezeigt (bereits in players/page.tsx + /api/players/search)

### Fixed
- Spieler-Seite: „Partie aufzeichnen" verlinkte auf `/plays/new` (404) — jetzt `/plays?player=NAME`
- Spieler-Seite: Radius-Chips flickerten während der Suche (Farbe sprang beim Laden) — vereinfachte Bedingung, Chip ist immer amber wenn ausgewählt
- Spieler-Seite: Radius-Chips änderten Größe wenn „Neu"-Button erschien — Button immer im DOM (invisible statt entfernt), Layout-Shift behoben
- Bibliothek: Tastatur-Sprünge beim Öffnen des Hinzufügen-Sheets behoben — Sheet-Höhe bleibt immer konstant (92dvh), nur `transform: translateY` verändert sich beim Tastaturöffnen
- Onboarding: PLZ-Eingabe direkt im Spieler-Slide möglich; Hinweistext auf allgemeine Auffindbarkeit aktualisiert
- Spieler-Tab: Hinweisbanner wenn keine PLZ hinterlegt (mit Direkt-Link zu Einstellungen, dismissbar)

---

## [Unreleased — vorherige Session]

### Added
- Audio-Tab (ehemals Sound): zwei Sub-Tabs „Sounds" (Soundboard) und „Musik" (YouTube-Suche); Musik-Tab hat „Playlisten"- und „Songs"-Modus
- Spielmusik-Suche: Playlist-Modus spielt zusammenhängende YouTube-Playlisten ab (nächster Track läuft automatisch); Songs-Modus für Einzeltracks
- Profil: Einstellungen-Block auf einzelnen Link reduziert; App Tour in Community-Block verschoben; Admin in eigenem Block
- Daten-Export (Art. 20 DSGVO): Button unter Einstellungen → Bibliothek lädt JSON-Datei mit Bibliothek, Partien, Notizen und Profil herunter (`/api/export`)
- Datenschutzerklärung (`/privacy`): vollständige DSGVO-konforme DSE inkl. Abschnitt zu GPS-Koordinaten, Rechtsgrundlagen, Drittanbietern, Betroffenenrechten
- Impressum (`/impressum`) und Nutzungsbedingungen (`/terms`): erste Versionen (Impressum-Pflichtfelder noch zu ergänzen)
- Profil-Galerie: Alle hochgeladenen Partienfotos in einer Bildergalerie sortiert nach Datum (Profil → Galerie), mit Vollbild-Ansicht beim Antippen
- BGStats-Import: Partien aus der BGStats-App als JSON-Datei importieren (Einstellungen → Bibliothek). Spiel-Matching via BGG-ID oder Name, automatische Duplikat-Erkennung (gleiche Partie am gleichen Tag), Anlegen neuer Spieleinträge bei Bedarf.
- Spielerabend abschließen: Organisator-Button „Spielabend abschließen" trägt Partien automatisch für alle Teilnehmer mit „Zugesagt"-Status ein (eine Play-Row pro Spiel pro Teilnehmer, inkl. Play-Players). Session verschwindet danach aus der Geplant-Liste.
- Partie per QR teilen: Share-Button auf jeder Partie-Karte → QR-Code + kopierbarer Link → `/plays/import?from=[id]` → Mitspieler übernimmt Partie mit einem Tap inkl. Duplikat-Erkennung
- BGStats-Export: „In BGStats eintragen"-Button im Share-Modal öffnet BGStats-App via Deep-Link (`bgstats://`) mit Spiel, Datum, Spielern, Scores und Gewinner vorausgefüllt
- Melodice-Integration im Sound-Tab: Spielname eingeben → kuratierte Playlist auf melodice.org öffnet sich direkt
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
- Tools: Audio ist jetzt der erste Tab (statt Punkte) — schnellster Zugriff auf das meistgenutzte Tool
- Partien-Seite: „Geplant"-Tab steht wieder zuerst (vor Vergangen) und ist Default beim Öffnen — passt besser zum Workflow „Was steht an?"
- Partien-Seite: Scores/Fotos erfassen schließt den Spielabend NICHT mehr automatisch ab — Abschluss nur über die explizite „Spielabend abschließen"-Aktion
- Spieler-Seite: Tab-Layout neu gestaltet (Icon oben, Label unten, Badge schwebt am Icon) — alle 5 Tabs deutlich entstauchter; „Einlad." → „Termine"
- Spieler-Seite: „Markt"-Tab zeigt jetzt eigene Verkaufsangebote zusätzlich zu den Freunde-Angeboten, klar getrennt nach „Deine Angebote" und „Von Freunden"; eigene Angebote führen ins Spiel-Detail (zum Bearbeiten), Freunde-Angebote zum Profil
- Spieler-Seite: Markt-Tab-Badge zählt nur noch Freunde-Angebote (eigene zählen nicht als „neu")
- Tools-Tabs: Label unter jedem Icon ist jetzt immer sichtbar (nicht mehr nur beim aktiven Tab)
- Profil: Profilbild direkt auf dem Profil antippbar zum Hochladen (nicht mehr nur in den Einstellungen)
- Melodice durch YouTube-Musiksuche ersetzt (vollständig in-app, kein externer Absprung mehr)
- Galerie: Vollbild-Viewer unterstützt jetzt Vor/Zurück-Navigation zwischen Fotos mit Dot-Indikator
- Datenschutzerklärung: Datenexport-Hinweis aktualisiert (Self-Service statt E-Mail-Anfrage)
- Sammlungswert aus dem Profil-Stats-Band entfernt — liegt jetzt exklusiv hinter dem Privacy-Toggle auf /stats
- Auth-Callback: Onboarding-Erkennung von 30 Minuten auf 7 Tage ausgedehnt (deckt E-Mail-Bestätigungs-Delays ab)
- Kategorien- und Mechanismen-Zähler aus dem Profil entfernt und auf /stats konsolidiert (Schnellübersicht-Karte, Sekundärzeile)
- Profil: Spiele/Partien/Freunde-Zahlen entfernt — alle Zahlen exklusiv auf /stats; Profil-Stats-Band ersetzt durch einfaches Statistiken-CTA-Widget
- Profil: Menüeintrag „Statistiken & Rankings" entfernt (Duplikat des CTA-Widgets)
- In-App Changelog auf v0.5.0 aktualisiert

### Fixed
- Admin: Neue Registrierungen mit Auto-Confirm umgingen den `/auth/callback` und wurden nie als ausstehende Freigaben erfasst — neuer `POST /api/auth/post-signup`-Endpunkt setzt `approved=false` direkt nach dem Sign-Up wenn `REQUIRE_APPROVAL=true`. Admin-Liste zeigt jetzt zusätzlich auch Profile mit `approved IS NULL` als ausstehend (deckt Legacy-User ab)
- Bibliothek: Tastatur-Overlay nachhaltig gelöst — Sheet wird jetzt per `visualViewport.height + offsetTop` über die Tastatur gehoben (vorher: nur `maxHeight` reduziert, was bei `position:fixed; bottom:0` nicht hilft, da das gegen den Layout-Viewport ankert, der durch die Tastatur nicht schrumpft); Animations-Transition für sanftes Hoch-/Runtergleiten
- Bibliothek: Spielsuche fällt auf BGG-Namens-API (`geekdo`) zurück, wenn Wikidata keine Treffer hat — fängt z.B. „The Hunger" ab, das in Wikidata kein P2339-Statement hat
- Bibliothek: Spielsuche „the hunger" und andere Spiele ohne explizite Wikidata-Klassifizierung fanden keine Ergebnisse — SPARQL-Constraint `P31 = Q131436` entfernt; BGG-ID-Property `P2339` reicht als Filter; Limit auf 15 erhöht
- Bibliothek: Mobilgerät — Tastatur überlagert Suchergebnisse; `visualViewport.resize`-Listener setzt Sheet-Höhe dynamisch in Pixel statt `dvh`-Units
- Bibliothek: BGG-Fallback-Link führte zu 404 — URL auf stabiles `geeksearch.php?action=search&objecttype=boardgame&q=…`-Format geändert
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
