import Link from "next/link";
import HomeIndex from "@/components/HomeIndex";
import { getAllLessons, getCategories, getLibraryDocs } from "@/lib/db";

export default function HomePage() {
  const categories = getCategories();
  const lessons = getAllLessons();
  const libraryCount = getLibraryDocs().length;
  const hours = Math.round(categories.reduce((n, c) => n + c.totalMinutes, 0) / 60);
  const first = lessons[0];

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <p className="eyebrow">Picture-first software engineering</p>
            <h1>
              Learn the big ideas <span className="gradient-text">the easy way</span>.
            </h1>
            <p className="lead">
              Short lessons with diagrams, real-life analogies and small code examples, from clean code and SOLID to Kafka and
              Kubernetes.
            </p>
            <div className="hero-actions">
              {first && (
                <Link className="button primary" href={`/learn/${first.categorySlug}/${first.slug}`}>
                  Start with lesson 1 →
                </Link>
              )}
              <Link className="button" href="#index">
                Browse all lessons
              </Link>
            </div>
            <dl className="stats">
              <div>
                <dt>Topics</dt>
                <dd>{categories.length}</dd>
              </div>
              <div>
                <dt>Lessons</dt>
                <dd>{lessons.length}</dd>
              </div>
              <div>
                <dt>Hours</dt>
                <dd>{hours}</dd>
              </div>
              <div>
                <dt>Library notes</dt>
                <dd>{libraryCount}</dd>
              </div>
            </dl>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="hero-art" src="/img/hero.svg" alt="" />
        </div>
      </section>

      <section className="container path">
        <h2>Suggested learning path</h2>
        <p className="muted">Each topic builds on the ones before it. Jump in anywhere you like.</p>
        <ol className="path-steps">
          {categories.map((c) => (
            <li key={c.slug} style={{ "--accent": c.color } as React.CSSProperties}>
              <Link href={`/learn/${c.slug}`}>
                {c.cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.cover} alt="" loading="lazy" />
                )}
                <span className="path-step-num">{c.position}</span>
                <strong>{c.title}</strong>
                <span className="muted">{c.tagline}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <div className="container">
        <HomeIndex categories={categories} lessons={lessons} />
      </div>
    </>
  );
}
