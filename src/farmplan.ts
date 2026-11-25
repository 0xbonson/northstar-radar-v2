import type { SnapshotProtocol } from './types.ts';

interface FarmStep {
  action: string;
  cost: string;
  time: string;
}

function primaryChain(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its primary chain';
}

function gasProfile(chain: string): { setupUsd: number; weeklyUsd: number } {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return { setupUsd: 12, weeklyUsd: 5 };
  if (c === 'solana' || c === 'sui' || c === 'aptos') return { setupUsd: 1, weeklyUsd: 0.2 };
  if (c === 'base' || c === 'arbitrum' || c === 'optimism' || c === 'polygon' || c === 'bsc') {
    return { setupUsd: 2, weeklyUsd: 0.5 };
  }
  return { setupUsd: 4, weeklyUsd: 1 };
}

function capitalTier(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 500;
  if (p.tvl_usd >= 200_000_000) return 250;
  if (p.tvl_usd >= 50_000_000) return 150;
  return 75;
}

function holdDurationDays(ageDays: number | null, change7d: number | null): number {
  const base = ageDays === null ? 45 : ageDays < 180 ? 60 : ageDays < 365 ? 45 : 30;
  if (change7d !== null && change7d >= 15) return Math.min(75, base + 15);
  return base;
}

function coreAction(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return `Supply $${capital} of USDC as collateral on ${n} (${chain}) and borrow 30% against it to accrue both lending and borrow points.`;
  }
  if (c.includes('dex') || c.includes('liquidity')) {
    return `Deposit $${capital} into ${n}'s deepest stable or blue-chip LP pool on ${chain} and route two swaps through it.`;
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) {
    return `Deposit $${capital} of USDC margin on ${n} (${chain}) and maintain a delta-neutral or low-leverage weekly volume position.`;
  }
  if (c.includes('basis')) {
    return `Mint or stake $${capital} in ${n}'s basis-yield vault on ${chain} to capture funding spread and protocol points.`;
  }
  if (c.includes('curator') || c.includes('allocator') || c.includes('yield')) {
    return `Deposit $${capital} into ${n}'s highest-TVL curated vault on ${chain} and retain the vault receipt token.`;
  }
  if (c.includes('rwa')) {
    return `Allocate $${capital} into ${n}'s tokenized treasury or RWA pool on ${chain} and hold the yield-bearing receipt.`;
  }
  if (c.includes('prediction')) {
    return `Fund $${capital} on ${n} (${chain}) and place balanced maker limit orders across active liquid markets.`;
  }
  return `Deposit $${capital} of USDC into ${n}'s primary pool on ${chain} and keep the receipt position active.`;
}

function fmtFee(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

export function buildFarmSteps(p: SnapshotProtocol, ageDays: number | null): string[] {
  const chain = primaryChain(p);
  const gas = gasProfile(chain);
  const capital = capitalTier(p);
  const holdDays = holdDurationDays(ageDays, p.change_7d);
  const weeks = Math.max(4, Math.round(holdDays / 7));
  const totalGas = Math.round((gas.setupUsd + gas.weeklyUsd * weeks) * 10) / 10;

  const steps: FarmStep[] = [
    {
      action: `Isolate a dedicated farming wallet on ${chain} funded with $${capital} USDC plus gas reserve; keep recovery phrase offline.`,
      cost: `$${capital} principal + ${fmtFee(gas.setupUsd)} initial gas`,
      time: '10 minutes setup',
    },
    {
      action: coreAction(p, capital, chain),
      cost: `$${capital} locked capital + ~${fmtFee(gas.setupUsd)} tx fee`,
      time: '15 minutes',
    },
    {
      action: `Execute one qualifying touchpoint weekly on ${p.name} (rebalance, claim-and-compound, or small swap) across ${weeks} epochs.`,
      cost: `~${fmtFee(gas.weeklyUsd)}/week (~${fmtFee(totalGas)} total gas over ${weeks} wks)`,
      time: '10 minutes/week',
    },
    {
      action: `Maintain the active position for at least ${holdDays} consecutive days to span multiple snapshot windows and loyalty multipliers.`,
      cost: `$${capital} remains deployed (opportunity cost ~4% APY)`,
      time: `${holdDays} days hold`,
    },
    {
      action: `Track epoch points and verify official eligibility announcements directly via ${p.name}'s verified app before unwinding.`,
      cost: '$0 check fee (avoid third-party claim aggregators)',
      time: '10 minutes/check',
    },
  ];

  return steps.map((s) => {
    const line = `${s.action} Cost: ${s.cost}. Time: ${s.time}.`;
    return line.length > 600 ? `${line.slice(0, 596)}...` : line;
  });
}
