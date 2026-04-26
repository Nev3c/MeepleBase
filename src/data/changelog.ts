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
    version: "v0.6.0",
    date: "2026-04-26",
    title: "Audio, Export & Galerie",
    changes: [
      { type: "feat", text: "Audio-Tab: Spielmusik direkt in der App suchen und abspielen — als einzelne Songs oder zusammenhängende Playlisten (YouTube Data API)" },
      { type: "feat", text: "Playlist-Modus: Titel spielen automatisch nacheinander ab, Trackliste mit Sprungfunktion" },
      { type: "feat", text: "Daten-Export: Bibliothek, Partien, Notizen und Profil als JSON herunterladen (Einstellungen → Bibliothek)" },
      { type: "feat", text: "Profil-Galerie: Alle Partienfotos in einer Bildergalerie, Vollbild-Ansicht mit Vor/Zurück-Navigation" },
      { type: "feat", text: "BGStats-Import: Partien aus der BGStats-App als JSON importieren (Einstellungen → Bibliothek)" },
      { type: "feat", text: "Spielerabend abschließen: Partien werden automatisch für alle Teilnehmer eingetragen" },
      { type: "feat", text: "Partie per QR-Code teilen: Mitspieler übernehmen Partie mit einem Tap" },
      { type: "improve", text: "Profilbild direkt auf dem Profil antippbar zum Hochladen" },
      { type: "improve", text: "Datenschutzerklärung DSGVO-konform erweitert (GPS, Push, Soziale Funktionen, Drittanbieter)" },
    ],
  },
  {
    version: "v0.5.0",
    date: "2026-04-25",
    title: "Statistiken & Spielerabend",
    changes: [
      { type: "feat", text: "Statistiken-Seite: Partien/Monat als Balkendiagramm, Siegquote, Lieblingsspiel, Sammlungswert (hinter Privacy-Toggle)" },
      { type: "feat", text: "Freunde-Rankings: Meistgespielt / Siegquote / Meistgekauft — per Monat, Jahr oder gesamt" },
      { type: "feat", text: "Spielerabend-Planer: mehrere Spiele pro Abend, Freunde einladen, Einladungen annehmen/ablehnen" },
      { type: "feat", text: "Einladungen-Tab im Spieler-Menü für ausstehende Spieleabend-Einladungen" },
      { type: "feat", text: "Vergangen/Geplant-Tab-Toggle auf der Partien-Seite" },
      { type: "improve", text: "Onboarding erscheint jetzt zuverlässig direkt nach Registrierung" },
      { type: "improve", text: "Alle Statistiken (Kategorien, Mechanismen, Partien, Spiele) auf /stats konsolidiert" },
      { type: "fix", text: "Einladungen senden: zirkulärer RLS-Fehler behoben — Writes laufen jetzt via Admin-Client" },
    ],
  },
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
