import type { LessonSummary } from "@/lib/db";

export interface LessonGroup {
  title: string;
  description: string;
  lessons: LessonSummary[];
}

type GroupDefinition = { title: string; description: string; positions: readonly number[] };

const groupedCategories: Record<string, readonly GroupDefinition[]> = {
  "system-design-l6": [
    { title: "Start Here: Learn the STAR Method", description: "Define the situation and task, explain your actions, then validate the result.", positions: [1, 12, 39] },
    { title: "Core Concepts Through Worked Scenarios", description: "Connect capacity, caching, networking and data choices to concrete user requirements.", positions: [7, 33, 8, 10, 11, 23, 24, 25, 26, 40, 38] },
    { title: "Reliability: Failure and Recovery", description: "Walk through retries, overload, coordination and regional failures without losing correctness.", positions: [2, 3, 34, 6, 35, 9, 27, 28, 36, 37] },
    { title: "Architecture and Operations", description: "Use measurable outcomes to choose boundaries, analytical pipelines and safe releases.", positions: [19, 29, 30] },
    { title: "STAR Case Studies", description: "Follow a user scenario from requirements through normal requests, failures, recovery and validation.", positions: [4, 5, 13, 14, 15, 16, 17, 18, 20, 21, 22, 31, 32] },
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
