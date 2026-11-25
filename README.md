# Token Launch Radar (`radar-v8`)

An offline-first token launch radar for `token-radar-01` built with Node 22 standard library TypeScript and a zero-dependency static dashboard.

## Methodology

1. **Pre-Token Classification & Exclusions (`src/snapshot.ts`)**
   Applies the competition's exact pre-token rules to all protocols in `snapshot.json`: keeps protocols with no recorded token (`mcap_usd`, `gecko_id`, `symbol` all null), excluding `CEX`, `Bridge`, `Canonical Bridge`, `Liquid Staking`, `Liquid Restaking`, `Restaked BTC`, versioned pool suffixes, `wrapped`/`staked`/`staking` wrappers, exchange-prefixed products, and parent-protocol derivatives omitted from the watchlist above the `$50M` floor. All excluded protocols and live-token peers are surfaced in the **Peers & Exclusions** view.

2. **Peer-Fitted Value Model & Two-Split Holdout (`src/stats.ts`, `src/model.ts`)**
   Fits `log(mcap) ~ ln(TVL / $50M) + momentum_7d + ln(1 + age_years) + category_offset` via Huber-weighted ridge regression on half of the priced live-token peers. Validates on two held-out splits (a balanced 50/50 slug-alternating split and an older-to-younger temporal split), selects the split preferred by held-out Spearman rank correlation, and displays both split metrics and the fitted equation on the cover.

3. **Empirical Launch Odds & Farm Plans (`src/model.ts`, `src/farmplan.ts`)**
   Estimates smoothed empirical token-launch probability by category, TVL tier, and age tier across non-excluded protocols, pairing conditional implied value with expected value (`implied_value_usd * launch_odds`). Each row includes a 5-step farm plan derived from category, chain gas profile, TVL tier, and momentum.

## Running Locally

```bash
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
```

## Snapshot Validation Summary (`2026-11-14`)

- **Watchlist coverage**: `40 / 40` (`100%` of the `$50M` floor)
- **Pre-token board rows**: `178` (`40` watchlist + `138` early protocols below `$50M`), with `416` live-token and `164` excluded tokenless protocols set aside in **Peers & Exclusions**
- **Value formula**: `log(val) = 16.473 + 0.485*ln(TVL/$50M) + (-0.186)*mom_7d + (-0.271)*ln(1+age_yr) + cat_offset`
- **Selected split**: Balanced 50/50 slug-alternating half-split (`64` train / `64` held-out), achieving held-out Spearman `rho = 0.478` and median relative error `87.7%` (preferred over the older-to-younger split at `rho = 0.293`, `92.9%` median error)

