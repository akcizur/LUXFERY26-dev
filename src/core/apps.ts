export type AppKind = "internal" | "external";
export type AppCategory = "AI" | "Internet" | "Development" | "Design" | "Media" | "System";

export type AppDefinition = {
  id: string;
  name: string;
  icon: string;
  category: AppCategory;
  kind: AppKind;
  url?: string;
  description?: string;
  defaultWidth: number;
  defaultHeight: number;
};

export const apps: AppDefinition[] = [
  { id: "explorer", name: "Tento počítač", icon: "🖥️", category: "System", kind: "internal", description: "Virtuální C:\\ a složky LUXFERY.", defaultWidth: 820, defaultHeight: 560 },
  { id: "notepad", name: "Poznámkový blok", icon: "📝", category: "System", kind: "internal", description: "Jednoduchý textový editor.", defaultWidth: 680, defaultHeight: 460 },
  { id: "calculator", name: "Kalkulačka", icon: "🧮", category: "System", kind: "internal", description: "Kalkulačka LUXFERY.", defaultWidth: 420, defaultHeight: 430 },
  { id: "paint", name: "Malování", icon: "🎨", category: "System", kind: "internal", description: "Pixelové kreslení.", defaultWidth: 760, defaultHeight: 520 },
  { id: "minesweeper", name: "Hledání min", icon: "💣", category: "System", kind: "internal", description: "Klasická hra.", defaultWidth: 360, defaultHeight: 430 },
  { id: "settings", name: "Ovládací panely", icon: "⚙️", category: "System", kind: "internal", description: "Nastavení desktopu.", defaultWidth: 560, defaultHeight: 480 },
  { id: "terminal", name: "LUXFERY Terminal", icon: "⌨️", category: "System", kind: "internal", description: "Simulovaný příkazový řádek.", defaultWidth: 720, defaultHeight: 460 },
  { id: "run", name: "Spustit", icon: "▶️", category: "System", kind: "internal", description: "Spustí aplikaci podle názvu nebo ID.", defaultWidth: 520, defaultHeight: 240 },

  { id: "chatgpt", name: "ChatGPT", icon: "💬", category: "AI", kind: "external", url: "https://chatgpt.com/", description: "Otevře ChatGPT v novém tabu.", defaultWidth: 1000, defaultHeight: 700 },
  { id: "google", name: "Google", icon: "🌐", category: "Internet", kind: "external", url: "https://www.google.com/", description: "Otevře Google.", defaultWidth: 1000, defaultHeight: 700 },
  { id: "indian-tv", name: "Indian TV", icon: "📺", category: "Media", kind: "external", url: "https://indian-tv.cz/", description: "Otevře Indian-TV.cz.", defaultWidth: 1000, defaultHeight: 720 },
  { id: "youtube", name: "YouTube", icon: "▶️", category: "Media", kind: "external", url: "https://www.youtube.com/", description: "Otevře YouTube.", defaultWidth: 1000, defaultHeight: 680 },
  { id: "figma", name: "Figma", icon: "🎨", category: "Design", kind: "external", url: "https://www.figma.com/", description: "Otevře Figma.", defaultWidth: 1100, defaultHeight: 760 },
  { id: "codepen", name: "CodePen", icon: "✒️", category: "Development", kind: "external", url: "https://codepen.io/", description: "Otevře CodePen.", defaultWidth: 1100, defaultHeight: 760 },
  { id: "vscode", name: "VS Code", icon: "💻", category: "Development", kind: "external", url: "https://vscode.dev/", description: "Otevře VS Code v prohlížeči.", defaultWidth: 1200, defaultHeight: 800 },
  { id: "github", name: "GitHub", icon: "🐙", category: "Development", kind: "external", url: "https://github.com/", description: "Otevře GitHub.", defaultWidth: 1100, defaultHeight: 760 },
];

export const appMap = new Map(apps.map((app) => [app.id, app]));

export const categories: AppCategory[] = ["AI", "Internet", "Development", "Design", "Media", "System"];
