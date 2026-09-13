import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

export type ManagedWindow = {
  id: string;
  title: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  zIndex: number;
};

type Props = {
  windowData: ManagedWindow;
  active: boolean;
  taskbarHeight: number;
  onFocus: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
  children: ReactNode;
};

export function WindowFrame({ windowData: w, active, taskbarHeight, onFocus, onMove, onResize, onMinimize, onMaximize, onClose, children }: Props) {
  const dragRef = useRef<{ offsetX: number; offsetY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; width: number; height: number } | null>(null);

  useEffect(() => {
    const move = (event: MouseEvent) => {
      if (dragRef.current && !w.maximized) {
        onMove(
          Math.max(0, event.clientX - dragRef.current.offsetX),
          Math.max(0, event.clientY - dragRef.current.offsetY),
        );
      }
      if (resizeRef.current && !w.maximized) {
        onResize(
          Math.max(280, resizeRef.current.width + event.clientX - resizeRef.current.startX),
          Math.max(180, resizeRef.current.height + event.clientY - resizeRef.current.startY),
        );
      }
    };
    const up = () => {
      dragRef.current = null;
      resizeRef.current = null;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [onMove, onResize, w.maximized]);

  if (w.minimized) return null;

  const style: CSSProperties = w.maximized
    ? { left: 0, top: 0, right: 0, bottom: taskbarHeight, width: "auto", height: "auto", zIndex: w.zIndex }
    : { left: w.x, top: w.y, width: w.width, height: w.height, zIndex: w.zIndex };

  return (
    <section className={`window ${active ? "active" : ""}`} style={style} onMouseDown={onFocus}>
      <div
        className="titlebar"
        onDoubleClick={onMaximize}
        onMouseDown={(event) => {
          if (w.maximized) return;
          dragRef.current = { offsetX: event.clientX - w.x, offsetY: event.clientY - w.y };
        }}
      >
        <b className="sys">{w.icon}</b>
        <strong>{w.title}</strong>
        <div className="controls">
          <button aria-label="Minimalizovat" onClick={(event) => { event.stopPropagation(); onMinimize(); }}>_</button>
          <button aria-label={w.maximized ? "Obnovit" : "Maximalizovat"} onClick={(event) => { event.stopPropagation(); onMaximize(); }}>{w.maximized ? "❐" : "□"}</button>
          <button aria-label="Zavřít" onClick={(event) => { event.stopPropagation(); onClose(); }}>×</button>
        </div>
      </div>
      <div className="window-body">{children}</div>
      {!w.maximized && (
        <div
          className="window-resize-handle"
          aria-hidden="true"
          onMouseDown={(event) => {
            event.stopPropagation();
            resizeRef.current = { startX: event.clientX, startY: event.clientY, width: w.width, height: w.height };
          }}
        />
      )}
    </section>
  );
}
