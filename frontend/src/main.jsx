// src/main.jsx
import React from "react"; // StrictMode removed for brevity, can be added back
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/index.css"; // Your global styles
import "./styles/chat.css"; // If you have chat-specific global CSS, keep it

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    // <React.StrictMode> // Re-add if desired
      <App />
    // </React.StrictMode>,
  );
} else {
  console.error("Root element (#root) not found.");
}
