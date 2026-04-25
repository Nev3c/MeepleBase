import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Datenschutzerklärung – MeepleBase",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Back */}
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft size={15} /> Zurück
        </Link>

        <h1 className="font-display text-3xl font-bold text-foreground mb-2">Datenschutzerklärung</h1>
        <p className="text-sm text-muted-foreground mb-10">Stand: April 2026</p>

        <div className="prose prose-sm max-w-none text-foreground space-y-8">

          {/* 1 */}
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-3">1. Verantwortlicher</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:
            </p>
            <div className="mt-2 p-3 bg-muted/50 rounded-xl text-sm text-muted-foreground leading-relaxed">
              Dennis Rau<br />
              Kontakt: dennis_rau@outlook.de<br />
              (vollständige Anschrift siehe{" "}
              <Link href="/impressum" className="text-amber-600 underline underline-offset-2">
                Impressum
              </Link>
              )
            </div>
          </section>

          {/* 2 */}
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-3">2. Welche Daten wir verarbeiten</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              MeepleBase verarbeitet folgende personenbezogene Daten:
            </p>

            <div className="flex flex-col gap-4">
              {[
                {
                  title: "Account-Daten",
                  items: [
                    "E-Mail-Adresse (für Registrierung und Login)",
                    "Anzeigename und Benutzername (selbst vergeben)",
                    "Profilbild (freiwillig, von dir hochgeladen)",
                    "BoardGameGeek-Benutzername (freiwillig)",
                  ],
                },
                {
                  title: "Standortdaten",
                  items: [
                    "Stadtname / Ortsangabe (freiwillig, manuell oder per GPS eingegeben)",
                    "Geografische Koordinaten – Breitengrad (latitude) und Längengrad (longitude) – wenn du die GPS-Ortungsfunktion nutzt",
                  ],
                  note: "Dein ungefährer Standort (Stadt) wird anderen Nutzern angezeigt, um die Suche nach Spielern in deiner Nähe zu ermöglichen. Die genauen Koordinaten werden niemals anderen Nutzern angezeigt; sie werden ausschließlich serverseitig zur Berechnung von Entfernungen genutzt. Du kannst Standortdaten jederzeit in den Einstellungen entfernen oder leer lassen.",
                },
                {
                  title: "Spielebibliothek und Partien",
                  items: [
                    "Spiele in deiner Sammlung (Titel, Status, Bewertungen)",
                    "Erfasste Partien (Datum, Ort, Dauer, Mitspieler, Scores)",
                    "Fotos zu Partien (freiwillig, von dir hochgeladen)",
                    "Spielnotizen (Hausregeln, Strategie – nur für dich sichtbar)",
                  ],
                },
                {
                  title: "Soziale Daten",
                  items: [
                    "Freundschaftsverbindungen (wer wen als Freund hinzugefügt hat)",
                    "Direktnachrichten zwischen Nutzern",
                    "Spielerabend-Einladungen und Zu-/Absagen",
                  ],
                },
                {
                  title: "Technische Daten",
                  items: [
                    "IP-Adresse (durch Infrastruktur-Anbieter Vercel, nicht dauerhaft gespeichert)",
                    "Push-Notification-Endpunkt (nur wenn Benachrichtigungen aktiviert)",
                    "Zeitstempel von Aktionen (Erstellung, letzte Änderung)",
                  ],
                },
              ].map(({ title, items, note }) => (
                <div key={title} className="border border-border rounded-xl p-3.5">
                  <p className="text-sm font-semibold text-foreground mb-2">{title}</p>
                  <ul className="list-disc list-inside space-y-1">
                    {items.map((item) => (
                      <li key={item} className="text-sm text-muted-foreground">{item}</li>
                    ))}
                  </ul>
                  {note && (
                    <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                      ℹ️ {note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 3 */}
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-3">3. Zweck und Rechtsgrundlage</h2>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              {[
                ["Account-Daten", "Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO)", "Ohne E-Mail und Passwort kann kein Account erstellt werden."],
                ["Standortdaten (GPS)", "Einwilligung (Art. 6 Abs. 1 lit. a DSGVO)", "Du aktivierst die GPS-Ortung explizit durch Antippen des Ortungs-Buttons. Die Einwilligung ist freiwillig und kann jederzeit widerrufen werden (Einstellungen → Standort löschen)."],
                ["Spielebibliothek & Partien", "Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO)", "Kernfunktion der App."],
                ["Soziale Funktionen", "Berechtigtes Interesse / Vertragserfüllung (Art. 6 Abs. 1 lit. b/f DSGVO)", "Freundschaften und Nachrichten sind freiwillige Funktionen."],
                ["Push-Benachrichtigungen", "Einwilligung (Art. 6 Abs. 1 lit. a DSGVO)", "Erst nach expliziter Browser-/OS-Erlaubnis aktiviert."],
              ].map(([cat, basis, desc]) => (
                <div key={cat} className="border border-border rounded-xl p-3">
                  <p className="font-medium text-foreground">{cat}</p>
                  <p className="text-amber-700 text-xs font-medium mt-0.5">{basis}</p>
                  <p className="mt-1 text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-3">4. Drittanbieter und Datenübermittlung</h2>
            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              {[
                {
                  name: "Supabase (Datenbank & Auth)",
                  detail: "Alle Nutzer- und App-Daten werden in der Supabase-Cloud gespeichert (EU-Region: Frankfurt, AWS eu-central-1). Auftragsverarbeitungsvertrag (AVV) liegt vor. Supabase Inc., 970 Trestle Glen Rd, Oakland, CA.",
                },
                {
                  name: "Vercel (Hosting)",
                  detail: "Der App-Server läuft auf Vercel. Vercel speichert Logs kurzfristig inkl. IP-Adressen. Auftragsverarbeitungsvertrag liegt vor. Vercel Inc., 340 Pine Street, San Francisco, CA.",
                },
                {
                  name: "Google OAuth",
                  detail: "Wenn du dich mit Google anmeldest, erhält Google die Information, dass du MeepleBase nutzt. Wir speichern nur E-Mail und Anzeigename. Google LLC, Mountain View, CA.",
                },
                {
                  name: "OpenStreetMap / Nominatim",
                  detail: "Für die Umwandlung von GPS-Koordinaten in Städtenamen (Reverse Geocoding) wird der Nominatim-Dienst der OpenStreetMap Foundation genutzt. Es werden nur Koordinaten übermittelt, keine Account-Daten. OpenStreetMap Foundation, St John's Innovation Centre, Cambridge, UK.",
                },
                {
                  name: "BoardGameGeek",
                  detail: "Spielmetadaten (Titel, Cover, Komplexität) werden von boardgamegeek.com geladen. Dabei wird deine IP-Adresse an BGG übermittelt. Keine Account-Daten. BoardGameGeek LLC.",
                },
                {
                  name: "YouTube (Soundboard)",
                  detail: "Das optionale Soundboard-Feature bettet YouTube-Videos ein. Beim Abspielen gelten YouTubes Datenschutzbedingungen (Google LLC). Wir empfehlen, nur lizenzfreie Inhalte zu verlinken.",
                },
                {
                  name: "Melodice.org",
                  detail: "Das Melodice-Feature öffnet melodice.org in einem neuen Tab. Deine Suchanfrage wird an melodice.org übermittelt. Keine Account-Daten.",
                },
              ].map(({ name, detail }) => (
                <div key={name} className="border border-border rounded-xl p-3">
                  <p className="font-medium text-foreground">{name}</p>
                  <p className="mt-1 text-xs leading-relaxed">{detail}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 5 */}
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-3">5. Speicherdauer</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Deine Daten werden gespeichert, solange dein Account existiert. Nach einer Kontolöschung
              werden alle personenbezogenen Daten (Profil, Bibliothek, Partien, Nachrichten, Fotos)
              innerhalb von 30 Tagen vollständig gelöscht. Standortdaten (GPS-Koordinaten) können
              jederzeit in den Einstellungen unabhängig vom Account gelöscht werden.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-3">6. Deine Rechte</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              Du hast nach der DSGVO folgende Rechte:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                ["Auskunft (Art. 15)", "Du kannst jederzeit Auskunft über die über dich gespeicherten Daten verlangen."],
                ["Berichtigung (Art. 16)", "Falsche oder unvollständige Daten kannst du in den Einstellungen selbst korrigieren."],
                ["Löschung (Art. 17)", 'Über "Account löschen" im Profil kannst du alle Daten löschen. Einzelne Daten (z.B. Standort) sind separat in den Einstellungen löschbar.'],
                ["Einschränkung (Art. 18)", "Du kannst die Verarbeitung deiner Daten in bestimmten Fällen einschränken lassen."],
                ["Datenübertragbarkeit (Art. 20)", "Auf Anfrage stellen wir deine Daten in einem maschinenlesbaren Format bereit."],
                ["Widerspruch (Art. 21)", "Du kannst der Verarbeitung auf Basis berechtigter Interessen widersprechen."],
                ["Widerruf der Einwilligung (Art. 7)", "Einwilligungen (GPS, Push-Benachrichtigungen) kannst du jederzeit in den Einstellungen widerrufen."],
                ["Beschwerde", "Du hast das Recht, eine Beschwerde bei einer Datenschutzbehörde einzureichen (in Deutschland: Landesdatenschutzbeauftragte)."],
              ].map(([right, desc]) => (
                <li key={right} className="border border-border rounded-xl p-3">
                  <span className="font-medium text-foreground">{right}: </span>
                  {desc}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              Für Anfragen zu deinen Rechten:{" "}
              <a href="mailto:dennis_rau@outlook.de" className="text-amber-600 underline underline-offset-2">
                dennis_rau@outlook.de
              </a>
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-3">7. Sicherheit</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Die Übertragung aller Daten erfolgt verschlüsselt via HTTPS/TLS. Datenbankzugriffe
              sind durch Row-Level Security (RLS) abgesichert — jeder Nutzer kann ausschließlich
              auf seine eigenen Daten zugreifen. Passwörter werden durch Supabase Auth gehasht
              und niemals im Klartext gespeichert.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-3">8. Cookies und lokale Speicherung</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              MeepleBase verwendet Cookies ausschließlich für die Session-Verwaltung (Login-Status).
              Es werden keine Tracking-Cookies oder Werbe-Cookies eingesetzt. Das Soundboard
              speichert deine Sound-Buttons im <code className="text-xs bg-muted px-1 py-0.5 rounded">localStorage</code> des
              Browsers — diese Daten verlassen dein Gerät nicht.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-3">9. Änderungen dieser Erklärung</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Bei wesentlichen Änderungen dieser Datenschutzerklärung werden registrierte Nutzer
              per E-Mail informiert. Das Datum der letzten Änderung ist oben angegeben.
            </p>
          </section>

        </div>

        {/* Footer nav */}
        <div className="mt-12 pt-6 border-t border-border flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Link href="/impressum" className="hover:text-foreground transition-colors underline underline-offset-2">Impressum</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors underline underline-offset-2">AGB</Link>
          <Link href="/profile" className="hover:text-foreground transition-colors underline underline-offset-2">Zurück zum Profil</Link>
        </div>
      </div>
    </div>
  );
}
