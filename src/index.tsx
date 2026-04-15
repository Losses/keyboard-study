import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { App } from './App';
import './App.css';
import { setupDebugTools } from './utils/debug-tools';

if (location.pathname === "/data") {
  location.href = "https://docs.google.com/spreadsheets/d/1q4sn_fiseydSPTENx1-Hblz2yZTDQgk_MF2MnstbAXE";
}

if (location.pathname === "w1") {
  location.href = "https://gist.github.com/Losses/8056b3ae3da89dae844fa48df0ea6881"
}

// Set up debug tools for development
setupDebugTools();

let container = document.getElementById("app")!;
let root = createRoot(container);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
