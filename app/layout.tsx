import type { Metadata } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { pretendard } from "@/shared/config/fonts";
import { QueryProvider } from "@/app/providers/query-provider";
import { Toaster } from "@/shared/ui/sonner";
import "@/app/styles/globals.css";

export const metadata: Metadata = { title: "UXIS COVA :: co-view area" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className={`${pretendard.className} antialiased`}>
        <NuqsAdapter>
          <QueryProvider>{children}</QueryProvider>
        </NuqsAdapter>
        <Toaster />
      </body>
    </html>
  );
}
