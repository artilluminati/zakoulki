"use client";

import { useSyncExternalStore } from "react";

export interface ScoreState { score: number; my_vote: number; }

const cache = new Map<string, ScoreState>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Единое состояние голосов: стрелки одного треда/ответа везде одинаковые. */
export function readScore(key: string, fb: ScoreState): ScoreState {
  return cache.get(key) ?? fb;
}

export function writeScore(key: string, v: ScoreState) {
  cache.set(key, v);
  emit();
}

export function useScore(key: string, fb: ScoreState): ScoreState {
  return useSyncExternalStore(
    subscribe,
    () => cache.get(key) ?? fb,
    () => cache.get(key) ?? fb
  );
}
