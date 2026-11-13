import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import "../globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = { title: "Revent Business · Team" };

// The team (reviewer) UI is English-only in v1 and lives outside [locale] (CLAUDE.md §4).
// It has no translation provider, so customer components that use next-intl stay out of it.
export default function TeamLayout({ children }: LayoutProps<"/team">) {
  return (
    // suppressHydrationWarning: next-themes adds the theme class in the browser before React loads.
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <header className="border-b px-6 py-4">
            <Link href="/team" className="font-medium">
              Revent Business · Team
            </Link>
          </header>
          <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
