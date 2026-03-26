import { useState, useEffect } from 'react';

/**
 * Hook to detect if a media query matches
 * @param query Media query string like '(max-width: 768px)'
 * @returns boolean indicating if the query matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = () => setMatches(media.matches);
    
    // Initial check
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}
