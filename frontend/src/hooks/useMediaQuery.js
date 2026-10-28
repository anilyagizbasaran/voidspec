import { useEffect, useState } from 'react';

// CSS media query'sini React durumuna çevirir. Tailwind sınıfları yalnızca
// görünümü değiştirebiliyor; bileşenin farklı bir yapı çizmesi gerektiğinde
// (ör. mobilde ızgara yerine tek sütun) bu kullanılıyor.
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

// Tailwind'in md kırılımı (768px) altı.
export const useIsMobile = () => useMediaQuery('(max-width: 767px)');
