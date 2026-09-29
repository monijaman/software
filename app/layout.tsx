import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import ThemeToggle, { themeInitScript } from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Software Academy", template: "%s · Software Academy" },
  description:
    "Easy, picture-first lessons on clean code, SOLID, design patterns, DSA, backend, frontend, programming languages, microservices, Kafka, Kubernetes and AWS.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-WEN0ZL81VV"
          strategy="beforeInteractive"
        />
        <Script id="google-analytics" strategy="beforeInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){window.dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-WEN0ZL81VV');`}
        </Script>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="brand">
              <span className="brand-mark">SA</span>
              <span>Software Academy</span>
            </Link>
            <nav className="nav">
              <Link href="/#index">Lessons</Link>
              <Link href="/learn/aws">AWS</Link>
              <Link href="/learn/programming-languages">Languages</Link>
              <Link href="/library">Library</Link>
              <form action="/search" className="nav-search" role="search">
                <input name="q" type="search" placeholder="Search…" aria-label="Search everything" />
              </form>
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="container">
            Lessons live in <code>content/</code> and the notes library comes from <code>../Theoretical</code>. Both are loaded
            into SQLite by <code>npm run seed</code>.
          </div>
        </footer>
      </body>
    </html>
  );
}
