import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { FILESYSTEM_KEY, OPEN_FILE_KEY } from "../core/runtime";
import { playSystemSound } from "../core/system";

type FsNode = { id: string; name: string; type: "folder" | "file"; size?: string; ext?: string; content?: string; children?: FsNode[]; deleted?: boolean };
type Props = { onLaunch: (id: string, forceNew?: boolean) => void; onNotify?: (title: string, message: string, tone?: "info" | "success" | "warning" | "error") => void };

const seed: FsNode = { id: "root", name: "C:\\", type: "folder", children: [
  { id: "windows", name: "Windows", type: "folder", children: [{ id: "media", name: "Media", type: "folder", children: [{ id: "startup", name: "startup.wav", type: "file", size: "12 KB", ext: ".wav" }, { id: "chord", name: "chord.wav", type: "file", size: "8 KB", ext: ".wav" }] }] },
  { id: "program-files", name: "Program Files", type: "folder", children: [] },
  { id: "docs", name: "My Documents", type: "folder", children: [{ id: "welcome", name: "WELCOME.TXT", type: "file", size: "2 KB", ext: ".txt", content: "Vítejte v LUXFERY 26.\n\nWindows 98, ale běží v roce 2026." }, { id: "notes", name: "NOTES.TXT", type: "file", size: "1 KB", ext: ".txt", content: "Moje poznámky.\n\nUprav mě v Poznámkovém bloku." }] },
  { id: "desktop", name: "Desktop", type: "folder", children: [] },
  { id: "downloads", name: "Downloads", type: "folder", children: [] },
  { id: "temp", name: "Temp", type: "folder", children: [] },
  { id: "recycle", name: "Recycled", type: "folder", children: [] },
] };

function loadFs(): FsNode { try { const raw = localStorage.getItem(FILESYSTEM_KEY); if (raw) return JSON.parse(raw) as FsNode; const initial = structuredClone(seed) as FsNode; localStorage.setItem(FILESYSTEM_KEY, JSON.stringify(initial)); return initial; } catch { return structuredClone(seed) as FsNode; } }
function persist(fs: FsNode) { localStorage.setItem(FILESYSTEM_KEY, JSON.stringify(fs)); }
function findNode(root: FsNode, id: string): FsNode | null { if (root.id === id) return root; for (const child of root.children ?? []) { const found = findNode(child, id); if (found) return found; } return null; }
function findParent(root: FsNode, id: string): FsNode | null { for (const child of root.children ?? []) { if (child.id === id) return root; const nested = findParent(child, id); if (nested) return nested; } return null; }
function updateTree(root: FsNode, id: string, updater: (node: FsNode) => FsNode): FsNode { if (root.id === id) return updater(root); return { ...root, children: root.children?.map((child) => updateTree(child, id, updater)) }; }
function removeTree(root: FsNode, id: string): FsNode { return { ...root, children: root.children?.filter((child) => child.id !== id).map((child) => removeTree(child, id)) }; }
function uniqueName(parent: FsNode, desired: string) { const names = new Set((parent.children ?? []).map((child) => child.name.toLowerCase())); if (!names.has(desired.toLowerCase())) return desired; const dot = desired.lastIndexOf("."); const stem = dot > 0 ? desired.slice(0, dot) : desired; const ext = dot > 0 ? desired.slice(dot) : ""; let index = 2; while (names.has(`${stem} (${index})${ext}`.toLowerCase())) index += 1; return `${stem} (${index})${ext}`; }
function pathFor(root: FsNode, id: string, current = "C:\\"): string { if (root.id === id) return current; for (const child of root.children ?? []) { const next = current === "C:\\" ? `C:\\${child.name}` : `${current}\\${child.name}`; const hit = pathFor(child, id, next); if (hit) return hit; } return current; }

function Button({ children, onClick, disabled = false }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) { return <button className="win-btn" disabled={disabled} onClick={onClick}>{children}</button>; }

export function Explorer({ onLaunch, onNotify }: Props) {
  const [fs, setFs] = useState<FsNode>(() => loadFs());
  const [currentId, setCurrentId] = useState(() => localStorage.getItem("luxfery26:explorer-path") ?? "root");
  const [query, setQuery] = useState("");
  const [details, setDetails] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<FsNode[]>([]);
  const [menu, setMenu] = useState<{ x: number; y: number; targetId?: string } | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setFs(loadFs());
    const onOpenPath = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string }>).detail;
      if (!detail?.id) return;
      const fresh = loadFs();
      if (!findNode(fresh, detail.id)) return;
      setFs(fresh);
      setCurrentId(detail.id);
      localStorage.setItem("luxfery26:explorer-path", detail.id);
      clearSelection();
    };
    window.addEventListener("luxfery:filesystem-changed", refresh);
    window.addEventListener("luxfery:explorer-open-path", onOpenPath);
    return () => { window.removeEventListener("luxfery:filesystem-changed", refresh); window.removeEventListener("luxfery:explorer-open-path", onOpenPath); };
  }, []);

  const current = findNode(fs, currentId) ?? fs;
  const items = useMemo(() => (current.children ?? []).filter((item) => !item.deleted && item.name.toLowerCase().includes(query.toLowerCase())), [current, query]);
  const selected = selectedIds.map((id) => findNode(fs, id)).filter((item): item is FsNode => Boolean(item));
  const primary = selected[0] ?? null;
  const notify = (title: string, message: string, tone: "info" | "success" | "warning" | "error" = "info") => { onNotify?.(title, message, tone); const kind = tone === "error" ? "error" : tone === "success" ? "notify" : tone === "warning" ? "error" : "click"; playSystemSound(kind, true); window.dispatchEvent(new CustomEvent("luxfery:notice", { detail: { id: `${Date.now()}-${Math.random()}`, title, message, tone } })); };
  const commit = (next: FsNode) => { setFs(next); persist(next); window.dispatchEvent(new CustomEvent("luxfery:filesystem-changed")); };
  const select = (id: string, additive = false) => setSelectedIds((previous) => additive ? previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id] : [id]);
  const clearSelection = () => setSelectedIds([]);
  const setPath = (id: string) => { setCurrentId(id); localStorage.setItem("luxfery26:explorer-path", id); clearSelection(); };
  const open = (node: FsNode) => { setMenu(null); setOpenMenu(null); if (node.type === "folder") { setPath(node.id); playSystemSound("open", true); return; } if (node.ext?.toLowerCase() === ".txt") { localStorage.setItem(OPEN_FILE_KEY, JSON.stringify({ id: node.id, name: node.name, path: pathFor(fs, node.id) })); onLaunch("notepad", true); } else notify("Explorer", `${node.name} není přidružena k interní aplikaci.`, "warning"); };
  const goRoot = () => setPath("root");
  const goParent = () => { if (currentId === "root") return; const parent = findParent(fs, currentId); if (parent) setPath(parent.id); };
  const createFolder = () => { const parent = findNode(fs, currentId); if (!parent || parent.type !== "folder") return; const name = uniqueName(parent, "Nová složka"); commit(updateTree(fs, currentId, (value) => ({ ...value, children: [...(value.children ?? []), { id: crypto.randomUUID(), name, type: "folder", children: [] }] }))); notify("Explorer", `Vytvořena složka „${name}“.`, "success"); };
  const createText = () => { const parent = findNode(fs, currentId); if (!parent || parent.type !== "folder") return; const name = uniqueName(parent, "Nový dokument.txt"); commit(updateTree(fs, currentId, (value) => ({ ...value, children: [...(value.children ?? []), { id: crypto.randomUUID(), name, type: "file", ext: ".txt", size: "0 B", content: "" }] }))); notify("Explorer", `Vytvořen soubor „${name}“.`, "success"); };
  const rename = () => { if (!primary || primary.id === "root") return; const value = window.prompt("Nový název:", primary.name)?.trim(); if (!value) return; const parent = findParent(fs, primary.id); if (!parent) return; const nextName = uniqueName({ ...parent, children: (parent.children ?? []).filter((child) => child.id !== primary.id) }, value); commit(updateTree(fs, primary.id, (node) => ({ ...node, name: nextName }))); notify("Explorer", `Položka přejmenována na „${nextName}“.`, "success"); };
  const copySelected = () => { if (!selected.length) return; setClipboard(selected.map((item) => structuredClone(item))); notify("Explorer", `Do schránky: ${selected.length} polož${selected.length === 1 ? "ka" : "ky"}.`, "info"); };
  const paste = () => { const parent = findNode(fs, currentId); if (!clipboard.length || !parent || parent.type !== "folder") return; const copied = clipboard.map((source) => ({ ...structuredClone(source), id: crypto.randomUUID(), name: uniqueName(parent, source.name), deleted: false })); commit(updateTree(fs, currentId, (node) => ({ ...node, children: [...(node.children ?? []), ...copied] }))); notify("Explorer", `Vloženo: ${copied.length} polož${copied.length === 1 ? "ka" : "ky"}.`, "success"); };
  const removeSelected = () => { if (!selected.length) return; let next = fs; for (const item of selected) { if (item.id === "root" || item.deleted) continue; next = updateTree(next, "recycle", (node) => ({ ...node, children: [...(node.children ?? []), { ...structuredClone(item), id: `trash-${item.id}-${Date.now()}-${Math.random()}`, deleted: true }] })); next = removeTree(next, item.id); } commit(next); notify("Koš", selected.length === 1 ? `„${selected[0].name}“ přesunuto do Koše.` : `${selected.length} položky přesunuty do Koše.`, "info"); clearSelection(); };
  const emptyRecycle = () => { commit(updateTree(fs, "recycle", (node) => ({ ...node, children: [] }))); notify("Koš", "Koš byl vysypán.", "success"); clearSelection(); };
  const restoreSelected = () => { const trash = selected.filter((item) => item.deleted); const desktop = findNode(fs, "desktop"); if (!trash.length || !desktop) return; let next = fs; for (const item of trash) { next = removeTree(next, item.id); next = updateTree(next, "desktop", (node) => ({ ...node, children: [...(node.children ?? []), { ...item, id: crypto.randomUUID(), deleted: false, name: uniqueName(node, item.name) }] })); } commit(next); notify("Koš", `${trash.length} polož${trash.length === 1 ? "ka" : "ky"} obnoveno na plochu.`, "success"); clearSelection(); };

  useEffect(() => { const onKey = (event: KeyboardEvent) => { if (event.ctrlKey && event.key.toLowerCase() === "c" && selected.length) { event.preventDefault(); copySelected(); } else if (event.ctrlKey && event.key.toLowerCase() === "v" && clipboard.length) { event.preventDefault(); paste(); } else if (event.key === "F2" && primary) { event.preventDefault(); rename(); } else if (event.key === "Delete" && selected.length) { event.preventDefault(); removeSelected(); } else if (event.key === "Escape") { setMenu(null); setOpenMenu(null); } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [selected.length, primary?.id, clipboard.length, currentId, fs]);
  const menuAction = (action: string) => { setOpenMenu(null); if (action === "new-folder") createFolder(); else if (action === "new-text") createText(); else if (action === "rename") rename(); else if (action === "copy") copySelected(); else if (action === "paste") paste(); else if (action === "delete") removeSelected(); else if (action === "root") goRoot(); else if (action === "view-icons") setDetails(false); else if (action === "view-details") setDetails(true); };
  const menus: Array<[string, Array<[string, string]>]> = [["Soubor", [["new-folder", "Nová složka"], ["new-text", "Nový textový dokument"], ["root", "Přejít na C:\\"]]], ["Úpravy", [["copy", "Kopírovat"], ["paste", "Vložit"], ["rename", "Přejmenovat"], ["delete", "Odstranit"]]], ["Zobrazit", [["view-icons", "Velké ikony"], ["view-details", "Podrobnosti"]]]];

  return <div className="app-fill" onContextMenu={(event) => { event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY }); setOpenMenu(null); }}>
    <div className="menu">{menus.map(([label, entries]) => <div className="menu-root" key={label}><button className="menu-trigger" onClick={(event) => { event.stopPropagation(); setOpenMenu((value) => value === label ? null : label); }}>{label}</button>{openMenu === label && <div className="dropdown-menu">{entries.map(([id, text]) => <button className="menu-entry" key={id} disabled={(id === "copy" || id === "rename" || id === "delete") && !selected.length || id === "paste" && !clipboard.length} onClick={() => menuAction(id)}>{text}</button>)}</div>}</div>)}</div>
    <div className="toolbar"><Button onClick={goRoot}>←</Button><Button onClick={goParent}>↑</Button><Button onClick={createFolder}>Nová složka</Button><Button onClick={createText}>Nový TXT</Button><Button onClick={rename} disabled={!primary}>Přejmenovat</Button><Button onClick={copySelected} disabled={!selected.length}>Kopírovat</Button><Button onClick={paste} disabled={!clipboard.length}>Vložit</Button><Button onClick={removeSelected} disabled={!selected.length}>Odstranit</Button><input className="sunken path" value={pathFor(fs, currentId)} readOnly aria-label="Cesta" /><input className="sunken search" placeholder="Hledat" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Hledat" /></div>
    <div className="explorer">
      <div className="tree sunken"><button onClick={goRoot}>▣ C:\</button>{(fs.children ?? []).map((item) => <button key={item.id} onClick={() => setPath(item.id)}>📁 {item.name}{item.id === "recycle" ? ` (${item.children?.length ?? 0})` : ""}</button>)}</div>
      <div className="files sunken" onClick={clearSelection}>{details ? <table><thead><tr><th>Název</th><th>Velikost</th><th>Typ</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className={selectedIds.includes(item.id) ? "selected-row" : ""} onClick={(event) => { event.stopPropagation(); select(item.id, event.ctrlKey); }} onDoubleClick={() => open(item)} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); if (!selectedIds.includes(item.id)) select(item.id); setMenu({ x: event.clientX, y: event.clientY, targetId: item.id }); }}><td>{item.type === "folder" ? "📁" : "📄"} {item.name}</td><td>{item.size ?? ""}</td><td>{item.ext ?? "Složka"}</td></tr>)}</tbody></table> : <div className="icons">{items.map((item) => <button className={`file-icon ${selectedIds.includes(item.id) ? "selected-file" : ""}`} key={item.id} onClick={(event) => { event.stopPropagation(); select(item.id, event.ctrlKey); }} onDoubleClick={() => open(item)} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); if (!selectedIds.includes(item.id)) select(item.id); setMenu({ x: event.clientX, y: event.clientY, targetId: item.id }); }}><span>{item.type === "folder" ? "📁" : "📄"}</span><b>{item.name}</b></button>)}</div>}</div>
    </div>
    <div className="status">Cesta: {pathFor(fs, currentId)}<span/>Položek: {items.length}<span/>{selected.length > 0 && `Vybráno: ${selected.length}`}<span/>{currentId === "recycle" && <Button onClick={emptyRecycle}>Vysypat koš</Button>}{selected.some((item) => item.deleted) && <Button onClick={restoreSelected}>Obnovit</Button>}<Button onClick={() => setDetails(!details)}>{details ? "Ikony" : "Podrobnosti"}</Button></div>
    {menu && <div className="desktop-context-menu explorer-context" style={{ left: Math.min(menu.x, window.innerWidth - 210), top: Math.min(menu.y, window.innerHeight - 230) }} onClick={(event) => event.stopPropagation()}>{menu.targetId && selected.length === 1 ? <><button onClick={() => { const node = findNode(fs, menu.targetId!); if (node) open(node); }}>Otevřít</button><button onClick={() => { menuAction("rename"); setMenu(null); }}>Přejmenovat</button><button onClick={() => { menuAction("copy"); setMenu(null); }}>Kopírovat</button><button onClick={() => { menuAction("delete"); setMenu(null); }}>Odstranit</button></> : <><button onClick={() => { menuAction("new-folder"); setMenu(null); }}>Nová složka</button><button onClick={() => { menuAction("new-text"); setMenu(null); }}>Nový textový dokument</button><button onClick={() => { menuAction("paste"); setMenu(null); }} disabled={!clipboard.length}>Vložit</button><button onClick={() => { menuAction("root"); setMenu(null); }}>Přejít na C:\</button><button onClick={() => { menuAction("view-details"); setMenu(null); }}>Podrobnosti</button></>}</div>}
  </div>;
}
