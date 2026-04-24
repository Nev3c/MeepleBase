// ============================================================
// MeepleBase – Changelog
// Wird bei jedem Release von Claude Code befüllt.
// Neueste Version zuerst.
// ============================================================

export type ChangeType = "feat" | "fix" | "improve";

export interface ChangelogChange {
  type: ChangeType;
  text: string;
}

export interface ChangelogEntry {
  version: string;
  date: string; // ISO date (YYYY-MM-DD)
  title: string;
  changes: ChangelogChange[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "v0.4.0",
    date: "2026-04-24",
    title: "Feedback & Changelog",
    changes: [
      { type: "feat", text: "Feedback-System: Bugs und Feature-Requests einreichen und den Status nachverfolgen" },
      { type: "feat", text: "Changelog mit laufendem Versionsverlauf" },
      { type: "improve", text: "Bibliothek: 'Was spielen?'-Schnellfilter ist jetzt ausklappbar" },
      { type: "improve", text: "Soundboard: Suche unterstützt jetzt über 100 deutsche Begriffe (regen, bier, kreuz, friedhof…)" },
      { type: "fix", text: "Soundboard: Ungültige Icon-Namen aus der deutschen Keyword-Map entfernt" },
      { type: "fix", text: "Tools-Tab: Scrollposition wird beim Tab-Wechsel zurückgesetzt" },
    ],
  },
  {
    version: "v0.3.0",
    date: "2026-04-20",
    title: "Tools & Spielabend-Helfer",
    changes: [
      { type: "feat", text: "Punktetracker für Spielabende mit Undo und Spielerverwaltung" },
      { type: "feat", text: "Soundboard mit YouTube-Integration und Icon-Picker" },
      { type: "feat", text: "Münzwurf und Würfelroller" },
      { type: "feat", text: "Spieler finden nach Standort (GPS + Radius-Filter)" },
      { type: "improve", text: "Spieldetail: Individuelle Anpassung von Spieleranzahl, Spielzeit und Kategorien" },
    ],
  },
  {
    version: "v0.2.0",
    date: "2026-04-10",
    title: "Soziale Features",
    changes: [
      { type: "feat", text: "Freundschaftssystem mit Anfragen, Annehmen und Ablehnen" },
      { type: "feat", text: "Direkt-Nachrichten zwischen Spielern" },
      { type: "feat", text: "Öffentliche Spielerprofile mit Bibliotheksvorschau" },
      { type: "feat", text: "Bibliotheks-Sichtbarkeit einstellbar (privat / Freunde / öffentlich)" },
      { type: "improve", text: "Spielersuche: Sofortanzeige aller Spieler ohne Eingabe" },
    ],
  },
  {
    version: "v0.1.0",
    date: "2026-04-01",
    title: "MVP Launch",
    changes: [
      { type: "feat", text: "Spielebibliothek mit BGG-Import (CSV + Einzelsuche)" },
      { type: "feat", text: "Partien-Tracking mit Spielern, Scores, Fotos und Kooperativ-Modus" },
      { type: "feat", text: "Spieldetail mit Notizen, eigener Bewertung und Bildern" },
      { type: "feat", text: "Auth via E-Mail und Google OAuth" },
      { type: "feat", text: "PWA mit Offline-Fallback" },
      { type: "feat", text: "Onboarding-Wizard für neue Nutzer" },
    ],
  },
];

export const CURRENT_VERSION = CHANGELOG[0].version;
