// Builds data/software.db from:
//   1. content/categories.json + content/<category>/*.md  -> lessons written for this site
//   2. ../Theoretical/**/*.md                             -> "Library" of original notes
// Run with `npm run seed` (also runs automatically before `dev` and `build`).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import matter from "gray-matter";

const ROOT = process.cwd();
const CONTENT_DIR = path.join(ROOT, "content");
const DB_PATH = path.join(ROOT, "data", "software.db");
const THEORETICAL_DIR = path.resolve(process.env.THEORETICAL_DIR ?? path.join(ROOT, "..", "Theoretical"));
const LIBRARY_PUBLIC_DIR = path.join(ROOT, "public", "library");

const WORDS_PER_MINUTE = 200;

const countWords = (text) => (text.match(/\S+/g) ?? []).length;
const readMinutes = (text) => Math.max(1, Math.round(countWords(text) / WORDS_PER_MINUTE));

function createSchema(db) {
  db.exec(`
    CREATE TABLE categories (
      id          INTEGER PRIMARY KEY,
      slug        TEXT NOT NULL UNIQUE,
      title       TEXT NOT NULL,
      tagline     TEXT NOT NULL,
      description TEXT NOT NULL,
      icon        TEXT NOT NULL,
      color       TEXT NOT NULL,
      cover       TEXT,
      position    INTEGER NOT NULL
    );

    CREATE TABLE lessons (
      id          INTEGER PRIMARY KEY,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      slug        TEXT NOT NULL,
      title       TEXT NOT NULL,
      summary     TEXT NOT NULL,
      level       TEXT NOT NULL CHECK (level IN ('Beginner', 'Intermediate', 'Advanced')),
      minutes     INTEGER NOT NULL,
      tags        TEXT NOT NULL DEFAULT '[]',
      body        TEXT NOT NULL,
      position    INTEGER NOT NULL,
      UNIQUE (category_id, slug)
    );

    CREATE TABLE library_docs (
      id            INTEGER PRIMARY KEY,
      category_slug TEXT,
      section       TEXT NOT NULL,
      title         TEXT NOT NULL,
      source_path   TEXT NOT NULL UNIQUE,
      body          TEXT NOT NULL,
      minutes       INTEGER NOT NULL
    );

    CREATE VIRTUAL TABLE search_index USING fts5(
      kind UNINDEXED,
      ref UNINDEXED,
      title,
      body,
      tokenize = 'porter unicode61'
    );
  `);
}

// ---------------------------------------------------------------- lessons

function loadLessons(db) {
  const categories = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, "categories.json"), "utf8"));
  const insertCategory = db.prepare(`
    INSERT INTO categories (slug, title, tagline, description, icon, color, cover, position)
    VALUES (@slug, @title, @tagline, @description, @icon, @color, @cover, @position)`);
  const insertLesson = db.prepare(`
    INSERT INTO lessons (category_id, slug, title, summary, level, minutes, tags, body, position)
    VALUES (@categoryId, @slug, @title, @summary, @level, @minutes, @tags, @body, @position)`);
  const insertSearch = db.prepare(`INSERT INTO search_index (kind, ref, title, body) VALUES (?, ?, ?, ?)`);

  let lessonCount = 0;
  categories.forEach((category, index) => {
    const { lastInsertRowid: categoryId } = insertCategory.run({ ...category, cover: category.cover ?? null, position: index + 1 });

    const dir = path.join(CONTENT_DIR, category.slug);
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
    for (const file of files) {
      const match = file.match(/^(\d+)-(.+)\.md$/);
      if (!match) throw new Error(`Lesson file must look like "01-some-slug.md": ${category.slug}/${file}`);
      const [, position, slug] = match;
      let parsed;
      try {
        parsed = matter(fs.readFileSync(path.join(dir, file), "utf8"));
      } catch (error) {
        throw new Error(`Invalid frontmatter in ${category.slug}/${file}: ${error.reason ?? error.message}`);
      }
      const { data, content } = parsed;
      for (const field of ["title", "summary", "level"]) {
        if (!data[field]) throw new Error(`Missing "${field}" in frontmatter of ${category.slug}/${file}`);
      }
      insertLesson.run({
        categoryId,
        slug,
        title: data.title,
        summary: data.summary,
        level: data.level,
        minutes: readMinutes(content),
        tags: JSON.stringify(data.tags ?? []),
        body: content.trim(),
        position: Number(position),
      });
      insertSearch.run("lesson", `${category.slug}/${slug}`, data.title, `${data.summary}\n${content}`);
      lessonCount++;
    }
  });
  return { categories: categories.length, lessons: lessonCount };
}

// ---------------------------------------------------------------- library

// "Backend-guru/System Design/04-caching/x.md" -> "System Design: Caching"
function systemDesignSection(relPath) {
  const folder = relPath.split("/")[2];
  if (!folder || folder.endsWith(".md")) return "System Design";
  const words = folder.replace(/^\d+-/, "").split("-");
  return `System Design: ${words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")}`;
}

// First matching rule wins. `category` links a section to one of the lesson categories;
// the section is a label or a function of the path.
const LIBRARY_RULES = [
  [/^Principles\/solid\//, "solid", "SOLID"],
  [/^Principles\/Design Pattern\//, "design-patterns", "Design Patterns"],
  [/^Principles\/DSA\//, "dsa", "DSA Problems"],
  [/^PDFS\/(problem1|moreproblems)\.md$/, "dsa", "DSA Problems"],
  [/^Principles\/(CLEAN-CODE|clean-code-architecture)/, "software-architecture", "Clean Architecture"],
  [/^Backend-guru\/Architecture Patterns\//, "software-architecture", "Architecture Patterns"],
  [/^Frontend-guru\/(Frontend-Arthitecture|Architecture & Scalable Frontend Systems)\//, "software-architecture", "Frontend Architecture"],
  [/^Principles\/(Code Refactoring|OOP)/, "clean-code", "Clean Code & Refactoring"],
  [/^Microservices\//, "microservices", "Microservices"],
  [/kafka|MessageBroker/i, "kafka", "Kafka & Message Brokers"],
  [/^(DevOps\/Kubernetes|Backend-guru\/Kubernetes)/, "kubernetes", "Kubernetes"],
  [/^Backend-guru\/System Design\//, "backend", systemDesignSection],
  [/^System Design L6\//, "backend", "System Design"],
  [/^Architectural concepts\//, "backend", "System Design"],
  [/^Backend-guru\/Interview\//, "backend", "Backend Interview"],
  [/^Backend-guru\//, "backend", "Backend Guru"],
  [/^(Database|PDFS)\//, "backend", "Databases & SQL"],
  [/^DevOps\//, "backend", "DevOps & Cloud"],
  [/^Languages\/(TypeScript|JavaScript Concepts)\//, "frontend", "JavaScript & TypeScript"],
  [/^Languages\//, "backend", "Backend Languages"],
  [/^Frontend-guru\/Questions\//, "frontend", "Frontend Interview"],
  [/^Frontend-guru\//, "frontend", "Frontend Guru"],
  [/^(React|React-19|Redux|VueJs)\//, "frontend", "Frameworks"],
  [/^AI\//, null, "AI Engineering"],
  [/^interview-questions\//, null, "Interview Questions"],
  [/.*/, null, "General"],
];

const MIN_LIBRARY_BYTES = 800; // skips boilerplate READMEs from demo apps

function walkMarkdown(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkMarkdown(full, base, out);
    else if (entry.name.toLowerCase().endsWith(".md") && fs.statSync(full).size >= MIN_LIBRARY_BYTES) {
      out.push(path.relative(base, full).split(path.sep).join("/"));
    }
  }
  return out;
}

function titleFor(relPath, body) {
  const withoutCode = body.replace(/^(```|~~~)[\s\S]*?^\1/gm, "");
  const heading = withoutCode.match(/^#\s+(.+)$/m)?.[1];
  if (heading) return heading.replace(/[*_`]/g, "").trim();
  const parts = relPath.split("/");
  const name = parts.at(-1).replace(/\.md$/i, "");
  return /^readme$/i.test(name) ? parts.at(-2) ?? "Readme" : name.replace(/[-_]/g, " ");
}

// Copies images referenced with relative paths into /public/library and links
// between notes to their /library/<id> pages.
function rewriteRelativeLinks(body, relPath, idByPath) {
  const fileDir = path.posix.dirname(relPath);
  return body.replace(/(!?)\[([^\]]*)\]\(([^)\s]+)([^)]*)\)/g, (whole, bang, text, target, rest) => {
    if (/^(https?:|mailto:|#|\/)/.test(target)) return whole;
    const [targetPath, hash = ""] = target.split("#");
    let resolved;
    try {
      resolved = path.posix.normalize(path.posix.join(fileDir, decodeURIComponent(targetPath)));
    } catch {
      return whole;
    }
    if (bang) {
      const source = path.join(THEORETICAL_DIR, resolved);
      if (!fs.existsSync(source)) return whole;
      const ext = path.extname(resolved);
      const name = crypto.createHash("sha1").update(resolved).digest("hex").slice(0, 12) + ext;
      fs.copyFileSync(source, path.join(LIBRARY_PUBLIC_DIR, name));
      return `![${text}](/library/${name}${rest})`;
    }
    const id = idByPath.get(resolved) ?? idByPath.get(`${resolved}/readme.md`) ?? idByPath.get(`${resolved}/README.md`);
    return id ? `[${text}](/library/${id}${hash ? `#${hash}` : ""})` : whole;
  });
}

function loadLibrary(db) {
  if (!fs.existsSync(THEORETICAL_DIR)) {
    console.warn(`! Theoretical folder not found at ${THEORETICAL_DIR}; skipping library.`);
    return 0;
  }
  fs.rmSync(LIBRARY_PUBLIC_DIR, { recursive: true, force: true });
  fs.mkdirSync(LIBRARY_PUBLIC_DIR, { recursive: true });

  const files = walkMarkdown(THEORETICAL_DIR).sort();
  const idByPath = new Map(files.map((file, i) => [file, i + 1]));
  const insertDoc = db.prepare(`
    INSERT INTO library_docs (id, category_slug, section, title, source_path, body, minutes)
    VALUES (@id, @category, @section, @title, @sourcePath, @body, @minutes)`);
  const insertSearch = db.prepare(`INSERT INTO search_index (kind, ref, title, body) VALUES ('library', ?, ?, ?)`);

  for (const relPath of files) {
    const raw = fs.readFileSync(path.join(THEORETICAL_DIR, relPath), "utf8");
    const body = rewriteRelativeLinks(raw, relPath, idByPath);
    const [, category, sectionRule] = LIBRARY_RULES.find(([pattern]) => pattern.test(relPath));
    const section = typeof sectionRule === "function" ? sectionRule(relPath) : sectionRule;
    const id = idByPath.get(relPath);
    const title = titleFor(relPath, body);
    insertDoc.run({ id, category, section, title, sourcePath: relPath, body, minutes: readMinutes(body) });
    insertSearch.run(String(id), title, body);
  }
  return files.length;
}

// ---------------------------------------------------------------- main

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const tmpPath = `${DB_PATH}.tmp`;
fs.rmSync(tmpPath, { force: true });

const db = new Database(tmpPath);
db.pragma("journal_mode = DELETE");
createSchema(db);
const counts = db.transaction(() => ({ ...loadLessons(db), library: loadLibrary(db) }))();
db.exec("INSERT INTO search_index(search_index) VALUES ('optimize')");
db.close();

// Swap in the new database in one step so a running dev server never sees a half-built file.
try {
  fs.renameSync(tmpPath, DB_PATH);
} catch (error) {
  console.error(`✗ Could not replace ${DB_PATH} (${error.code}). Stop the running "next start" server and seed again.`);
  process.exit(1);
}
console.log(`✓ Seeded ${path.relative(ROOT, DB_PATH)}: ${counts.categories} categories, ${counts.lessons} lessons, ${counts.library} library notes`);
