import type { Metadata } from "next";
import Link from "next/link";
import { Geist } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import "../globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = { title: "Revent Business · Back office" };

// Frames every back-office page (English only, outside [locale]).
export default function OpsLayout({ children }: LayoutProps<"/ops">) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <header className="border-b px-6 py-4">
            <Link href="/ops" className="font-medium">
              Revent Business · Back office
            </Link>
          </header>
          <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
