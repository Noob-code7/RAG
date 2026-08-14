import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Landing from './pages/Landing';
import Chat from './pages/Chat';
import Upload from './pages/Upload';
import HowThisWorks from './pages/HowThisWorks';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<Chat />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/how-it-works" element={<HowThisWorks />} />
      </Routes>
    </BrowserRouter>
  );
}