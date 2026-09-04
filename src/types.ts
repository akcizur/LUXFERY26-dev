export type AppId =
  | "explorer" | "notepad" | "calculator" | "paint" | "minesweeper" | "system"
  | "taskmgr" | "run" | "cmd" | "browser" | "winamp" | "solitaire" | "about";

export type WindowState = {
  id: number; app: AppId; title: string;
  x: number; y: number; w: number; h: number;
  minimized: boolean; maximized: boolean; alwaysOnTop: boolean; toolWindow?: boolean;
};
