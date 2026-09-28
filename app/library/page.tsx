import type { Metadata } from "next";
import Link from "next/link";
import { getCategories, getLibraryDocs, type LibraryDocSummary } from "@/lib/db";

export const metadata: Metadata = {
  title: "Library",
  description: "Every original note from the Theoretical folder, sorted by topic.",
};

export default function LibraryPage() {
  const categories = getCategories();
  const docs = getLibraryDocs();

  // Group as category -> section -> docs, keeping the order the query returned.
  const groups = new Map<string, Map<string, LibraryDocSummary[]>>();
  for (const doc of docs) {
    const group = doc.categorySlug ?? "other";
    const sections = groups.get(group) ?? new Map<string, LibraryDocSummary[]>();
    sections.set(doc.section, [...(sections.get(doc.section) ?? []), doc]);
    groups.set(group, sections);
  }

  return (
    <div className="container library">
      <nav className="breadcrumbs">
        <Link href="/">Home</Link> / <span>Library</span>
      </nav>
      <h1>📚 Notes library</h1>
      <p className="lead">
        {docs.length} original notes from the <code>Theoretical</code> folder, sorted into the same topics as the lessons. Use them
        to go deeper after a lesson.
      </p>

      <nav className="library-jump">
        {[...groups.keys()].map((slug) => {
          const category = categories.find((c) => c.slug === slug);
          return (
            <a key={slug} href={`#lib-${slug}`}>
              {category ? `${category.icon} ${category.title}` : "🗂 Other"}
            </a>
          );
        })}
      </nav>

      {[...groups.entries()].map(([slug, sections]) => {
        const category = categories.find((c) => c.slug === slug);
        return (
          <section key={slug} id={`lib-${slug}`} className="library-group" style={{ "--accent": category?.color ?? "#64748b" } as React.CSSProperties}>
            <h2>
              {category ? (
                <Link href={`/learn/${slug}`}>
                  {category.icon} {category.title}
                </Link>
              ) : (
                "🗂 Other notes"
              )}
            </h2>
            <div className="library-sections">
              {[...sections.entries()].map(([section, list]) => (
                <div key={section} className="library-section">
                  <h3>
                    {section} <span className="muted">({list.length})</span>
                  </h3>
                  <ul>
                    {list.map((doc) => (
                      <li key={doc.id}>
                        <Link href={`/library/${doc.id}`}>{doc.title}</Link>
                        <span className="muted"> {doc.minutes} min</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
