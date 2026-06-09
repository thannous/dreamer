# Noctalia dogfooding - 2026-05-21

Scope: live site `https://noctalia.app`, header/footer paths, desktop and mobile.

Tooling:
- `agent-browser` CLI 0.27.0
- Desktop viewport: 1440x1000
- Mobile viewports: 390x844 and 375x667
- Tablet viewport: 1024x768

## Findings

### P1 - French home hero H1 drops out of the accessibility tree

URL: `https://noctalia.app/fr/`

Reproduction:
1. Open the home page.
2. Use the language selector to switch to `Français`, or load `/fr/` directly.
3. Wait for network idle.

Observed:
- Visual control screenshots show the hero headline can render for sighted users.
- However, the `agent-browser snapshot` for `/fr/` does not expose the hero H1 as a heading. The first heading in `main` is the next section, `De l'oreiller à la clarté`.
- Live DOM inspection confirms the `h1.hero-title` can remain in a hidden animation state after load:
  - `transform: translate(0px, 16px)`
  - `opacity: 0`
  - `visibility: hidden`
- The H1 text exists in `textContent`, but `innerText` is empty in that state.
- The English home page snapshot exposes its hero H1 normally, so this appears localized/state-specific.

Expected:
- The localized hero title should remain visible to assistive technology and keep its H1 semantics after the page has loaded.

Evidence:
- `screenshots/desktop-french-home.png`
- `screenshots/desktop-french-after-wait.png`
- `screenshots/desktop-french-playwright-direct.png`
- `agent-browser snapshot` on `/fr/` direct load: first exposed heading in `main` was H2 `De l'oreiller à la clarté`.
- `agent-browser eval` on `/fr/` direct load: `h1.hero-title` had `opacity: 0`, `visibility: hidden`, and empty `innerText`.

Likely area:
- The hero animation setup for localized static pages. The initial `opacity-0 hero-anim hero-title` state is not reliably cleared for accessibility on `/fr/`.

### P2 - Small mobile menu feels visually unfinished on short screens

URL: `https://noctalia.app/`

Viewport: 375x667

Reproduction:
1. Open the home page on a short mobile viewport.
2. Open the header menu.

Observed:
- The mobile menu panel is 475px high and starts at y=60, ending at y=535.
- On a 667px-high viewport, the hero content and CTAs remain visible underneath/behind the menu.
- The accessibility snapshot still exposes the whole main content while the menu is open, which makes the screen feel like two active layers.
- A background click closed the menu instead of navigating, so this is mainly a visual/interaction polish issue rather than a broken navigation bug.

Expected:
- On short mobile screens, the menu should either behave like a clearer modal/sheet with backdrop and background inerting, or occupy a constrained scrollable panel that does not visually compete with the hero.

Evidence:
- `screenshots/small-mobile-menu-375x667.png`
- `screenshots/small-mobile-background-click-result.png`
- `agent-browser snapshot` with menu open showed nav links and main content exposed simultaneously.

### P3 - Footer is readable but too dense on mobile

URL: `https://noctalia.app/`

Observed:
- Footer columns are functional and readable.
- On mobile, the footer is very long, with many article/resource links stacked together. It works, but it is heavy for a conversion-oriented landing page.

Expected:
- Consider collapsing secondary footer groups on mobile, shortening article labels, or prioritizing product/legal/download links first.

Evidence:
- `screenshots/mobile-footer-end.png`
- `screenshots/desktop-footer-end.png`

## Checks That Looked OK

- Desktop header at 1440px: no overlap observed.
- Desktop language dropdown: opens cleanly.
- Tablet-ish 1024px header: compact but not broken.
- Mobile primary hero at 390x844: text and CTA stack fit.
- Mobile Resources path from menu to `/en/blog/`: navigation worked and content rendered.
- `agent-browser errors` returned no page errors on the tested desktop/mobile sessions.
