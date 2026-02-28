import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cobox",
  description: "中小事業者のための共同受信箱",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
