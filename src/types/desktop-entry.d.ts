import type { AppCategory } from "../core/apps";

declare global {
  interface Object {
    appId?: string;
    category?: AppCategory;
  }
}

export {};
