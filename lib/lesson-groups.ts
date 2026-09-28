import type { LessonSummary } from "@/lib/db";

export interface LessonGroup {
  title: string;
  description: string;
  lessons: LessonSummary[];
}

type GroupDefinition = { title: string; description: string; positions: readonly number[] };

const groupedCategories: Record<string, readonly GroupDefinition[]> = {
  "system-design-l6": [
    { title: "Start Here", description: "The learning loop and a repeatable interview framework.", positions: [1, 12] },
    { title: "Core System Design Concepts", description: "Capacity, traffic, APIs, data, caching and communication building blocks.", positions: [7, 8, 10, 11, 23, 24, 25, 26] },
    { title: "Distributed Reliability", description: "Correctness, coordination, overload control, time and scale-oriented data structures.", positions: [2, 3, 6, 9, 27, 28] },
    { title: "Architecture and Operations", description: "Choose system shapes, analytical platforms and safe production releases.", positions: [19, 29, 30] },
    { title: "Case Studies", description: "Apply the concepts to real production-style design problems.", positions: [4, 5, 13, 14, 15, 16, 17, 18, 20, 21, 22] },
  ],
  databases: [
    { title: "Database Design & Performance", description: "Relations, normalization, transactions, indexes, query performance and scaling.", positions: [1, 2, 3, 4, 5, 6, 7] },
    { title: "Database Interview Prep", description: "Thirty DBMS interview questions with detailed answers and SQL practice.", positions: [8, 9, 10, 11, 12] },
  ],
};

export function groupLessons(categorySlug: string, lessons: LessonSummary[]): LessonGroup[] {
  const definitions = groupedCategories[categorySlug];
  if (!definitions) return [{ title: "Lessons", description: "", lessons }];
  const byPosition = new Map(lessons.map((lesson) => [lesson.position, lesson]));
  return definitions.map((group) => ({
    title: group.title,
    description: group.description,
    lessons: group.positions.flatMap((position) => {
      const lesson = byPosition.get(position);
      return lesson ? [lesson] : [];
    }),
  })).filter((group) => group.lessons.length > 0);
}
