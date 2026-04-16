export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-[#FDFAF6] px-6 py-10 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-[#1E2A3A] mb-2">Datenschutzerklärung</h1>
      <p className="text-xs text-muted-foreground mb-8">Stand: April 2026</p>

      <div className="space-y-6 text-sm text-foreground">

        <section>
          <h2 className="font-semibold text-base mb-2">1. Verantwortlicher</h2>
          <p className="text-muted-foreground leading-relaxed">
            Verantwortlicher im Sinne der DSGVO ist [Name, Adresse, E-Mail — siehe Impressum].
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">2. Welche Daten wir erheben</h2>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground leading-relaxed">
            <li><strong>Account-Daten:</strong> E-Mail-Adresse, (optionaler) Benutzername, Profilfoto (nur bei Google-Login)</li>
            <li><strong>Nutzungsdaten:</strong> Spielebibliothek, erfasste Partien, Spielnotizen, eigene Fotos</li>
            <li><strong>Technische Daten:</strong> IP-Adresse (von Vercel-Infrastruktur, max. 30 Tage gespeichert), Browser-Typ</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">3. Zweck der Verarbeitung</h2>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground leading-relaxed">
            <li>Bereitstellung der App-Funktionen (Art. 6 Abs. 1 lit. b DSGVO — Vertragserfüllung)</li>
            <li>Authentifizierung und Accountverwaltung</li>
            <li>Kein Einsatz von Tracking, Werbung oder Analysetools</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">4. Drittanbieter &amp; Datenübertragung</h2>
          <div className="space-y-3 text-muted-foreground leading-relaxed">
            <div>
              <p className="font-medium text-foreground">Supabase (Auth + Datenbank)</p>
              <p>Supabase Inc., San Francisco, USA. Daten werden auf EU-Servern gespeichert (Frankfurt).
              Datenschutz: <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-amber-600 underline">supabase.com/privacy</a></p>
            </div>
            <div>
              <p className="font-medium text-foreground">Vercel (Hosting)</p>
              <p>Vercel Inc., San Francisco, USA. Standardvertragsklauseln (SCC) für Drittlandübertragung.
              Datenschutz: <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-amber-600 underline">vercel.com/legal/privacy-policy</a></p>
            </div>
            <div>
              <p className="font-medium text-foreground">Google OAuth (optional)</p>
              <p>Bei Anmeldung über Google: Datenverarbeitung durch Google Ireland Ltd. gemäß Google-Datenschutzerklärung.
              Nur bei expliziter Nutzung des &quot;Mit Google registrieren&quot;-Buttons.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">BoardGameGeek API</p>
              <p>Spieledaten werden von boardgamegeek.com abgerufen. Dabei wird keine persönliche Information übermittelt.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">5. Speicherdauer</h2>
          <p className="text-muted-foreground leading-relaxed">
            Deine Daten werden gespeichert, solange dein Account besteht. Bei Accountlöschung (in der App möglich)
            werden alle personenbezogenen Daten innerhalb von 30 Tagen unwiderruflich gelöscht.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">6. Deine Rechte (DSGVO Art. 15–21)</h2>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground leading-relaxed">
            <li><strong>Auskunft</strong> über gespeicherte Daten</li>
            <li><strong>Berichtigung</strong> unrichtiger Daten (in den App-Einstellungen möglich)</li>
            <li><strong>Löschung</strong> deines Accounts (direkt in der App unter Profil)</li>
            <li><strong>Einschränkung</strong> der Verarbeitung</li>
            <li><strong>Datenübertragbarkeit</strong></li>
            <li><strong>Widerspruch</strong> gegen die Verarbeitung</li>
          </ul>
          <p className="text-muted-foreground mt-2">
            Anfragen an: <a href="mailto:[deine@email.de]" className="text-amber-600 underline">[deine@email.de]</a>
          </p>
          <p className="text-muted-foreground mt-1">
            Du hast außerdem das Recht, dich bei der zuständigen Datenschutzbehörde zu beschweren
            (Deutschland: <a href="https://www.bfdi.bund.de" target="_blank" rel="noopener noreferrer" className="text-amber-600 underline">bfdi.bund.de</a>).
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">7. Cookies</h2>
          <p className="text-muted-foreground leading-relaxed">
            Diese App verwendet ausschließlich technisch notwendige Session-Cookies für die Authentifizierung (Supabase Auth).
            Es werden keine Marketing- oder Tracking-Cookies gesetzt.
          </p>
        </section>

        <p className="text-xs text-muted-foreground pt-4">
          <a href="/impressum" className="text-amber-600 underline mr-4">Impressum</a>
          <a href="/terms" className="text-amber-600 underline">Nutzungsbedingungen</a>
        </p>
      </div>
    </div>
  );
}
