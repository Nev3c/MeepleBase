# MeepleBase — Codex Agent Instructions

## Schritt 1: Immer zuerst lesen

Bevor du irgendetwas implementierst, lies diese Dateien in dieser Reihenfolge:

1. `CLAUDE.md` — Projektdokumentation, aktueller Stand, alle bekannten Eigenheiten
2. `.agents/skills/` — Design- und Coding-Guidelines (siehe unten)

Diese Dateien sind die einzige Wahrheitsquelle. Nicht dein Training, nicht Annahmen.

---

## Skills — wann welche Datei lesen

| Aufgabe | Lies |
|---------|------|
| Neuer Screen, neue Seite, UI-Redesign | `.agents/skills/frontend-design.md` + `.agents/skills/ui-ux-pro-max.md` |
| Neue React-Komponente, Refactoring | `.agents/skills/vercel-react-best-practices.md` + `.agents/skills/vercel-composition-patterns.md` |
| Data Fetching, Performance, Bundle | `.agents/skills/vercel-react-best-practices.md` |
| UX-Review, Accessibility, Animationen | `.agents/skills/ui-ux-pro-max.md` |

---

## Kollaborations-Protokoll

Dieses Projekt wird parallel von **Claude Code (Desktop)** bearbeitet. Um Konflikte zu vermeiden:

- Arbeite IMMER auf einem Feature-Branch — **nie direkt auf `main`**
- Branch-Namen: `feat/<kurzname>`, `fix/<kurzname>`, `chore/<kurzname>`
- Starte jeden Task mit:
  ```bash
  git fetch origin
  git checkout -b feat/<name> origin/main
  ```
- Öffne am Ende einen PR — **merge nie selbst**
- PR-Beschreibung auf Deutsch: welche Dateien geändert wurden und warum

---

## Pflicht-Checks vor jedem PR

```bash
npx tsc --noEmit   # muss fehlerfrei sein
next lint           # muss fehlerfrei sein
```

Wenn einer dieser Checks fehlschlägt → erst fixen, dann PR öffnen.

---

## Stack

- **Framework**: Next.js 14 App Router
- **Sprache**: TypeScript strict — kein `any`, keine ungetypten Funktionen
- **Styling**: Tailwind CSS + shadcn/ui
- **Datenbank**: Supabase (PostgreSQL + Auth + Storage)
- **Deployment**: Vercel (Auto-Deploy bei Merge auf `main`)

## Kritische Regeln

### Supabase / Datenbank

- **Service Role Key** nur in `/app/api/` Route Handlers — nie in Client-Komponenten
- **RLS**: Jede neue Tabelle bekommt sofort RLS + alle 4 Policies (SELECT/INSERT/UPDATE/DELETE)
- **Enum**: `game_status` ist ein PostgreSQL ENUM → neue Werte via `ALTER TYPE game_status ADD VALUE`
- **Auth-Check** am Anfang jeder API Route: `getUser()`, nie `getSession()`
- **Storage-Uploads**: `createClient` aus `@supabase/supabase-js` verwenden (nicht `@supabase/ssr`)

### Komponenten

- Functional Components — keine Class-Komponenten
- Server Components für Datenfetching; Client Components (`"use client"`) nur wo nötig
- Kein `useEffect` für Datenfetching — stattdessen Server Components oder SWR
- `Promise.all()` für parallele unabhängige Fetches
- `next/dynamic` für schwere Komponenten (Charts, Maps)

### Dateisystem

- Dateinamen: kebab-case (`game-card.tsx`)
- Komponenten: PascalCase (`GameCard`)
- Commits: Conventional Commits auf Englisch (`feat:`, `fix:`, `chore:`)

### UI — MeepleBase-spezifisch

- Alle Seiten-Wrapper: `min-h-[calc(100dvh-72px)]`
- Inputs in Flex-Containern: immer `min-w-0`
- Bottom-Nav: kein `backdrop-blur`, immer `translateZ(0)` Style
- Fonts: Fraunces (Display) + Instrument Sans (Body)
- Primärfarbe: Amber/Orange `#E8821A`
- shadcn/ui Basiskomponenten nutzen — keine eigenen Primitives bauen
- Icons: Lucide React (kein Emoji als Icon)

### Nicht anfassen

- `src/lib/supabase/` — Supabase Client-Konfiguration
- `public/` — Icons und PWA-Assets
- `.env.local` — niemals committen

---

## Wenn du dir unsicher bist

Schreib einen Kommentar im PR statt zu raten:

> "Ich bin mir bei X unsicher — bitte vor dem Merge prüfen."

Lieber einen klaren PR mit Fragezeichen als stillen, falschen Code.
