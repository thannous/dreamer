import { Href, Link } from 'expo-router';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { type ComponentProps } from 'react';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: Href & string };

const ensureSecureRel = (rel?: string): string => {
  const tokens = (rel ?? '').split(/\s+/).filter(Boolean);
  const set = new Set(tokens);
  set.add('noopener');
  set.add('noreferrer');
  return Array.from(set).join(' ');
};

export function ExternalLink({ href, rel, target = '_blank', ...rest }: Props) {
  // Security: prevent reverse tabnabbing when opening a new tab.
  const secureRel = target === '_blank' ? ensureSecureRel(rel) : rel;
  return (
    <Link
      target={target}
      rel={secureRel}
      {...rest}
      href={href}
      onPress={async (event) => {
        if (process.env.EXPO_OS !== 'web') {
          // Prevent the default behavior of linking to the default browser on native.
          event.preventDefault();
          // Open the link in an in-app browser.
          await openBrowserAsync(href, {
            presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
          });
        }
      }}
    />
  );
}
