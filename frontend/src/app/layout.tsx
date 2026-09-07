import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "ScanSure — AI Legal Metrology Compliance Scanner",
  description:
    "AI-powered product label scanner for Legal Metrology compliance verification. OCR extraction, rule checks and evidence-backed inspection reports.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
