import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { bootSteps, loadRegistry, loadSession, saveRegistry, saveSession } from "./core/runtime";
import type { DesktopSettings, Registry } from "./core/runtime";
import { appMap, apps, categories, type AppCategory, type AppDefinition } from "./core/apps";
import { WindowFrame, type ManagedWindow } from "./desktop/WindowManager";

type FsNode = { name: string; type: "folder" | "file"; size?: string; ext?: string; children?: FsNode[] };
type ShellWindow = ManagedWindow & { appId: string };
type SessionState = { windows: ShellWindow[]; nextZ: number };

const initialFs: FsNode = {
  name: "C:\\",
  type: "folder",
  children: [
    { name: "Windows", type: "folder", children: [{ name: "Media", type: "folder", children: [{ name: "startup.wav", type: "file", size: "12 KB", ext: ".wav" }, { name: "chord.wav", type: "file", size: "8 KB", ext: ".wav" }] }] },
    { name: "Program Files", type: "folder", children: [] },
    { name: "My Documents", type: "folder", children: [{ name: "WELCOME.TXT", type: "file", size: "2 KB", ext: ".txt" }, { name: "NOTES.TXT", type: "file", size: "1 KB", ext: ".txt" }] },
    { name: "Desktop", type: "folder", children: [] },
    { name: "Downloads", type: "folder", children: [] },
    { name: "Temp", type: "folder", children: [] },
    { name: "Recycled", type: "folder", children: [] },
  ],
};

const desktopDefaults: { id: string; appId?: string; category?: AppCategory; label: string; icon: string }[] = [
  { id: "my-computer", appId: "explorer", label: "Tento počítač", icon: "🖥️" },
  { id: "chatgpt", appId: "chatgpt", label: "ChatGPT", icon: "💬" },
  { id: "figma", appId: "figma", label: "Figma", icon: "🎨" },
  { id: "vscode", appId: "vscode", label: "VS Code", icon: "💻" },
  { id: "internet", category: "Internet", label: "Internet", icon: "🌐" },
  { id: "development", category: "Development", label: "Development", icon: "📁" },
  { id: "design", category: "Design", label: "Design", icon: "📁" },
  { id: "media", category: "Media", label: "Media", icon: "📁" },
  { id: "system", category: "System", label: "System", icon: "📁" },
];

function Button({ children, onClick, className = "", disabled = false }: { children: ReactNode; onClick?: () => void; className?: string; disabled?: boolean }) {
  return <button className={`win-btn ${className}`} disabled={disabled} onClick={onClick}>{children}</button>;
}

function BootScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setStep((v) => Math.min(v + 1, bootSteps.length)), 150);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (step >= bootSteps.length) {
      const timer = window.setTimeout(onDone, 450);
      return () => window.clearTimeout(timer);
    }
  }, [step, onDone]);
  const pct = Math.round((step / bootSteps.length) * 100);
  return (
    <div className="boot-screen">
      <div className="boot-logo">Macroloft <b>LUXFERY 26</b></div>
      <div className="boot-panel">
        <b>LUXFERY 26 BIOS</b>
        {bootSteps.slice(0, step).map(([name, message]) => <div key={name} className="boot-ok">[OK] {name} — {message}</div>)}
        {step < bootSteps.length && <div>[....] {bootSteps[step][0]} — {bootSteps[step][1]}</div>}
        <div className="boot-progress"><i style={{ width: `${pct}%` }} /></div>
        <div className="boot-pct">{pct}%</div>
      </div>
    </div>
  );
}

function MenuBar({ items }: { items: string[] }) {
  return <div className="menu" role="menubar">{items.map((item) => <button key={item} className="menu-trigger">{item}</button>)}</div>;
}

function Explorer({ initialPath = "C:\\", onOpenApp }: { initialPath?: string; onOpenApp: (appId: string) => void }) {
  const [path, setPath] = useState(initialPath);
  const [query, setQuery] = useState("");
  const [details, setDetails] = useState(false);
  const find = (value: string): FsNode => {
    let node = initialFs;
    const parts = value.replace("C:\\", "").split("\\").filter(Boolean);
    for (const part of parts) node = (node.children ?? []).find((child) => child.name === part) ?? node;
    return node;
  };
  const current = find(path);
  const items = (current.children ?? []).filter((item) => item.name.toLowerCase().includes(query.toLowerCase()));
  const openNode = (node: FsNode) => { if (node.type === "folder") setPath(path === "C:\\" ? `C:\\${node.name}` : `${path}\\${node.name}`); };
  return (
    <div className="app-fill">
      <MenuBar items={["Soubor", "Úpravy", "Zobrazit", "Nástroje", "Nápověda"]} />
      <div className="toolbar">
        <Button onClick={() => setPath("C:\\")}>←</Button>
        <Button onClick={() => setPath(path.includes("\\") ? path.split("\\").slice(0, -1).join("\\") || "C:\\" : "C:\\")}>↑</Button>
        <input className="sunken path" value={path} onChange={(event) => setPath(event.target.value)} />
        <input className="sunken search" placeholder="Hledat" value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="explorer">
        <div className="tree sunken"><button onClick={() => setPath("C:\\")}>▣ C:\</button>{(initialFs.children ?? []).map((item) => <button key={item.name} onClick={() => item.type === "folder" && setPath(`C:\\${item.name}`)}>📁 {item.name}</button>)}</div>
        <div className="files sunken">
          {details ? <table><thead><tr><th>Název</th><th>Velikost</th><th>Typ</th></tr></thead><tbody>{items.map((item) => <tr key={item.name} onDoubleClick={() => openNode(item)}><td>{item.type === "folder" ? "📁" : "📄"} {item.name}</td><td>{item.size ?? ""}</td><td>{item.ext ?? "Složka"}</td></tr>)}</tbody></table> : <div className="icons">{items.map((item) => <button className="file-icon" key={item.name} onDoubleClick={() => openNode(item)}><span>{item.type === "folder" ? "📁" : "📄"}</span><b>{item.name}</b></button>)}</div>}
        </div>
      </div>
      <div className="status">Počet položek: {items.length}<span /><Button onClick={() => setDetails(!details)}>{details ? "Ikony" : "Podrobnosti"}</Button></div>
      <div className="explorer-hint">Kategorie aplikací jsou dostupné přes Start → Programs nebo ikony na ploše.</div>
      <button className="hidden-launch" onClick={() => onOpenApp("explorer")} aria-hidden="true" tabIndex={-1} />
    </div>
  );
}

function Notepad() {
  const [text, setText] = useState("Vítejte v LUXFERY 26.\n\nWindows 98, ale běží v roce 2026.");
  const [wrap, setWrap] = useState(true);
  return <div className="app-fill"><MenuBar items={["Soubor", "Úpravy", "Hledat", "Formát", "Nápověda"]} /><div className="toolbar"><Button onClick={() => setText("")}>Nový</Button><Button onClick={() => navigator.clipboard?.writeText(text)}>Kopírovat</Button><Button onClick={() => setWrap(!wrap)}>Zalamování: {wrap ? "Ano" : "Ne"}</Button></div><textarea className="editor sunken" value={text} onChange={(event) => setText(event.target.value)} style={{ whiteSpace: wrap ? "pre-wrap" : "pre" }} /><div className="status">Řádky: {text.split("\n").length}<span />Znaky: {text.length}<span />UTF-8</div></div>;
}

function Calculator() {
  const [value, setValue] = useState("0");
  const [accumulator, setAccumulator] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const digit = (digitValue: string) => setValue((prev) => prev === "0" && digitValue !== "." ? digitValue : prev + digitValue);
  const calculate = () => {
    if (accumulator === null || !operator) return;
    const b = Number(value);
    const result = operator === "+" ? accumulator + b : operator === "-" ? accumulator - b : operator === "*" ? accumulator * b : b === 0 ? NaN : accumulator / b;
    setValue(Number.isFinite(result) ? String(result) : "Error");
    setAccumulator(null); setOperator(null);
  };
  const chooseOperator = (op: string) => { setAccumulator(Number(value)); setOperator(op); setValue("0"); };
  const keys = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "=", "+"];
  return <div className="calc"><div className="lcd">{value}</div><div className="calc-grid">{keys.map((key) => <Button key={key} onClick={() => key === "=" ? calculate() : "+-*/".includes(key) ? chooseOperator(key) : digit(key)}>{key}</Button>)}<Button onClick={() => { setValue("0"); setAccumulator(null); setOperator(null); }}>C</Button><Button onClick={() => setValue(String(Math.sqrt(Number(value))))}>√</Button><Button onClick={() => setValue(String(Number(value) * Number(value)))}>x²</Button></div></div>;
}

function Paint() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  useEffect(() => { const context = canvas.current?.getContext("2d"); if (context && canvas.current) { context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.current.width, canvas.current.height); } }, []);
  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => { if (!drawing || !canvas.current) return; const rect = canvas.current.getBoundingClientRect(); const context = canvas.current.getContext("2d"); if (!context) return; context.fillStyle = "#000"; context.fillRect(Math.floor((event.clientX - rect.left) * (640 / rect.width)), Math.floor((event.clientY - rect.top) * (360 / rect.height)), 4, 4); };
  return <div className="app-fill"><MenuBar items={["Soubor", "Úpravy", "Zobrazit", "Obraz", "Barvy", "Nápověda"]} /><div className="paint"><aside>{["✎", "🖌", "▣", "◩", "⌕", "T", "／", "▭", "○"].map((tool) => <button className="tool" key={tool}>{tool}</button>)}</aside><div className="canvas sunken"><canvas ref={canvas} width="640" height="360" onPointerDown={() => setDrawing(true)} onPointerUp={() => setDrawing(false)} onPointerLeave={() => setDrawing(false)} onPointerMove={draw} /></div></div></div>;
}

function Minesweeper() {
  const make = () => Array.from({ length: 81 }, (_, index) => ({ index, mine: [3, 8, 11, 22, 35, 46, 57, 61, 70, 76].includes(index), open: false, flag: false }));
  const [cells, setCells] = useState(make);
  const [status, setStatus] = useState("HRA");
  const [time, setTime] = useState(0);
  useEffect(() => { if (status !== "HRA") return; const timer = window.setInterval(() => setTime((v) => v + 1), 1000); return () => window.clearInterval(timer); }, [status]);
  const click = (index: number) => { if (cells[index].flag || cells[index].open || status !== "HRA") return; const next = [...cells]; next[index] = { ...next[index], open: true }; setCells(next); if (next[index].mine) { setCells(next.map((cell) => ({ ...cell, open: cell.open || cell.mine }))); setStatus("PROHRA"); } else if (next.filter((cell) => !cell.mine && !cell.open).length === 0) setStatus("VÝHRA"); };
  return <div className="mine"><div className="mine-head">💣 10 <button onClick={() => { setCells(make()); setStatus("HRA"); setTime(0); }}>🙂</button> ⏱ {time}</div><div className="mine-grid">{cells.map((cell) => <button key={cell.index} className={`mine-cell ${cell.open ? "open" : ""}`} onClick={() => click(cell.index)} onContextMenu={(event) => { event.preventDefault(); const next = [...cells]; next[cell.index] = { ...next[cell.index], flag: !next[cell.index].flag }; setCells(next); }}>{cell.open ? cell.mine ? "💣" : "" : cell.flag ? "🚩" : ""}</button>)}</div><div className="status">{status}</div></div>;
}

function Terminal({ onLaunch }: { onLaunch: (id: string) => void }) {
  const [lines, setLines] = useState(["LUXFERY 26 Terminal [Version 26.09]", "Napište 'help' pro seznam příkazů."]);
  const [input, setInput] = useState("");
  const execute = () => { const command = input.trim(); if (!command) return; const lower = command.toLowerCase(); const output = lower === "help" ? "help, dir, ver, cls, echo <text>, open <app>, about" : lower === "dir" ? apps.map((app) => app.id).join("  ") : lower === "ver" ? "LUXFERY 26 virtual OS" : lower === "about" ? "Browser OS shell / LUXFERY 26" : lower === "cls" ? "" : lower.startsWith("echo ") ? command.slice(5) : lower.startsWith("open ") ? (appMap.has(lower.slice(5)) ? (onLaunch(lower.slice(5)), "Spouštím…") : "Aplikace nebyla nalezena.") : "Neznámý příkaz."; setLines((prev) => lower === "cls" ? [] : [...prev, `C:\\LUXFERY>${command}`, output]); setInput(""); };
  return <div className="terminal"><div className="terminal-output">{lines.map((line, index) => <div key={`${index}-${line}`}>{line}</div>)}</div><div className="terminal-input"><span>C:\\LUXFERY&gt;</span><input autoFocus value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && execute()} /></div></div>;
}

function Settings({ settings, onChange }: { settings: DesktopSettings; onChange: (patch: Partial<DesktopSettings>) => void }) {
  return <div className="app-fill control"><MenuBar items={["Soubor", "Úpravy", "Zobrazit", "Nápověda"]} /><h3>Ovládací panely</h3><div className="settings-grid"><label>Téma<select value={settings.theme} onChange={(event) => onChange({ theme: event.target.value as DesktopSettings["theme"] })}><option value="classic">Classic</option><option value="dark">Dark</option><option value="high-contrast">High contrast</option></select></label><label>Poloha taskbaru<select value={settings.taskbarPosition} onChange={(event) => onChange({ taskbarPosition: event.target.value as DesktopSettings["taskbarPosition"] })}><option value="bottom">Dole</option><option value="top">Nahoře</option></select></label><label className="check"><input type="checkbox" checked={settings.reduceMotion} onChange={(event) => onChange({ reduceMotion: event.target.checked })} /> Omezit pohyb</label><label className="check"><input type="checkbox" checked={settings.soundEnabled} onChange={(event) => onChange({ soundEnabled: event.target.checked })} /> Systémové zvuky</label></div><p>Retro pozadí je řízeno samostatnou vrstvou a respektuje nastavení desktopu.</p></div>;
}

function ExternalApp({ app }: { app: AppDefinition }) {
  const [opened, setOpened] = useState(false);
  useEffect(() => { if (app.url && !opened) { const win = window.open(app.url, "_blank", "noopener,noreferrer"); if (win) setOpened(true); } }, [app.url, opened]);
  return <div className="external-launcher"><div className="external-icon">{app.icon}</div><h3>{app.name}</h3><p>{app.description}</p><p className="external-url">{app.url}</p><Button onClick={() => app.url && window.open(app.url, "_blank", "noopener,noreferrer")}>Otevřít web</Button><p className="external-note">Tato služba se otevře v novém panelu prohlížeče. Web může z bezpečnostních důvodů zakázat vložení do iframe.</p></div>;
}

function CategoryView({ category, onLaunch }: { category: AppCategory; onLaunch: (id: string) => void }) {
  const entries = apps.filter((app) => app.category === category);
  return <div className="app-fill"><MenuBar items={["Soubor", "Zobrazit", "Nápověda"]} /><div className="category-title">{category}</div><div className="icons category-icons">{entries.map((app) => <button className="file-icon" key={app.id} onDoubleClick={() => onLaunch(app.id)} onClick={() => onLaunch(app.id)}><span>{app.icon}</span><b>{app.name}</b></button>)}</div></div>;
}

function App() {
  const [booting, setBooting] = useState(true);
  const [registry, setRegistry] = useState<Registry>(() => loadRegistry());
  const [windows, setWindows] = useState<ShellWindow[]>(() => loadSession<SessionState>()?.windows ?? []);
  const [nextZ, setNextZ] = useState(() => loadSession<SessionState>()?.nextZ ?? 20);
  const [activeId, setActiveId] = useState<string | null>(() => {
    const saved = loadSession<SessionState>();
    return saved?.windows.find((windowData) => !windowData.minimized)?.id ?? null;
  });
  const [startOpen, setStartOpen] = useState(false);
  const [allProgramsOpen, setAllProgramsOpen] = useState(false);
  const [clock, setClock] = useState(new Date());
  const [desktopMenu, setDesktopMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => { const timer = window.setInterval(() => setClock(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => saveRegistry(registry), [registry]);
  useEffect(() => saveSession<SessionState>({ windows, nextZ }), [windows, nextZ]);

  const settings = registry.HKCU.Desktop.settings;
  const updateSettings = useCallback((patch: Partial<DesktopSettings>) => setRegistry((current) => ({ ...current, HKCU: { ...current.HKCU, Desktop: { ...current.HKCU.Desktop, settings: { ...current.HKCU.Desktop.settings, ...patch } } } })), []);

  const focusWindow = useCallback((id: string) => {
    setNextZ((z) => z + 1);
    setWindows((current) => current.map((item) => item.id === id ? { ...item, minimized: false, zIndex: nextZ + 1 } : item));
    setActiveId(id);
  }, [nextZ]);

  const closeWindow = useCallback((id: string) => {
    setWindows((current) => current.filter((item) => item.id !== id));
    setActiveId((current) => current === id ? null : current);
  }, []);

  const launch = useCallback((id: string, forceNew = false) => {
    const definition = appMap.get(id);
    if (!definition) return;
    setStartOpen(false); setAllProgramsOpen(false);
    const existing = !forceNew ? windows.find((windowData) => windowData.appId === id) : undefined;
    if (existing) { focusWindow(existing.id); return; }
    if (definition.kind === "external" && definition.url) {
      window.open(definition.url, "_blank", "noopener,noreferrer");
    }
    const serial = `${id}-${Date.now()}`;
    const savedPosition = registry.HKCU.Desktop.windowPositions[id];
    const z = nextZ + 1;
    const created: ShellWindow = { id: serial, appId: id, title: definition.name, icon: definition.icon, x: savedPosition?.x ?? 70 + (windows.length % 6) * 28, y: savedPosition?.y ?? 50 + (windows.length % 5) * 24, width: savedPosition?.w ?? definition.defaultWidth, height: savedPosition?.h ?? definition.defaultHeight, minimized: false, maximized: false, zIndex: z };
    setNextZ(z);
    setWindows((current) => [...current, created]);
    setActiveId(serial);
  }, [focusWindow, nextZ, registry.HKCU.Desktop.windowPositions, windows]);

  const updateWindow = (id: string, patch: Partial<ShellWindow>) => setWindows((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  const rememberWindowPosition = (id: string, x: number, y: number, width: number, height: number) => {
    const item = windows.find((entry) => entry.id === id);
    if (!item) return;
    setRegistry((current) => ({ ...current, HKCU: { ...current.HKCU, Desktop: { ...current.HKCU.Desktop, windowPositions: { ...current.HKCU.Desktop.windowPositions, [item.appId]: { x, y, w: width, h: height } } } } }));
  };

  const moveIcon = (id: string, x: number, y: number) => setRegistry((current) => ({ ...current, HKCU: { ...current.HKCU, Desktop: { ...current.HKCU.Desktop, iconPositions: { ...current.HKCU.Desktop.iconPositions, [id]: { x, y } } } } }));

  const renderApp = (windowData: ShellWindow) => {
    const definition = appMap.get(windowData.appId);
    if (!definition) return null;
    if (definition.kind === "external") return <ExternalApp app={definition} />;
    switch (windowData.appId) {
      case "explorer": return <Explorer onOpenApp={launch} />;
      case "notepad": return <Notepad />;
      case "calculator": return <Calculator />;
      case "paint": return <Paint />;
      case "minesweeper": return <Minesweeper />;
      case "terminal": return <Terminal onLaunch={launch} />;
      case "settings": return <Settings settings={settings} onChange={updateSettings} />;
      default: return <div className="app-fill"><h3>{definition.name}</h3><p>Aplikace je připravena.</p></div>;
    }
  };

  const openCategory = (category: AppCategory) => {
    launch(`category-${category.toLowerCase()}`);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Meta" && event.target === document.body) setStartOpen((open) => !open);
      if ((event.altKey && event.key === "F4") && activeId) { event.preventDefault(); closeWindow(activeId); }
      if (event.altKey && event.key === "Tab") { event.preventDefault(); const ordered = [...windows].sort((a, b) => b.zIndex - a.zIndex).filter((item) => !item.minimized); const currentIndex = ordered.findIndex((item) => item.id === activeId); const next = ordered[(currentIndex + 1) % Math.max(1, ordered.length)]; if (next) focusWindow(next.id); }
      if (event.metaKey && event.key.toLowerCase() === "d") { event.preventDefault(); setWindows((items) => items.map((item) => ({ ...item, minimized: true }))); setActiveId(null); }
      if (event.metaKey && event.key.toLowerCase() === "e") { event.preventDefault(); launch("explorer"); }
      if (event.key === "Escape") { setStartOpen(false); setAllProgramsOpen(false); setDesktopMenu(null); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeId, closeWindow, focusWindow, launch, windows]);

  const categorized = useMemo(() => categories.map((category) => ({ category, apps: apps.filter((app) => app.category === category) })), []);

  if (booting) return <BootScreen onDone={() => setBooting(false)} />;

  return (
    <div className={`desktop shell-theme-${settings.theme}`} onContextMenu={(event) => { event.preventDefault(); setStartOpen(false); setDesktopMenu({ x: event.clientX, y: event.clientY }); }} onClick={() => { setDesktopMenu(null); }}>
      <div className="wallpaper" aria-label="LUXFERY desktop" />
      <div className="desktop-icons" onClick={(event) => event.stopPropagation()}>
        {desktopDefaults.map((entry, index) => {
          const position = registry.HKCU.Desktop.iconPositions[entry.id] ?? { x: 16 + (index % 2) * 92, y: 16 + Math.floor(index / 2) * 86 };
          return <DesktopIcon key={entry.id} entry={entry} position={position} onMove={moveIcon} onOpen={() => entry.appId ? launch(entry.appId) : entry.category ? openCategory(entry.category) : undefined} />;
        })}
      </div>

      {windows.map((windowData) => <WindowFrame key={windowData.id} windowData={windowData} active={windowData.id === activeId} taskbarHeight={settings.taskbarPosition === "bottom" ? 30 : 0} onFocus={() => focusWindow(windowData.id)} onMove={(x, y) => { updateWindow(windowData.id, { x, y }); rememberWindowPosition(windowData.id, x, y, windowData.width, windowData.height); }} onResize={(width, height) => { updateWindow(windowData.id, { width, height }); rememberWindowPosition(windowData.id, windowData.x, windowData.y, width, height); }} onMinimize={() => { updateWindow(windowData.id, { minimized: true }); if (activeId === windowData.id) setActiveId(null); }} onMaximize={() => updateWindow(windowData.id, { maximized: !windowData.maximized, minimized: false })} onClose={() => closeWindow(windowData.id)}>{renderApp(windowData)}</WindowFrame>)}

      {startOpen && <div className="start-menu" onClick={(event) => event.stopPropagation()}><div className="start-brand">LUXFERY <b>26</b></div><div className="start-items"><button onClick={() => setAllProgramsOpen((value) => !value)}>Programs <span>▶</span></button><button onClick={() => launch("explorer")}>Documents <span>▶</span></button><button onClick={() => launch("settings")}>Settings</button><button onClick={() => launch("terminal")}>Run...</button><button onClick={() => window.location.reload()}>Shut down LUXFERY</button></div>{allProgramsOpen && <div className="programs-panel">{categorized.map(({ category, apps: categoryApps }) => <div key={category}><strong>{category}</strong>{categoryApps.map((app) => <button key={app.id} onClick={() => launch(app.id)}>{app.icon} {app.name}</button>)}</div>)}</div>}</div>}

      {desktopMenu && <div className="desktop-context-menu" style={{ left: desktopMenu.x, top: desktopMenu.y }} onClick={(event) => event.stopPropagation()}><button onClick={() => window.location.reload()}>Obnovit</button><button onClick={() => launch("explorer")}>Nové okno Exploreru</button><button onClick={() => launch("settings")}>Vlastnosti plochy</button></div>}

      <div className={`taskbar ${settings.taskbarPosition === "top" ? "taskbar-top" : ""}`}><button className={`start-button ${startOpen ? "pressed" : ""}`} onClick={(event) => { event.stopPropagation(); setStartOpen((value) => !value); }}>🪟 <b>Start</b></button><div className="task-buttons">{windows.map((windowData) => <button key={windowData.id} className={windowData.id === activeId && !windowData.minimized ? "task-active" : ""} onClick={() => windowData.id === activeId && !windowData.minimized ? updateWindow(windowData.id, { minimized: true }) : focusWindow(windowData.id)}>{windowData.icon} {windowData.title}</button>)}</div><div className="tray"><span>🖥</span><span>{clock.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}</span></div></div>
    </div>
  );
}

function DesktopIcon({ entry, position, onMove, onOpen }: { entry: { id: string; label: string; icon: string }; position: { x: number; y: number }; onMove: (id: string, x: number, y: number) => void; onOpen: () => void }) {
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  useEffect(() => { const move = (event: MouseEvent) => { if (!drag.current) return; const nextX = Math.max(0, drag.current.x + event.clientX - drag.current.startX); const nextY = Math.max(0, drag.current.y + event.clientY - drag.current.startY); const element = document.getElementById(`desktop-icon-${entry.id}`); if (element) { element.style.left = `${nextX}px`; element.style.top = `${nextY}px`; } }; const up = () => { if (drag.current) { const element = document.getElementById(`desktop-icon-${entry.id}`); if (element) onMove(entry.id, element.offsetLeft, element.offsetTop); } drag.current = null; }; window.addEventListener("mousemove", move); window.addEventListener("mouseup", up); return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); }; }, [entry.id, onMove]);
  return <button id={`desktop-icon-${entry.id}`} className="desktop-icon" style={{ left: position.x, top: position.y } as CSSProperties} onDoubleClick={onOpen} onKeyDown={(event) => event.key === "Enter" && onOpen()} onMouseDown={(event) => { drag.current = { x: position.x, y: position.y, startX: event.clientX, startY: event.clientY }; }}><span>{entry.icon}</span><b>{entry.label}</b></button>;
}

export { App };
