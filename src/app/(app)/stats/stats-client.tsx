"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Eye, EyeOff, Trophy, Users, TrendingUp, ShoppingBag,
  CalendarDays, Dices, Gamepad2, ChevronRight, BarChart2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types (exported for page.tsx) ────────────────────────────────────────────

export interface PlayByMonth { label: string; month: string; count: number }
export interface SpendingByMonth { label: string; month: string; amount: number }

export interface RankingEntry {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_me: boolean;
  plays: number;
  wins: number;
  total_with_players: number;
  purchases: number;
}

export interface RankingSet {
  by_plays: RankingEntry[];
  by_winrate: RankingEntry[];
  by_purchases: RankingEntry[];
}

interface StatsClientProps {
  totalGames: number;
  totalPlays: number;
  playsByMonth: PlayByMonth[];
  totalWins: number;
  totalWithPlayers: number;
  favGame: { name: string; thumbnail_url: string | null; count: number } | null;
  collectionValue: number;
  hasFinancialData: boolean;
  spendingByMonth: SpendingByMonth[];
  hasRankings: boolean;
  rankingsMonth: RankingSet;
  rankingsYear: RankingSet;
  rankingsAllTime: RankingSet;
}

type Period = "monat" | "jahr" | "gesamt";

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase px-4 mb-2 mt-5">
      {children}
    </p>
  );
}

function StatCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card rounded-2xl border border-border shadow-card p-4", className)}>
      {children}
    </div>
  );
}

// Simple CSS bar chart — no library
function BarChart({ data, unit = "" }: { data: { label: string; value: number }[]; unit?: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height: 72 }}>
      {data.map((d, i) => {
        const pct = Math.max((d.value / max) * 100, d.value > 0 ? 8 : 0);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            {d.value > 0 && (
              <span className="text-[9px] text-muted-foreground font-semibold leading-none">
                {unit}{d.value}
              </span>
            )}
            <div className="w-full flex-1 flex items-end">
              <div
                className="w-full rounded-t-[3px] bg-amber-500 transition-all duration-500 ease-out"
                style={{ height: `${pct}%` }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground leading-none">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// Avatar with fallback
function Avatar({ url, name, size = 32 }: { url: string | null; name: string; size?: number }) {
  const initial = (name[0] ?? "?").toUpperCase();
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover border border-border flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0 border border-border"
      style={{ width: size, height: size }}
    >
      <span className="text-white font-bold" style={{ fontSize: size * 0.4 }}>{initial}</span>
    </div>
  );
}

// Single ranking row
function RankRow({
  rank,
  entry,
  value,
  valueLabel,
}: {
  rank: number;
  entry: RankingEntry;
  value: string;
  valueLabel?: string;
}) {
  const isFirst = rank === 1;
  const name = entry.display_name ?? entry.username;

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-2.5",
      isFirst && "bg-amber-50/60"
    )}>
      {/* Rank */}
      <div className="w-6 flex-shrink-0 flex items-center justify-center">
        {isFirst ? (
          <Trophy size={16} className="text-amber-500" />
        ) : (
          <span className="text-sm font-bold text-muted-foreground/60">{rank}</span>
        )}
      </div>

      {/* Avatar */}
      <Avatar url={entry.avatar_url} name={name} size={30} />

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm truncate leading-tight",
          isFirst ? "font-bold text-foreground" : "font-medium text-foreground/80"
        )}>
          {name}
          {entry.is_me && (
            <span className="ml-1.5 text-[10px] font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
              Du
            </span>
          )}
        </p>
        {valueLabel && (
          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{valueLabel}</p>
        )}
      </div>

      {/* Value */}
      <span className={cn(
        "text-sm font-bold tabular-nums flex-shrink-0",
        isFirst ? "text-amber-600" : "text-foreground/70"
      )}>
        {value}
      </span>
    </div>
  );
}

// Ranking card with title + up to 5 rows
function RankingCard({
  title,
  icon: Icon,
  entries,
  getValue,
  getValueLabel,
  emptyText,
}: {
  title: string;
  icon: React.ElementType;
  entries: RankingEntry[];
  getValue: (e: RankingEntry) => string;
  getValueLabel?: (e: RankingEntry) => string | undefined;
  emptyText: string;
}) {
  const visible = entries.slice(0, 5);
  const allZero = entries.every(e => {
    const val = getValue(e);
    return val === "0" || val === "–" || val === "0 Partien" || val === "0 Spiele";
  });

  return (
    <StatCard className="p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50">
        <Icon size={15} className="text-amber-500 flex-shrink-0" />
        <span className="text-sm font-bold text-foreground">{title}</span>
      </div>
      {allZero || visible.length === 0 ? (
        <p className="text-sm text-muted-foreground px-4 py-4">{emptyText}</p>
      ) : (
        <div className="divide-y divide-border/40">
          {visible.map((entry, i) => (
            <RankRow
              key={entry.id}
              rank={i + 1}
              entry={entry}
              value={getValue(entry)}
              valueLabel={getValueLabel?.(entry)}
            />
          ))}
        </div>
      )}
    </StatCard>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function StatsClient({
  totalGames,
  totalPlays,
  playsByMonth,
  totalWins,
  totalWithPlayers,
  favGame,
  collectionValue,
  hasFinancialData,
  spendingByMonth,
  hasRankings,
  rankingsMonth,
  rankingsYear,
  rankingsAllTime,
}: StatsClientProps) {
  const [period, setPeriod] = useState<Period>("monat");
  const [showFinancial, setShowFinancial] = useState(false);

  const winRate = totalWithPlayers > 0
    ? Math.round((totalWins / totalWithPlayers) * 100)
    : null;

  const activeRankings: RankingSet =
    period === "monat" ? rankingsMonth :
    period === "jahr" ? rankingsYear :
    rankingsAllTime;

  const periodLabel =
    period === "monat" ? "diesem Monat" :
    period === "jahr" ? "diesem Jahr" : "gesamt";

  return (
    <div className="flex flex-col min-h-[calc(100dvh-72px)] bg-background pb-6">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-6 pb-1">
        <BarChart2 size={22} className="text-amber-500" />
        <h1 className="font-display text-2xl font-bold text-foreground">Statistiken</h1>
      </div>

      {/* ── Persönliche Stats ─────────────────────────────────────────── */}
      <SectionLabel>Meine Stats</SectionLabel>

      <div className="px-4 flex flex-col gap-3">
        {/* Schnellübersicht */}
        <StatCard className="p-0 overflow-hidden">
          <div className="flex items-stretch divide-x divide-border/50">
            <div className="flex flex-col items-center gap-0.5 flex-1 px-3 py-4">
              <span className="font-display text-2xl font-bold text-foreground leading-tight">{totalPlays}</span>
              <span className="text-[10px] text-muted-foreground font-medium">Partien gesamt</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 flex-1 px-3 py-4">
              <span className="font-display text-2xl font-bold text-foreground leading-tight">{totalGames}</span>
              <span className="text-[10px] text-muted-foreground font-medium">Spiele besessen</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 flex-1 px-3 py-4">
              {winRate !== null ? (
                <span className="font-display text-2xl font-bold text-amber-500 leading-tight">{winRate}%</span>
              ) : (
                <span className="font-display text-2xl font-bold text-muted-foreground leading-tight">–</span>
              )}
              <span className="text-[10px] text-muted-foreground font-medium">Siegquote</span>
            </div>
          </div>
        </StatCard>

        {/* Partien pro Monat */}
        <StatCard>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarDays size={14} className="text-amber-500" />
              <span className="text-sm font-bold text-foreground">Partien / Monat</span>
            </div>
            <span className="text-[11px] text-muted-foreground">letzte 6 Monate</span>
          </div>
          {playsByMonth.every(m => m.count === 0) ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <Dices size={28} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Noch keine Partien erfasst</p>
              <Link href="/plays" className="text-xs text-amber-600 font-semibold">Erste Partie eintragen →</Link>
            </div>
          ) : (
            <BarChart data={playsByMonth.map(m => ({ label: m.label, value: m.count }))} />
          )}
        </StatCard>

        {/* Win-Rate + Lieblingsspiel */}
        <div className="flex gap-3">
          {/* Siegquote */}
          <StatCard className="flex-1">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp size={13} className="text-amber-500" />
              <span className="text-xs font-bold text-foreground">Siegquote</span>
            </div>
            {winRate !== null ? (
              <>
                <p className="font-display text-3xl font-bold text-amber-500">{winRate}%</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {totalWins}S / {totalWithPlayers - totalWins}N
                </p>
              </>
            ) : (
              <div className="flex flex-col gap-1 mt-1">
                <p className="font-display text-2xl font-bold text-muted-foreground">–</p>
                <p className="text-[10px] text-muted-foreground leading-snug">
                  Spieler mit Gewinner-Flag erfassen
                </p>
              </div>
            )}
          </StatCard>

          {/* Lieblingsspiel */}
          <StatCard className="flex-1">
            <div className="flex items-center gap-1.5 mb-2">
              <Gamepad2 size={13} className="text-amber-500" />
              <span className="text-xs font-bold text-foreground">Lieblingsspiel</span>
            </div>
            {favGame ? (
              <>
                {favGame.thumbnail_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={favGame.thumbnail_url}
                    alt={favGame.name}
                    className="w-10 h-10 rounded-lg object-cover mb-1.5"
                  />
                )}
                <p className="text-xs font-bold text-foreground leading-snug line-clamp-2">{favGame.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{favGame.count}× gespielt</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">Noch keine Partien</p>
            )}
          </StatCard>
        </div>

        {/* Finanzen (versteckt) */}
        <StatCard className={cn(!showFinancial && "bg-muted/30")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag size={14} className={showFinancial ? "text-amber-500" : "text-muted-foreground"} />
              <span className={cn("text-sm font-bold", showFinancial ? "text-foreground" : "text-muted-foreground")}>
                Finanzen
              </span>
            </div>
            <button
              onClick={() => setShowFinancial(v => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground active:opacity-70 transition-colors touch-manipulation"
              aria-label={showFinancial ? "Finanzdaten ausblenden" : "Finanzdaten anzeigen"}
            >
              {showFinancial ? <EyeOff size={13} /> : <Eye size={13} />}
              <span>{showFinancial ? "Ausblenden" : "Anzeigen"}</span>
            </button>
          </div>

          {!showFinancial ? (
            <div className="mt-3 flex gap-4">
              <div>
                <p className="text-sm font-bold text-muted-foreground/40 tracking-widest">••••• €</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Sammlungswert</p>
              </div>
              <div>
                <p className="text-sm font-bold text-muted-foreground/40 tracking-widest">••••• €</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Ausgaben / Monat</p>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-4">
              {/* Sammlungswert */}
              <div>
                <div className="flex items-baseline gap-1.5">
                  <p className="font-display text-2xl font-bold text-foreground">
                    {collectionValue.toLocaleString("de-DE", { maximumFractionDigits: 0 })} €
                  </p>
                  <span className="text-[10px] text-muted-foreground">Sammlungswert</span>
                </div>
                {!hasFinancialData && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Kaufpreise in der{" "}
                    <Link href="/library" className="text-amber-600 font-semibold">Bibliothek</Link>
                    {" "}eintragen für genaue Werte.
                  </p>
                )}
              </div>

              {/* Ausgaben pro Monat */}
              {hasFinancialData && (
                <div>
                  <p className="text-xs font-bold text-foreground mb-2">Ausgaben / Monat</p>
                  {spendingByMonth.every(m => m.amount === 0) ? (
                    <p className="text-xs text-muted-foreground">Keine Ausgaben in den letzten 6 Monaten</p>
                  ) : (
                    <BarChart
                      data={spendingByMonth.map(m => ({ label: m.label, value: Math.round(m.amount) }))}
                      unit="€"
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </StatCard>
      </div>

      {/* ── Freunde-Rankings ──────────────────────────────────────────── */}
      <SectionLabel>Freunde-Rankings</SectionLabel>

      <div className="px-4 flex flex-col gap-3">
        {!hasRankings ? (
          <StatCard className="text-center py-6">
            <Users size={32} className="text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground mb-1">Noch keine Freunde</p>
            <p className="text-xs text-muted-foreground mb-3">
              Füge Freunde hinzu um Rankings zu sehen — wer spielt am meisten?
            </p>
            <Link
              href="/players"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-600 hover:text-amber-700 active:opacity-70"
            >
              Spieler finden <ChevronRight size={14} />
            </Link>
          </StatCard>
        ) : (
          <>
            {/* Period toggle */}
            <div className="flex bg-muted rounded-xl p-1 gap-1">
              {(["monat", "jahr", "gesamt"] as Period[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 touch-manipulation",
                    period === p
                      ? "bg-white text-amber-600 shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p === "monat" ? "Monat" : p === "jahr" ? "Jahr" : "Gesamt"}
                </button>
              ))}
            </div>

            {/* Meistgespielt */}
            <RankingCard
              title="Meistgespielt"
              icon={Dices}
              entries={activeRankings.by_plays}
              getValue={e => e.plays === 0 ? "0" : `${e.plays}`}
              getValueLabel={e => e.plays === 1 ? "Partie" : "Partien"}
              emptyText={`Noch keine Partien ${periodLabel}`}
            />

            {/* W/L Siegquote */}
            <RankingCard
              title="Siegquote (W/L)"
              icon={TrendingUp}
              entries={activeRankings.by_winrate}
              getValue={e => {
                if (e.total_with_players === 0) return "–";
                return `${Math.round((e.wins / e.total_with_players) * 100)}%`;
              }}
              getValueLabel={e => {
                if (e.total_with_players === 0) return undefined;
                return `${e.wins}S / ${e.total_with_players - e.wins}N`;
              }}
              emptyText={`Keine Gewinner-Daten ${periodLabel}. Erfasse Spieler mit Gewinner-Flag.`}
            />

            {/* Meistgekauft */}
            <RankingCard
              title="Meistgekauft"
              icon={ShoppingBag}
              entries={activeRankings.by_purchases}
              getValue={e => e.purchases === 0 ? "0" : `${e.purchases}`}
              getValueLabel={e => e.purchases === 1 ? "Spiel" : "Spiele"}
              emptyText={`Keine Käufe ${periodLabel} erfasst`}
            />
          </>
        )}
      </div>
    </div>
  );
}
