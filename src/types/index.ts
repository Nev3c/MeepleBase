// ============================================================
// MeepleBase – Global TypeScript Types
// ============================================================

export type GameStatus = "owned" | "wishlist" | "previously_owned" | "for_trade" | "want_to_play";

export type NoteType = "general" | "house_rules" | "rules_clarification" | "strategy" | "links" | "components";

export type MemberRole = "admin" | "member";

export type RsvpStatus = "going" | "maybe" | "declined";

// ============================================================
// Database row types (mirrors schema.sql)
// ============================================================

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  bgg_username: string | null;
  location: string | null;
  location_lat: number | null;
  location_lng: number | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface Game {
  id: string;
  bgg_id: number;
  name: string;
  year_published: number | null;
  min_players: number | null;
  max_players: number | null;
  min_playtime: number | null;
  max_playtime: number | null;
  complexity: number | null;
  rating_avg: number | null;
  rating_bayes: number | null;
  rank_overall: number | null;
  thumbnail_url: string | null;
  image_url: string | null;
  description: string | null;
  categories: string[] | null;
  mechanics: string[] | null;
  designers: string[] | null;
  publishers: string[] | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface UserGame {
  id: string;
  user_id: string;
  game_id: string;
  status: GameStatus;
  personal_rating: number | null;
  acquired_date: string | null;
  price_paid: number | null;
  notes: string | null;
  bgg_synced_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  game?: Game;
}

export interface Play {
  id: string;
  user_id: string;
  game_id: string;
  played_at: string;
  duration_minutes: number | null;
  location: string | null;
  notes: string | null;
  incomplete: boolean;
  cooperative: boolean;
  bgg_play_id: number | null;
  created_at: string;
  updated_at: string;
  // Joined
  game?: Game;
  players?: PlayPlayer[];
}

export interface PlayPlayer {
  id: string;
  play_id: string;
  user_id: string | null;
  display_name: string;
  score: number | null;
  winner: boolean;
  color: string | null;
  seat_order: number | null;
  new_player: boolean;
}

export interface GameNote {
  id: string;
  user_id: string;
  game_id: string;
  title: string;
  content: string | null;
  note_type: NoteType;
  is_pinned: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// BGG API types
// ============================================================

export interface BggSearchResult {
  bgg_id: number;
  name: string;
  year_published: number | null;
  thumbnail_url?: string;
}

export interface BggGameDetail {
  bgg_id: number;
  name: string;
  year_published: number | null;
  min_players: number | null;
  max_players: number | null;
  min_playtime: number | null;
  max_playtime: number | null;
  complexity: number | null;
  rating_avg: number | null;
  rating_bayes: number | null;
  rank_overall: number | null;
  thumbnail_url: string | null;
  image_url: string | null;
  description: string | null;
  categories: string[];
  mechanics: string[];
  designers: string[];
  publishers: string[];
}

// ============================================================
// UI types
// ============================================================

export type LibraryView = "grid" | "list";

export type LibraryFilter = {
  status?: GameStatus;
  minPlayers?: number;
  maxPlayers?: number;
  search?: string;
};

export type LibrarySortKey =
  | "name_asc" | "name_desc"
  | "added_desc" | "added_asc"
  | "players_asc" | "players_desc"
  | "rating";
