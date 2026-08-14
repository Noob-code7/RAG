import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyTheme, storedSettings } from './context/SettingsContext';
import './index.css';

// Apply the persisted theme before first paint to avoid a flash of the wrong theme.
applyTheme(storedSettings());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);