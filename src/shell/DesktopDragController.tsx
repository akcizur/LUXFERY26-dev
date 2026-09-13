import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FILESYSTEM_KEY } from "../core/runtime";
import "./DesktopDragController.css";

type FsNode = { id?: string; name: string; type: "folder" | "file"; ext?: string; children?: FsNode[]; deleted?: boolean };

const STATIC_IDS: Record<string, string> = { "Tento počítač": "my-computer", ChatGPT: "chatgpt", Figma: "figma", "VS Code": "vscode", Internet: "internet", Development: "development", Design: "design", Media: "media", System: "system" };
function loadFs(): FsNode | null { try { const raw = localStorage.getItem(FILESYSTEM_KEY); return raw ? JSON.parse(raw) as FsNode : null; } catch { return null; } }
function findNode(root: FsNode, id: string): FsNode | null { if (root.id === id) return root; for (const child of root.children ?? []) { const found = findNode(child, id); if (found) return found; } return null; }
function findParent(root: FsNode, id: string): FsNode | null { for (const child of root.children ?? []) { if (child.id === id) return root; const parent = findParent(child, id); if (parent) return parent; } return null; }
function updateTree(root: FsNode, id: string, updater: (node: FsNode) => FsNode): FsNode { if (root.id === id) return updater(root); return { ...root, children: root.children?.map((child) => updateTree(child, id, updater)) }; }
function removeTree(root: FsNode, id: string): FsNode { return { ...root, children: root.children?.filter((child) => child.id !== id).map((child) => removeTree(child, id)) }; }
function nodeForDesktopLabel(root: FsNode, label: string): FsNode | null { const desktop = findNode(root, "desktop"); return (desktop?.children ?? []).find((item) => item.name === label && !item.deleted) ?? null; }
function iconIdForButton(button: HTMLElement): string | null { const label = button.innerText.trim().replace(/\s+/g, " "); if (label.startsWith("Koš")) return "recycle"; if (STATIC_IDS[label]) return STATIC_IDS[label]; const fs = loadFs(); const node = fs ? nodeForDesktopLabel(fs, label) : null; return node?.id ? `fs:${node.id}` : null; }
function closeOpenWindows() { document.querySelectorAll<HTMLElement>(".window").forEach((win) => { win.querySelector<HTMLElement>(".controls button:last-child")?.click(); }); }

function trashItem(sourceId: string) {
  if (!sourceId.startsWith("fs:")) return false;
  const nodeId = sourceId.slice(3);
  const fs = loadFs();
  if (!fs || nodeId === "recycle") return false;
  const source = findNode(fs, nodeId);
  const recycle = findNode(fs, "recycle");
  if (!source || !recycle || source.deleted) return false;
  const moved = { ...structuredClone(source), id: `trash-${nodeId}-${Date.now()}`, deleted: true };
  let next = removeTree(fs, nodeId);
  next = updateTree(next, "recycle", (current) => ({ ...current, children: [...(current.children ?? []), moved] }));
  localStorage.setItem(FILESYSTEM_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("luxfery:filesystem-changed"));
  window.dispatchEvent(new CustomEvent("luxfery:notice", { detail: { id: `${Date.now()}-desktop-trash`, title: "Koš", message: `„${source.name}“ bylo přesunuto do Koše přetažením.`, tone: "info" } }));
  return true;
}

function Tree({ node, currentId, onOpen }: { node: FsNode; currentId: string; onOpen: (id: string) => void }) {
  return <>{node.id && <button type="button" className={`desktop-folder-tree-row ${node.id === currentId ? "active" : ""}`} style={{ paddingLeft: 7 }} onClick={() => onOpen(node.id!)}><span>{node.type === "folder" ? "📁" : "📄"}</span><span>{node.name}</span></button>}{node.type === "folder" && (node.children ?? []).filter((item) => !item.deleted).map((child) => <div key={child.id} style={{ paddingLeft: 14 }}><Tree node={child} currentId={currentId} onOpen={onOpen} /></div>)}</>;
}

function DesktopFolderSurface({ root, currentId, onBack, onOpenFolder }: { root: FsNode; currentId: string; onBack: () => void; onOpenFolder: (id: string) => void }) {
  const current = findNode(root, currentId);
  if (!current) return null;
  const items = (current.children ?? []).filter((item) => item.id && !item.deleted);
  return <div className="desktop-folder-surface" role="region" aria-label={`Obsah složky ${current.name}`} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}>
    <div className="desktop-folder-surface-main">
      <button type="button" className="desktop-folder-icon desktop-folder-back" onClick={(event) => { event.stopPropagation(); onBack(); }} title="Zpět"><span>←</span><b>Zpět</b></button>
      {items.map((item, index) => <button type="button" key={item.id} className="desktop-folder-icon" style={{ left: 16 + ((index + 1) % 2) * 92, top: 16 + Math.floor((index + 1) / 2) * 86 }} onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => { event.stopPropagation(); if (item.type === "folder" && item.id) onOpenFolder(item.id); }}>{item.type === "folder" ? <span>📁</span> : <span>📄</span>}<b>{item.name}</b></button>)}
    </div>
    <aside className="desktop-folder-side sunken">
      <div className="desktop-folder-panel-title">Strom souborů</div>
      <div className="desktop-folder-tree"><Tree node={root} currentId={current.id ?? ""} onOpen={(id) => { const target = findNode(root, id); if (target?.type === "folder") onOpenFolder(id); }} /></div>
      <div className="desktop-folder-overview"><div className="desktop-folder-panel-title">Přehled</div><div className="desktop-folder-preview-icon">📁</div><strong>{current.name}</strong><div className="desktop-folder-preview-path">{current.id === "desktop" ? "Plocha" : `Složka: ${current.name}`}</div><div className="desktop-folder-meta">{items.length} položek</div></div>
    </aside>
  </div>;
}

export function DesktopDragController() {
  const dragRef = useRef<HTMLElement | null>(null);
  const dropTargetRef = useRef<HTMLElement | null>(null);
  const clickRef = useRef<{ target: HTMLElement | null; time: number }>({ target: null, time: 0 });
  const [folderViewId, setFolderViewId] = useState<string | null>(null);
  const [filesystemVersion, setFilesystemVersion] = useState(0);
  const [desktopHost, setDesktopHost] = useState<HTMLElement | null>(null);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const locateDesktop = () => setDesktopHost(document.querySelector<HTMLElement>(".desktop"));
    locateDesktop();
    const observer = new MutationObserver(locateDesktop);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>(".desktop-icon") : null;
      if (target) dragRef.current = target;
    };
    const onPointerMove = (event: PointerEvent) => {
      const source = dragRef.current;
      if (!source || folderViewId) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(".desktop-icon") ?? null;
      const nextTarget = target?.innerText.trim().startsWith("Koš") ? target : null;
      if (dropTargetRef.current !== nextTarget) {
        dropTargetRef.current = nextTarget;
        forceRender((value) => value + 1);
      }
    };
    const onPointerUp = () => {
      const source = dragRef.current;
      if (!source || folderViewId) return;
      dragRef.current = null;
      const dropTarget = dropTargetRef.current;
      dropTargetRef.current = null;
      forceRender((value) => value + 1);
      if (dropTarget) trashItem(iconIdForButton(source) ?? "");
    };
    const onClickCapture = (event: MouseEvent) => {
      const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>(".desktop-icon") : null;
      if (!target) return;
      const sourceId = iconIdForButton(target);
      if (!sourceId?.startsWith("fs:")) return;
      const fs = loadFs();
      const node = fs ? findNode(fs, sourceId.slice(3)) : null;
      if (!node || node.type !== "folder" || node.deleted || !node.id) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const now = Date.now();
      const previous = clickRef.current;
      if (previous.target === target && now - previous.time <= 450) {
        clickRef.current = { target: null, time: 0 };
        closeOpenWindows();
        setFolderViewId(node.id);
      } else {
        clickRef.current = { target, time: now };
      }
    };

    const onDblClickCapture = (event: MouseEvent) => {
      const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>(".desktop-icon") : null;
      if (!target) return;
      const sourceId = iconIdForButton(target);
      if (!sourceId?.startsWith("fs:")) return;
      const fs = loadFs();
      const node = fs ? findNode(fs, sourceId.slice(3)) : null;
      if (!node || node.type !== "folder" || node.deleted || !node.id) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      clickRef.current = { target: null, time: 0 };
      closeOpenWindows();
      setFolderViewId(node.id);
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("click", onClickCapture, true);
    window.addEventListener("dblclick", onDblClickCapture, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("dblclick", onDblClickCapture, true);
    };
  }, [folderViewId]);

  useEffect(() => {
    const refresh = () => setFilesystemVersion((value) => value + 1);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && folderViewId) {
        event.preventDefault();
        const fs = loadFs();
        const parent = fs ? findParent(fs, folderViewId) : null;
        if (!parent || parent.id === "desktop") setFolderViewId(null);
        else if (parent.id) setFolderViewId(parent.id);
      }
    };
    window.addEventListener("luxfery:filesystem-changed", refresh);
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("luxfery:filesystem-changed", refresh); window.removeEventListener("keydown", onKeyDown); };
  }, [folderViewId]);

  useEffect(() => {
    if (!folderViewId) return;
    const fs = loadFs();
    if (!fs || !findNode(fs, folderViewId)) setFolderViewId(null);
  }, [filesystemVersion, folderViewId]);

  useEffect(() => {
    const desktop = document.querySelector<HTMLElement>(".desktop");
    if (!desktop) return;
    desktop.classList.toggle("desktop-folder-mode", Boolean(folderViewId));
    return () => desktop.classList.remove("desktop-folder-mode");
  }, [folderViewId]);

  useEffect(() => {
    document.querySelectorAll<HTMLElement>(".desktop-icon").forEach((icon) => icon.classList.toggle("desktop-icon-drop-target", icon === dropTargetRef.current));
  });

  const fs = loadFs();
  if (!desktopHost || !fs || !folderViewId) return null;
  return createPortal(
    <DesktopFolderSurface root={fs} currentId={folderViewId} onBack={() => {
      const parent = findParent(fs, folderViewId);
      if (!parent || parent.id === "desktop") setFolderViewId(null);
      else if (parent.id) setFolderViewId(parent.id);
    }} onOpenFolder={(id) => setFolderViewId(id)} />,
    desktopHost,
  );
}
