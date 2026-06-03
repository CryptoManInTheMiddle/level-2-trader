import { create } from 'zustand';
import type { ScenarioName } from '../sim/types';

// Cross-tab navigation intent: which lesson is open, and any "see it live"
// focus the Book tab should apply (load a scenario, pop a coach popover).

export type BookFocus = { scenario?: ScenarioName; term?: string } | null;

type UiStore = {
  activeLessonId: string | null;
  lessonStep: number;
  bookFocus: BookFocus;
  openLesson: (id: string) => void;
  closeLesson: () => void;
  setLessonStep: (n: number) => void;
  focusBook: (focus: NonNullable<BookFocus>) => void;
  clearBookFocus: () => void;
};

export const useUiStore = create<UiStore>((set) => ({
  activeLessonId: null,
  lessonStep: 0,
  bookFocus: null,

  openLesson: (id) => set({ activeLessonId: id, lessonStep: 0 }),
  closeLesson: () => set({ activeLessonId: null, lessonStep: 0 }),
  setLessonStep: (n) => set({ lessonStep: n }),
  focusBook: (focus) => set({ bookFocus: focus }),
  clearBookFocus: () => set({ bookFocus: null }),
}));
