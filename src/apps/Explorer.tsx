import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { FILESYSTEM_KEY, OPEN_FILE_KEY } from "../core/runtime";
import { playSystemSound } from "../core/system";

type FsNode = { id: string; name: string; type: "folder" | "file"; size?: string; ext?: string; content?: string; children?: FsNode[]; deleted?: boolean };

type Props = { onLaunch: (id: string) => void; onNotify?: (title: string, message: string, tone?: "info" | "success" | "warning" | "error") => void };

const seed: FsNode = {
  id: "root", name: "C:\\", type: "folder", children: [
    { id: "windows", name: "Windows", type: "folder", children: [{ id: "media", name: "Media", type: "folder", children: [{ id: "startup", name: "startup.wav", type: "file", size: "12 KB", ext: ".wav" }, { id: "chord", name: "chord.wav", type: "file", size: "8 KB", ext: ".wav" }] }] },
    { id: "program-files", name: "Program Files", type: "folder", children: [] },
    { id: "docs", name: "My Documents", type: "folder", children: [{ id: "welcome", name: "WELCOME.TXT", type: "file", size: "2 KB", ext: ".txt", content: "Vítejte v LUXFERY 26.\n\nWindows 98, ale běží v roce 2026." }, { id: "notes", name: "NOTES.TXT", type: "file", size: "1 KB", ext: ".txt", content: "Moje poznámky.\n\nUprav mě v Poznámkovém bloku." }] },
    { id: "desktop", name: "Desktop", type: "folder", children: [] },
    { id: "downloads", name: "Downloads", type: "folder", children: [] },
    { id: "temp", name: "Temp", type: "folder", children: [] },
    { id: "recycle", name: "Recycled", type: "folder", children: [] },
  ],
};

function cloneSeed() { return structuredClone(seed) as FsNode; }
function loadFs(): FsNode { try { const raw = localStorage.getItem(FILESYSTEM_KEY); return raw ? JSON.parse(raw) as FsNode : cloneSeed(); } catch { return cloneSeed(); } }
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
  const [currentId, setCurrentId] = useState("root");
  const [query, setQuery] = useState("");
  const [details, setDetails] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clipboardId, setClipboardId] = useState<string | null>(null);

  const current = findNode(fs, currentId) ?? fs;
  const items = useMemo(() => (current.children ?? []).filter((item) => !item.deleted && item.name.toLowerCase().includes(query.toLowerCase())), [current, query]);
  const selected = selectedId ? findNode(fs, selectedId) : null;
  const notify = (title: string, message: string, tone: "info" | "success" | "warning" | "error" = "info") => {
    onNotify?.(title, message, tone);
    const kind = tone === "error" ? "error" : tone === "success" ? "notify" : tone === "warning" ? "error" : "click";
    playSystemSound(kind, true);
    window.dispatchEvent(new CustomEvent("luxfery:notice", { detail: { id: `${Date.now()}-${Math.random()}`, title, message, tone } }));
  };

  const commit = (next: FsNode) => { setFs(next); persist(next); window.dispatchEvent(new CustomEvent("luxfery:filesystem-changed")); };
  const open = (node: FsNode) => { if (node.type === "folder") { setCurrentId(node.id); playSystemSound("open", true); return; } if (node.ext?.toLowerCase() === ".txt") { const opened = { id: node.id, name: node.name, path: pathFor(fs, node.id) }; localStorage.setItem(OPEN_FILE_KEY, JSON.stringify(opened)); if (node.id !== selectedId) setSelectedId(node.id); onLaunch("notepad", true); } else notify("Explorer", `${node.name} není přidružena k interní aplikaci.`, "warning"); };
  const goRoot = () => setCurrentId("root");
  const goParent = () => { if (currentId === "root") return; const parent = findParent(fs, currentId); if (parent) setCurrentId(parent.id); };
  const createFolder = () => { const parent = findNode(fs, currentId); if (!parent || parent.type !== "folder") return; const name = uniqueName(parent, "Nová složka"); const next = updateTree(fs, currentId, (node) => ({ ...node, children: [...(node.children ?? []), { id: crypto.randomUUID(), name, type: "folder", children: [] }] })); commit(next); notify("Explorer", `Vytvořena složka „${name}“.`, "success"); };
  const createText = () => { const parent = findNode(fs, currentId); if (!parent || parent.type !== "folder") return; const name = uniqueName(parent, "Nový dokument.txt"); const next = updateTree(fs, currentId, (node) => ({ ...node, children: [...(node.children ?? []), { id: crypto.randomUUID(), name, type: "file", ext: ".txt", size: "0 B", content: "" }] })); commit(next); notify("Explorer", `Vytvořen soubor „${name}“.`, "success"); };
  const rename = () => { if (!selected || selected.id === "root") return; const value = window.prompt("Nový název:", selected.name)?.trim(); if (!value) return; const parent = findParent(fs, selected.id); if (!parent) return; const nextName = uniqueName({ ...parent, children: (parent.children ?? []).filter((child) => child.id !== selected.id) }, value); commit(updateTree(fs, selected.id, (node) => ({ ...node, name: nextName }))); notify("Explorer", `Položka přejmenována na „${nextName}“.`, "success"); };
  const remove = () => { if (!selected || selected.id === "root" || selected.deleted) return; const next = updateTree(fs, "recycle", (node) => ({ ...node, children: [...(node.children ?? []), { ...structuredClone(selected), id: `trash-${selected.id}-${Date.now()}`, deleted: true }] })); commit(removeTree(next, selected.id)); notify("Koš", `„${selected.name}“ přesunuto do Koše.`, "info"); setSelectedId(null); };
  const copy = () => { if (selected) { setClipboardId(selected.id); notify("Explorer", `„${selected.name}“ zkopírováno.`, "info"); } };
  const paste = () => { if (!clipboardId) return; const source = findNode(fs, clipboardId); const parent = findNode(fs, currentId); if (!source || !parent || parent.type !== "folder") return; const copied = structuredClone(source) as FsNode; copied.id = crypto.randomUUID(); copied.name = uniqueName(parent, copied.name); const next = updateTree(fs, currentId, (node) => ({ ...node, children: [...(node.children ?? []), copied] })); commit(next); notify("Explorer", `Vloženo „${copied.name}“.`, "success"); };
  const emptyRecycle = () => { const next = updateTree(fs, "recycle", (node) => ({ ...node, children: [] })); commit(next); notify("Koš", "Koš byl vysypán.", "success"); };
  const restoreSelected = () => { if (!selected || !selected.deleted) return; const desktop = findNode(fs, "desktop"); if (!desktop) return; const next = updateTree(removeTree(fs, selected.id), "desktop", (node) => ({ ...node, children: [...(node.children ?? []), { ...selected, id: crypto.randomUUID(), deleted: false, name: uniqueName(node, selected.name) }] })); commit(next); notify("Koš", `„${selected.name}“ bylo obnoveno na plochu.`, "success"); setSelectedId(null); };

  return <div className="app-fill">
    <div className="menu"><button className="menu-trigger">Soubor</button><button className="menu-trigger">Úpravy</button><button className="menu-trigger">Zobrazit</button><button className="menu-trigger">Nástroje</button><button className="menu-trigger">Nápověda</button></div>
    <div className="toolbar"><Button onClick={goRoot}>←</Button><Button onClick={goParent}>↑</Button><Button onClick={createFolder}>Nová složka</Button><Button onClick={createText}>Nový TXT</Button><Button onClick={rename} disabled={!selected}>Přejmenovat</Button><Button onClick={copy} disabled={!selected}>Kopírovat</Button><Button onClick={paste} disabled={!clipboardId}>Vložit</Button><Button onClick={remove} disabled={!selected || selected.deleted}>Odstranit</Button><input className="sunken path" value={pathFor(fs, currentId)} readOnly aria-label="Cesta" /><input className="sunken search" placeholder="Hledat" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Hledat" /></div>
    <div className="explorer">
      <div className="tree sunken"><button onClick={goRoot}>▣ C:\</button>{(fs.children ?? []).map((item) => item.id === "recycle" ? <button key={item.id} onClick={() => setCurrentId(item.id)}>🗑 Koš ({item.children?.length ?? 0})</button> : <button key={item.id} onClick={() => setCurrentId(item.id)}>📁 {item.name}</button>)}</div>
      <div className="files sunken" onClick={() => setSelectedId(null)}>{details ? <table><thead><tr><th>Název</th><th>Velikost</th><th>Typ</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className={selectedId === item.id ? "selected-row" : ""} onClick={(event) => { event.stopPropagation(); setSelectedId(item.id); }} onDoubleClick={() => open(item)}><td>{item.type === "folder" ? "📁" : item.deleted ? "🗑️" : "📄"} {item.name}</td><td>{item.size ?? ""}</td><td>{item.ext ?? "Složka"}</td></tr>)}</tbody></table> : <div className="icons">{items.map((item) => <button className={`file-icon ${selectedId === item.id ? "selected-file" : ""}`} key={item.id} onClick={(event) => { event.stopPropagation(); setSelectedId(item.id); }} onDoubleClick={() => open(item)}><span>{item.type === "folder" ? "📁" : item.deleted ? "🗑️" : "📄"}</span><b>{item.name}</b></button>)}</div>}</div>
    </div>
    <div className="status">Cesta: {pathFor(fs, currentId)}<span/>Položek: {items.length}<span/>{currentId === "recycle" && <Button onClick={emptyRecycle}>Vysypat koš</Button>}{selected?.deleted && <Button onClick={restoreSelected}>Obnovit</Button>}<Button onClick={() => setDetails(!details)}>{details ? "Ikony" : "Podrobnosti"}</Button></div>
  </div>;
}
