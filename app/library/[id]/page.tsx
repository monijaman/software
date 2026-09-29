import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MarkdownContent from "@/components/Markdown";
import { getCategory, getLibraryDoc, getLibraryDocs } from "@/lib/db";
import { tableOfContents } from "@/lib/toc";

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return getLibraryDocs().map((d) => ({ id: String(d.id) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const doc = getLibraryDoc(Number((await params).id));
  return doc
    ? {
        title: doc.title,
        description: `${doc.title} — practical software engineering notes from Software Academy.`,
      }
    : {};
}

export default async function LibraryDocPage({ params }: Props) {
  const doc = getLibraryDoc(Number((await params).id));
  if (!doc) notFound();
  const category = doc.categorySlug ? getCategory(doc.categorySlug) : undefined;
  const toc = tableOfContents(doc.body).filter((t) => t.depth === 2);

  return (
    <div className="container lesson-layout no-sidebar" style={{ "--accent": category?.color ?? "#64748b" } as React.CSSProperties}>
      <article className="lesson">
        <nav className="breadcrumbs">
          <Link href="/">Software engineering lessons</Link> / <Link href="/library">Software engineering notes</Link> / {" "}
          <span>{doc.title}</span>
        </nav>
        <div className="library-banner">
          <span>
            📄 Original note · <code>Theoretical/{doc.sourcePath}</code> · {doc.minutes} min read
          </span>
          {category && (
            <Link href={`/learn/${category.slug}`}>
              Easy lessons on {category.title} →
            </Link>
          )}
        </div>
        <MarkdownContent source={doc.body} />
      </article>
      {toc.length > 1 && (
        <aside className="toc">
          <p className="toc-title">On this page</p>
          <ul>
            {toc.map((item) => (
              <li key={item.id} className="depth-2">
                <a href={`#${item.id}`}>{item.text}</a>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
