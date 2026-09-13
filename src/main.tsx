import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ContextMenuLayer } from "./shell/ContextMenuLayer";
import { DesktopDragController } from "./shell/DesktopDragController";
import { NotificationCenter } from "./shell/NotificationCenter";
import { RetroBackground } from "./RetroBackground";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("LUXFERY 26: root element #root was not found.");
}

createRoot(root).render(
  <StrictMode>
    <RetroBackground />
    <App />
    <NotificationCenter />
    <ContextMenuLayer />
    <DesktopDragController />
  </StrictMode>,
);
