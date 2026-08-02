import { useCallback, useEffect } from 'react';
import { usePersistentState } from '../lib/hooks';

export type ThemePreference = 'dark' | 'light' | 'system';

const STORAGE_KEY = 'echoai:theme';

/**
 * Theme preference applied via `data-theme` on the document root.
 *
 * "system" removes the attribute entirely so the prefers-color-scheme block in
 * tokens.css takes over, which keeps one source of truth for the palette.
 */
export function useTheme(): {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  toggle: () => void;
  resolved: 'dark' | 'light';
} {
  const [preference, setPreference] = usePersistentState<ThemePreference>(STORAGE_KEY, 'dark');

  useEffect(() => {
    const root = document.documentElement;
    if (preference === 'system') {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = preference;
    }
  }, [preference]);

  const resolved: 'dark' | 'light' =
    preference === 'system'
      ? window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
      : preference;

  const toggle = useCallback(() => {
    setPreference(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setPreference]);

  return { preference, setPreference, toggle, resolved };
}
