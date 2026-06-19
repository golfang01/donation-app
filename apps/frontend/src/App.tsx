import { Routes, Route } from 'react-router-dom';
import DonationPage from './pages/DonationPage';
import OverlayPage from './pages/OverlayPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DonationPage />} />
      <Route path="/overlay" element={<OverlayPage />} />
    </Routes>
  );
}