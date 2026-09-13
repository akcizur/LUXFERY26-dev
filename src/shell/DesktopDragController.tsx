import { useEffect, useRef, useState } from "react";
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

function DesktopFolderSurface({ root, currentId, onBack, onOpenFolder }: { root: FsNode; currentId: string; onBack: () => void; onOpenFolder: (id: string) => void }) {
  const current = findNode(root, currentId);
  if (!current) return null;
  const items = (current.children ?? []).filter((item) => item.id && !item.deleted);
  return <div className="desktop-folder-surface" role="region" aria-label={`Obsah složky ${current.name}`} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}>
    <button className="desktop-folder-icon desktop-folder-back" onClick={(event) => { event.stopPropagation(); onBack(); }} title="Zpět">
      <span>←</span><b>Zpět</b>
    </button>
    {items.map((item, index) => <button key={item.id} className="desktop-folder-icon" style={{ left: 16 + ((index + 1) % 2) * 92, top: 16 + Math.floor((index + 1) / 2) * 86 }} onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => { event.stopPropagation(); if (item.type === "folder" && item.id) onOpenFolder(item.id); }}>
      <span>{item.type === "folder" ? "📁" : "📄"}</span><b>{item.name}</b>
    </button>)}
  </div>;
}

export function DesktopDragController() {
  const dragRef = useRef<HTMLElement | null>(null);
  const dropTargetRef = useRef<HTMLElement | null>(null);
  const [folderViewId, setFolderViewId] = useState<string | null>(null);
  const [filesystemVersion, setFilesystemVersion] = useState(0);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => { if (event.button !== 0) return; const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>(".desktop-icon") : null; if (target) dragRef.current = target; };
    const onPointerMove = (event: PointerEvent) => { const source = dragRef.current; if (!source) return; const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(".desktop-icon") ?? null; const nextTarget = target?.innerText.trim().startsWith("Koš") ? target : null; if (dropTargetRef.current !== nextTarget) { dropTargetRef.current = nextTarget; forceRender((value) => value + 1); } };
    const onPointerUp = () => { const source = dragRef.current; if (!source) return; dragRef.current = null; const dropTarget = dropTargetRef.current; dropTargetRef.current = null; forceRender((value) => value + 1); if (dropTarget) trashItem(iconIdForButton(source) ?? ""); };
    const onDoubleClick = (event: MouseEvent) => {
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
      setFolderViewId(node.id);
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("dblclick", onDoubleClick, true);
    return () => { window.removeEventListener("pointerdown", onPointerDown, true); window.removeEventListener("pointermove", onPointerMove, true); window.removeEventListener("pointerup", onPointerUp, true); window.removeEventListener("dblclick", onDoubleClick, true); };
  }, []);

  useEffect(() => {
    const refresh = () => setFilesystemVersion((value) => value + 1);
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && folderViewId) { event.preventDefault(); setFolderViewId(null); } };
    window.addEventListener("luxfery:filesystem-changed", refresh);
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("luxfery:filesystem-changed", refresh); window.removeEventListener("keydown", onKeyDown); };
  }, [folderViewId]);

  useEffect(() => { if (!folderViewId) return; const fs = loadFs(); if (!fs || !findNode(fs, folderViewId)) setFolderViewId(null); }, [filesystemVersion, folderViewId]);
  useEffect(() => { document.querySelectorAll<HTMLElement>(".desktop-icon").forEach((icon) => icon.classList.toggle("desktop-icon-drop-target", icon === dropTargetRef.current)); });

  const fs = loadFs();
  const surface = fs && folderViewId ? <DesktopFolderSurface root={fs} currentId={folderViewId} onBack={() => { const parent = findParent(fs, folderViewId); if (!parent || parent.id === "desktop") setFolderViewId(null); else if (parent.id) setFolderViewId(parent.id); }} onOpenFolder={(id) => setFolderViewId(id)} /> : null;
  return surface;
}
