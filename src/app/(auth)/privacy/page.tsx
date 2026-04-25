export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-[#FDFAF6] px-6 py-10 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-[#1E2A3A] mb-2">Datenschutzerklärung</h1>
      <p className="text-xs text-muted-foreground mb-8">Stand: April 2026</p>

      <div className="space-y-6 text-sm text-foreground">

        <section>
          <h2 className="font-semibold text-base mb-2">1. Verantwortlicher (Art. 13 DSGVO)</h2>
          <p className="text-muted-foreground leading-relaxed">
            Dennis Rau<br />
            Gehrengrabenstraße 1b, 77886 Lauf<br />
            E-Mail: <a href="mailto:dennis_rau@outlook.de" className="text-amber-600 underline">dennis_rau@outlook.de</a><br />
            Telefon: 07841 668067
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">2. Erhobene Daten und Zwecke</h2>
          <div className="space-y-4">

            <div className="bg-muted/40 rounded-xl p-4">
              <p className="font-medium mb-1">Account-Registrierung</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                <strong>Daten:</strong> E-Mail-Adresse, Passwort (gehasht), optionaler Benutzername<br />
                <strong>Zweck:</strong> Authentifizierung und Kontoverwaltung<br />
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)<br />
                <strong>Speicherdauer:</strong> Bis zur Kontolöschung
              </p>
            </div>

            <div className="bg-muted/40 rounded-xl p-4">
              <p className="font-medium mb-1">Google-Login (optional)</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                <strong>Daten:</strong> E-Mail-Adresse, Profilname, Profilfoto von Google<br />
                <strong>Zweck:</strong> Vereinfachte Anmeldung ohne separates Passwort<br />
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung durch aktive Nutzung)<br />
                <strong>Hinweis:</strong> Google verarbeitet dabei Daten gemäß eigener Datenschutzerklärung
                (<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-amber-600 underline">policies.google.com/privacy</a>)
              </p>
            </div>

            <div className="bg-muted/40 rounded-xl p-4">
              <p className="font-medium mb-1">Nutzungsdaten</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                <strong>Daten:</strong> Spielebibliothek, Partienhistorie, Spielnotizen, eigene Fotos<br />
                <strong>Zweck:</strong> Kernfunktion der App — persönliche Brettspiel-Verwaltung<br />
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO<br />
                <strong>Speicherdauer:</strong> Bis zur Kontolöschung. Fotos werden in Supabase Storage gespeichert.
              </p>
            </div>

            <div className="bg-muted/40 rounded-xl p-4">
              <p className="font-medium mb-1">Standortdaten (optional, GPS)</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                <strong>Daten:</strong> Stadtname/Ortsangabe (manuell oder per GPS) sowie geografische
                Koordinaten (Breitengrad, Längengrad) bei Nutzung der GPS-Ortungsfunktion<br />
                <strong>Zweck:</strong> Anzeige des ungefähren Wohnorts im Profil; serverseitige
                Entfernungsberechnung für die &bdquo;Spieler in meiner Nähe&ldquo;-Suche<br />
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung) — die
                GPS-Ortung wird nur nach expliziter Aktivierung durch den Nutzer durchgeführt<br />
                <strong>Hinweis:</strong> Der Stadtname wird anderen Nutzern angezeigt. Die genauen
                Koordinaten werden <em>niemals</em> an andere Nutzer weitergegeben und ausschließlich
                serverseitig zur Entfernungsberechnung verwendet.<br />
                <strong>Widerruf:</strong> Standortdaten können jederzeit in den Einstellungen
                (Standort-Feld leeren + Speichern) gelöscht werden.
              </p>
            </div>

            <div className="bg-muted/40 rounded-xl p-4">
              <p className="font-medium mb-1">Soziale Funktionen (optional)</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                <strong>Daten:</strong> Freundschaftsverbindungen, Direktnachrichten, Spielerabend-Einladungen<br />
                <strong>Zweck:</strong> Vernetzung mit anderen Brettspiel-Spielern<br />
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung der gewählten Funktion)<br />
                <strong>Speicherdauer:</strong> Bis zur Kontolöschung
              </p>
            </div>

            <div className="bg-muted/40 rounded-xl p-4">
              <p className="font-medium mb-1">Push-Benachrichtigungen (optional)</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                <strong>Daten:</strong> Push-Endpunkt-URL des Browsers/Geräts<br />
                <strong>Zweck:</strong> Benachrichtigungen über neue Nachrichten und Spielerabend-Einladungen<br />
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. a DSGVO (Einwilligung via Browser-Prompt)<br />
                <strong>Widerruf:</strong> Jederzeit in Einstellungen → Benachrichtigungen deaktivierbar
              </p>
            </div>

            <div className="bg-muted/40 rounded-xl p-4">
              <p className="font-medium mb-1">Spielbeschreibungen übersetzen (optional)</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                <strong>Daten:</strong> Englische Spielbeschreibungen (kein Personenbezug)<br />
                <strong>Zweck:</strong> Automatische Übersetzung ins Deutsche<br />
                <strong>Dienst:</strong> Google Translate API (unoffizielle, schlüssellose Schnittstelle)<br />
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse — kein Personenbezug)<br />
                <strong>Hinweis:</strong> Es werden ausschließlich BGG-Spielbeschreibungen übermittelt, keine Nutzerdaten.
              </p>
            </div>

            <div className="bg-muted/40 rounded-xl p-4">
              <p className="font-medium mb-1">Serverzugriffsdaten</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                <strong>Daten:</strong> IP-Adresse, Browser-Typ, Zeitstempel (durch Vercel-Infrastruktur)<br />
                <strong>Zweck:</strong> Technischer Betrieb, Fehlerdiagnose, Missbrauchsabwehr<br />
                <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse)<br />
                <strong>Speicherdauer:</strong> Max. 30 Tage (Vercel-Standardeinstellung)
              </p>
            </div>

          </div>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">3. Auftragsverarbeiter und Drittanbieter</h2>
          <div className="space-y-3 text-muted-foreground leading-relaxed">
            <div className="border-l-2 border-amber-200 pl-3">
              <p className="font-medium text-foreground text-xs">Supabase (Datenbank, Auth, Dateispeicher)</p>
              <p className="text-xs">Supabase Inc., 970 Toa Payoh North, Singapur. Datenspeicherung auf EU-Servern
              (AWS Frankfurt, Region eu-central-1). Auftragsverarbeitungsvertrag (DPA) abgeschlossen.
              &rarr; <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-amber-600 underline">supabase.com/privacy</a></p>
            </div>
            <div className="border-l-2 border-amber-200 pl-3">
              <p className="font-medium text-foreground text-xs">Vercel (Hosting, CDN)</p>
              <p className="text-xs">Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA.
              Drittlandübertragung auf Basis von Standardvertragsklauseln (SCC gem. Art. 46 DSGVO).
              &rarr; <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-amber-600 underline">vercel.com/legal/privacy-policy</a></p>
            </div>
            <div className="border-l-2 border-amber-200 pl-3">
              <p className="font-medium text-foreground text-xs">BoardGameGeek API</p>
              <p className="text-xs">BoardGameGeek, LLC, USA. Es werden ausschließlich öffentliche
              Spieledaten abgerufen. Dabei werden keine personenbezogenen Daten der Nutzer übermittelt.
              &rarr; <a href="https://boardgamegeek.com/privacy" target="_blank" rel="noopener noreferrer" className="text-amber-600 underline">boardgamegeek.com/privacy</a></p>
            </div>
            <div className="border-l-2 border-amber-200 pl-3">
              <p className="font-medium text-foreground text-xs">OpenStreetMap / Nominatim (Geocoding)</p>
              <p className="text-xs">OpenStreetMap Foundation, Cambridge, UK. Wird für die Umwandlung
              von GPS-Koordinaten in Städtenamen (Reverse Geocoding) genutzt. Dabei werden nur
              Koordinaten übermittelt — keine Account- oder Profildaten.
              &rarr; <a href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noopener noreferrer" className="text-amber-600 underline">osmfoundation.org/wiki/Privacy_Policy</a></p>
            </div>
            <div className="border-l-2 border-amber-200 pl-3">
              <p className="font-medium text-foreground text-xs">YouTube (optionales Soundboard)</p>
              <p className="text-xs">Google LLC, Mountain View, CA. Das Soundboard-Feature bettet
              YouTube-Videos ein. Beim Abspielen werden Daten (inkl. IP-Adresse) an YouTube/Google
              übermittelt und gelten deren Datenschutzbedingungen. Das Feature ist vollständig optional.
              &rarr; <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-amber-600 underline">policies.google.com/privacy</a></p>
            </div>
            <div className="border-l-2 border-amber-200 pl-3">
              <p className="font-medium text-foreground text-xs">Melodice.org (optionale Musik-Suche)</p>
              <p className="text-xs">melodice.org. Beim Öffnen einer Melodice-Playlist wird ein neuer
              Tab mit der eingegebenen Suchanfrage (Spielname) geöffnet. Es werden keine Accountdaten
              übermittelt.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">4. Keine Weitergabe an Dritte</h2>
          <p className="text-muted-foreground leading-relaxed">
            Personenbezogene Daten werden nicht an Dritte verkauft, vermietet oder zu Werbezwecken
            weitergegeben. Eine Weitergabe erfolgt ausschließlich an die oben genannten Auftragsverarbeiter
            im Rahmen des Betriebs der App.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">5. Cookies</h2>
          <p className="text-muted-foreground leading-relaxed">
            MeepleBase verwendet ausschließlich technisch notwendige Session-Cookies für die
            Authentifizierung (Supabase Auth-Token). Es werden keine Marketing-, Tracking- oder
            Analyse-Cookies gesetzt. Ein Cookie-Banner ist daher nicht erforderlich.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">6. Speicherdauer</h2>
          <p className="text-muted-foreground leading-relaxed">
            Daten werden gespeichert, solange dein Account besteht. Bei Accountlöschung
            (unter Profil → &ldquo;Account löschen&rdquo;) werden alle personenbezogenen Daten
            einschließlich Bibliothek, Partien, Notizen und Fotos unwiderruflich gelöscht.
            Die Löschung erfolgt innerhalb von 30 Tagen.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">7. Deine Rechte (Art. 15–21 DSGVO)</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Auskunft", "Art. 15"],
              ["Berichtigung", "Art. 16"],
              ["Löschung", "Art. 17"],
              ["Einschränkung", "Art. 18"],
              ["Datenübertragbarkeit", "Art. 20"],
              ["Widerspruch", "Art. 21"],
            ].map(([right, article]) => (
              <div key={right} className="bg-muted/40 rounded-lg px-3 py-2">
                <p className="text-xs font-medium">{right}</p>
                <p className="text-[10px] text-muted-foreground">{article} DSGVO</p>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-xs mt-3">
            Anfragen richten an:{" "}
            <a href="mailto:dennis_rau@outlook.de" className="text-amber-600 underline">
              dennis_rau@outlook.de
            </a>
          </p>
          <p className="text-muted-foreground text-xs mt-2">
            Beschwerderecht bei der zuständigen Aufsichtsbehörde:{" "}
            <a href="https://www.lfd.bw.de" target="_blank" rel="noopener noreferrer" className="text-amber-600 underline">
              Landesbeauftragter für Datenschutz Baden-Württemberg (lfd.bw.de)
            </a>
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">8. Minderjährige</h2>
          <p className="text-muted-foreground leading-relaxed">
            MeepleBase richtet sich an Nutzer ab 16 Jahren. Für Nutzer unter 16 Jahren
            ist die Einwilligung der Erziehungsberechtigten erforderlich (Art. 8 DSGVO).
          </p>
        </section>

        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            <a href="/impressum" className="text-amber-600 underline mr-4">Impressum</a>
            <a href="/terms" className="text-amber-600 underline">Nutzungsbedingungen</a>
          </p>
        </div>

      </div>
    </div>
  );
}
