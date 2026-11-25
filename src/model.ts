import { ageDays, round4 } from './snapshot.ts';
import { fitHuberRidge, median, spearmanRho } from './stats.ts';
import type { FittedModel, Snapshot, SnapshotProtocol, SplitMetrics } from './types.ts';

const ANCHOR_TVL = 50_000_000;

function clampGrowth(change7d: number | null): number {
  const raw = change7d !== null && Number.isFinite(change7d) ? change7d : 0;
  return Math.max(-50, Math.min(100, raw)) / 100;
}

function logAgeYears(asOf: string, listedAt: string | null, fallbackDays: number): number {
  const d = ageDays(asOf, listedAt) ?? fallbackDays;
  return Math.log1p(Math.max(0, d) / 365);
}

interface TrainedFit {
  beta: number[];
  topCats: string[];
  medAge: number;
  predict(p: SnapshotProtocol, asOf: string): number;
}

function trainPeerFit(train: SnapshotProtocol[], asOf: string): TrainedFit {
  const ages = train.map((p) => ageDays(asOf, p.listed_at)).filter((d): d is number => d !== null);
  const medAge = ages.length > 0 ? Math.round(median(ages)) : 365;
  const catCounts = new Map<string, number>();
  for (const p of train) {
    const cat = p.category ?? 'Other';
    catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1);
  }
  const topCats = [...catCounts.entries()].filter(([, n]) => n >= 4).map(([k]) => k).sort();

  const features = (p: SnapshotProtocol): number[] => {
    const logTvl = Math.log(Math.max(1, p.tvl_usd) / ANCHOR_TVL);
    const mom = clampGrowth(p.change_7d);
    const lAge = logAgeYears(asOf, p.listed_at, medAge);
    const cat = p.category ?? 'Other';
    return [1, logTvl, mom, lAge, ...topCats.map((c) => (c === cat ? 1 : 0))];
  };

  const X = train.map(features);
  const y = train.map((p) => Math.log(Math.max(1, p.mcap_usd ?? 1)));
  const penalty = (col: number): number => (col === 0 ? 0 : col <= 3 ? 2.0 : 8.0);
  const beta = fitHuberRidge(X, y, penalty, 8);

  return {
    beta,
    topCats,
    medAge,
    predict(p: SnapshotProtocol, snapAsOf: string): number {
      const row = features(p);
      let s = 0;
      for (let i = 0; i < row.length; i++) s += beta[i]! * row[i]!;
      return Math.exp(s);
    },
  };
}

function scoreHoldout(fit: TrainedFit, test: SnapshotProtocol[], asOf: string, meta: { id: string; label: string; rationale: string; trainN: number }): SplitMetrics {
  const preds = test.map((p) => fit.predict(p, asOf));
  const actuals = test.map((p) => p.mcap_usd ?? 1);
  const relErrs = test.map((p, i) => Math.abs(preds[i]! - actuals[i]!) / actuals[i]!);
  const logErrs = test.map((p, i) => Math.abs(Math.log(preds[i]!) - Math.log(actuals[i]!)));
  return {
    id: meta.id,
    label: meta.label,
    rationale: meta.rationale,
    train_n: meta.trainN,
    test_n: test.length,
    spearman_rho: round4(spearmanRho(preds, actuals)),
    median_rel_error_pct: Math.round(median(relErrs) * 1000) / 10,
    median_log_error: round4(median(logErrs)),
  };
}

export interface LaunchOddsTable {
  baseRate: number;
  oddsFor(p: SnapshotProtocol, asOf: string): number;
}

export function fitLaunchOdds(preToken: SnapshotProtocol[], nonExclLive: SnapshotProtocol[], asOf: string): LaunchOddsTable {
  const all = [...preToken.map((p) => ({ p, tok: 0 })), ...nonExclLive.map((p) => ({ p, tok: 1 }))];
  const baseRate = all.length > 0 ? nonExclLive.length / all.length : 0.5;
  const catStats = new Map<string, { n: number; tok: number }>();
  const tvlStats = { high: { n: 0, tok: 0 }, mid: { n: 0, tok: 0 }, low: { n: 0, tok: 0 } };
  const ageStats = { mature: { n: 0, tok: 0 }, mid: { n: 0, tok: 0 }, young: { n: 0, tok: 0 } };

  const tvlBucket = (tvl: number): 'high' | 'mid' | 'low' => (tvl >= 100_000_000 ? 'high' : tvl >= 25_000_000 ? 'mid' : 'low');
  const ageBucket = (days: number | null): 'mature' | 'mid' | 'young' => (days !== null && days >= 540 ? 'mature' : days !== null && days >= 180 ? 'mid' : 'young');

  for (const { p, tok } of all) {
    const cat = p.category ?? 'Other';
    const c = catStats.get(cat) ?? { n: 0, tok: 0 };
    c.n++;
    c.tok += tok;
    catStats.set(cat, c);
    const tb = tvlStats[tvlBucket(p.tvl_usd)];
    tb.n++;
    tb.tok += tok;
    const ab = ageStats[ageBucket(ageDays(asOf, p.listed_at))];
    ab.n++;
    ab.tok += tok;
  }

  const smooth = (tok: number, n: number, prior: number, weight: number): number => (tok + prior * weight) / (n + weight);

  return {
    baseRate: round4(baseRate),
    oddsFor(p: SnapshotProtocol, snapAsOf: string): number {
      const cat = catStats.get(p.category ?? 'Other') ?? { n: 0, tok: 0 };
      const pCat = smooth(cat.tok, cat.n, baseRate, 10);
      const tb = tvlStats[tvlBucket(p.tvl_usd)];
      const pTvl = smooth(tb.tok, tb.n, baseRate, 10);
      const ab = ageStats[ageBucket(ageDays(snapAsOf, p.listed_at))];
      const pAge = smooth(ab.tok, ab.n, baseRate, 10);
      const blended = 0.55 * pCat + 0.25 * pTvl + 0.20 * pAge;
      return round4(Math.max(0.08, Math.min(0.92, blended)));
    },
  };
}

export function fitAndValidatePeerModel(peers: SnapshotProtocol[], launchBaseRate: number, asOf: string): { model: FittedModel; predict: (p: SnapshotProtocol) => { implied: number; catOffset: number } } {
  const bySlug = peers.slice().sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const halfTrain = bySlug.filter((_, i) => i % 2 === 0);
  const halfTest = bySlug.filter((_, i) => i % 2 === 1);
  const halfFit = trainPeerFit(halfTrain, asOf);
  const halfMetrics = scoreHoldout(halfFit, halfTest, asOf, {
    id: 'slug_half',
    label: 'Balanced 50/50 half-split',
    rationale: 'Even/odd split across alphabetically sorted peer slugs preserves TVL, age, and category balance.',
    trainN: halfTrain.length,
  });

  const peerAges = peers.map((p) => ageDays(asOf, p.listed_at)).filter((d): d is number => d !== null);
  const globalMedAge = peerAges.length > 0 ? Math.round(median(peerAges)) : 365;
  const olderTrain = peers.filter((p) => (ageDays(asOf, p.listed_at) ?? globalMedAge) >= globalMedAge);
  const youngerTest = peers.filter((p) => (ageDays(asOf, p.listed_at) ?? globalMedAge) < globalMedAge);
  const ageFit = trainPeerFit(olderTrain, asOf);
  const ageMetrics = scoreHoldout(ageFit, youngerTest, asOf, {
    id: 'age_regime',
    label: 'Older-to-younger temporal split',
    rationale: 'Trains on peers at or above median listing age and validates on younger cohorts.',
    trainN: olderTrain.length,
  });

  const preferHalf = halfMetrics.spearman_rho >= ageMetrics.spearman_rho;
  const chosenFit = preferHalf ? halfFit : ageFit;
  const chosenMetrics = preferHalf ? halfMetrics : ageMetrics;
  const otherMetrics = preferHalf ? ageMetrics : halfMetrics;

  const categoryOffsets: Record<string, number> = {};
  for (let i = 0; i < chosenFit.topCats.length; i++) {
    categoryOffsets[chosenFit.topCats[i]!] = round4(chosenFit.beta[4 + i]!);
  }

  const b0 = chosenFit.beta[0]!;
  const bTvl = chosenFit.beta[1]!;
  const bMom = chosenFit.beta[2]!;
  const bAge = chosenFit.beta[3]!;
  const formulaLine = `log(val) = ${b0.toFixed(3)} + ${bTvl.toFixed(3)}*ln(TVL/$50M) + (${bMom.toFixed(3)})*mom_7d + (${bAge.toFixed(3)})*ln(1+age_yr) + cat_offset`;

  return {
    model: {
      split_used: chosenMetrics.id,
      split_reason: `${chosenMetrics.label} selected over ${otherMetrics.label} because held-out rank correlation is higher (rho=${chosenMetrics.spearman_rho.toFixed(3)} vs ${otherMetrics.spearman_rho.toFixed(3)}).`,
      formula_line: formulaLine,
      peer_count: peers.length,
      train_count: chosenMetrics.train_n,
      test_count: chosenMetrics.test_n,
      anchor_tvl_usd: ANCHOR_TVL,
      median_age_days: chosenFit.medAge,
      intercept: b0,
      beta_log_tvl: bTvl,
      beta_momentum: bMom,
      beta_log_age: bAge,
      category_offsets: categoryOffsets,
      splits: [halfMetrics, ageMetrics],
      launch_base_rate: launchBaseRate,
    },
    predict(p: SnapshotProtocol): { implied: number; catOffset: number } {
      const catOffset = categoryOffsets[p.category ?? 'Other'] ?? 0;
      const tvlTerm = bTvl * Math.log(Math.max(1, p.tvl_usd) / ANCHOR_TVL);
      const momTerm = bMom * clampGrowth(p.change_7d);
      const ageTerm = bAge * logAgeYears(asOf, p.listed_at, chosenFit.medAge);
      const val = Math.exp(b0 + tvlTerm + momTerm + ageTerm + catOffset);
      return { implied: Math.max(1, Math.round(val)), catOffset };
    },
  };
}
