import { useEffect, useRef, useState } from "react";
import { FILESYSTEM_KEY, loadRegistry, saveRegistry } from "../core/runtime";
import "./DesktopDragController.css";

type FsNode = { id?: string; name: string; type: "folder" | "file"; ext?: string; children?: FsNode[]; deleted?: boolean };
type IconPosition = { x: number; y: number };

const STATIC_IDS: Record<string, string> = { "Tento počítač": "my-computer", ChatGPT: "chatgpt", Figma: "figma", "VS Code": "vscode", Internet: "internet", Development: "development", Design: "design", Media: "media", System: "system" };

function loadFs(): FsNode | null { try { const raw = localStorage.getItem(FILESYSTEM_KEY); return raw ? JSON.parse(raw) as FsNode : null; } catch { return null; } }
function findNode(root: FsNode, id: string): FsNode | null { if (root.id === id) return root; for (const child of root.children ?? []) { const found = findNode(child, id); if (found) return found; } return null; }
function findParent(root: FsNode, id: string): FsNode | null { for (const child of root.children ?? []) { if (child.id === id) return root; const nested = findParent(child, id); if (nested) return nested; } return null; }
function updateTree(root: FsNode, id: string, updater: (node: FsNode) => FsNode): FsNode { if (root.id === id) return updater(root); return { ...root, children: root.children?.map((child) => updateTree(child, id, updater)) }; }
function removeTree(root: FsNode, id: string): FsNode { return { ...root, children: root.children?.filter((child) => child.id !== id).map((child) => removeTree(child, id)) }; }
function nodeForLabel(root: FsNode, label: string): FsNode | null { const desktop = findNode(root, "desktop"); return (desktop?.children ?? []).find((item) => item.name === label && !item.deleted) ?? null; }
function iconIdForButton(button: HTMLElement): string | null { const label = button.innerText.trim().replace(/\s+/g, " "); if (label.startsWith("Koš")) return "recycle"; if (STATIC_IDS[label]) return STATIC_IDS[label]; const fs = loadFs(); const node = fs ? nodeForLabel(fs, label) : null; return node?.id ? `fs:${node.id}` : null; }
function snap(value: number, grid = 8) { return Math.max(4, Math.round(value / grid) * grid); }
function positionOf(button: HTMLElement): IconPosition { const left = Number.parseFloat(button.style.left || "0"); const top = Number.parseFloat(button.style.top || "0"); return { x: Number.isFinite(left) ? left : 0, y: Number.isFinite(top) ? top : 0 }; }
function persistPosition(id: string, position: IconPosition) { const registry = loadRegistry(); saveRegistry({ ...registry, HKCU: { ...registry.HKCU, Desktop: { ...registry.HKCU.Desktop, iconPositions: { ...registry.HKCU.Desktop.iconPositions, [id]: position } } } }); }
function trashItem(sourceId: string) { if (!sourceId.startsWith("fs:")) return false; const nodeId = sourceId.slice(3); const fs = loadFs(); if (!fs || nodeId === "recycle") return false; const source = findNode(fs, nodeId); const desktop = findNode(fs, "desktop"); const recycle = findNode(fs, "recycle"); if (!source || !desktop || !recycle || source.deleted) return false; const moved = { ...structuredClone(source), id: `trash-${nodeId}-${Date.now()}`, deleted: true }; let next = removeTree(fs, nodeId); next = updateTree(next, "recycle", (current) => ({ ...current, children: [...(current.children ?? []), moved] })); localStorage.setItem(FILESYSTEM_KEY, JSON.stringify(next)); window.dispatchEvent(new CustomEvent("luxfery:filesystem-changed")); window.dispatchEvent(new CustomEvent("luxfery:notice", { detail: { id: `${Date.now()}-desktop-trash`, title: "Koš", message: `„${source.name}“ bylo přesunuto do Koše přetažením.`, tone: "info" } })); return true; }
function dispatchExplorerPath(id: string) { localStorage.setItem("luxfery26:explorer-path", id); window.dispatchEvent(new CustomEvent("luxfery:explorer-open-path", { detail: { id } })); }
function pathFor(root: FsNode, id: string, current = "C:\\"): string { if (root.id === id) return current; for (const child of root.children ?? []) { if (!child.id) continue; const next = current === "C:\\" ? `C:\\${child.name}` : `${current}\\${child.name}`; const hit = pathFor(child, id, next); if (hit) return hit; } return current; }

function addTreeBranch(container: HTMLElement, node: FsNode, currentId: string, level = 0) {
  const row = document.createElement("button"); row.type = "button"; row.className = `explorer-direct-tree-row${node.id === currentId ? " active" : ""}`; row.style.paddingLeft = `${7 + level * 14}px`; row.innerHTML = `<span>${node.type === "folder" ? "📁" : "📄"}</span><span>${node.name}</span>`;
  row.addEventListener("click", () => { if (node.id) dispatchExplorerPath(node.id); }); container.appendChild(row);
  if (node.type === "folder") for (const child of (node.children ?? []).filter((item) => !item.deleted)) addTreeBranch(container, child, currentId, level + 1);
}

function decorateExplorerSurface() {
  const win = [...document.querySelectorAll<HTMLElement>(".window")].find((candidate) => candidate.querySelector(".explorer")); if (!win) return false;
  const explorer = win.querySelector<HTMLElement>(".explorer"); const toolbar = win.querySelector<HTMLElement>(".toolbar"); const files = explorer?.querySelector<HTMLElement>(".files"); if (!explorer || !toolbar || !files) return false;
  win.classList.add("explorer-direct-surface"); explorer.classList.add("explorer-direct-layout"); toolbar.classList.add("explorer-direct-toolbar"); explorer.querySelector<HTMLElement>(":scope > .tree")?.classList.add("explorer-direct-hidden-tree");
  let side = explorer.querySelector<HTMLElement>(":scope > .explorer-direct-side"); if (!side) { side = document.createElement("aside"); side.className = "explorer-direct-side sunken"; explorer.appendChild(side); }
  const fs = loadFs(); if (!fs) return true; const currentId = localStorage.getItem("luxfery26:explorer-path") ?? "root"; const current = findNode(fs, currentId) ?? fs;
  side.innerHTML = "";
  const treeTitle = document.createElement("div"); treeTitle.className = "explorer-direct-title"; treeTitle.textContent = "Strom souborů";
  const treeScroll = document.createElement("div"); treeScroll.className = "explorer-direct-tree"; addTreeBranch(treeScroll, fs, currentId); side.append(treeTitle, treeScroll);
  const overview = document.createElement("div"); overview.className = "explorer-direct-overview";
  const overviewTitle = document.createElement("div"); overviewTitle.className = "explorer-direct-title"; overviewTitle.textContent = "Přehled";
  const overviewIcon = document.createElement("div"); overviewIcon.className = "explorer-direct-preview-icon"; overviewIcon.textContent = current.type === "folder" ? "📁" : "📄";
  const overviewName = document.createElement("strong"); overviewName.textContent = current.name;
  const overviewPath = document.createElement("div"); overviewPath.className = "explorer-direct-preview-path"; overviewPath.textContent = pathFor(fs, current.id ?? "root");
  const overviewMeta = document.createElement("div"); overviewMeta.className = "explorer-direct-meta"; overviewMeta.textContent = current.type === "folder" ? `${(current.children ?? []).filter((item) => !item.deleted).length} položek` : (current.ext ?? "Soubor");
  overview.append(overviewTitle, overviewIcon, overviewName, overviewPath, overviewMeta); side.appendChild(overview);
  const backButton = toolbar.querySelector<HTMLElement>("button");
  if (backButton && !backButton.dataset.directBack) { backButton.dataset.directBack = "1"; backButton.addEventListener("click", (event) => { event.preventDefault(); event.stopImmediatePropagation(); const liveFs = loadFs(); const liveId = localStorage.getItem("luxfery26:explorer-path") ?? "root"; if (liveId === "root") { win.querySelector<HTMLElement>(".controls button:last-child")?.click(); return; } const parent = liveFs ? findParent(liveFs, liveId) : null; dispatchExplorerPath(parent?.id ?? "root"); }, true); }
  toolbar.querySelectorAll<HTMLElement>("button")[1]?.classList.add("explorer-direct-hidden-button"); return true;
}

export function DesktopDragController() {
  const dragRef = useRef<HTMLElement | null>(null); const dropTargetRef = useRef<HTMLElement | null>(null); const [, forceRender] = useState(0);
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => { if (event.button !== 0) return; const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>(".desktop-icon") : null; if (target) dragRef.current = target; };
    const onDoubleClick = (event: MouseEvent) => { const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>(".desktop-icon") : null; if (!target) return; const sourceId = iconIdForButton(target); if (!sourceId?.startsWith("fs:")) return; const fs = loadFs(); const node = fs ? findNode(fs, sourceId.slice(3)) : null; if (node?.type === "folder") localStorage.setItem("luxfery26:explorer-surface", "1"); };
    const onExplorerOpenPath = () => { if (localStorage.getItem("luxfery26:explorer-surface") !== "1") return; window.setTimeout(() => { if (decorateExplorerSurface()) localStorage.removeItem("luxfery26:explorer-surface"); }, 100); };
    const onPointerMove = (event: PointerEvent) => { const source = dragRef.current; if (!source) return; const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(".desktop-icon") ?? null; const nextTarget = target?.innerText.trim().startsWith("Koš") ? target : null; if (dropTargetRef.current !== nextTarget) { dropTargetRef.current = nextTarget; forceRender((value) => value + 1); } };
    const onPointerUp = () => { const source = dragRef.current; if (!source) return; dragRef.current = null; const dropTarget = dropTargetRef.current; dropTargetRef.current = null; forceRender((value) => value + 1); if (dropTarget) { trashItem(iconIdForButton(source) ?? ""); return; } const id = iconIdForButton(source); if (!id) return; const current = positionOf(source); const next = { x: snap(current.x), y: snap(current.y) }; source.style.left = `${next.x}px`; source.style.top = `${next.y}px`; persistPosition(id, next); };
    window.addEventListener("pointerdown", onPointerDown, true); window.addEventListener("dblclick", onDoubleClick, true); window.addEventListener("luxfery:explorer-open-path", onExplorerOpenPath as EventListener); window.addEventListener("pointermove", onPointerMove, true); window.addEventListener("pointerup", onPointerUp, true);
    return () => { window.removeEventListener("pointerdown", onPointerDown, true); window.removeEventListener("dblclick", onDoubleClick, true); window.removeEventListener("luxfery:explorer-open-path", onExplorerOpenPath as EventListener); window.removeEventListener("pointermove", onPointerMove, true); window.removeEventListener("pointerup", onPointerUp, true); };
  }, []);
  useEffect(() => { document.querySelectorAll<HTMLElement>(".desktop-icon").forEach((icon) => icon.classList.toggle("desktop-icon-drop-target", icon === dropTargetRef.current)); });
  return null;
}
