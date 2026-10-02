import { useSyncExternalStore } from 'react';

const query = '(prefers-color-scheme: dark)';

function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function getSnapshot(): 'light' | 'dark' {
  return window.matchMedia(query).matches ? 'dark' : 'light';
}

function getServerSnapshot(): 'light' {
  return 'light';
}

/** Keep native props and CSS consumers synchronized with the browser's system theme. */
export function useColorScheme() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
