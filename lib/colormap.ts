export type ColormapName = "viridis" | "magma" | "plasma" | "cividis" | "turbo" | "bone";

// Compact 10-stop approximations (RGB in 0..1). Good enough for shading — we
// linearly interpolate between stops.
const STOPS: Record<ColormapName, [number, number, number][]> = {
  viridis: [
    [0.267, 0.005, 0.329],
    [0.283, 0.141, 0.458],
    [0.254, 0.265, 0.530],
    [0.207, 0.372, 0.553],
    [0.164, 0.471, 0.558],
    [0.128, 0.567, 0.551],
    [0.135, 0.659, 0.518],
    [0.267, 0.749, 0.441],
    [0.478, 0.821, 0.318],
    [0.741, 0.873, 0.150],
  ],
  magma: [
    [0.001, 0.000, 0.014],
    [0.094, 0.065, 0.304],
    [0.261, 0.068, 0.488],
    [0.428, 0.115, 0.509],
    [0.594, 0.165, 0.508],
    [0.764, 0.215, 0.465],
    [0.911, 0.310, 0.386],
    [0.988, 0.481, 0.298],
    [0.996, 0.682, 0.339],
    [0.987, 0.890, 0.565],
  ],
  plasma: [
    [0.050, 0.029, 0.528],
    [0.262, 0.003, 0.614],
    [0.448, 0.000, 0.659],
    [0.621, 0.090, 0.619],
    [0.762, 0.214, 0.510],
    [0.881, 0.335, 0.387],
    [0.965, 0.470, 0.272],
    [0.994, 0.624, 0.162],
    [0.987, 0.803, 0.118],
    [0.940, 0.975, 0.131],
  ],
  cividis: [
    [0.000, 0.135, 0.304],
    [0.113, 0.198, 0.410],
    [0.240, 0.263, 0.412],
    [0.342, 0.336, 0.430],
    [0.441, 0.412, 0.444],
    [0.544, 0.493, 0.448],
    [0.653, 0.578, 0.435],
    [0.772, 0.669, 0.404],
    [0.894, 0.769, 0.343],
    [0.999, 0.882, 0.253],
  ],
  turbo: [
    [0.188, 0.072, 0.235],
    [0.275, 0.408, 0.871],
    [0.176, 0.710, 0.929],
    [0.169, 0.910, 0.655],
    [0.561, 0.999, 0.310],
    [0.902, 0.937, 0.129],
    [0.996, 0.710, 0.136],
    [0.953, 0.413, 0.137],
    [0.773, 0.176, 0.102],
    [0.479, 0.018, 0.012],
  ],
  bone: [
    [0.0, 0.0, 0.0],
    [0.12, 0.13, 0.17],
    [0.22, 0.25, 0.33],
    [0.32, 0.38, 0.48],
    [0.42, 0.52, 0.61],
    [0.52, 0.62, 0.70],
    [0.63, 0.72, 0.78],
    [0.76, 0.82, 0.85],
    [0.88, 0.92, 0.93],
    [1.0, 1.0, 1.0],
  ],
};

/** Sample a colormap at t in [0,1]. Returns RGB in 0..1. */
export function sampleColor(
  name: ColormapName,
  t: number,
): [number, number, number] {
  const stops = STOPS[name];
  const clamped = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
  const pos = clamped * (stops.length - 1);
  const i = Math.floor(pos);
  const f = pos - i;
  const a = stops[i];
  const b = stops[Math.min(stops.length - 1, i + 1)];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export const COLORMAPS: { id: ColormapName; label: string }[] = [
  { id: "viridis", label: "Viridis" },
  { id: "plasma", label: "Plasma" },
  { id: "magma", label: "Magma" },
  { id: "cividis", label: "Cividis" },
  { id: "turbo", label: "Turbo" },
  { id: "bone", label: "Bone" },
];
