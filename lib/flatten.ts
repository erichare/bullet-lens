/**
 * Flatten a 1D crosscut signature by:
 *  1. Trimming the outer groove-impression region (by default 10% on each side)
 *  2. Fitting a low-order polynomial to the remaining interior signal
 *  3. Subtracting the polynomial — the residual is the striae signal
 *
 * The trimmed signal is returned so the plot can display only the meaningful
 * land interior; NaN values in z are preserved.
 */
export interface FlattenOptions {
  /** Fraction of the signal to trim from each side (default 0.1 = 10%). */
  trimFrac?: number;
  /** Polynomial degree (default 2 = quadratic). */
  degree?: 1 | 2 | 3;
}

export interface FlattenResult {
  x: Float32Array;
  z: Float32Array;
  degree: number;
  trimFrac: number;
  /** Polynomial coefficients [a0, a1, a2, ...] such that fit(x) = Σ a_i * x^i. */
  coeffs: number[];
}

export function flattenSignature(
  x: Float32Array | number[],
  z: Float32Array | number[],
  opts: FlattenOptions = {},
): FlattenResult {
  const trimFrac = opts.trimFrac ?? 0.1;
  const degree = opts.degree ?? 2;
  const n = x.length;
  const startIdx = Math.max(0, Math.floor(n * trimFrac));
  const endIdx = Math.min(n, Math.ceil(n * (1 - trimFrac)));
  const len = Math.max(0, endIdx - startIdx);

  if (len < degree + 1) {
    return {
      x: new Float32Array(),
      z: new Float32Array(),
      degree,
      trimFrac,
      coeffs: [],
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

  if (xsNorm.length < degree + 1) {
    return {
      x: new Float32Array(),
      z: new Float32Array(),
      degree,
      trimFrac,
      coeffs: [],
    };
  }

  const coeffsNorm = polyFit(xsNorm, zs, degree);

  const outX = new Float32Array(len);
  const outZ = new Float32Array(len);
  for (let k = 0; k < len; k++) {
    const srcIdx = startIdx + k;
    const xi = (x[srcIdx] - x0) / xSpan;
    let fit = 0;
    for (let d = coeffsNorm.length - 1; d >= 0; d--) {
      fit = fit * xi + coeffsNorm[d];
    }
    const v = z[srcIdx];
    outX[k] = x[srcIdx];
    outZ[k] = Number.isFinite(v) ? (v as number) - fit : NaN;
  }

  return { x: outX, z: outZ, degree, trimFrac, coeffs: coeffsNorm };
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
