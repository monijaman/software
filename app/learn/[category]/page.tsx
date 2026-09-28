import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DoneMark } from "@/components/CompleteButton";
import { getCategories, getCategory, getLessonsInCategory, getLibraryDocs } from "@/lib/db";

type Props = { params: Promise<{ category: string }> };

export function generateStaticParams() {
  return getCategories().map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = getCategory((await params).category);
  return category ? { title: category.title, description: category.description } : {};
}

export default async function CategoryPage({ params }: Props) {
  const { category: slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();
  const lessons = getLessonsInCategory(slug);
  const notes = getLibraryDocs().filter((d) => d.categorySlug === slug);
  const minutes = lessons.reduce((n, l) => n + l.minutes, 0);

  return (
    <div style={{ "--accent": category.color } as React.CSSProperties}>
      <section className="category-hero">
        <div className="container category-hero-inner">
          <div>
            <nav className="breadcrumbs">
              <Link href="/">Home</Link> / <span>{category.title}</span>
            </nav>
            <h1>
              <span className="category-icon">{category.icon}</span> {category.title}
            </h1>
            <p className="lead">{category.description}</p>
            <p className="muted">
              {lessons.length} lessons · about {Math.round(minutes / 6) / 10} hours
            </p>
            {lessons[0] && (
              <Link className="button primary" href={`/learn/${slug}/${lessons[0].slug}`}>
                Start the first lesson →
              </Link>
            )}
          </div>
          {category.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="category-cover" src={category.cover} alt="" />
          )}
        </div>
      </section>

      <section className="container">
        <ol className="lesson-cards">
          {lessons.map((lesson) => (
            <li key={lesson.id}>
              <Link href={`/learn/${slug}/${lesson.slug}`} className="lesson-card">
                <span className="lesson-card-num">{String(lesson.position).padStart(2, "0")}</span>
                <span className="lesson-card-body">
                  <strong>
                    {lesson.title} <DoneMark lessonKey={`${slug}/${lesson.slug}`} />
                  </strong>
                  <span className="muted">{lesson.summary}</span>
                  <span className="lesson-card-meta">
                    <span className={`level level-${lesson.level.toLowerCase()}`}>{lesson.level}</span>
                    <span>{lesson.minutes} min read</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>

        {notes.length > 0 && (
          <div className="related-notes">
            <h2>Go deeper in your notes</h2>
            <p className="muted">Original notes from the Theoretical folder on this topic.</p>
            <ul>
              {notes.map((doc) => (
                <li key={doc.id}>
                  <Link href={`/library/${doc.id}`}>{doc.title}</Link>
                  <span className="muted">
                    {" "}
                    · {doc.section} · {doc.minutes} min
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
