# software: Software Academy

A Next.js + SQLite learning site with easy, picture-first lessons on software engineering, built from the notes in `../Theoretical`.

- **166 lessons** in 13 topics, each with diagrams, real-life analogies, code examples and key takeaways
- **Library** of all 178 original notes from `../Theoretical`, sorted into the same topics
- **Full-text search** (SQLite FTS5) across lessons and notes
- Home page index with live filtering, level filters and per-browser progress tracking
- Light/dark theme, mobile friendly, fully static pages (except search)

## Getting started

```bash
npm install
npm run dev      # seeds the database, then starts http://localhost:3000
```

### Deploying to the Contabo server

After pushing changes, SSH into the server and run:

```bash
cd /var/www/software
git pull
npm ci
npm run build
sudo systemctl restart software-next.service
sudo systemctl status software-next.service
# Then verify:
sudo ss -ltnp | grep ':3002'
# Port 3000 is used by the Kossti Next.js application. Do not stop it.
PORT=3002 npm start
```

Keep the `npm start` process running in that SSH terminal. From a second SSH session, verify Software on port `3001`:

```bash
curl -I http://127.0.0.1:3001
```

A successful response is an HTTP status such as `200 OK`. Configure the Software domain in Nginx or OpenLiteSpeed to reverse proxy to `http://127.0.0.1:3001`; do not proxy it to Kossti’s port `3000`.

To verify the Google tag after the proxy is live:

```bash
curl -fsS http://127.0.0.1:3001/ | grep -Eo 'googletagmanager|G-WEN0ZL81VV'
```

The expected output includes `googletagmanager` and `G-WEN0ZL81VV`.

| Script | What it does |
| --- | --- |
| `npm run seed` | Rebuilds `data/software.db` from `content/` and `../Theoretical` |
| `npm run dev` | Seed + development server |
| `npm run build` | Seed + production build (every lesson and note is pre-rendered) |
| `npm start` | Serve the production build |

Requires Node.js 22+. The library is read from `../Theoretical` by default; point elsewhere with `THEORETICAL_DIR=/path/to/notes npm run seed`. If the folder is missing, the site still works without the library.

## How it works

```text
content/categories.json ─┐
content/<topic>/*.md ────┼──► scripts/seed.mjs ──► data/software.db (SQLite) ──► Next.js pages
../Theoretical/**/*.md ──┘                            categories, lessons,
                                                      library_docs, search_index (FTS5)
```

- **`content/`**: the lessons, written in Markdown. This is the source of truth.
- **`scripts/seed.mjs`**: loads the lessons and library notes into SQLite, builds the search index, and copies images referenced by notes into `public/library/`.
- **`lib/db.ts`**: every database query the pages use (read-only).
- **`app/`**: routes: `/` (index), `/learn/[category]`, `/learn/[category]/[slug]`, `/library`, `/library/[id]`, `/search`.
- **`components/Markdown.tsx`**: renders Markdown with tables, syntax highlighting, figure captions and Mermaid diagrams (`components/Mermaid.tsx`, drawn in the browser).
- **`public/img/`**: hand-made SVG illustrations and the topic covers.

## Topics

The notes in `Theoretical` were reviewed and organised into this learning path:

| # | Topic | Lessons | Built from Theoretical |
| --- | --- | --- | --- |
| 1 | Clean Code (incl. KISS, DRY, YAGNI) | 10 | `Principles/CLEAN-CODE-Architecture`, `Code Refactoring Techniques` |
| 2 | SOLID Principles | 6 | `Principles/solid` |
| 3 | Design Patterns | 6 | `Principles/Design Pattern` |
| 4 | Software Architecture (Layered, MVC/MVVM, Clean, Hexagonal, Onion, DDD, event-driven, microkernel, serverless, vertical slices, modular monolith) | 13 | `Principles/CLEAN-CODE-Architecture`, `Backend-guru/Architecture Patterns`, `Frontend-guru/Frontend-Arthitecture` |
| 5 | Data Structures & Algorithms | 14 | `Principles/DSA`, `PDFS` problems |
| 6 | Backend Engineering | 12 | `Backend-guru`, `Database`, `DevOps/Docker`, `Languages` |
| 7 | Frontend Engineering | 11 | `Frontend-guru`, `React`, `Redux`, `VueJs`, `Languages/TypeScript` |
| 8 | Microservices | 8 | `Microservices`, `Backend-guru/System Design` |
| 9 | Apache Kafka | 7 | `MessageBroker.md`, `kafka-like-message-broker.md` |
| 10 | Kubernetes | 8 | `DevOps/Kubernetes`, `Kubernetes + Observability` |
| 11 | AWS for Developers (IAM, VPC, EC2, ELB, Route 53, S3, CloudFront, ECS, RDS, DynamoDB, Lambda, messaging, security, observability, CI/CD, data pipelines, interview prep) | 16 | `DevOps/AWS` |
| 12 | Programming Languages (JavaScript, TypeScript, Node.js & Express, NestJS, Python, FastAPI & Django, Go, Gin, Rust) | 13 | `Languages` |

The folder-to-topic mapping for the library lives in `LIBRARY_RULES` in `scripts/seed.mjs`.

## Adding or editing a lesson

1. Create `content/<topic>/NN-some-slug.md`. The number sets the order; the rest becomes the URL.
2. Add the frontmatter. Quote any value that contains `: `.

   ```markdown
   ---
   title: My New Lesson
   summary: "One or two sentences shown on cards and in search results."
   level: Beginner            # Beginner | Intermediate | Advanced
   tags: [kafka, streaming]
   ---
   ```

3. Write the lesson in Markdown. You can use:
   - Images: `![Caption shown under the image](/img/<topic>/picture.svg)`
   - Diagrams: a fenced code block with the language `mermaid`
   - Tables, `> 💡 callouts`, code blocks, and `<details><summary>Answer</summary>…</details>`
4. Run `npm run seed` (or restart `npm run dev`).

Reading time is calculated automatically. To add a whole new topic, add an entry to `content/categories.json` and create its folder.

### Mermaid tips

If a diagram shows "Diagram could not be drawn", the page displays Mermaid's error message. Common causes:

- `;` inside a message ends the statement: use commas.
- Some words are keywords (`end`, `off`): rename the node or participant.
- Use `#lt;` / `#gt;` instead of `<` / `>` inside labels.
- When you colour a node with `classDef`, also set `color:` so the text stays readable in dark mode.
