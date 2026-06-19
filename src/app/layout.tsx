import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PredictMind",
  description: "AI-Powered Market Intelligence & Strategy Research Platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-background text-white antialiased">{children}</body>
    </html>
  );
}
