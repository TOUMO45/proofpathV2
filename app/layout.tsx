import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProofPath",
  description: "Don't tell me it's done. Show me the proof.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
