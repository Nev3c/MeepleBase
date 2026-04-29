# Changelog

All notable changes to MeepleBase are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.7.5] — 2026-04-29

### Fixed
- Spielerabend: „Scores & Fotos erfassen" legt Partien jetzt als Entwurf (`incomplete=true`) an — sie erscheinen nicht in „Vergangen". Erst „Spielabend abschließen" markiert sie als abgeschlossen und macht sie sichtbar.
- Spielerabend: `complete/route.ts` erkennt jetzt Entwurfspartien (`incomplete=true`) und setzt sie auf `incomplete=false`, statt doppelte Einträge zu erstellen. Neue Partien werden nur noch für Teilnehmer angelegt, die noch gar keine Partie haben.
- Partien-Seite: Server-Query filtert jetzt `incomplete=false` — Entwurfspartien aus dem Session-Flow werden nie an den Client geliefert.

---

## [0.7.4] — 2026-04-29

### Fixed
- Spielerabend: Doppelte Einträge + Session erscheint sofort in „Vergangen" nach Scores erfassen — zwei Grundursachen behoben: (1) `complete/route.ts` verglich `played_at` mit `session_date` per `.eq()`, aber `session_date` ist `timestamptz` (z.B. `2026-04-30T19:00:00+00:00`) während Plays nur `2026-04-30` als Datum speichern — kein Match → Dedup schlug immer fehl. Fix: Datumsbereich-Query (`.gte`/`.lt` auf Tagesgranularität). (2) „Scores & Fotos erfassen" und „Spielabend abschließen" waren zwei unabhängige Aktionen die beide Plays erstellten. Fix: „Scores & Fotos erfassen" schließt jetzt die Session automatisch ab (ruft nach dem Speichern der Plays auch den complete-Endpoint auf). Plays erscheinen damit erst nach dem Abschließen in „Vergangen".
- Spielerabend: Doppelte Einträge unter „Vergangen" nach Abschließen — `complete/route.ts` erstellte Partien für alle Teilnehmer ohne zu prüfen ob bereits Partien für dieselbe Kombination aus Nutzer + Spiel + Datum existieren. Wurden Scores zuerst über „Scores & Fotos erfassen" erfasst (POST /api/plays), entstand beim Klick auf „Spielabend abschließen" eine zweite identische Partie. Fix: Vor dem Insert prüft die Route jetzt bestehende Plays (user_id + game_id + played_at) und überspringt Kombinationen die schon vorhanden sind. Zusätzlich: Bereits abgeschlossene Sessions (status = "completed") geben jetzt 409 zurück statt erneut Partien anzulegen.
- Spielerabend: „Scores & Fotos erfassen" schloss den Abend fälschlicherweise ab — die Session verschwand aus den geplanten Partien. Ursache: `router.refresh()` in `handleSessionPlayCreated` löste einen Next.js-Suspense-Remount aus, der `PlaysClient` mit den neu abgerufenen Server-Daten neu initialisierte; da die Session dabei evtl. nicht mehr zurückkam, verschwand sie. Fix: `router.refresh()` wird nach dem Erfassen von Scores/Fotos nicht mehr aufgerufen (die neuen Partien sind bereits im lokalen State, ein Server-Re-Fetch ist nicht nötig)
- BGStats-Import: Timeout-Fix — bei großen Exporten (700+ Partien) brach der Import nach ca. 50 Partien ab, weil die Vercel-Funktion (10 s Free / 60 s Pro) überschritten wurde. Import wird jetzt in Blöcken von 100 Partien verarbeitet; der Client schickt automatisch mehrere Anfragen hintereinander und zeigt einen Fortschrittsbalken (X/Y Partien)
- BGStats-Import: Spielauflösung jetzt parallel (Promise.all statt sequenziellem for-of) — reduziert die Zeit pro Block erheblich bei Exporten mit vielen verschiedenen Spielen
- BGG CSV-Import: Timeout-Fix — bei Sammlungen mit 500+ Spielen importierte die alte Route nur ~50 Spiele weil sie für jedes Spiel einen BGG-Metadaten-Fetch (geekitems, bis 6 s) auslöste und damit regelmäßig die Vercel-Timeout-Grenze überschritt. Die Route speichert jetzt nur Name + Jahr aus der CSV (kein BGG-Fetch mehr); Bilder und Metadaten lassen sich danach einmalig über Einstellungen → BGG-Daten aktualisieren nachladen
- BGG CSV-Import: Batch-Größe von 5 auf 20 erhöht (kein BGG-Fetch mehr → sehr schnell)

### Added
- BGStats-Import: Fortschrittsbalken während des Imports zeigt wie viele Partien bereits importiert wurden (z. B. „350 / 724 Partien · 48%")
- BGG CSV-Import: Hinweistext im Import-Ergebnis erklärt, dass Spielbilder und Metadaten danach über „BGG-Daten aktualisieren" geladen werden müssen
- BGG CSV-Import: Erklärung im Schritte-Dialog was der Import beinhaltet und was nicht (kein automatisches Bildladen)

---

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

### Added
- Spiel hinzufügen: Lokalisierter Spieltitel wählbar — wird ein Spiel über einen deutschen Namen gefunden (z. B. „Dune – Ein Spiel um Macht und Intrigen"), erscheint im Bestätigungs-Sheet ein DE/EN-Toggle; der gewählte Titel wird als `custom_fields.name` in `user_games` gespeichert und in der Bibliothek angezeigt; Standard ist der gefundene deutsche Titel
- Spielsuche: Wikidata-Ergebnisse zeigen jetzt beide Sprachtitel in einer Zeile — sucht man „dune" sieht man den EN-Titel + DE-Untertitel darunter; der DE/EN-Toggle im Confirm-Sheet erscheint nun auch bei englischer Suche wenn ein deutsches Wikidata-Label vorhanden ist
- Spielsuche: Ergebnisse werden jetzt nach String-Relevanz sortiert (Exakt-Match > Startet-mit > Wort-startet-mit > Enthält); Titel die mit dem Suchbegriff beginnen erscheinen zuerst, unabhängig von Quelle oder BGG-Popularität
- Spielsuche: Ergebnislimit auf 30 erhöht (vorher 15); Wikidata SPARQL-Limit auf 40 erhöht
- Spielsuche: Quelltransparenz — jedes Suchergebnis zeigt ein kleines Badge „Lokal" (amber), „Wikidata" (grau) oder „BGG" (grau) an

### Fixed
- Spielsuche: Lokalisierte Spielnamen (z. B. „Dune: Geheimnisse der Häuser") erscheinen jetzt in den Ergebnissen. Zwei Bugs behoben: (1) lokale DB-Suche hat bei ≥5 Treffern externe Quellen komplett übersprungen; (2) Wikidata und BGG wurden exklusiv behandelt — hatte Wikidata ≥1 Treffer, wurde BGG komplett ignoriert. Jetzt laufen alle Quellen parallel und werden immer zusammengeführt; BGG geeksearch lädt jetzt Seite 1+2 parallel (~50 Treffer statt 25); Wikidata-Query erweitert auf EN + DE Labels.
- Spielsuche: Ladekringel im Suchfeld sprang auf und ab statt zu drehen — `animate-spin` und `-translate-y-1/2` auf demselben SVG ließen die CSS-Keyframes das `translateY` bei jedem Frame überschreiben; Wrapper-Div trennt jetzt Positionierung von Animation.
- Spiel hinzufügen: Hero-Bild und Metadaten jetzt vollständig beim ersten Hinzufügen (kein manueller BGG-Refresh mehr nötig) — `games/add` extrahiert jetzt `complexity` + `best_players` aus dem geekitems-Response; `image_url` fällt auf `imageurl` zurück wenn `topimageurl` fehlt; `thumbnail_url` des Suchergebnisses wird als letzter Fallback übergeben falls der geekitems-Fetch komplett scheitert; manueller BGG-Aktualisieren-Klick danach nicht mehr nötig
- Tastatur-Zucken auf Android (Honor Magic OS / Chrome): `height: min(92svh, 100dvh)` statt `max-height: 92svh` — Sheet hat jetzt feste Höhe, Suchergebnisse-Laden verändert die Sheet-Höhe nicht mehr; `100dvh` passt sich via `interactive-widget=resizes-visual-viewport` automatisch der Tastatur-Höhe an
- Bild-Datenschutz: `image_url` in `games/add` und `import-csv` reverted auf `item.imageurl` (offizielle Cover-Art) — `item.topimageurl` (Community-Upload, kann Personen zeigen) wird nie mehr verwendet; in CLAUDE.md als Non-Negotiable dokumentiert
- CSV-Import: `image_url` war fälschlicherweise auf Community-Bild (`topimageurl`) gesetzt — reverted auf offizielle Cover-Art (`imageurl`)
- Bibliothek: Nach Spiel-Hinzufügen wurde nur das neue Spiel angezeigt — `AddGameSheet` ruft jetzt `onSuccess()` auf, das `filter.search` zurücksetzt bevor `router.refresh()` läuft; Suchfilter war aus dem Library-Suchfeld erhalten geblieben und hat nach dem Refresh alle anderen Spiele herausgefiltert
- Tastatur-Sprünge auf Android: `interactiveWidget: "resizes-visual-viewport"` im Viewport-Meta ergänzt — Android Chrome 108+ verkleinert jetzt das Visual-Viewport wenn die Tastatur aufgeht (analog zu iOS 15+); `position:fixed; bottom:0` Elemente folgen dem Visual-Viewport und werden nicht mehr von der Tastatur überdeckt
- Spieler-Seite: „Partie aufzeichnen" verlinkte auf `/plays/new` (404) — jetzt `/plays?player=NAME`
- Spieler-Seite: Radius-Chips flickerten während der Suche (Farbe sprang beim Laden) — vereinfachte Bedingung, Chip ist immer amber wenn ausgewählt
- Spieler-Seite: Radius-Chips änderten Größe wenn „Neu"-Button erschied — entfernt, kein Layout-Shift mehr
- Bibliothek: Tastatur-Sprünge endgültig behoben — CSS-only `max-height: 92svh` (`svh` = konstante Small-Viewport-Height, ändert sich nie bei Tastatur); kein JS-Tracking, kein `translateY` mehr. iOS 15+ positioniert `position:fixed; bottom:0` automatisch über die Tastatur; `transform` verursachte eine doppelte Verschiebung und das Sheet flog nach unten wenn die Tastatur sich veränderte (Autocomplete-Bar etc.)
- Spielsuche: BGG XML API v2 als dritte parallele Suchquelle ergänzt — vollständige Volltextsuche statt Autocomplete-Prefix-Matching; findet Spiele wie „The Hunger", die im nosession-geekdo-Endpunkt fehlen; Thumbnails werden nachgeladen; graceful fallback wenn BGG 401 zurückgibt
- Spieler-Tab Suche: Radius-Chips zeigen Zahl und „km" jetzt immer zweizeilig (einheitliches Layout)
- Spieler-Tab Suche: 3-Button-Toggle (A–Z / Nähe / Neu) statt 2; „Neu"-Tab zeigt 30 zuletzt beigetretene Spieler (ohne PLZ-Filter)
- Onboarding: PLZ-Eingabe direkt im Spieler-Slide möglich; Hinweistext auf allgemeine Auffindbarkeit aktualisiert
- Spieler-Tab: Hinweisbanner wenn keine PLZ hinterlegt (mit Direkt-Link zu Einstellungen, dismissbar)
- Spielsuche: Wikidata und BGG geekdo laufen jetzt parallel — BGG-Fallback wird nicht mehr übersprungen wenn Wikidata unavailable ist

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
