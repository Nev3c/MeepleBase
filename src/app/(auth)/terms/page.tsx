export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-[#FDFAF6] px-6 py-10 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-[#1E2A3A] mb-2">Nutzungsbedingungen</h1>
      <p className="text-xs text-muted-foreground mb-8">Stand: April 2026</p>

      <div className="space-y-6 text-sm text-foreground">

        <section>
          <h2 className="font-semibold text-base mb-2">1. Über MeepleBase</h2>
          <p className="text-muted-foreground leading-relaxed">
            MeepleBase ist eine kostenlose, nicht-kommerzielle Web-App für Brettspieler.
            Sie dient der persönlichen Verwaltung der eigenen Spielesammlung und Partienhistorie.
            Ein Anspruch auf Verfügbarkeit oder Weiterentwicklung besteht nicht.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">2. Nutzung</h2>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground leading-relaxed">
            <li>MeepleBase ist für die private, nicht-kommerzielle Nutzung bestimmt.</li>
            <li>Pro Person ist ein Account erlaubt.</li>
            <li>Der Betreiber behält sich vor, Accounts bei Missbrauch zu sperren.</li>
            <li>Die App wird &quot;as is&quot; bereitgestellt — keine Gewähr für Verfügbarkeit oder Fehlerfreiheit.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">3. Inhalte</h2>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground leading-relaxed">
            <li>Spieledaten stammen von BoardGameGeek und werden ohne Gewähr für Richtigkeit bereitgestellt.</li>
            <li>Nutzer sind für eigene hochgeladene Inhalte (Bilder, Notizen) selbst verantwortlich.</li>
            <li>Rechtswidrige Inhalte sind nicht erlaubt.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">4. Haftung</h2>
          <p className="text-muted-foreground leading-relaxed">
            Der Betreiber haftet nicht für Datenverlust, Ausfälle oder Schäden, die durch die Nutzung
            von MeepleBase entstehen. Die App wird ehrenamtlich ohne kommerzielle Absicht betrieben.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">5. Accountlöschung</h2>
          <p className="text-muted-foreground leading-relaxed">
            Du kannst deinen Account jederzeit unter Profil → &quot;Account löschen&quot; unwiderruflich löschen.
            Alle deine Daten werden dabei vollständig entfernt.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">6. Änderungen</h2>
          <p className="text-muted-foreground leading-relaxed">
            Diese Nutzungsbedingungen können jederzeit angepasst werden.
            Bei wesentlichen Änderungen werden aktive Nutzer informiert.
          </p>
        </section>

        <p className="text-xs text-muted-foreground pt-4">
          <a href="/impressum" className="text-amber-600 underline mr-4">Impressum</a>
          <a href="/privacy" className="text-amber-600 underline">Datenschutz</a>
        </p>
      </div>
    </div>
  );
}
