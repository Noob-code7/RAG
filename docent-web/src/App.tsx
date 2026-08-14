import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SettingsProvider } from './context/SettingsContext';
import { ToastProvider } from './components/ui/Toast';
import Landing from './pages/Landing';
import NotebooksHome from './pages/NotebooksHome';
import NotebookWorkspace from './pages/NotebookWorkspace';
import Workspace from './pages/Workspace';
import HowThisWorks from './pages/HowThisWorks';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Help from './pages/Help';

export default function App() {
  return (
    <SettingsProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/notebooks" element={<NotebooksHome />} />
            <Route path="/notebooks/:id" element={<NotebookWorkspace />} />
            <Route path="/workspace" element={<Workspace />} />
            <Route path="/welcome" element={<Navigate to="/" replace />} />
            <Route path="/how-it-works" element={<HowThisWorks />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/help" element={<Help />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </SettingsProvider>
  );
}