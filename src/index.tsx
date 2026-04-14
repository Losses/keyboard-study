import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { App } from './App';
import './App.css';
import { setupDebugTools } from './utils/debug-tools';

// Set up debug tools for development
setupDebugTools();

if (location.pathname === "/data") {
  location.href = "https://docs.google.com/spreadsheets/d/1q4sn_fiseydSPTENx1-Hblz2yZTDQgk_MF2MnstbAXE";
}

let container = document.getElementById("app")!;
let root = createRoot(container);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
