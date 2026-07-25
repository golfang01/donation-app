import { Routes, Route } from 'react-router-dom';
import DonationPage from './pages/DonationPage';
import OverlayPage from './pages/OverlayPage';
import MobileUploadPage from './pages/MobileUploadPage';


export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DonationPage />} />
      <Route path="/overlay" element={<OverlayPage />} />
      <Route path="/mobile-upload" element={<MobileUploadPage />} />
    </Routes>
  );
}