"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CategoryWithStats, Level, LessonSummary } from "@/lib/db";
import { useCompletedLessons } from "@/lib/progress";

const LEVELS: (Level | "All")[] = ["All", "Beginner", "Intermediate", "Advanced"];

export default function HomeIndex({
  categories,
  lessons,
}: {
  categories: CategoryWithStats[];
  lessons: LessonSummary[];
}) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<Level | "All">("All");
  const completed = useCompletedLessons();

  const byCategory = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const map = new Map<string, LessonSummary[]>();
    for (const lesson of lessons) {
      if (level !== "All" && lesson.level !== level) continue;
      const haystack = `${lesson.title} ${lesson.summary} ${lesson.tags.join(" ")}`.toLowerCase();
      if (!words.every((w) => haystack.includes(w))) continue;
      map.set(lesson.categorySlug, [...(map.get(lesson.categorySlug) ?? []), lesson]);
    }
    return map;
  }, [lessons, query, level]);

  const visibleCount = [...byCategory.values()].reduce((n, list) => n + list.length, 0);

  return (
    <section id="index" className="index">
      <div className="index-toolbar">
        <div>
          <h2>Everything in one place</h2>
          <p className="muted">
            {visibleCount} of {lessons.length} lessons
            {completed.length > 0 && <> · {completed.length} completed</>}
          </p>
        </div>
        <div className="index-controls">
          <input
            type="search"
            placeholder="Filter lessons… e.g. cache, hooks, partition"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter lessons"
          />
          <div className="segmented" role="group" aria-label="Filter by level">
            {LEVELS.map((l) => (
              <button key={l} className={l === level ? "active" : ""} onClick={() => setLevel(l)}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="index-grid">
        {categories.map((category) => {
          const list = byCategory.get(category.slug);
          if (!list) return null;
          const done = lessons.filter(
            (l) => l.categorySlug === category.slug && completed.includes(`${l.categorySlug}/${l.slug}`),
          ).length;
          const percent = category.lessonCount ? Math.round((done / category.lessonCount) * 100) : 0;
          return (
            <article key={category.slug} className="index-card" style={{ "--accent": category.color } as React.CSSProperties}>
              <Link href={`/learn/${category.slug}`} className="index-card-head">
                <span className="index-card-icon">{category.icon}</span>
                <span>
                  <span className="index-card-title">{category.title}</span>
                  <span className="index-card-meta">
                    {category.lessonCount} lessons · {Math.round(category.totalMinutes / 6) / 10} h
                  </span>
                </span>
              </Link>
              <div className="progress" aria-label={`${percent}% completed`}>
                <span style={{ width: `${percent}%` }} />
              </div>
              <ol className="index-list">
                {list.map((lesson) => {
                  const key = `${lesson.categorySlug}/${lesson.slug}`;
                  return (
                    <li key={lesson.id} className={completed.includes(key) ? "is-done" : ""}>
                      <Link href={`/learn/${key}`}>
                        <span className="index-num">{completed.includes(key) ? "✓" : String(lesson.position).padStart(2, "0")}</span>
                        <span className="index-title">{lesson.title}</span>
                        <span className={`level level-${lesson.level.toLowerCase()}`}>{lesson.level[0]}</span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </article>
          );
        })}
      </div>
      {visibleCount === 0 && (
        <p className="empty">
          No lessons match “{query}”. Try the <Link href={`/search?q=${encodeURIComponent(query)}`}>full-text search</Link>, which also
          looks inside the notes library.
        </p>
      )}
    </section>
  );
}
