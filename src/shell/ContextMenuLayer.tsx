import { useEffect, useState } from "react";

type Point = { x: number; y: number };
type Target = { element: HTMLElement; label: string; openable: boolean };

type MenuState = { point: Point; target?: Target; properties?: boolean } | null;

function describe(element: HTMLElement) {
  const label = element.innerText?.trim().split("\n")[0] || element.getAttribute("aria-label") || element.tagName;
  return label.slice(0, 100);
}

export function ContextMenuLayer() {
  const [menu, setMenu] = useState<MenuState>(null);

  useEffect(() => {
    const close = () => setMenu(null);
    const onContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const icon = target.closest<HTMLElement>(".desktop-icon, .file-icon, .selected-file, .selected-row");
      const desktop = target.closest<HTMLElement>(".desktop");
      if (!icon && !desktop) return;
      event.preventDefault();
      event.stopPropagation();
      const element = icon ?? desktop!;
      const openable = Boolean(icon);
      setMenu({ point: { x: event.clientX, y: event.clientY }, target: { element, label: describe(element), openable } });
    };
    window.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("contextmenu", onContextMenu, true);
      window.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, []);

  if (!menu) return null;

  if (menu.properties && menu.target) {
    return (
      <div className="os-modal-backdrop" onMouseDown={() => setMenu(null)}>
        <section className="os-properties" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
          <div className="titlebar"><strong>Vlastnosti</strong><button onClick={() => setMenu(null)} aria-label="Zavřít">×</button></div>
          <div className="os-properties-body">
            <div className="properties-icon">▣</div>
            <h3>{menu.target.label}</h3>
            <dl>
              <dt>Typ</dt><dd>{menu.target.element.classList.contains("desktop-icon") ? "Zástupce / objekt plochy" : "Položka Exploreru"}</dd>
              <dt>Režim</dt><dd>LUXFERY virtuální objekt</dd>
              <dt>Zdroj</dt><dd>Browser OS</dd>
            </dl>
          </div>
          <div className="os-properties-actions"><button className="win-btn" onClick={() => setMenu(null)}>OK</button></div>
        </section>
      </div>
    );
  }

  const left = Math.min(menu.point.x, Math.max(4, window.innerWidth - 210));
  const top = Math.min(menu.point.y, Math.max(4, window.innerHeight - 170));

  const openTarget = () => {
    const target = menu.target?.element;
    if (target) target.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    setMenu(null);
  };

  const copyLabel = async () => {
    if (menu.target?.label) await navigator.clipboard?.writeText(menu.target.label);
    setMenu(null);
  };

  return (
    <div className="desktop-context-menu os-context-menu" style={{ left, top }} onMouseDown={(event) => event.stopPropagation()}>
      {menu.target?.openable && <button onClick={openTarget}>Otevřít</button>}
      {menu.target && <button onClick={copyLabel}>Kopírovat název</button>}
      {menu.target && <button onClick={() => setMenu({ ...menu, properties: true })}>Vlastnosti</button>}
      {!menu.target?.openable && <>
        <button onClick={() => window.location.reload()}>Obnovit</button>
        <button onClick={() => document.querySelector<HTMLButtonElement>(".start-button")?.click()}>Start</button>
      </>}
      <button onClick={() => setMenu(null)}>Zrušit</button>
    </div>
  );
}
