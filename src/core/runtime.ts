export type Theme = "classic" | "high-contrast" | "dark";
export type WallpaperMode = "tile" | "center" | "stretch";

export type DesktopSettings = {
  theme: Theme;
  wallpaper: string;
  wallpaperMode: WallpaperMode;
  taskbarPosition: "bottom" | "top" | "left" | "right";
  taskbarAutoHide: boolean;
  taskbarAlwaysOnTop: boolean;
  showDesktopIcons: boolean;
  showSmallIcons: boolean;
  reduceMotion: boolean;
  soundEnabled: boolean;
  language: "cs" | "en" | "de";
};

export type Registry = {
  HKCU: {
    Desktop: {
      settings: DesktopSettings;
      iconPositions: Record<string, {x:number;y:number}>;
      windowPositions: Record<string, {x:number;y:number;w:number;h:number}>;
    };
    Explorer: { runMRU: string[]; recentDocs: string[]; history: string[] };
  };
  HKLM: { System: { version: string; build: string; computerName: string } };
};

export const defaultSettings: DesktopSettings = {
  theme: "classic", wallpaper: "#008080", wallpaperMode: "stretch",
  taskbarPosition: "bottom", taskbarAutoHide: false, taskbarAlwaysOnTop: true,
  showDesktopIcons: true, showSmallIcons: false, reduceMotion: false,
  soundEnabled: true, language: "cs",
};

export const defaultRegistry: Registry = {
  HKCU: { Desktop: { settings: defaultSettings, iconPositions: {}, windowPositions: {} },
    Explorer: { runMRU: [], recentDocs: [], history: [] } },
  HKLM: { System: { version: "Macroloft Luxfers 27", build: "LUXFERY 26.09.04", computerName: "LUXFERY-PC" } },
};

const REGISTRY_KEY = "luxfery26:registry";
const SESSION_KEY = "luxfery26:session";

function canUseStorage() { return typeof window !== "undefined" && !!window.localStorage; }

export function loadRegistry(): Registry {
  if (!canUseStorage()) return structuredClone(defaultRegistry);
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) return structuredClone(defaultRegistry);
    const patch = JSON.parse(raw) as Partial<Registry> & any;
    return {
      HKCU: {
        Desktop: {
          ...defaultRegistry.HKCU.Desktop, ...(patch.HKCU?.Desktop ?? {}),
          settings: { ...defaultSettings, ...(patch.HKCU?.Desktop?.settings ?? {}) },
          iconPositions: { ...(patch.HKCU?.Desktop?.iconPositions ?? {}) },
          windowPositions: { ...(patch.HKCU?.Desktop?.windowPositions ?? {}) },
        },
        Explorer: { ...defaultRegistry.HKCU.Explorer, ...(patch.HKCU?.Explorer ?? {}) },
      },
      HKLM: { System: { ...defaultRegistry.HKLM.System, ...(patch.HKLM?.System ?? {}) } },
    };
  } catch { return structuredClone(defaultRegistry); }
}

export function saveRegistry(registry: Registry) {
  if (canUseStorage()) localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
}

export function loadSession<T>(): T | null {
  if (!canUseStorage()) return null;
  try { const raw = localStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) as T : null; }
  catch { return null; }
}

export function saveSession<T>(session: T) {
  if (canUseStorage()) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export const bootSteps = [
  ["BIOS", "Kontrola paměti RAM a virtuálních disků…"],
  ["IDE", "Detekce Primary Master / Secondary Master…"],
  ["VXD", "Načítání virtuálních ovladačů…"],
  ["KERNEL32.DLL", "Inicializace virtuální paměti…"],
  ["GDI32.DLL", "Inicializace grafického subsystému…"],
  ["USER32.DLL", "Inicializace Window Manageru…"],
  ["SYSTEM.DAT", "Načítání registru…"],
  ["SYSTRAY.EXE", "Spouštění systémové lišty…"],
  ["MSTASK.EXE", "Spouštění plánovače úloh…"],
  ["EXPLORER.EXE", "Spouštění plochy…"],
] as const;
