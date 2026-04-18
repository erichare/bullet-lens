import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bullet Lens — x3p topography viewer",
  description:
    "Modern, interactive 3D visualization for forensic bullet land scans stored in the x3p (ISO 5436-2) format.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
