/**
 * Flatten a 1D crosscut signature by:
 *  1. Trimming the outer groove-impression region (by default 10% on each side)
 *  2. Estimating a smooth low-frequency baseline
 *  3. Subtracting the baseline — the residual is the striae signal
 *
 * The trimmed signal is returned so the plot can display only the meaningful
 * land interior; NaN values in z are preserved.
 */
export type FlattenMethod = "loess" | "polynomial";

export interface FlattenOptions {
  /** Fraction of the signal to trim from each side (default 0.1 = 10%). */
  trimFrac?: number;
  /** Baseline estimator (default "loess"). */
  method?: FlattenMethod;
  /** LOESS window as a fraction of finite samples (default 0.18 = 18%). */
  spanFrac?: number;
  /** Fraction of flattened residuals to hide at each edge (default 0). */
  edgeGuardFrac?: number;
  /** Extend edge guard until residuals settle within this many robust sigmas. */
  edgeSettleSigma?: number;
  /** Consecutive settled samples required before ending adaptive edge masking. */
  edgeSettleRun?: number;
  /** Polynomial degree when method="polynomial" (default 2 = quadratic). */
  degree?: 1 | 2 | 3;
}

export interface FlattenResult {
  x: Float32Array;
  z: Float32Array;
  method: FlattenMethod;
  degree: number;
  trimFrac: number;
  spanFrac: number;
  edgeGuardFrac: number;
  edgeSettleSigma: number | null;
  edgeSettleRun: number;
  /** Polynomial coefficients [a0, a1, a2, ...] such that fit(x) = Σ a_i * x^i. */
  coeffs: number[];
  /** Estimated low-frequency baseline, aligned with x/z. */
  baseline: Float32Array;
}

export function flattenSignature(
  x: Float32Array | number[],
  z: Float32Array | number[],
  opts: FlattenOptions = {},
): FlattenResult {
  const trimFrac = opts.trimFrac ?? 0.1;
  const method = opts.method ?? "loess";
  const spanFrac = opts.spanFrac ?? 0.18;
  const edgeGuardFrac = opts.edgeGuardFrac ?? 0;
  const edgeSettleSigma = opts.edgeSettleSigma ?? null;
  const edgeSettleRun = opts.edgeSettleRun ?? 8;
  const degree = opts.degree ?? 2;
  const n = x.length;
  const startIdx = Math.max(0, Math.floor(n * trimFrac));
  const endIdx = Math.min(n, Math.ceil(n * (1 - trimFrac)));
  const len = Math.max(0, endIdx - startIdx);

  const minSamples = method === "polynomial" ? degree + 1 : 2;
  if (len < minSamples) {
    return {
      x: new Float32Array(),
      z: new Float32Array(),
      method,
      degree,
      trimFrac,
      spanFrac,
      edgeGuardFrac,
      edgeSettleSigma,
      edgeSettleRun,
      coeffs: [],
      baseline: new Float32Array(),
    };
  }

  // Work in normalized X coordinates to keep the normal-equations matrix
  // well-conditioned regardless of the physical units of x.
  const x0 = x[startIdx];
  const x1 = x[endIdx - 1];
  const xSpan = x1 - x0 || 1;

  const xsNorm: number[] = [];
  const zs: number[] = [];
  for (let i = startIdx; i < endIdx; i++) {
    const v = z[i];
    if (Number.isFinite(v)) {
      xsNorm.push((x[i] - x0) / xSpan);
      zs.push(v as number);
    }
  }

  if (xsNorm.length < minSamples) {
    return {
      x: new Float32Array(),
      z: new Float32Array(),
      method,
      degree,
      trimFrac,
      spanFrac,
      edgeGuardFrac,
      edgeSettleSigma,
      edgeSettleRun,
      coeffs: [],
      baseline: new Float32Array(),
    };
  }

  if (method === "loess") {
    const baseline = loessBaseline(x, z, startIdx, endIdx, spanFrac);
    const outX = new Float32Array(len);
    const outZ = new Float32Array(len);
    for (let k = 0; k < len; k++) {
      const srcIdx = startIdx + k;
      const v = z[srcIdx];
      outX[k] = x[srcIdx];
      outZ[k] = Number.isFinite(v) ? (v as number) - baseline[k] : NaN;
    }
    maskEdgeGuard(outZ, edgeGuardFrac, edgeSettleSigma, edgeSettleRun);

    return {
      x: outX,
      z: outZ,
      method,
      degree: 1,
      trimFrac,
      spanFrac,
      edgeGuardFrac,
      edgeSettleSigma,
      edgeSettleRun,
      coeffs: [],
      baseline,
    };
  }

  const coeffsNorm = polyFit(xsNorm, zs, degree);

  const outX = new Float32Array(len);
  const outZ = new Float32Array(len);
  const baseline = new Float32Array(len);
  for (let k = 0; k < len; k++) {
    const srcIdx = startIdx + k;
    const xi = (x[srcIdx] - x0) / xSpan;
    let fit = 0;
    for (let d = coeffsNorm.length - 1; d >= 0; d--) {
      fit = fit * xi + coeffsNorm[d];
    }
    const v = z[srcIdx];
    outX[k] = x[srcIdx];
    baseline[k] = fit;
    outZ[k] = Number.isFinite(v) ? (v as number) - fit : NaN;
  }
  maskEdgeGuard(outZ, edgeGuardFrac, edgeSettleSigma, edgeSettleRun);

  return {
    x: outX,
    z: outZ,
    method,
    degree,
    trimFrac,
    spanFrac,
    edgeGuardFrac,
    edgeSettleSigma,
    edgeSettleRun,
    coeffs: coeffsNorm,
    baseline,
  };
}

function maskEdgeGuard(
  z: Float32Array,
  edgeGuardFrac: number,
  edgeSettleSigma: number | null,
  edgeSettleRun: number,
): void {
  const guard = Math.min(
    Math.floor(z.length / 2),
    Math.max(0, Math.ceil(z.length * edgeGuardFrac)),
  );
  for (let i = 0; i < guard; i++) {
    z[i] = NaN;
    z[z.length - 1 - i] = NaN;
  }
  if (edgeSettleSigma === null) return;

  const finite: number[] = [];
  for (let i = guard; i < z.length - guard; i++) {
    const v = z[i];
    if (Number.isFinite(v)) finite.push(v);
  }
  if (finite.length < 8) return;

  const center = median(finite);
  const deviations = finite.map((v) => Math.abs(v - center));
  const robustSigma = median(deviations) * 1.4826;
  if (!(robustSigma > 0)) return;

  const threshold = edgeSettleSigma * robustSigma;
  const run = Math.max(1, Math.floor(edgeSettleRun));
  const leftKeepStart = settledRunStart(z, guard, z.length - guard, center, threshold, run);
  if (leftKeepStart !== null) {
    for (let i = guard; i < leftKeepStart; i++) z[i] = NaN;
  }

  const rightKeepEnd = settledRunEnd(z, guard, z.length - guard, center, threshold, run);
  if (rightKeepEnd !== null) {
    for (let i = rightKeepEnd + 1; i < z.length - guard; i++) z[i] = NaN;
  }
}

function settledRunStart(
  z: Float32Array,
  start: number,
  end: number,
  center: number,
  threshold: number,
  run: number,
): number | null {
  let settled = 0;
  for (let i = start; i < end; i++) {
    const v = z[i];
    if (Number.isFinite(v) && Math.abs(v - center) <= threshold) {
      settled++;
      if (settled >= run) return i - run + 1;
    } else {
      settled = 0;
    }
  }
  return null;
}

function settledRunEnd(
  z: Float32Array,
  start: number,
  end: number,
  center: number,
  threshold: number,
  run: number,
): number | null {
  let settled = 0;
  for (let i = end - 1; i >= start; i--) {
    const v = z[i];
    if (Number.isFinite(v) && Math.abs(v - center) <= threshold) {
      settled++;
      if (settled >= run) return i + run - 1;
    } else {
      settled = 0;
    }
  }
  return null;
}

function median(values: number[]): number {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) * 0.5
    : sorted[mid];
}

function loessBaseline(
  x: Float32Array | number[],
  z: Float32Array | number[],
  startIdx: number,
  endIdx: number,
  spanFrac: number,
): Float32Array {
  const len = Math.max(0, endIdx - startIdx);
  const out = new Float32Array(len);
  const x0 = x[startIdx];
  const x1 = x[endIdx - 1];
  const xSpan = x1 - x0 || 1;
  const xs: number[] = [];
  const ys: number[] = [];

  for (let i = startIdx; i < endIdx; i++) {
    const v = z[i];
    if (Number.isFinite(v)) {
      xs.push((x[i] - x0) / xSpan);
      ys.push(v as number);
    }
  }

  if (xs.length === 0) return out;
  if (xs.length === 1) {
    out.fill(ys[0]);
    return out;
  }

  const spanCount = Math.min(
    xs.length,
    Math.max(2, Math.ceil(xs.length * Math.min(1, Math.max(0.02, spanFrac)))),
  );

  for (let k = 0; k < len; k++) {
    const xi = (x[startIdx + k] - x0) / xSpan;
    const center = lowerBound(xs, xi);
    let left = Math.max(0, center - 1);
    let right = Math.min(xs.length - 1, center);
    while (right - left + 1 < spanCount) {
      if (left <= 0) {
        right = Math.min(xs.length - 1, right + 1);
      } else if (right >= xs.length - 1) {
        left = Math.max(0, left - 1);
      } else if (Math.abs(xs[left - 1] - xi) <= Math.abs(xs[right + 1] - xi)) {
        left--;
      } else {
        right++;
      }
    }

    let bandwidth = 0;
    for (let i = left; i <= right; i++) {
      bandwidth = Math.max(bandwidth, Math.abs(xs[i] - xi));
    }
    out[k] = localLinearPredict(xs, ys, left, right, xi, bandwidth);
  }

  return out;
}

function lowerBound(values: number[], target: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (values[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function localLinearPredict(
  xs: number[],
  ys: number[],
  left: number,
  right: number,
  xi: number,
  bandwidth: number,
): number {
  let sw = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;

  for (let i = left; i <= right; i++) {
    const dist = Math.abs(xs[i] - xi);
    const u = bandwidth > 0 ? dist / bandwidth : 0;
    const w = u >= 1 ? 0 : (1 - u ** 3) ** 3;
    sw += w;
    sx += w * xs[i];
    sy += w * ys[i];
    sxx += w * xs[i] * xs[i];
    sxy += w * xs[i] * ys[i];
  }

  if (sw <= 0) {
    let sum = 0;
    for (let i = left; i <= right; i++) sum += ys[i];
    return sum / (right - left + 1);
  }

  const denom = sw * sxx - sx * sx;
  if (Math.abs(denom) < 1e-12) return sy / sw;

  const slope = (sw * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / sw;
  return intercept + slope * xi;
}

/**
 * Least-squares polynomial fit via normal equations. Returns coefficients
 * [a0, a1, ..., ad] such that f(x) = Σ a_i x^i. Uses Gaussian elimination
 * with partial pivoting for numerical stability.
 */
function polyFit(xs: number[], ys: number[], degree: number): number[] {
  const d1 = degree + 1;
  const n = xs.length;

  // Sums of x^k for k=0..2*degree
  const powerSums = new Array(2 * degree + 1).fill(0);
  // Sums of x^k * y for k=0..degree
  const weightedSums = new Array(d1).fill(0);

  for (let i = 0; i < n; i++) {
    const xi = xs[i];
    const yi = ys[i];
    let xp = 1;
    for (let k = 0; k <= 2 * degree; k++) {
      powerSums[k] += xp;
      if (k <= degree) weightedSums[k] += xp * yi;
      xp *= xi;
    }
  }

  // Build (d1 x d1+1) augmented matrix [A | b]
  const M: number[][] = [];
  for (let i = 0; i < d1; i++) {
    const row = new Array(d1 + 1);
    for (let j = 0; j < d1; j++) row[j] = powerSums[i + j];
    row[d1] = weightedSums[i];
    M.push(row);
  }

  // Gaussian elimination with partial pivoting
  for (let i = 0; i < d1; i++) {
    let maxRow = i;
    for (let k = i + 1; k < d1; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
    }
    if (maxRow !== i) {
      const tmp = M[i];
      M[i] = M[maxRow];
      M[maxRow] = tmp;
    }
    const pivot = M[i][i];
    if (Math.abs(pivot) < 1e-12) {
      // Singular; return zeros
      return new Array(d1).fill(0);
    }
    for (let k = i + 1; k < d1; k++) {
      const f = M[k][i] / pivot;
      for (let j = i; j <= d1; j++) M[k][j] -= f * M[i][j];
    }
  }

  const coeffs = new Array(d1).fill(0);
  for (let i = d1 - 1; i >= 0; i--) {
    let s = M[i][d1];
    for (let j = i + 1; j < d1; j++) s -= M[i][j] * coeffs[j];
    coeffs[i] = s / M[i][i];
  }
  return coeffs;
}
