import { useEffect, useState } from "react";
import type { SystemNotice } from "../core/system";

export function NotificationCenter() {
  const [items, setItems] = useState<SystemNotice[]>([]);

  useEffect(() => {
    const onNotice = (event: Event) => {
      const custom = event as CustomEvent<SystemNotice>;
      const notice = custom.detail;
      if (!notice?.id) return;
      setItems((current) => [...current, notice].slice(-4));
      window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== notice.id)), 4200);
    };
    window.addEventListener("luxfery:notice", onNotice);
    return () => window.removeEventListener("luxfery:notice", onNotice);
  }, []);

  return <div className="notification-center" aria-live="polite">{items.map((item) => <div className={`system-notice notice-${item.tone ?? "info"}`} key={item.id} role="status"><div className="system-notice-title">{item.title}</div><div className="system-notice-message">{item.message}</div></div>)}</div>;
}
