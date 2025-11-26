import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// This file customizes the root HTML for web builds.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />

        {/* Link the PWA manifest and bootstrap the service worker. */}
        <link rel="manifest" href="/manifest.json" />
        <script dangerouslySetInnerHTML={{ __html: swRegister }} />

        {/* Disable body scrolling on web so ScrollView behaves like native. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}

const swRegister = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}
`;
