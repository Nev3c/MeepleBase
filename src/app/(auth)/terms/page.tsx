export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-[#FDFAF6] px-6 py-10 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-[#1E2A3A] mb-2">Nutzungsbedingungen</h1>
      <p className="text-xs text-muted-foreground mb-8">Stand: April 2026</p>

      <div className="space-y-6 text-sm text-foreground">

        <section>
          <h2 className="font-semibold text-base mb-2">1. Betreiber und Geltungsbereich</h2>
          <p className="text-muted-foreground leading-relaxed">
            MeepleBase wird betrieben von Dennis Rau, Gehrengrabenstraße 1b, 77886 Lauf
            (nachfolgend &bdquo;Betreiber&ldquo;). Diese Nutzungsbedingungen gelten für alle Nutzer
            der Web-App MeepleBase (<em>meeplebase.app</em>) und ihrer Funktionen.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">2. Leistungsbeschreibung</h2>
          <p className="text-muted-foreground leading-relaxed">
            MeepleBase ist eine kostenlose, nicht-kommerzielle Web-App zur persönlichen
            Verwaltung von Brettspielsammlungen. Sie ermöglicht das Erfassen von Spielen,
            Partien, Notizen und Fotos. Die App wird ohne Gewinnabsicht als Hobbyprojekt betrieben.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-2">
            Es besteht kein Anspruch auf dauerhaften Betrieb, Verfügbarkeit, Weiterentwicklung
            oder den Erhalt bestimmter Funktionen.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">3. Registrierung und Account</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground leading-relaxed">
            <li>Die Registrierung ist kostenlos. Es darf pro Person nur ein Account angelegt werden.</li>
            <li>Zugangsdaten sind vertraulich zu behandeln und dürfen nicht weitergegeben werden.</li>
            <li>Bei Verdacht auf Missbrauch des Accounts ist der Betreiber unverzüglich zu informieren.</li>
            <li>Der Betreiber behält sich vor, Accounts ohne Angabe von Gründen zu sperren oder zu löschen,
            insbesondere bei Verstößen gegen diese Nutzungsbedingungen.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">4. Nutzungsrechte und Einschränkungen</h2>
          <p className="text-muted-foreground leading-relaxed mb-2">
            Die Nutzung der App ist ausschließlich für private, nicht-kommerzielle Zwecke gestattet.
            Untersagt ist insbesondere:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground leading-relaxed">
            <li>Automatisierter Zugriff (Bots, Scraping) auf die App oder die API</li>
            <li>Nutzung für kommerzielle Zwecke ohne ausdrückliche schriftliche Genehmigung</li>
            <li>Hochladen rechtswidriger, beleidigender oder urheberrechtlich geschützter Inhalte</li>
            <li>Weiterverkauf oder Weiterlizenzierung von Spieledaten, die über MeepleBase abgerufen wurden</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">4a. Soundboard — erlaubte Inhalte</h2>
          <p className="text-muted-foreground leading-relaxed">
            Im Soundboard dürfen ausschließlich YouTube-Links zu Inhalten verwendet werden,
            für die der Nutzer die entsprechenden Nutzungsrechte besitzt oder die unter einer
            freien Lizenz stehen (z.B. Creative Commons, royalty-free). Das Einbetten
            urheberrechtlich geschützter Musik oder anderer Inhalte ohne Lizenz ist untersagt.
            Der Nutzer ist für die Einhaltung des Urheberrechts selbst verantwortlich.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">5. Nutzergenerierte Inhalte</h2>
          <p className="text-muted-foreground leading-relaxed">
            Hochgeladene Fotos, Notizen und andere Inhalte verbleiben im Eigentum des Nutzers.
            Mit dem Hochladen räumt der Nutzer dem Betreiber das technisch notwendige Recht ein,
            diese Inhalte zum Zweck der Bereitstellung der App zu speichern und anzuzeigen.
            Inhalte sind ausschließlich für den jeweiligen Nutzer sichtbar (kein öffentliches Profil in Phase 1).
          </p>
          <p className="text-muted-foreground leading-relaxed mt-2">
            Der Nutzer ist verantwortlich dafür, dass hochgeladene Inhalte keine Rechte Dritter verletzen
            und nicht rechtswidrig sind.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">6. Spieledaten von BoardGameGeek</h2>
          <p className="text-muted-foreground leading-relaxed">
            Spielmetadaten (Namen, Beschreibungen, Cover-Bilder, Kategorien etc.) werden von
            BoardGameGeek (boardgamegeek.com) bezogen. MeepleBase steht in keiner Verbindung zu
            BoardGameGeek, LLC. Die Richtigkeit, Vollständigkeit und Aktualität dieser Daten
            wird nicht garantiert.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">7. Haftung</h2>
          <p className="text-muted-foreground leading-relaxed">
            Der Betreiber haftet nicht für:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground leading-relaxed mt-2">
            <li>Datenverlust durch technische Ausfälle, Fehler oder Drittanbieter-Ausfälle</li>
            <li>Schäden durch zeitweilige Nichtverfügbarkeit der App</li>
            <li>Fehlerhafte oder unvollständige Spieledaten von BGG</li>
            <li>Inhalte externer verlinkter Websites</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-2">
            Die App wird ohne jede Garantie (&ldquo;as is&rdquo;) bereitgestellt. Die Nutzung
            erfolgt auf eigene Gefahr.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">8. Kündigung und Datenlöschung</h2>
          <p className="text-muted-foreground leading-relaxed">
            Nutzer können ihren Account jederzeit unter <em>Profil → Account löschen</em> unwiderruflich
            löschen. Dabei werden alle gespeicherten Daten (Bibliothek, Partien, Notizen, Fotos)
            vollständig und dauerhaft entfernt.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-2">
            Der Betreiber kann den Dienst jederzeit einstellen. Im Falle einer Einstellung werden
            Nutzer mit aktivem Account mindestens 30 Tage vorher informiert.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">9. Änderungen der Nutzungsbedingungen</h2>
          <p className="text-muted-foreground leading-relaxed">
            Diese Nutzungsbedingungen können jederzeit angepasst werden. Bei wesentlichen Änderungen
            werden aktive Nutzer per E-Mail oder in der App informiert. Die weitere Nutzung nach
            Inkrafttreten der Änderungen gilt als Zustimmung.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">10. Anwendbares Recht</h2>
          <p className="text-muted-foreground leading-relaxed">
            Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist, soweit gesetzlich
            zulässig, 77886 Lauf.
          </p>
        </section>

        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            <a href="/impressum" className="text-amber-600 underline mr-4">Impressum</a>
            <a href="/privacy" className="text-amber-600 underline">Datenschutzerklärung</a>
          </p>
        </div>

      </div>
    </div>
  );
}
