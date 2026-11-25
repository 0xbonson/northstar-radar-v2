import { buildFarmSteps } from './farmplan.ts';
import { fitAndValidatePeerModel, fitLaunchOdds } from './model.ts';
import { ageDays, classifyProtocols, round4 } from './snapshot.ts';
import type { BoardRow, PeerRow, RadarData, Snapshot } from './types.ts';

export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const { preToken, liveAll, livePeersWithMcap, nonExcludedLive, exclusions } = classifyProtocols(snapshot);
  const oddsTable = fitLaunchOdds(preToken, nonExcludedLive, snapshot.as_of);
  const { model, predict } = fitAndValidatePeerModel(livePeersWithMcap, oddsTable.baseRate, snapshot.as_of);

  const wlSet = new Set(snapshot.watchlist);
  const scored = preToken.map((p) => {
    const age = ageDays(snapshot.as_of, p.listed_at);
    const { implied, catOffset } = predict(p);
    const launchOdds = oddsTable.oddsFor(p, snapshot.as_of);
    const expectedValue = Math.max(1, Math.round(implied * launchOdds));
    return { p, age, implied, catOffset, launchOdds, expectedValue };
  });

  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));

  const board: BoardRow[] = scored.map((s, idx) => ({
    rank: idx + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    age_days: s.age,
    in_watchlist: wlSet.has(s.p.slug),
    token_status: 'pre-token',
    implied_value_usd: s.implied,
    launch_odds: s.launchOdds,
    expected_value_usd: s.expectedValue,
    category_offset: s.catOffset,
    farm_steps: buildFarmSteps(s.p, s.age),
  }));

  const peers: PeerRow[] = livePeersWithMcap
    .map((p) => {
      const mcap = p.mcap_usd ?? 0;
      const { implied } = predict(p);
      return {
        slug: p.slug,
        name: p.name,
        symbol: p.symbol,
        category: p.category,
        chains: p.chains,
        tvl_usd: p.tvl_usd,
        mcap_usd: mcap,
        change_7d: p.change_7d,
        age_days: ageDays(snapshot.as_of, p.listed_at),
        model_value_usd: implied,
        ratio: round4(mcap / Math.max(1, implied)),
      };
    })
    .sort((a, b) => b.mcap_usd - a.mcap_usd || (a.slug < b.slug ? -1 : 1));

  const sortedExcl = exclusions.slice().sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1));
  const earlySize = board.filter((r) => !r.in_watchlist).length;

  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    total_protocols: snapshot.protocols.length,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: earlySize,
    peer_mcap_size: peers.length,
    live_token_total: liveAll.length,
    excluded_size: sortedExcl.length,
    model,
    rows: board,
    peers,
    exclusions: sortedExcl,
  };

  return { board, radar };
}

export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `row count ${board.length} outside 100..4000`;
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `misses ${missing.length} watchlist slugs: ${missing.slice(0, 5).join(', ')}`;
  for (let i = 0; i < board.length; i++) {
    const r = board[i]!;
    if (r.rank !== i + 1) return `rank at index ${i} is ${r.rank}`;
    if (i > 0 && r.implied_value_usd > board[i - 1]!.implied_value_usd) return `rank ${r.rank} exceeds prior implied value`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} invalid implied_value_usd`;
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) return `${r.slug} invalid farm_steps length`;
    for (const st of r.farm_steps) {
      if (st.trim().length < 20 || st.trim().length > 600) return `${r.slug} farm step length ${st.length}`;
    }
  }
  if (board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) return 'all rows have identical implied value';
  return null;
}

export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
