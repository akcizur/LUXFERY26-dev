import { useEffect, useMemo, useRef, useState } from "react";
import { FILESYSTEM_KEY, OPEN_FILE_KEY } from "../core/runtime";
import type { ReactNode } from "react";

type FsNode = { id: string; name: string; type: "folder" | "file"; size?: string; ext?: string; content?: string; children?: FsNode[]; deleted?: boolean };
type OpenFile = { id: string; name: string; path: string } | null;

function Button({ children, onClick, disabled = false }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return <button className="win-btn" disabled={disabled} onClick={onClick}>{children}</button>;
}

function loadFs(): FsNode | null {
  try { const raw = localStorage.getItem(FILESYSTEM_KEY); return raw ? JSON.parse(raw) as FsNode : null; }
  catch { return null; }
}

function findNode(root: FsNode, id: string): FsNode | null {
  if (root.id === id) return root;
  for (const child of root.children ?? []) { const found = findNode(child, id); if (found) return found; }
  return null;
}

function updateTree(root: FsNode, id: string, updater: (node: FsNode) => FsNode): FsNode {
  if (root.id === id) return updater(root);
  return { ...root, children: root.children?.map((child) => updateTree(child, id, updater)) };
}

function uniqueName(parent: FsNode, desired: string) {
  const names = new Set((parent.children ?? []).map((child) => child.name.toLowerCase()));
  if (!names.has(desired.toLowerCase())) return desired;
  const dot = desired.lastIndexOf(".");
  const stem = dot > 0 ? desired.slice(0, dot) : desired;
  const ext = dot > 0 ? desired.slice(dot) : "";
  let index = 2;
  while (names.has(`${stem} (${index})${ext}`.toLowerCase())) index += 1;
  return `${stem} (${index})${ext}`;
}

function readOpenFile(): OpenFile {
  try { const raw = localStorage.getItem(OPEN_FILE_KEY); return raw ? JSON.parse(raw) as OpenFile : null; }
  catch { return null; }
}

export function Notepad() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [openFile, setOpenFile] = useState<OpenFile>(() => readOpenFile());
  const [text, setText] = useState("");
  const [wrap, setWrap] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState("");
  const title = useMemo(() => `${openFile?.name ?? "Bez názvu"}${dirty ? " *" : ""}`, [openFile, dirty]);

  const windowId = rootRef.current?.closest<HTMLElement>("[data-window-id]")?.dataset.windowId;
  const emitDirty = (value: boolean) => {
    if (!windowId) return;
    window.dispatchEvent(new CustomEvent("luxfery:notepad-dirty", { detail: { windowId, dirty: value } }));
  };

  useEffect(() => {
    const file = readOpenFile();
    setOpenFile(file);
    const fs = loadFs();
    const node = file && fs ? findNode(fs, file.id) : null;
    setText(node?.content ?? "");
    setDirty(false);
    const id = windowId;
    if (id) window.dispatchEvent(new CustomEvent("luxfery:notepad-dirty", { detail: { windowId: id, dirty: false } }));
    return () => { if (id) window.dispatchEvent(new CustomEvent("luxfery:notepad-dirty", { detail: { windowId: id, dirty: false } })); };
  }, [windowId]);

  const markDirty = (value: boolean) => { setDirty(value); emitDirty(value); };

  const saveCurrent = () => {
    if (!openFile) return saveAs();
    const fs = loadFs();
    if (!fs) { setStatus("Souborový systém není dostupný."); return; }
    const node = findNode(fs, openFile.id);
    if (!node || node.type !== "file") { setStatus("Soubor už neexistuje."); return; }
    const next = updateTree(fs, openFile.id, (current) => ({ ...current, content: text, ext: ".txt", size: `${Math.max(1, new Blob([text]).size)} B` }));
    localStorage.setItem(FILESYSTEM_KEY, JSON.stringify(next));
    localStorage.setItem(OPEN_FILE_KEY, JSON.stringify(openFile));
    markDirty(false);
    setStatus(`Uloženo: ${openFile.path}`);
    window.dispatchEvent(new CustomEvent("luxfery:filesystem-changed"));
    window.dispatchEvent(new CustomEvent("luxfery:notice", { detail: { id: `${Date.now()}-notepad`, title: "Poznámkový blok", message: `Soubor „${openFile.name}“ byl uložen.`, tone: "success" } }));
  };

  const saveAs = () => {
    const fs = loadFs();
    if (!fs) { setStatus("Souborový systém není dostupný."); return; }
    const parent = findNode(fs, "docs");
    if (!parent || parent.type !== "folder") { setStatus("Cílová složka není dostupná."); return; }
    const requested = window.prompt("Název souboru:", openFile?.name ?? "Dokument.txt")?.trim();
    if (!requested) return;
    const name = uniqueName(parent, requested.toLowerCase().endsWith(".txt") ? requested : `${requested}.txt`);
    const id = crypto.randomUUID();
    const node: FsNode = { id, name, type: "file", ext: ".txt", size: `${Math.max(1, new Blob([text]).size)} B`, content: text };
    const next = updateTree(fs, "docs", (current) => ({ ...current, children: [...(current.children ?? []), node] }));
    localStorage.setItem(FILESYSTEM_KEY, JSON.stringify(next));
    const opened = { id, name, path: `C:\\My Documents\\${name}` } satisfies OpenFile;
    localStorage.setItem(OPEN_FILE_KEY, JSON.stringify(opened));
    setOpenFile(opened);
    markDirty(false);
    setStatus(`Uloženo jako: ${opened.path}`);
    window.dispatchEvent(new CustomEvent("luxfery:filesystem-changed"));
    window.dispatchEvent(new CustomEvent("luxfery:notice", { detail: { id: `${Date.now()}-notepad-saveas`, title: "Poznámkový blok", message: `Vytvořen soubor „${name}".`, tone: "success" } }));
  };

  const newDocument = () => {
    if (dirty && !window.confirm("Dokument obsahuje neuložené změny. Zahodit je?")) return;
    localStorage.removeItem(OPEN_FILE_KEY);
    setOpenFile(null);
    setText("");
    markDirty(false);
    setStatus("Nový dokument");
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (event.shiftKey) saveAs(); else saveCurrent();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    const onRequestClose = (event: Event) => {
      const custom = event as CustomEvent<{ windowId?: string; cancel?: boolean }>;
      if (!windowId || custom.detail?.windowId !== windowId || !dirty) return;
      if (!window.confirm(`„${openFile?.name ?? "Bez názvu"}" obsahuje neuložené změny. Zavřít bez uložení?`)) custom.detail.cancel = true;
    };
    window.addEventListener("luxfery:request-close", onRequestClose);
    return () => window.removeEventListener("luxfery:request-close", onRequestClose);
  }, [dirty, openFile, windowId]);

  return <div className="app-fill" ref={rootRef}>
    <div className="menu"><button className="menu-trigger" onClick={saveCurrent}>Soubor</button><button className="menu-trigger">Úpravy</button><button className="menu-trigger">Hledat</button><button className="menu-trigger">Formát</button><button className="menu-trigger">Nápověda</button></div>
    <div className="toolbar"><Button onClick={newDocument}>Nový</Button><Button onClick={saveCurrent}>Uložit</Button><Button onClick={saveAs}>Uložit jako…</Button><Button onClick={() => navigator.clipboard?.writeText(text)}>Kopírovat</Button><Button onClick={() => setWrap(!wrap)}>Zalamování: {wrap ? "Ano" : "Ne"}</Button></div>
    <div className="notepad-titlebar">{title}</div>
    <textarea className="editor sunken" autoFocus value={text} onChange={(event) => { setText(event.target.value); markDirty(true); }} style={{ whiteSpace: wrap ? "pre-wrap" : "pre" }} />
    <div className="status">Řádky: {text.split("\n").length}<span />Znaky: {text.length}<span />{openFile?.path ?? "Bez názvu"}<span />{status || "Připraveno"}</div>
  </div>;
}
