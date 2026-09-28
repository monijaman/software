import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CompleteButton, { DoneMark } from "@/components/CompleteButton";
import MarkdownContent from "@/components/Markdown";
import { getAllLessons, getCategory, getLesson, getLessonsInCategory } from "@/lib/db";
import { groupLessons } from "@/lib/lesson-groups";
import { tableOfContents } from "@/lib/toc";

type Props = { params: Promise<{ category: string; slug: string }> };

export function generateStaticParams() {
  return getAllLessons().map((l) => ({ category: l.categorySlug, slug: l.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params;
  const lesson = getLesson(category, slug);
  return lesson ? { title: lesson.title, description: lesson.summary } : {};
}

export default async function LessonPage({ params }: Props) {
  const { category: categorySlug, slug } = await params;
  const category = getCategory(categorySlug);
  const lesson = getLesson(categorySlug, slug);
  if (!category || !lesson) notFound();

  const siblings = getLessonsInCategory(categorySlug);
  const groups = groupLessons(categorySlug, siblings);
  const all = getAllLessons();
  const index = all.findIndex((l) => l.id === lesson.id);
  const prev = all[index - 1];
  const next = all[index + 1];
  const toc = tableOfContents(lesson.body);
  const key = `${categorySlug}/${slug}`;

  return (
    <div className="container lesson-layout" style={{ "--accent": category.color } as React.CSSProperties}>
      <aside className="lesson-sidebar">
        <Link href={`/learn/${categorySlug}`} className="sidebar-category">
          <span>{category.icon}</span> {category.title}
        </Link>
        {groups.map((group) => (
          <section className="sidebar-lesson-group" key={group.title}>
            {groups.length > 1 && <p>{group.title}</p>}
            <ol>
              {group.lessons.map((s) => (
                <li key={s.id} className={s.id === lesson.id ? "active" : ""}>
                  <Link href={`/learn/${categorySlug}/${s.slug}`}>
                    <span className="index-num">{String(s.position).padStart(2, "0")}</span>
                    <span>{s.title}</span>
                    <DoneMark lessonKey={`${categorySlug}/${s.slug}`} />
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </aside>

      <article className="lesson">
        <nav className="breadcrumbs">
          <Link href="/">Home</Link> / <Link href={`/learn/${categorySlug}`}>{category.title}</Link> /{" "}
          <span>Lesson {lesson.position}</span>
        </nav>
        <header className="lesson-header">
          <h1>{lesson.title}</h1>
          <p className="lead">{lesson.summary}</p>
          <div className="lesson-meta">
            <span className={`level level-${lesson.level.toLowerCase()}`}>{lesson.level}</span>
            <span>⏱ {lesson.minutes} min read</span>
            <span>
              Lesson {lesson.position} of {siblings.length}
            </span>
            {lesson.tags.map((t) => (
              <Link key={t} className="tag" href={`/search?q=${encodeURIComponent(t)}`}>
                #{t}
              </Link>
            ))}
          </div>
        </header>

        <MarkdownContent source={lesson.body} />

        <div className="lesson-footer">
          <CompleteButton lessonKey={key} />
          <nav className="pager">
            {prev ? (
              <Link href={`/learn/${prev.categorySlug}/${prev.slug}`} className="pager-link">
                <span className="muted">← Previous</span>
                <strong>{prev.title}</strong>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={`/learn/${next.categorySlug}/${next.slug}`} className="pager-link next">
                <span className="muted">Next →</span>
                <strong>{next.title}</strong>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </div>
      </article>

      {toc.length > 1 && (
        <aside className="toc">
          <p className="toc-title">On this page</p>
          <ul>
            {toc.map((item) => (
              <li key={item.id} className={`depth-${item.depth}`}>
                <a href={`#${item.id}`}>{item.text}</a>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
