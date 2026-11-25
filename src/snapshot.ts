import type { ExcludedProtocol, ExclusionCode, Snapshot, SnapshotProtocol } from './types.ts';

const DAY_MS = 86_400_000;
const VERSIONED_RE = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_RE = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE_RE = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;
const EXCLUDED_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

export const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

export function hasTokenRecorded(p: SnapshotProtocol): boolean {
  return p.mcap_usd !== null || p.gecko_id !== null || p.symbol !== null;
}

export function exclusionFor(p: SnapshotProtocol, floorUsd: number, watchlistSet: Set<string>): { code: ExclusionCode; label: string } | null {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) {
    return { code: 'excluded_category', label: `Excluded category (${p.category})` };
  }
  if (VERSIONED_RE.test(p.name)) {
    return { code: 'versioned_pool', label: 'Versioned pool suffix (V2/2.0)' };
  }
  if (WRAPPED_RE.test(p.name)) {
    return { code: 'wrapped_or_staked', label: 'Wrapped or staked token wrapper' };
  }
  if (EXCHANGE_RE.test(p.name)) {
    return { code: 'exchange_product', label: 'Exchange-prefixed product' };
  }
  if (p.tvl_usd >= floorUsd && !watchlistSet.has(p.slug)) {
    return { code: 'parent_protocol', label: 'Parent-protocol derivative (omitted from watchlist)' };
  }
  return null;
}

export interface ClassifiedUniverse {
  preToken: SnapshotProtocol[];
  liveAll: SnapshotProtocol[];
  livePeersWithMcap: SnapshotProtocol[];
  nonExcludedLive: SnapshotProtocol[];
  exclusions: ExcludedProtocol[];
}

export function classifyProtocols(snapshot: Snapshot): ClassifiedUniverse {
  const wlSet = new Set(snapshot.watchlist);
  const preToken: SnapshotProtocol[] = [];
  const liveAll: SnapshotProtocol[] = [];
  const livePeersWithMcap: SnapshotProtocol[] = [];
  const nonExcludedLive: SnapshotProtocol[] = [];
  const exclusions: ExcludedProtocol[] = [];

  for (const p of snapshot.protocols) {
    if (hasTokenRecorded(p)) {
      liveAll.push(p);
      if (p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0) {
        livePeersWithMcap.push(p);
      }
      // Keep clean non-excluded live protocols (regardless of watchlist membership) for empirical launch-odds calibration.
      const catOk = p.category === null || !EXCLUDED_CATEGORIES.has(p.category);
      if (catOk && !VERSIONED_RE.test(p.name) && !WRAPPED_RE.test(p.name) && !EXCHANGE_RE.test(p.name)) {
        nonExcludedLive.push(p);
      }
      continue;
    }
    const ex = exclusionFor(p, snapshot.floor_usd, wlSet);
    if (ex !== null) {
      exclusions.push({
        slug: p.slug,
        name: p.name,
        category: p.category,
        chains: p.chains,
        tvl_usd: p.tvl_usd,
        change_7d: p.change_7d,
        age_days: ageDays(snapshot.as_of, p.listed_at),
        reason_code: ex.code,
        reason_label: ex.label,
      });
    } else {
      preToken.push(p);
    }
  }
  return { preToken, liveAll, livePeersWithMcap, nonExcludedLive, exclusions };
}

export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not valid JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not an object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('missing as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('missing source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('missing floor_usd');
  if (!Array.isArray(o.protocols) || !Array.isArray(o.watchlist)) throw new SnapshotError('missing protocols or watchlist');
  const protocols = o.protocols.map((v, i) => {
    const p = v as Record<string, unknown>;
    if (typeof p?.slug !== 'string' || typeof p?.name !== 'string' || typeof p?.tvl_usd !== 'number') {
      throw new SnapshotError(`protocol ${i} malformed`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return { as_of: o.as_of, source: o.source, floor_usd: o.floor_usd, protocols, watchlist: o.watchlist as string[] };
}
