import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

export function getMobileFavoriteStorageKey(storageScope: string): string {
  return `celebration-atlas:${storageScope}:favorite`;
}

export function useMobileFavorite(
  storageScope = 'michigan',
): [boolean, Dispatch<SetStateAction<boolean>>] {
  const storageKey = getMobileFavoriteStorageKey(storageScope);
  const [isMobileFavoriteSaved, setIsMobileFavoriteSaved] = useState(false);
  const hasLoadedMobileFavoriteRef = useRef(false);

  useEffect(() => {
    hasLoadedMobileFavoriteRef.current = false;
    const favoriteLoadTimer = window.setTimeout(() => {
      try {
        setIsMobileFavoriteSaved(
          window.localStorage.getItem(storageKey) === 'true',
        );
      } catch {
        setIsMobileFavoriteSaved(false);
      } finally {
        hasLoadedMobileFavoriteRef.current = true;
      }
    }, 0);

    return () => window.clearTimeout(favoriteLoadTimer);
  }, [storageKey]);

  useEffect(() => {
    if (!hasLoadedMobileFavoriteRef.current) return;
    try {
      window.localStorage.setItem(
        storageKey,
        isMobileFavoriteSaved ? 'true' : 'false',
      );
    } catch {
      // Favorites still provide a polished visual toggle if storage is unavailable.
    }
  }, [isMobileFavoriteSaved, storageKey]);

  return [isMobileFavoriteSaved, setIsMobileFavoriteSaved];
}
