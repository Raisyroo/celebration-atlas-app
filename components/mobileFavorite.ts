import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

export const MOBILE_FAVORITE_STORAGE_KEY = 'celebration-atlas:michigan:favorite';

export function useMobileFavorite(): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [isMobileFavoriteSaved, setIsMobileFavoriteSaved] = useState(false);
  const hasLoadedMobileFavoriteRef = useRef(false);

  useEffect(() => {
    const favoriteLoadTimer = window.setTimeout(() => {
      try {
        setIsMobileFavoriteSaved(
          window.localStorage.getItem(MOBILE_FAVORITE_STORAGE_KEY) === 'true',
        );
      } catch {
        setIsMobileFavoriteSaved(false);
      } finally {
        hasLoadedMobileFavoriteRef.current = true;
      }
    }, 0);

    return () => window.clearTimeout(favoriteLoadTimer);
  }, []);

  useEffect(() => {
    if (!hasLoadedMobileFavoriteRef.current) return;
    try {
      window.localStorage.setItem(
        MOBILE_FAVORITE_STORAGE_KEY,
        isMobileFavoriteSaved ? 'true' : 'false',
      );
    } catch {
      // Favorites still provide a polished visual toggle if storage is unavailable.
    }
  }, [isMobileFavoriteSaved]);

  return [isMobileFavoriteSaved, setIsMobileFavoriteSaved];
}
