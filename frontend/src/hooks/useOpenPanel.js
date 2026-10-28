import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// Bir paneli açar. Widget'lar eskiden store'daki setActiveTab'ı çağırıyordu;
// aktif panel URL'ye taşınınca o fonksiyon kalktı ve widget'lara tıklamak
// hiçbir şey yapmıyordu.
export function useOpenPanel() {
  const navigate = useNavigate();
  return useCallback((id) => navigate(`/${id}`), [navigate]);
}
