export default function ImpressumPage() {
  return (
    <div className="min-h-dvh bg-[#FDFAF6] px-6 py-10 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-[#1E2A3A] mb-6">Impressum</h1>

      <div className="space-y-5 text-sm text-foreground">

        <section>
          <h2 className="font-semibold text-base mb-2">Angaben gemäß § 5 TMG</h2>
          <p className="text-muted-foreground leading-relaxed">
            Dennis Rau<br />
            Gehrengrabenstraße 1b<br />
            77886 Lauf<br />
            Deutschland
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">Kontakt</h2>
          <p className="text-muted-foreground leading-relaxed">
            Telefon: 07841 668067<br />
            E-Mail: <a href="mailto:dennis_rau@outlook.de" className="text-amber-600 underline">dennis_rau@outlook.de</a>
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">Verantwortlich für den Inhalt (§ 18 Abs. 2 MStV)</h2>
          <p className="text-muted-foreground leading-relaxed">
            Dennis Rau, Gehrengrabenstraße 1b, 77886 Lauf
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">Hinweis zur App</h2>
          <p className="text-muted-foreground leading-relaxed">
            MeepleBase ist ein privates, nicht-kommerzielles Hobby-Projekt zur Verwaltung von
            Brettspielsammlungen. Die App wird kostenlos und ohne kommerzielle Absicht betrieben.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">Drittanbieter-Inhalte</h2>
          <p className="text-muted-foreground leading-relaxed text-xs">
            Spieledaten und -cover werden von BoardGameGeek (boardgamegeek.com) bezogen.
            BoardGameGeek ist eine Marke von BoardGameGeek, LLC. MeepleBase steht in keiner
            Verbindung zu BoardGameGeek, LLC.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">Haftungsausschluss</h2>
          <p className="text-muted-foreground leading-relaxed text-xs">
            Trotz sorgfältiger inhaltlicher Kontrolle übernehmen wir keine Haftung für die
            Inhalte externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich
            deren Betreiber verantwortlich. Die Nutzung der App erfolgt auf eigene Gefahr.
            Ein Anspruch auf Verfügbarkeit oder Fehlerfreiheit besteht nicht.
          </p>
        </section>

        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            <a href="/privacy" className="text-amber-600 underline mr-4">Datenschutzerklärung</a>
            <a href="/terms" className="text-amber-600 underline">Nutzungsbedingungen</a>
          </p>
        </div>
      </div>
    </div>
  );
}
