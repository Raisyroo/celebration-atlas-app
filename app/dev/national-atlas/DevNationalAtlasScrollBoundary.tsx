'use client';

import { useEffect, type ReactNode } from 'react';

const DEV_NATIONAL_ATLAS_SCROLL_CLASS = 'dev-national-atlas-scroll';

interface DevNationalAtlasScrollBoundaryProps {
  children: ReactNode;
}

export default function DevNationalAtlasScrollBoundary({
  children,
}: DevNationalAtlasScrollBoundaryProps) {
  useEffect(() => {
    document.documentElement.classList.add(DEV_NATIONAL_ATLAS_SCROLL_CLASS);
    document.body.classList.add(DEV_NATIONAL_ATLAS_SCROLL_CLASS);

    return () => {
      document.documentElement.classList.remove(DEV_NATIONAL_ATLAS_SCROLL_CLASS);
      document.body.classList.remove(DEV_NATIONAL_ATLAS_SCROLL_CLASS);
    };
  }, []);

  return children;
}
