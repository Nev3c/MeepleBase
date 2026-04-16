export default function ImpressumPage() {
  return (
    <div className="min-h-dvh bg-[#FDFAF6] px-6 py-10 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-[#1E2A3A] mb-6">Impressum</h1>

      <div className="prose prose-sm text-foreground space-y-4">
        <section>
          <h2 className="font-semibold text-base mb-1">Angaben gemäß § 5 TMG</h2>
          {/* ── HIER AUSFÜLLEN ── */}
          <p className="text-muted-foreground leading-relaxed">
            <strong>[Vorname Nachname]</strong><br />
            [Straße Hausnummer]<br />
            [PLZ Ort]<br />
            Deutschland
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-1">Kontakt</h2>
          <p className="text-muted-foreground leading-relaxed">
            E-Mail: <a href="mailto:[deine@email.de]" className="text-amber-600 underline">[deine@email.de]</a>
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-1">Verantwortlich für den Inhalt (§ 18 Abs. 2 MStV)</h2>
          <p className="text-muted-foreground leading-relaxed">
            [Vorname Nachname], Anschrift wie oben
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-1">Haftungsausschluss</h2>
          <p className="text-muted-foreground leading-relaxed text-xs">
            Die Inhalte dieser App wurden mit größtmöglicher Sorgfalt erstellt. Spieledaten werden von BoardGameGeek bezogen.
            Für die Richtigkeit, Vollständigkeit und Aktualität der Daten wird keine Gewähr übernommen.
            Diese App ist ein privates, nicht-kommerzielles Hobby-Projekt.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-1">Drittanbieter</h2>
          <p className="text-muted-foreground leading-relaxed text-xs">
            Spieledaten: BoardGameGeek (brettspielgeek.com) · Hosting: Vercel Inc., San Francisco, USA ·
            Datenbank &amp; Auth: Supabase Inc., San Francisco, USA
          </p>
        </section>

        <p className="text-xs text-muted-foreground pt-4">
          <a href="/privacy" className="text-amber-600 underline mr-4">Datenschutz</a>
          <a href="/terms" className="text-amber-600 underline">Nutzungsbedingungen</a>
        </p>
      </div>
    </div>
  );
}
