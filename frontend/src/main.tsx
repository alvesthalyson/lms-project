import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./index.css";
import { syncDocumentWithPrefs } from "./lib/i18n/store";

syncDocumentWithPrefs(); // <html lang> and data-theme from the saved choices, before the first paint

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline shell. Production only: in `vite dev` a service worker would serve stale modules.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}
