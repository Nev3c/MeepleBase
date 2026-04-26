"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, ArrowLeft, Check, Download, List, Plus, ExternalLink } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { GameStatus } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchResult {
  bgg_id: number;
  name: string;
  year_published: number | null;
  thumbnail_url?: string | null;
}

interface LookupResult extends SearchResult {
  min_players?: number | null;
  max_players?: number | null;
  min_playtime?: number | null;
  max_playtime?: number | null;
  description?: string | null;
}

type Step = "search" | "confirm";
type Tab = "search" | "import";

const STATUS_OPTIONS: { value: GameStatus; label: string }[] = [
  { value: "owned", label: "Im Besitz" },
  { value: "wishlist", label: "Wunschliste" },
  { value: "want_to_play", label: "Möchte spielen" },
  { value: "for_sale", label: "Zum Verkauf" },
];

// ── BGG URL parser ─────────────────────────────────────────────────────────────

function extractBggId(input: string): number | null {
  // Matches: boardgamegeek.com/boardgame/174430/... or just a plain number
  const urlMatch = input.match(/boardgamegeek\.com\/boardgame\/(\d+)/i);
  if (urlMatch) return Number(urlMatch[1]);
  const numMatch = input.trim().match(/^\d+$/);
  if (numMatch) return Number(numMatch[0]);
  return null;
}

// ── Main component ─────────────────────────────────────────────────────────────

interface AddGameSheetProps {
  open: boolean;
  onClose: () => void;
  bggUsername?: string | null;
  initialTab?: Tab;
}

export function AddGameSheet({ open, onClose, bggUsername, initialTab = "search" }: AddGameSheetProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [selected, setSelected] = useState<LookupResult | null>(null);
  const [status, setStatus] = useState<GameStatus>("owned");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);
  const [sheetMaxHeight, setSheetMaxHeight] = useState<string>("92dvh");

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      setStep("search");
      setTab(initialTab);
      setQuery("");
      setResults([]);
      setSelected(null);
      setStatus("owned");
      setAddError(null);
      setAddSuccess(false);
      setSearchError(false);
    }
  }, [open, initialTab]);

  // Search: detect BGG link first, otherwise text search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();

    // BGG link or ID → immediate lookup, no debounce
    const bggId = extractBggId(trimmed);
    if (bggId && trimmed.length > 3) {
      setSearching(true);
      setSearchError(false);
      setResults([]);
      fetch(`/api/bgg/lookup?id=${bggId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.bgg_id) {
            // Jump straight to confirm
            setSelected(data);
            setStep("confirm");
          } else {
            setSearchError(true);
          }
        })
        .catch(() => setSearchError(true))
        .finally(() => setSearching(false));
      return;
    }

    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    setSearchError(false);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/games/search?q=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        if (data.results?.length === 0) setSearchError(true);
      } catch {
        setSearchError(true);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleSelectGame = useCallback(async (game: SearchResult) => {
    setAdding(false);
    setAddError(null);
    setSearching(true);
    try {
      const res = await fetch(`/api/bgg/lookup?id=${game.bgg_id}`);
      const data = await res.json();
      setSelected(res.ok && !data.error ? data : game);
    } catch {
      setSelected(game);
    } finally {
      setSearching(false);
    }
    setStep("confirm");
  }, []);

  const handleBack = useCallback(() => {
    setStep("search");
    setSelected(null);
    setAddError(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  async function handleAdd() {
    if (!selected) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/games/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bgg_id: selected.bgg_id, status, name: selected.name }),
      });
      if (res.status === 409) { setAddError("Bereits in deiner Bibliothek."); setAdding(false); return; }
      if (!res.ok) { setAddError("Hinzufügen fehlgeschlagen. Bitte nochmal versuchen."); setAdding(false); return; }
      setAddSuccess(true);
      router.refresh();
      setTimeout(() => onClose(), 1200);
    } catch {
      setAddError("Netzwerkfehler. Bitte nochmal versuchen.");
      setAdding(false);
    }
  }

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Resize the sheet when the soft keyboard opens/closes so it never hides behind it.
  // visualViewport.height already excludes the keyboard on Android and iOS.
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setSheetMaxHeight(`${Math.floor(vv.height * 0.92)}px`);
    update();
    vv.addEventListener("resize", update);
    return () => vv.removeEventListener("resize", update);
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: sheetMaxHeight }}
        role="dialog" aria-modal="true"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0 border-b border-border">
          {step === "confirm" ? (
            <button onClick={handleBack} className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted transition-colors" aria-label="Zurück">
              <ArrowLeft size={20} />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Plus size={16} className="text-amber-600" strokeWidth={2.5} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg font-semibold text-foreground leading-tight truncate">
              {step === "confirm" ? (selected?.name ?? "Spiel hinzufügen") : "Spiel hinzufügen"}
            </h2>
            {step === "confirm" && selected?.year_published && (
              <p className="text-xs text-muted-foreground">{selected.year_published}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 -mr-1.5 rounded-lg hover:bg-muted transition-colors" aria-label="Schließen">
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        {step === "search" && (
          <div className="flex px-4 pt-3 pb-0 gap-1 flex-shrink-0">
            <button
              onClick={() => setTab("search")}
              className={cn(
                "flex-1 py-2 text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5",
                tab === "search" ? "bg-amber-500 text-white shadow-sm" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Search size={14} />
              Spiel suchen
            </button>
            <button
              onClick={() => setTab("import")}
              className={cn(
                "flex-1 py-2 text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5",
                tab === "import" ? "bg-amber-500 text-white shadow-sm" : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Download size={14} />
              Sammlung
            </button>
          </div>
        )}

        {/* Content */}
        {step === "search" && tab === "search" && (
          <SearchTab
            query={query}
            setQuery={setQuery}
            results={results}
            searching={searching}
            searchError={searchError}
            onSelect={handleSelectGame}
            inputRef={inputRef}
          />
        )}
        {step === "search" && tab === "import" && (
          <ImportTab bggUsername={bggUsername} onClose={onClose} />
        )}
        {step === "confirm" && (
          <ConfirmStep
            selected={selected!}
            status={status}
            setStatus={setStatus}
            onAdd={handleAdd}
            adding={adding}
            addError={addError}
            addSuccess={addSuccess}
          />
        )}
      </div>
    </>
  );
}

// ── Search tab ────────────────────────────────────────────────────────────────

function SearchTab({
  query, setQuery, results, searching, searchError, onSelect, inputRef,
}: {
  query: string; setQuery: (q: string) => void; results: SearchResult[];
  searching: boolean; searchError: boolean;
  onSelect: (g: SearchResult) => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  const trimmed = query.trim();
  const isBggLink = !!extractBggId(trimmed) && trimmed.length > 3;
  const showBggFallback = searchError && !isBggLink && trimmed.length >= 2;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-4 py-3 flex-shrink-0">
        <div className="relative">
          {/* Icon: link vs search */}
          {isBggLink ? (
            <ExternalLink size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none" />
          ) : (
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          )}
          {searching && (
            <svg className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {query && !searching && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Eingabe löschen"
            >
              <X size={14} />
            </button>
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder="Spielname oder BGG-Link einfügen…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={cn(
              "w-full h-11 pl-10 pr-8 rounded-xl border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent transition-all",
              isBggLink ? "border-amber-400 focus:ring-amber-400" : "border-border focus:ring-amber-400"
            )}
            autoComplete="off" autoCorrect="off"
          />
        </div>

        {/* BGG link detected hint */}
        {isBggLink && (
          <p className="text-xs text-amber-600 font-medium mt-1.5 px-1">
            BGG-Link erkannt – lade Spieldaten…
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8">

        {/* Empty state */}
        {!trimmed && (
          <div className="flex flex-col gap-3 py-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">So geht&apos;s</p>

            {/* Option 1: name search */}
            <div className="flex items-start gap-3 px-3 py-3 rounded-xl bg-muted/40">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Search size={15} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Spielname eingeben</p>
                <p className="text-xs text-muted-foreground mt-0.5">z.B. &quot;Gloomhaven&quot; oder &quot;Catan&quot;</p>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 px-1">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">oder</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Option 2: BGG link */}
            <div className="flex items-start gap-3 px-3 py-3 rounded-xl bg-muted/40">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <ExternalLink size={15} className="text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">BGG-Link oder Item-ID einfügen</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Spiel auf <a href="https://boardgamegeek.com" target="_blank" rel="noopener noreferrer" className="text-amber-600 underline underline-offset-1">boardgamegeek.com</a> suchen → Link oder BGG Item ID oben in die Suche einfügen. Funktioniert immer.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Fallback when search returns no results */}
        {showBggFallback && (
          <div className="mb-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
              <p className="text-sm font-semibold text-amber-900 mb-1">Kein Ergebnis</p>
              <p className="text-xs text-amber-800 leading-relaxed mb-3">
                Nicht gefunden. Suche das Spiel auf BGG, kopiere den Link und füge ihn hier ein.
              </p>
              <a
                href={`https://boardgamegeek.com/geeksearch.php?action=search&objecttype=boardgame&q=${encodeURIComponent(trimmed)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                <ExternalLink size={12} />
                &quot;{trimmed}&quot; auf BGG suchen
              </a>
            </div>
          </div>
        )}

        {/* No results (search worked but empty) */}
        {!searching && !searchError && trimmed.length >= 2 && results.length === 0 && !isBggLink && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <List size={32} className="text-muted-foreground/30 mb-3" />
            <p className="font-medium text-sm mb-1">Kein Spiel gefunden</p>
            <p className="text-muted-foreground text-xs mb-3">Prüf die Schreibweise oder suche auf Englisch</p>
            <a
              href={`https://boardgamegeek.com/geeksearch.php?action=search&objecttype=boardgame&q=${encodeURIComponent(trimmed)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 underline underline-offset-2"
            >
              <ExternalLink size={12} />
              Auf BGG suchen
            </a>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <ul className="flex flex-col gap-1">
            {results.map((game) => (
              <li key={game.bgg_id}>
                <button
                  onClick={() => onSelect(game)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted active:bg-muted/80 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {game.thumbnail_url ? (
                      <Image src={game.thumbnail_url} alt={game.name} width={40} height={40} className="object-cover w-full h-full" />
                    ) : (
                      <List size={16} className="text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm leading-tight truncate">{game.name}</p>
                    {game.year_published && <p className="text-muted-foreground text-xs mt-0.5">{game.year_published}</p>}
                  </div>
                  <span className="text-muted-foreground text-xs flex-shrink-0">#{game.bgg_id}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── CSV parser ────────────────────────────────────────────────────────────────

interface CsvGame { bgg_id: number; name: string; year_published: number | null; status: string }

function parseBggCsv(text: string): CsvGame[] {
  const lines = text.split(/\r?\n/);
  const headerIdx = lines.findIndex((l) => l.toLowerCase().includes("objectid"));
  if (headerIdx === -1) return [];

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { result.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseLine(lines[headerIdx]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ""));
  const col = (name: string) => headers.indexOf(name);

  const idIdx = col("objectid");
  const nameIdx = col("objectname");
  const yearIdx = col("yearpublished");
  const ownIdx = col("own");
  const tradeIdx = col("fortrade");
  const wtpIdx = col("wanttoplay");
  const wlIdx = col("wishlist");
  const prevIdx = col("prevowned");

  if (idIdx === -1) return [];

  const results: CsvGame[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseLine(line);
    const bggId = Number(cols[idIdx]);
    if (!bggId) continue;

    const own = cols[ownIdx] === "1";
    const trade = cols[tradeIdx] === "1";
    const wtp = cols[wtpIdx] === "1";
    const wl = cols[wlIdx] === "1";
    const prev = cols[prevIdx] === "1";

    if (!own && !trade && !wtp && !wl && !prev) continue;

    // previously_owned (prev && !own) → skip, not imported anymore
    if (prev && !own) continue;
    let status = "owned";
    // for_trade → mapped to owned (we use for_sale instead, set manually)
    if (wtp && !own) status = "want_to_play";
    else if (wl && !own) status = "wishlist";

    const year = yearIdx >= 0 ? Number(cols[yearIdx]) || null : null;
    results.push({ bgg_id: bggId, name: cols[nameIdx] || `BGG #${bggId}`, year_published: year, status });
  }
  return results;
}

// ── Import tab ────────────────────────────────────────────────────────────────

type ImportMode = "csv" | "csv-uploading" | "success";

function ImportTab({ onClose }: { bggUsername?: string | null; onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<ImportMode>("csv");
  const [parsedGames, setParsedGames] = useState<CsvGame[] | null>(null);
  const [importCount, setImportCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submitCsvGames(games: CsvGame[]) {
    setMode("csv-uploading");
    try {
      const res = await fetch("/api/bgg/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ games }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import fehlgeschlagen.");
        setMode("csv");
        return;
      }
      setImportCount(data.imported ?? 0);
      setSkippedCount(data.skipped ?? 0);
      setMode("success");
      router.refresh();
      setTimeout(() => onClose(), 2000);
    } catch {
      setError("Netzwerkfehler.");
      setMode("csv");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const games = parseBggCsv(text);
      if (games.length === 0) {
        setError("Keine Spiele gefunden. Bitte lade die Original-BGG-Export-CSV hoch.");
        setParsedGames(null);
      } else {
        setParsedGames(games);
        setError(null);
      }
    };
    reader.readAsText(file);
  }

  if (mode === "success") {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-10 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <Check size={32} className="text-green-600" />
        </div>
        <p className="font-semibold text-foreground text-lg mb-1">Import abgeschlossen!</p>
        <p className="text-muted-foreground text-sm">
          {importCount} {importCount === 1 ? "Spiel" : "Spiele"} importiert
          {skippedCount > 0 && `, ${skippedCount} bereits vorhanden`}
        </p>
        <p className="text-xs text-muted-foreground mt-3">Schließt automatisch…</p>
      </div>
    );
  }

  if (mode === "csv-uploading") {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-6 py-10 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
          <svg className="animate-spin h-7 w-7 text-amber-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-foreground text-base">
            Importiere {parsedGames?.length ?? "..."} Spiele…
          </p>
          <p className="text-muted-foreground text-xs mt-1">Einen Moment bitte…</p>
        </div>
      </div>
    );
  }

  // CSV upload screen
  return (
    <div className="flex flex-col flex-1 overflow-y-auto px-4 py-4 gap-4">
      <div className="bg-slate-50 border border-border rounded-2xl p-4 flex flex-col gap-2.5">
        <p className="text-xs font-semibold text-foreground">So geht&apos;s:</p>
        {([
          ["boardgamegeek.com öffnen und einloggen", "https://boardgamegeek.com"],
          ['Oben rechts auf deinen Namen → "Collection" klicken', null],
          ['Ganz nach unten scrollen → "Export" klicken', null],
          ["CSV-Datei herunterladen und hier hochladen", null],
        ] as [string, string | null][]).map(([text, href], i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-px">{i + 1}</span>
            <span className="text-xs text-muted-foreground leading-relaxed">
              {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-amber-600 underline underline-offset-1">{text}</a> : text}
            </span>
          </div>
        ))}
      </div>

      <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" aria-label="BGG CSV Datei auswählen" />
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 border-dashed border-amber-300 hover:border-amber-400 hover:bg-amber-50 active:scale-[0.99] transition-all text-left"
      >
        <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Download size={18} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          {parsedGames
            ? <><p className="text-sm font-semibold text-green-700">{parsedGames.length} Spiele erkannt</p><p className="text-xs text-muted-foreground">Andere Datei wählen</p></>
            : <><p className="text-sm font-semibold text-foreground">CSV-Datei hochladen</p><p className="text-xs text-muted-foreground">BGG-Export-CSV auswählen</p></>
          }
        </div>
        {parsedGames && <Check size={18} className="text-green-500 flex-shrink-0" />}
      </button>

      {error && (
        <div className="text-sm text-destructive bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">{error}</div>
      )}

      <div className="mt-auto pb-2">
        <button
          onClick={() => parsedGames && submitCsvGames(parsedGames)}
          disabled={!parsedGames}
          className="w-full rounded-xl font-semibold text-base bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
          style={{ height: "52px" }}
        >
          {parsedGames
            ? <><Download size={18} /> {parsedGames.length} Spiele importieren</>
            : <><Download size={18} /> Sammlung importieren</>}
        </button>
      </div>
    </div>
  );
}

// ── Confirm step ──────────────────────────────────────────────────────────────

function ConfirmStep({ selected, status, setStatus, onAdd, adding, addError, addSuccess }: {
  selected: LookupResult; status: GameStatus; setStatus: (s: GameStatus) => void;
  onAdd: () => void; adding: boolean; addError: string | null; addSuccess: boolean;
}) {
  return (
    <div className="flex flex-col flex-1 px-4 py-4 gap-4 overflow-y-auto">
      {/* Game preview */}
      <div className="flex items-center gap-3 bg-muted/40 rounded-2xl p-3">
        <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
          {selected.thumbnail_url ? (
            <Image src={selected.thumbnail_url} alt={selected.name} width={64} height={64} className="object-cover w-full h-full" />
          ) : (
            <List size={24} className="text-muted-foreground/30" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight">{selected.name}</p>
          <div className="flex flex-wrap gap-x-3 mt-1">
            {selected.year_published && <span className="text-xs text-muted-foreground">{selected.year_published}</span>}
            {(selected.min_players || selected.max_players) && (
              <span className="text-xs text-muted-foreground">
                {selected.min_players}{selected.max_players !== selected.min_players ? `–${selected.max_players}` : ""} Spieler
              </span>
            )}
            {(selected.min_playtime || selected.max_playtime) && (
              <span className="text-xs text-muted-foreground">
                {selected.min_playtime}{selected.max_playtime !== selected.min_playtime ? `–${selected.max_playtime}` : ""} Min.
              </span>
            )}
          </div>
          {selected.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{selected.description}</p>
          )}
        </div>
      </div>

      {/* Status picker */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</p>
        <div className="grid grid-cols-2 gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              disabled={adding || addSuccess}
              className={cn(
                "flex items-center gap-2.5 px-3 py-3 rounded-xl border text-left transition-all duration-150",
                status === opt.value
                  ? "border-amber-400 bg-amber-50 text-amber-900 shadow-sm"
                  : "border-border bg-card hover:bg-muted/50"
              )}
            >
              <span className="text-sm font-medium">{opt.label}</span>
              {status === opt.value && <Check size={14} className="text-amber-600 ml-auto" />}
            </button>
          ))}
        </div>
      </div>

      {addError && (
        <div className="text-sm text-destructive bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">{addError}</div>
      )}

      <div className="mt-auto pb-2">
        <button
          onClick={onAdd}
          disabled={adding || addSuccess}
          className={cn(
            "w-full rounded-xl font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2",
            addSuccess ? "bg-green-500 text-white" : "bg-amber-500 hover:bg-amber-600 text-white shadow-sm disabled:opacity-60"
          )}
          style={{ height: "52px" }}
        >
          {addSuccess ? <><Check size={20} /> Hinzugefügt!</> :
           adding ? <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Wird hinzugefügt…</> :
           <>+ Zur Bibliothek hinzufügen</>}
        </button>
      </div>
    </div>
  );
}
