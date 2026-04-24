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

## Arbeitsweise & Deployment

- Pushе direkt auf `main`
- Vercel deployed automatisch nach jedem Push auf `main`
- Vor dem Push immer die Pflicht-Checks ausführen (siehe unten)
- Commit-Message: Conventional Commits auf Englisch (`feat:`, `fix:`, `chore:`)

---

## Pflicht-Checks vor jedem Push

```bash
npx tsc --noEmit   # TypeScript — muss fehlerfrei sein
next lint           # ESLint — muss fehlerfrei sein
```

Wenn einer dieser Checks fehlschlägt → erst fixen, dann pushen.

---

## Stack

- **Framework**: Next.js 14 App Router
- **Sprache**: TypeScript strict — kein `any`, keine ungetypten Funktionen
- **Styling**: Tailwind CSS + shadcn/ui
- **Datenbank**: Supabase (PostgreSQL + Auth + Storage)
- **Deployment**: Vercel (Auto-Deploy bei jedem Push auf `main`)

---

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

Lieber einen Kommentar hinterlassen als raten. Schreib in die Commit-Message oder als Zusammenfassung:

> "Unsicher bei X — bitte prüfen."
