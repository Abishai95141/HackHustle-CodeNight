import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

const DARK_PREFIXES = ['/scan', '/me', '/board', '/judge'];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  useEffect(() => {
    const isDark = DARK_PREFIXES.some((p) => pathname.startsWith(p));
    document.documentElement.classList.toggle('dark', isDark);
  }, [pathname]);

  return <>{children}</>;
}
