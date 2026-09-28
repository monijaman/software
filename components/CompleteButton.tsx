"use client";

import { setLessonCompleted, useCompletedLessons } from "@/lib/progress";

export default function CompleteButton({ lessonKey }: { lessonKey: string }) {
  const done = useCompletedLessons().includes(lessonKey);
  return (
    <button
      className={`complete-button ${done ? "is-done" : ""}`}
      onClick={() => setLessonCompleted(lessonKey, !done)}
      aria-pressed={done}
    >
      {done ? "✓ Completed" : "Mark as completed"}
    </button>
  );
}

export function DoneMark({ lessonKey }: { lessonKey: string }) {
  const done = useCompletedLessons().includes(lessonKey);
  return done ? <span className="done-mark" title="Completed">✓</span> : null;
}
