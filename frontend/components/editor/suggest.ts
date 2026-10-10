import type { MutableRefObject } from "react";

/** Контроллер меню-подсказки для клавиатурной навигации из textarea.
 * Вниз — следующий, вверх — предыдущий (на первом закрывает, как Esc), Enter — выбрать. */
export interface SuggestCtl {
  move(d: 1 | -1): void;
  peek(): number;
  count(): number;
  enter(): boolean;
}

export type SuggestCtlRef = MutableRefObject<SuggestCtl | null>;
