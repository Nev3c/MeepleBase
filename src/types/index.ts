// ============================================================
// MeepleBase – Global TypeScript Types
// ============================================================

export type GameStatus = "owned" | "wishlist" | "previously_owned" | "for_trade" | "want_to_play" | "for_sale";

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
  library_visibility: LibraryVisibility;
  notify_messages: boolean | null;
  notify_friend_accepted: boolean | null;
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
  description_de: string | null;
  categories: string[] | null;
  mechanics: string[] | null;
  designers: string[] | null;
  publishers: string[] | null;
  best_players: number[] | null;
  alternate_names: string[] | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface CustomFields {
  name?: string;
  description?: string;
  min_players?: number | null;
  max_players?: number | null;
  min_playtime?: number | null;
  max_playtime?: number | null;
  categories?: string[];
  best_players_override?: number[]; // user's own optimal player count preference
  hero_image_url?: string;          // custom hero image (from own uploads)
  customized?: boolean;             // painted minis / upgraded components
  youtube_url?: string;             // tutorial video link
  spotify_url?: string;             // background playlist link
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
  custom_fields: CustomFields | null;
  sale_price?: number | null;
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
  image_url: string | null;
  bgg_play_id: number | null;
  created_at: string;
  updated_at: string;
  /** User's custom name override (from user_games.custom_fields.name) */
  custom_game_name?: string | null;
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
  playerCount?: number; // quick filter: show games playable with exactly N players
  maxPlaytime?: number; // quick filter: show games whose min_playtime <= this value
  categories?: string[]; // English BGG strings matching games.categories
  mechanics?: string[];  // English BGG strings matching games.mechanics
  customized?: boolean;  // only show individualized (painted/upgraded) games
};

export type LibrarySortKey =
  | "name_asc" | "name_desc"
  | "added_desc" | "added_asc"
  | "players_asc" | "players_desc"
  | "rating" | "rating_asc"
  | "plays_desc" | "plays_asc";

// ============================================================
// Social types
// ============================================================

export type FriendshipStatus = "pending" | "accepted" | "declined";

export type LibraryVisibility = "private" | "friends" | "public";

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
}

export interface FriendProfile {
  friendship_id: string;
  friendship_status: FriendshipStatus;
  is_requester: boolean;
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    location: string | null;
    library_visibility: LibraryVisibility;
  };
}

export interface Message {
  id: string;
  from_id: string;
  to_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

// ============================================================
// Feedback types
// ============================================================

export type FeedbackType = "bug" | "feature" | "other";
export type FeedbackStatus = "open" | "in_progress" | "done";

export interface Feedback {
  id: string;
  user_id: string | null;
  username: string;
  type: FeedbackType;
  title: string;
  message: string | null;
  status: FeedbackStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ForSaleGame {
  id: string;
  user_id: string;
  sale_price: number | null;
  owner_username: string;
  owner_display_name: string | null;
  /** User's custom name override (from user_games.custom_fields.name) */
  custom_game_name?: string | null;
  game: { id: string; name: string; thumbnail_url: string | null } | null;
}

export interface ConversationSummary {
  other_user_id: string;
  other_username: string;
  other_display_name: string | null;
  other_avatar_url: string | null;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  is_last_from_me: boolean;
}

// ============================================================
// Play sessions (planned game nights + multi-game sessions)
// ============================================================

export type PlaySessionStatus = "planned" | "confirmed" | "completed" | "cancelled";
export type InviteStatus = "invited" | "accepted" | "declined";
export type GameSelectionMode = "fixed" | "vote_organizer" | "vote_free" | "lottery";

export interface SessionGame {
  id: string;
  name: string;
  thumbnail_url: string | null;
  min_playtime?: number | null;
  max_playtime?: number | null;
}

export interface SessionInvitee {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: InviteStatus;
}

export interface SessionProposal {
  id: string;
  session_id: string;
  game_id: string;
  proposed_by: string;
  created_at: string;
  game: SessionGame;
}

export interface SessionVote {
  session_id: string;
  user_id: string;
  game_id: string;
  rank: number;
}

export interface BordaResult {
  game: SessionGame;
  points: number;
  voter_count: number;
}

/** A planned (or confirmed) game session — used in /plays Geplant tab */
export interface PlannedSession {
  id: string;
  title: string | null;
  session_date: string;
  location: string | null;
  notes: string | null;
  status: PlaySessionStatus;
  created_by: string;
  is_organizer: boolean;
  my_invite_status: InviteStatus | null; // null = I am organizer
  games: SessionGame[];
  invitees: SessionInvitee[];
  // New fields for game selection modes
  game_selection_mode: GameSelectionMode;
  voting_closed: boolean;
  planned_duration_minutes: number | null;
  // Loaded separately for vote modes
  proposals?: SessionProposal[];
  my_votes?: SessionVote[];
  borda_results?: BordaResult[];
}

// ============================================================
// Playlist types (ranked "want to play" list, max 10 per user)
// ============================================================

export interface PlaylistGame {
  id: string;
  name: string;
  thumbnail_url: string | null;
  min_players: number | null;
  max_players: number | null;
  min_playtime: number | null;
  max_playtime: number | null;
}

export interface PlaylistEntry {
  id: string;
  user_id: string;
  game_id: string;
  rank: number;
  created_at: string;
  game?: PlaylistGame;
}

/** An incoming invite — used in /players Einladungen tab */
export interface SessionInviteForPlayer {
  invite_id: string;
  session_id: string;
  status: InviteStatus;
  session_date: string;
  title: string | null;
  location: string | null;
  organizer_id: string;
  organizer_username: string;
  organizer_display_name: string | null;
  organizer_avatar_url: string | null;
  games: SessionGame[];
}
