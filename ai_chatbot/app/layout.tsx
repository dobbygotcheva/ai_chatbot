import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import Script from "next/script";
import { Toaster } from "sonner";
import { LanguageProvider } from "@/components/language-selector";
import { ThemeProvider } from "@/components/theme-provider";
import { APP_VERSION } from "@/lib/app-version";
import { normalizeUiLang } from "@/lib/ui-language";
import egtIcon from "@/public/images/egt-logo.png";

import "./globals.css";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  metadataBase: new URL("https://chat.vercel.ai"),
  title: "Destiny",
  description: "Destiny — AI assistant by EGT.",
};

export const viewport = {
  maximumScale: 1, // Disable auto-zoom on mobile Safari
};

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
});

const FAVICON_VERSIONED = `${egtIcon.src}?v=${APP_VERSION}`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialLang = normalizeUiLang(cookieStore.get("ui-language")?.value);

  return (
    <html
      className={`${geist.variable} ${geistMono.variable}`}
      // `next-themes` injects an extra classname to the body element to avoid
      // visual flicker before hydration. Hence the `suppressHydrationWarning`
      // prop is necessary to avoid the React hydration mismatch warning.
      // https://github.com/pacocoursey/next-themes?tab=readme-ov-file#with-app
      lang={initialLang}
      suppressHydrationWarning
    >
      <head>
        <link href={FAVICON_VERSIONED} rel="icon" type="image/png" />
      </head>
      <body className="antialiased">
        <Script
          src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
          strategy="beforeInteractive"
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          <Toaster position="top-center" />
          <SessionProvider>
            <LanguageProvider initialLang={initialLang}>
              {children}
            </LanguageProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
