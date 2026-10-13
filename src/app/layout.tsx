import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pulse — chat, stories & moments",
  description: "A modern real-time messenger with stories and a social feed.",
};
export const viewport: Viewport = { themeColor: "#7c3aed", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
