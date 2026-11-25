/** Pure statistical helpers for peer-group fitting and held-out validation. */

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = xs.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function averageRanks(values: number[]): number[] {
  const indexed = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const ranks = new Array<number>(values.length);
  for (let i = 0; i < indexed.length; ) {
    let j = i;
    while (j < indexed.length && indexed[j]![0] === indexed[i]![0]) j++;
    const avg = (i + j - 1) / 2 + 1;
    for (let k = i; k < j; k++) ranks[indexed[k]![1]] = avg;
    i = j;
  }
  return ranks;
}

export function spearmanRho(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length < 2) return 0;
  const rx = averageRanks(xs);
  const ry = averageRanks(ys);
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < rx.length; i++) {
    const a = rx[i]! - mx;
    const b = ry[i]! - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  return denom > 0 ? num / denom : 0;
}

export function solveWeightedRidge(X: number[][], y: number[], w: number[], penalty: (col: number) => number): number[] {
  const n = X.length;
  const m = X[0]?.length ?? 0;
  const XtX = Array.from({ length: m }, () => new Array<number>(m).fill(0));
  const Xty = new Array<number>(m).fill(0);
  for (let i = 0; i < n; i++) {
    const row = X[i]!;
    const wi = w[i]!;
    const yi = y[i]!;
    for (let j = 0; j < m; j++) {
      Xty[j] = Xty[j]! + wi * row[j]! * yi;
      for (let k = 0; k < m; k++) {
        XtX[j]![k] = XtX[j]![k]! + wi * row[j]! * row[k]!;
      }
    }
  }
  for (let j = 0; j < m; j++) XtX[j]![j] = XtX[j]![j]! + penalty(j);

  const aug = XtX.map((row, i) => [...row, Xty[i]!]);
  for (let i = 0; i < m; i++) {
    let maxRow = i;
    for (let r = i + 1; r < m; r++) {
      if (Math.abs(aug[r]![i]!) > Math.abs(aug[maxRow]![i]!)) maxRow = r;
    }
    [aug[i], aug[maxRow]] = [aug[maxRow]!, aug[i]!];
    const pivot = aug[i]![i]!;
    if (Math.abs(pivot) < 1e-12) continue;
    for (let k = i; k <= m; k++) aug[i]![k] = aug[i]![k]! / pivot;
    for (let r = 0; r < m; r++) {
      if (r === i) continue;
      const factor = aug[r]![i]!;
      for (let k = i; k <= m; k++) aug[r]![k] = aug[r]![k]! - factor * aug[i]![k]!;
    }
  }
  return aug.map((row) => row[m]!);
}

export function fitHuberRidge(X: number[][], y: number[], penalty: (col: number) => number, iterations = 8): number[] {
  let w = new Array<number>(X.length).fill(1);
  let beta = solveWeightedRidge(X, y, w, penalty);
  for (let iter = 0; iter < iterations; iter++) {
    const res = X.map((row, i) => {
      let pred = 0;
      for (let j = 0; j < row.length; j++) pred += row[j]! * beta[j]!;
      return y[i]! - pred;
    });
    const absRes = res.map((r) => Math.abs(r));
    const scale = Math.max(0.25, median(absRes) / 0.6745);
    const delta = 1.345 * scale;
    w = res.map((r) => (Math.abs(r) <= delta ? 1 : delta / Math.abs(r)));
    beta = solveWeightedRidge(X, y, w, penalty);
  }
  return beta;
}
