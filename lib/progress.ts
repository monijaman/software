"use client";

import { useSyncExternalStore } from "react";

// Finished lessons are a per-browser convenience, so localStorage is enough.
const KEY = "completed-lessons";
const EVENT = "completed-lessons-change";
const EMPTY: string[] = [];

let cachedRaw: string | null = null;
let cachedList: string[] = EMPTY;

function read(): string[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {}
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedList = raw ? (JSON.parse(raw) as string[]) : EMPTY;
    } catch {
      cachedList = EMPTY;
    }
  }
  return cachedList;
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useCompletedLessons(): string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function setLessonCompleted(key: string, done: boolean) {
  const next = new Set(read());
  if (done) next.add(key);
  else next.delete(key);
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}
