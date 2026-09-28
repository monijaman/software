import type { Metadata } from "next";
import Link from "next/link";
import { search } from "@/lib/db";

export const metadata: Metadata = { title: "Search" };

type Props = { searchParams: Promise<{ q?: string | string[] }> };

export default async function SearchPage({ searchParams }: Props) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const hits = q ? search(q) : [];
  const lessons = hits.filter((h) => h.kind === "lesson");
  const notes = hits.filter((h) => h.kind === "library");

  return (
    <div className="container search-page">
      <h1>Search</h1>
      <form action="/search" className="search-form" role="search">
        <input name="q" type="search" defaultValue={q} placeholder="Try: idempotency, useEffect, consumer group…" autoFocus />
        <button className="button primary">Search</button>
      </form>

      {q && hits.length === 0 && <p className="empty">Nothing found for “{q}”.</p>}

      {lessons.length > 0 && (
        <section>
          <h2>Lessons ({lessons.length})</h2>
          <ul className="search-results">
            {lessons.map((hit) => (
              <li key={hit.ref}>
                <Link href={`/learn/${hit.ref}`}>{hit.title}</Link>
                <p dangerouslySetInnerHTML={{ __html: hit.snippet }} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {notes.length > 0 && (
        <section>
          <h2>Library notes ({notes.length})</h2>
          <ul className="search-results">
            {notes.map((hit) => (
              <li key={hit.ref}>
                <Link href={`/library/${hit.ref}`}>{hit.title}</Link>
                <p dangerouslySetInnerHTML={{ __html: hit.snippet }} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
