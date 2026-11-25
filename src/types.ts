/** Snapshot protocol entry: the ten fields from DefiLlama's frozen snapshot. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** Sealed snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

export type ExclusionCode =
  | 'excluded_category'
  | 'versioned_pool'
  | 'wrapped_or_staked'
  | 'exchange_product'
  | 'parent_protocol';

export interface ExcludedProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  age_days: number | null;
  reason_code: ExclusionCode;
  reason_label: string;
}

export interface SplitMetrics {
  id: string;
  label: string;
  rationale: string;
  train_n: number;
  test_n: number;
  spearman_rho: number;
  median_rel_error_pct: number;
  median_log_error: number;
}

export interface FittedModel {
  split_used: string;
  split_reason: string;
  formula_line: string;
  peer_count: number;
  train_count: number;
  test_count: number;
  anchor_tvl_usd: number;
  median_age_days: number;
  intercept: number;
  beta_log_tvl: number;
  beta_momentum: number;
  beta_log_age: number;
  category_offsets: Record<string, number>;
  splits: SplitMetrics[];
  launch_base_rate: number;
}

export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  age_days: number | null;
  in_watchlist: boolean;
  token_status: 'pre-token';
  implied_value_usd: number;
  launch_odds: number;
  expected_value_usd: number;
  category_offset: number;
  farm_steps: string[];
}

export interface PeerRow {
  slug: string;
  name: string;
  symbol: string | null;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number;
  change_7d: number | null;
  age_days: number | null;
  model_value_usd: number;
  ratio: number;
}

export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  total_protocols: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  peer_mcap_size: number;
  live_token_total: number;
  excluded_size: number;
  model: FittedModel;
  rows: BoardRow[];
  peers: PeerRow[];
  exclusions: ExcludedProtocol[];
}
