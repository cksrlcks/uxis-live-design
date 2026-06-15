import type { Metadata } from "next";
import { pretendard } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = { title: "uxis live design" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className={`${pretendard.className} antialiased`}>{children}</body>
    </html>
  );
}
