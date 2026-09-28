import "server-only";
import path from "node:path";
import Database from "better-sqlite3";

const DB_PATH = path.join(process.cwd(), "data", "software.db");

export type Level = "Beginner" | "Intermediate" | "Advanced";

export interface Category {
  id: number;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  icon: string;
  color: string;
  cover: string | null;
  position: number;
}

export interface CategoryWithStats extends Category {
  lessonCount: number;
  totalMinutes: number;
}

export interface LessonSummary {
  id: number;
  categorySlug: string;
  slug: string;
  title: string;
  summary: string;
  level: Level;
  minutes: number;
  tags: string[];
  position: number;
}

export interface Lesson extends LessonSummary {
  body: string;
}

export interface LibraryDocSummary {
  id: number;
  categorySlug: string | null;
  section: string;
  title: string;
  sourcePath: string;
  minutes: number;
}

export interface LibraryDoc extends LibraryDocSummary {
  body: string;
}

export interface SearchHit {
  kind: "lesson" | "library";
  ref: string;
  title: string;
  snippet: string;
}

let cached: Database.Database | undefined;

// In development a fresh connection per query lets `npm run seed` replace the
// file while the dev server is running (Windows refuses to rename open files).
function withDb<T>(fn: (db: Database.Database) => T): T {
  if (process.env.NODE_ENV === "production") {
    cached ??= new Database(DB_PATH, { readonly: true, fileMustExist: true });
    return fn(cached);
  }
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

const LESSON_COLUMNS = `
  l.id, c.slug AS categorySlug, l.slug, l.title, l.summary, l.level, l.minutes, l.tags, l.position`;

type LessonRow = Omit<LessonSummary, "tags"> & { tags: string };
const toLesson = <T extends LessonRow>(row: T) => ({ ...row, tags: JSON.parse(row.tags) as string[] });

export function getCategories(): CategoryWithStats[] {
  return withDb((db) =>
    db
      .prepare(
        `SELECT c.*, COUNT(l.id) AS lessonCount, COALESCE(SUM(l.minutes), 0) AS totalMinutes
         FROM categories c LEFT JOIN lessons l ON l.category_id = c.id
         GROUP BY c.id ORDER BY c.position`,
      )
      .all() as CategoryWithStats[],
  );
}

export function getCategory(slug: string): Category | undefined {
  return withDb((db) => db.prepare(`SELECT * FROM categories WHERE slug = ?`).get(slug) as Category | undefined);
}

export function getAllLessons(): LessonSummary[] {
  return withDb((db) =>
    (
      db
        .prepare(
          `SELECT ${LESSON_COLUMNS} FROM lessons l JOIN categories c ON c.id = l.category_id
           ORDER BY c.position, l.position`,
        )
        .all() as LessonRow[]
    ).map(toLesson),
  );
}

export function getLessonsInCategory(categorySlug: string): LessonSummary[] {
  return withDb((db) =>
    (
      db
        .prepare(
          `SELECT ${LESSON_COLUMNS} FROM lessons l JOIN categories c ON c.id = l.category_id
           WHERE c.slug = ? ORDER BY l.position`,
        )
        .all(categorySlug) as LessonRow[]
    ).map(toLesson),
  );
}

export function getLesson(categorySlug: string, slug: string): Lesson | undefined {
  return withDb((db) => {
    const row = db
      .prepare(
        `SELECT ${LESSON_COLUMNS}, l.body FROM lessons l JOIN categories c ON c.id = l.category_id
         WHERE c.slug = ? AND l.slug = ?`,
      )
      .get(categorySlug, slug) as (LessonRow & { body: string }) | undefined;
    return row && toLesson(row);
  });
}

export function getLibraryDocs(): LibraryDocSummary[] {
  return withDb(
    (db) =>
      db
        .prepare(
          `SELECT d.id, d.category_slug AS categorySlug, d.section, d.title, d.source_path AS sourcePath, d.minutes
           FROM library_docs d LEFT JOIN categories c ON c.slug = d.category_slug
           ORDER BY c.position IS NULL, c.position, d.section, d.source_path`,
        )
        .all() as LibraryDocSummary[],
  );
}

export function getLibraryDoc(id: number): LibraryDoc | undefined {
  return withDb(
    (db) =>
      db
        .prepare(
          `SELECT id, category_slug AS categorySlug, section, title, source_path AS sourcePath, minutes, body
           FROM library_docs WHERE id = ?`,
        )
        .get(id) as LibraryDoc | undefined,
  );
}

// Turns free text into a safe FTS5 query: every word becomes a quoted prefix term.
function toFtsQuery(input: string): string | null {
  const words = input.match(/[\p{L}\p{N}]+/gu);
  return words?.length ? words.map((w) => `"${w}"*`).join(" ") : null;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function search(input: string, limit = 40): SearchHit[] {
  const query = toFtsQuery(input);
  if (!query) return [];
  const rows = withDb(
    (db) =>
      db
        .prepare(
          `SELECT kind, ref, title,
                  snippet(search_index, 3, char(1), char(2), ' … ', 18) AS snippet
           FROM search_index WHERE search_index MATCH ?
           ORDER BY (kind = 'lesson') DESC, bm25(search_index, 0, 0, 8, 1)
           LIMIT ?`,
        )
        .all(query, limit) as SearchHit[],
  );
  // Snippets come from Markdown, so escape them before turning the markers into <mark>.
  return rows.map((row) => ({
    ...row,
    snippet: escapeHtml(row.snippet.replace(/[#*`>|_]+/g, " "))
      .replace(/\u0001/g, "<mark>")
      .replace(/\u0002/g, "</mark>"),
  }));
}
