export interface SignatureRange {
  x0: number;
  x1: number;
}

export const FULL_SIGNATURE_RANGE: SignatureRange = { x0: 0, x1: 1 };
export const MIN_SIGNATURE_RANGE_WIDTH = 0.02;

export function clampSignatureFraction(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function clampSignatureRange(
  range: SignatureRange | undefined,
  minWidth = MIN_SIGNATURE_RANGE_WIDTH,
): SignatureRange {
  if (!range) return { ...FULL_SIGNATURE_RANGE };

  let x0 = clampSignatureFraction(range.x0);
  let x1 = clampSignatureFraction(range.x1);
  if (x1 < x0) [x0, x1] = [x1, x0];

  const width = Math.min(1, Math.max(0, minWidth));
  if (x1 - x0 >= width) return { x0, x1 };

  const center = (x0 + x1) * 0.5;
  x0 = center - width * 0.5;
  x1 = center + width * 0.5;
  if (x0 < 0) {
    x1 = width;
    x0 = 0;
  }
  if (x1 > 1) {
    x0 = 1 - width;
    x1 = 1;
  }
  return { x0: clampSignatureFraction(x0), x1: clampSignatureFraction(x1) };
}

export function signatureRangeWidth(range: SignatureRange): number {
  return Math.max(0, range.x1 - range.x0);
}

export function fractionInSignatureRange(
  value: number,
  range: SignatureRange,
  epsilon = 1e-6,
): boolean {
  return value >= range.x0 - epsilon && value <= range.x1 + epsilon;
}

export function fractionToRangeLocal(
  value: number,
  range: SignatureRange,
): number | null {
  if (!fractionInSignatureRange(value, range)) return null;
  const width = signatureRangeWidth(range) || 1;
  return (value - range.x0) / width;
}

export function rangeToIndexWindow(
  length: number,
  range: SignatureRange | undefined,
): { start: number; end: number } {
  if (length <= 0) return { start: 0, end: 0 };
  if (length === 1) return { start: 0, end: 1 };

  const safe = clampSignatureRange(range);
  const maxIndex = length - 1;
  let start = Math.ceil(safe.x0 * maxIndex);
  let end = Math.floor(safe.x1 * maxIndex) + 1;

  start = Math.min(Math.max(0, start), maxIndex);
  end = Math.min(Math.max(start + 1, end), length);

  if (end - start < 2) {
    if (start > 0) start -= 1;
    else end = Math.min(length, end + 1);
  }

  return { start, end };
}

export function sliceSignatureRange(
  x: Float32Array | number[],
  z: Float32Array | number[],
  range: SignatureRange | undefined,
): { x: Float32Array; z: Float32Array; start: number; end: number } {
  const { start, end } = rangeToIndexWindow(x.length, range);
  const len = Math.max(0, end - start);
  const outX = new Float32Array(len);
  const outZ = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    outX[i] = x[start + i];
    outZ[i] = z[start + i];
  }
  return { x: outX, z: outZ, start, end };
}
