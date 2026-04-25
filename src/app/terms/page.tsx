import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Nutzungsbedingungen – MeepleBase",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft size={15} /> Zurück
        </Link>

        <h1 className="font-display text-3xl font-bold text-foreground mb-2">Nutzungsbedingungen</h1>
        <p className="text-sm text-muted-foreground mb-10">Stand: April 2026</p>

        <div className="space-y-8 text-sm text-muted-foreground">

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-3">1. Geltungsbereich</h2>
            <p className="leading-relaxed">
              Diese Nutzungsbedingungen gelten für die Nutzung der Web-App MeepleBase
              (nachfolgend &bdquo;Dienst&ldquo;), betrieben von Dennis Rau (siehe{" "}
              <Link href="/impressum" className="text-amber-600 underline underline-offset-2">Impressum</Link>
              ). Mit der Registrierung akzeptierst du diese Bedingungen.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-3">2. Nutzung des Dienstes</h2>
            <ul className="space-y-2 list-disc list-inside leading-relaxed">
              <li>MeepleBase ist ein kostenloser Dienst für private, nicht-kommerzielle Nutzung.</li>
              <li>Du musst mindestens 16 Jahre alt sein, um einen Account zu erstellen.</li>
              <li>Du bist verantwortlich für alle Aktivitäten unter deinem Account.</li>
              <li>Automatisiertes Auslesen (Scraping) des Dienstes ist nicht erlaubt.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-3">3. Nutzerinhalte</h2>
            <p className="leading-relaxed">
              Du behältst alle Rechte an Inhalten, die du hochlädst (Fotos, Notizen, Partiedaten).
              Du räumst MeepleBase das Recht ein, diese Inhalte ausschließlich zur Bereitstellung
              des Dienstes zu speichern und anzuzeigen. Du bestätigst, dass du die Rechte
              an hochgeladenen Inhalten besitzt und keine Rechte Dritter verletzt.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-3">4. Soundboard – erlaubte Inhalte</h2>
            <p className="leading-relaxed">
              Im Soundboard dürfen ausschließlich YouTube-Links zu Inhalten eingebettet werden,
              für die du die entsprechenden Nutzungsrechte besitzt oder die unter einer
              freien Lizenz stehen (z.B. Creative Commons, royalty-free). Das Einbetten
              urheberrechtlich geschützter Musik ohne Lizenz ist nicht erlaubt.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-3">5. Verfügbarkeit</h2>
            <p className="leading-relaxed">
              MeepleBase ist ein Hobbyprojekt ohne Verfügbarkeitsgarantie. Der Dienst
              kann jederzeit ohne Vorankündigung geändert, eingeschränkt oder eingestellt
              werden. Bei einer Einstellung werden Nutzer mindestens 30 Tage vorher
              informiert und erhalten die Möglichkeit, ihre Daten zu exportieren.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-3">6. Haftung</h2>
            <p className="leading-relaxed">
              Der Dienst wird ohne Gewährleistung bereitgestellt. Eine Haftung für
              Datenverlust, Schäden durch Ausfallzeiten oder fehlerhafte Drittanbieter-Daten
              (z.B. BGG-Metadaten) ist ausgeschlossen, soweit gesetzlich zulässig.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-3">7. Kündigung</h2>
            <p className="leading-relaxed">
              Du kannst deinen Account jederzeit über das Profil → &bdquo;Account löschen&ldquo; kündigen.
              Alle deine Daten werden dann innerhalb von 30 Tagen gelöscht.
              Wir behalten uns vor, Accounts bei Verstößen gegen diese Bedingungen zu sperren.
            </p>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-foreground mb-3">8. Anwendbares Recht</h2>
            <p className="leading-relaxed">
              Es gilt deutsches Recht. Gerichtsstand für Streitigkeiten ist, soweit
              gesetzlich zulässig, der Wohnsitz des Anbieters.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-6 border-t border-border flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground transition-colors underline underline-offset-2">Datenschutz</Link>
          <Link href="/impressum" className="hover:text-foreground transition-colors underline underline-offset-2">Impressum</Link>
          <Link href="/profile" className="hover:text-foreground transition-colors underline underline-offset-2">Zurück zum Profil</Link>
        </div>
      </div>
    </div>
  );
}
