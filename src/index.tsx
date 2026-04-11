import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { App } from './App';
import './App.css';
import { setupDebugTools } from './utils/debug-tools';

// Set up debug tools for development
setupDebugTools();

let container = document.getElementById("app")!;
let root = createRoot(container)
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
