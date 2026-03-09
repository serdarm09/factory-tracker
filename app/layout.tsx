import type { Metadata } from "next";
import "./globals.css";

import { auth } from "@/lib/auth";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthSessionProvider } from "@/components/session-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Marisit ERP",
  description: "Fabrika Üretim Takip Sistemi",
  manifest: "/manifest.json",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <html lang="tr" suppressHydrationWarning>
      <body className="font-sans" suppressHydrationWarning>
        <AuthSessionProvider>
          {/*
            ÖNEMLI: forcedTheme="light" ile tema zorla sabitlendi.
            Sebep 1: "system" modunda Windows/Edge dark modda ise tüm arayüz bozuluyordu.
            Sebep 2: defaultTheme="light" tek başına yetmez — next-themes kullanıcı
            tercihini localStorage'a kaydeder ve eski dark tercih varsa onu kullanır.
            forcedTheme localStorage'ı tamamen yok sayar, her zaman light mode açılır.
            Bu site yalnızca light modda tasarlanmıştır. forcedTheme'i kaldırma!
          */}
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            forcedTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
