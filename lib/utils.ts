import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMicrons(meters: number): string {
  const um = meters * 1e6;
  if (Math.abs(um) >= 1000) return `${(um / 1000).toFixed(2)} mm`;
  if (Math.abs(um) >= 1) return `${um.toFixed(1)} µm`;
  return `${(um * 1000).toFixed(0)} nm`;
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
