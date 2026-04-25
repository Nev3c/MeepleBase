import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Impressum – MeepleBase",
};

export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft size={15} /> Zurück
        </Link>

        <h1 className="font-display text-3xl font-bold text-foreground mb-2">Impressum</h1>
        <p className="text-sm text-muted-foreground mb-10">Angaben gemäß § 5 TMG</p>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-8">
          <p className="text-sm text-amber-800 leading-relaxed">
            <strong>Hinweis:</strong> Dieses Impressum ist noch unvollständig.
            Bitte ergänze deine vollständige Postanschrift und Telefonnummer gemäß §&nbsp;5&nbsp;TMG.
            Ein Impressum ohne vollständige Anschrift ist in Deutschland abmahnfähig.
          </p>
        </div>

        <div className="space-y-6 text-sm text-muted-foreground">
          <section>
            <h2 className="font-semibold text-foreground mb-2">Anbieter</h2>
            <p className="leading-relaxed">
              Dennis Rau<br />
              {/* TODO: Vollständige Postanschrift eintragen */}
              [Straße und Hausnummer]<br />
              [PLZ] [Stadt]<br />
              Deutschland
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Kontakt</h2>
            <p className="leading-relaxed">
              E-Mail:{" "}
              <a href="mailto:dennis_rau@outlook.de" className="text-amber-600 underline underline-offset-2">
                dennis_rau@outlook.de
              </a><br />
              {/* TODO: Telefonnummer eintragen (TMG-Pflicht) */}
              Telefon: [Nummer eintragen]
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Verantwortlich für den Inhalt (§ 18 Abs. 2 MStV)</h2>
            <p className="leading-relaxed">
              Dennis Rau<br />
              (Anschrift wie oben)
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Haftungsausschluss</h2>
            <p className="leading-relaxed">
              MeepleBase ist ein privates Hobbyprojekt. Für die Inhalte verlinkter externer Seiten
              sind ausschließlich deren Betreiber verantwortlich. Nutzerinhalte (Partienfotos,
              Beschreibungen) liegen in der Verantwortung der jeweiligen Nutzer.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-foreground mb-2">Urheberrecht</h2>
            <p className="leading-relaxed">
              Spielmetadaten und -cover werden von BoardGameGeek bezogen und sind Eigentum
              der jeweiligen Verlage und Urheber. MeepleBase beansprucht kein Eigentum an
              diesen Inhalten.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground transition-colors underline underline-offset-2">Datenschutz</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors underline underline-offset-2">AGB</Link>
          <Link href="/profile" className="hover:text-foreground transition-colors underline underline-offset-2">Zurück zum Profil</Link>
        </div>
      </div>
    </div>
  );
}
