import { useEffect, useRef, useState } from "react";
import { FILESYSTEM_KEY, loadRegistry, saveRegistry } from "../core/runtime";
import "./DesktopDragController.css";

type FsNode = {
  id?: string;
  name: string;
  type: "folder" | "file";
  ext?: string;
  children?: FsNode[];
  deleted?: boolean;
};

type IconPosition = { x: number; y: number };

const STATIC_IDS: Record<string, string> = {
  "Tento počítač": "my-computer",
  ChatGPT: "chatgpt",
  Figma: "figma",
  "VS Code": "vscode",
  Internet: "internet",
  Development: "development",
  Design: "design",
  Media: "media",
  System: "system",
};

function loadFs(): FsNode | null {
  try {
    const raw = localStorage.getItem(FILESYSTEM_KEY);
    return raw ? JSON.parse(raw) as FsNode : null;
  } catch {
    return null;
  }
}

function findNode(root: FsNode, id: string): FsNode | null {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function updateTree(root: FsNode, id: string, updater: (node: FsNode) => FsNode): FsNode {
  if (root.id === id) return updater(root);
  return { ...root, children: root.children?.map((child) => updateTree(child, id, updater)) };
}

function removeTree(root: FsNode, id: string): FsNode {
  return { ...root, children: root.children?.filter((child) => child.id !== id).map((child) => removeTree(child, id)) };
}

function nodeForLabel(root: FsNode, label: string): FsNode | null {
  const desktop = findNode(root, "desktop");
  return (desktop?.children ?? []).find((item) => item.name === label && !item.deleted) ?? null;
}

function iconIdForButton(button: HTMLElement): string | null {
  const label = button.innerText.trim().replace(/\s+/g, " ");
  if (label.startsWith("Koš")) return "recycle";
  if (STATIC_IDS[label]) return STATIC_IDS[label];
  const fs = loadFs();
  const node = fs ? nodeForLabel(fs, label) : null;
  return node?.id ? `fs:${node.id}` : null;
}

function snap(value: number, grid = 8) {
  return Math.max(4, Math.round(value / grid) * grid);
}

function positionOf(button: HTMLElement): IconPosition {
  const left = Number.parseFloat(button.style.left || "0");
  const top = Number.parseFloat(button.style.top || "0");
  return { x: Number.isFinite(left) ? left : 0, y: Number.isFinite(top) ? top : 0 };
}

function persistPosition(id: string, position: IconPosition) {
  const registry = loadRegistry();
  saveRegistry({
    ...registry,
    HKCU: {
      ...registry.HKCU,
      Desktop: {
        ...registry.HKCU.Desktop,
        iconPositions: {
          ...registry.HKCU.Desktop.iconPositions,
          [id]: position,
        },
      },
    },
  });
}

function trashItem(sourceId: string) {
  if (!sourceId.startsWith("fs:")) return false;
  const nodeId = sourceId.slice(3);
  const fs = loadFs();
  if (!fs || nodeId === "recycle") return false;
  const source = findNode(fs, nodeId);
  const desktop = findNode(fs, "desktop");
  const recycle = findNode(fs, "recycle");
  if (!source || !desktop || !recycle || source.deleted) return false;
  const moved = { ...structuredClone(source), id: `trash-${nodeId}-${Date.now()}`, deleted: true };
  let next = removeTree(fs, nodeId);
  next = updateTree(next, "recycle", (current) => ({ ...current, children: [...(current.children ?? []), moved] }));
  localStorage.setItem(FILESYSTEM_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("luxfery:filesystem-changed"));
  window.dispatchEvent(new CustomEvent("luxfery:notice", {
    detail: {
      id: `${Date.now()}-desktop-trash`,
      title: "Koš",
      message: `„${source.name}“ bylo přesunuto do Koše přetažením.`,
      tone: "info",
    },
  }));
  return true;
}

export function DesktopDragController() {
  const dragRef = useRef<HTMLElement | null>(null);
  const dropTargetRef = useRef<HTMLElement | null>(null);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>(".desktop-icon") : null;
      if (!target) return;
      dragRef.current = target;
    };

    const onPointerMove = (event: PointerEvent) => {
      const source = dragRef.current;
      if (!source) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(".desktop-icon") ?? null;
      const nextTarget = target?.innerText.trim().startsWith("Koš") ? target : null;
      if (dropTargetRef.current !== nextTarget) {
        dropTargetRef.current = nextTarget;
        forceRender((value) => value + 1);
      }
    };

    const onPointerUp = () => {
      const source = dragRef.current;
      if (!source) return;
      dragRef.current = null;
      const dropTarget = dropTargetRef.current;
      dropTargetRef.current = null;
      forceRender((value) => value + 1);
      if (dropTarget) {
        trashItem(iconIdForButton(source) ?? "");
        return;
      }
      const id = iconIdForButton(source);
      if (!id) return;
      const current = positionOf(source);
      const next = { x: snap(current.x), y: snap(current.y) };
      source.style.left = `${next.x}px`;
      source.style.top = `${next.y}px`;
      persistPosition(id, next);
      window.dispatchEvent(new CustomEvent("luxfery:notice", {
        detail: {
          id: `${Date.now()}-desktop-snap`,
          title: "Plocha",
          message: "Ikona byla přichycena k mřížce.",
          tone: "info",
        },
      }));
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
    };
  }, []);

  useEffect(() => {
    document.querySelectorAll<HTMLElement>(".desktop-icon").forEach((icon) => icon.classList.toggle("desktop-icon-drop-target", icon === dropTargetRef.current));
  });

  return null;
}
