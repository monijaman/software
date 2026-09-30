"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { href: "/#index", label: "Lessons" },
  { href: "/learn/aws", label: "AWS" },
  { href: "/learn/programming-languages", label: "Languages" },
  { href: "/library", label: "Library" },
];

export default function SiteNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile menu after navigating.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="nav-wrap">
      <nav id="site-nav" className={open ? "nav open" : "nav"} aria-label="Main">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
            {link.label}
          </Link>
        ))}
        <form action="/search" className="nav-search" role="search" onSubmit={() => setOpen(false)}>
          <input name="q" type="search" placeholder="Search…" aria-label="Search everything" />
        </form>
      </nav>
      <ThemeToggle />
      <button
        type="button"
        className="menu-toggle"
        aria-expanded={open}
        aria-controls="site-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">{open ? "✕" : "☰"}</span>
      </button>
    </div>
  );
}
