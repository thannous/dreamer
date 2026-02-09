# Mobile SEO --- Noctalia SEO Audit

**Date:** 2026-02-09 | **Scope:** Full site (530 pages, 5 languages) | **Domain:** noctalia.app

---

## Executive Summary

**Health Score:** Yellow --- Responsive design is solid with correct viewport configuration and Tailwind-based breakpoints. However, heavy CSS animations (aurora background, blur orbs) and glass-panel effects may impact performance on low-end mobile devices. Touch target sizes need verification.

| Metric | Value |
|--------|-------|
| Viewport meta tag | 100% (`width=device-width, initial-scale=1.0`) |
| Responsive framework | Tailwind CSS with `sm:`, `md:`, `lg:` breakpoints |
| overflow-x: hidden | Applied to body on homepage |
| Glass-panel UI | `backdrop-filter: blur(20px)` on navbar and cards |
| Aurora background animation | `aurora 20s ease infinite` on homepage |
| Blur orbs | `filter: blur(100px)` on 375+ files (symbols, guides) |
| MobileApplication schema | Present on homepage (Android/Google Play) |
| prefers-reduced-motion | Found in 2 files only (`js/landing-animations.js`, `auth/callback/index.html`) |
| Blog content max-width | `max-w-5xl` with `px-4`/`px-6` padding |
| Font preloading | 3 fonts preloaded (Outfit Regular, Outfit Bold, Fraunces Variable) |

## Current State

### Viewport Configuration
Every page includes the correct viewport meta tag:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```
This is present on 100% of the 530 pages, ensuring proper mobile rendering.

### Responsive Layout
The site uses Tailwind CSS with responsive breakpoints throughout:
- Navigation: `max-w-7xl mx-auto`, `px-4 md:px-6 py-4 md:py-6`
- Content areas: `max-w-5xl mx-auto`, `pt-32 pb-20 px-6`
- Grid layouts: `grid grid-cols-1 md:grid-cols-2`, `grid-cols-1 md:grid-cols-3`
- Typography: `text-4xl md:text-5xl` for headings
- Element visibility: `hidden md:inline-flex` for desktop-only nav links, `hidden sm:inline` for language labels

### Horizontal Overflow Prevention
The homepage body includes `overflow-x-hidden` to prevent horizontal scrolling caused by oversized orb elements:
```html
<body class="... overflow-x-hidden" style="background-color: #0a0514;">
```
Orb elements use constrained sizing: `w-[70vw] h-[70vw] md:w-[40rem] md:h-[40rem]`

### Glass-Panel UI
The site uses a glass-morphism design with `backdrop-filter: blur()` extensively:
- Navbar: `bg-dream-dark/80 backdrop-blur-md border-b border-white/5`
- Cards on symbol/guide pages: `glass-panel rounded-2xl p-6` (which applies `backdrop-filter: blur(20px)` via CSS class)
- This effect is GPU-accelerated but can impact rendering performance on low-end mobile devices

### Background Animations
The homepage includes:
1. **Aurora background**: `<div class="aurora-bg"></div>` with CSS animation `aurora 20s ease infinite` and `background-size: 200% 200%`
2. **Floating orbs**: `<div class="orb ... animate-float"></div>` with `filter: blur(100px)` applied to 375+ files across the site
3. **Noise overlay**: `<div class="noise-overlay"></div>` for texture

These run continuously, consuming GPU resources.

### Content Readability
- Blog articles use `max-w-5xl` (~64rem / 1024px) with `px-4` padding, providing readable line lengths on mobile
- Font sizes use Tailwind responsive classes (`text-sm`, `text-base`, `text-xl`, etc.) which default to 14px+ (above the 12px minimum)
- Body text uses `text-gray-300 leading-relaxed` for comfortable reading
- Fonts are preloaded (3 WOFF2 files) to prevent FOIT/FOUT

### Navigation
- Fixed navbar with glass-panel effect stays accessible while scrolling
- Language dropdown has proper ARIA attributes: `aria-haspopup="true"`, `aria-expanded="false"`, `aria-label="Choose language"`, `role="menu"`, `role="menuitem"`
- Back button and navigation links use Tailwind flex layout

### Structured Data
The homepage includes `MobileApplication` schema referencing the Android app on Google Play:
```json
{
  "@type": "MobileApplication",
  "name": "Noctalia",
  "operatingSystem": "Android",
  "applicationCategory": "LifestyleApplication",
  "downloadUrl": "https://play.google.com/store/apps/details?id=com.tanuki75.noctalia"
}
```

### Symbol/Guide Pages
- Symbol cards use hover effects: `hover:border-dream-salmon/30 transition-all hover:-translate-y-1`
- These are desktop-optimized hover states that degrade gracefully on touch (no hover state stuck)
- Cards use `backdrop-filter: blur(100px)` for the blur orb background effect (found in 375+ files)

## Issues & Gaps

### P0 --- Critical

None identified.

### P1 --- High Priority

1. **Aurora-bg animation and blur(100px) orbs run continuously on all pages**: The `aurora-bg` CSS animation runs a 20-second infinite loop with `background-size: 200% 200%`. The orb elements apply `filter: blur(100px)` which is computationally expensive. On the homepage, both effects combine. On symbol/guide pages (375+ files), the blur effect is present. These continuous GPU animations can:
   - Drain battery on mobile devices
   - Cause jank/stuttering on low-end Android devices
   - Increase time-to-interactive

   **Mitigation**: `prefers-reduced-motion` is only respected in 2 files (`js/landing-animations.js` for GSAP animations and `auth/callback/index.html`). The CSS animations (aurora, float, blur) do NOT check this media query.

### P2 --- Optimization

1. **Touch targets on language dropdown items may be below 48x48px threshold**: Dropdown menu items use `px-4 py-2 text-sm` which produces approximately 32x28px clickable areas. Google recommends a minimum of 48x48px for mobile touch targets. The dropdown trigger button uses `px-3 py-2` which is similarly small.

2. **No explicit font-size minimum enforced**: The site relies on Tailwind defaults (which are generally 16px+ for body text), but some UI elements use `text-xs` (12px) and `text-[10px]` (e.g., the copyright footer). While not a direct SEO issue, very small text may trigger mobile usability warnings.

3. **Consider prefers-reduced-motion for all CSS animations**: Currently only GSAP/JS animations respect `prefers-reduced-motion`. The CSS-based aurora animation, floating orbs, and hover transforms should also be disabled or simplified for users who prefer reduced motion.

4. **Symbol card hover effects are desktop-optimized**: The `hover:-translate-y-1` transform works on desktop but provides no visual feedback for touch interactions. Consider adding `active:` states for mobile tap feedback.

5. **Glass-panel backdrop-filter on many elements**: While GPU-accelerated, having multiple layers of `backdrop-filter: blur()` on a single viewport (navbar + card + orb) can cause compositing overhead on mobile.

## Recommendations

1. **Add `prefers-reduced-motion` media query to CSS animations.** Disable or simplify `aurora-bg`, `animate-float`, and `animate-float-delayed` when the user prefers reduced motion:
   ```css
   @media (prefers-reduced-motion: reduce) {
     .aurora-bg { animation: none; }
     .orb { animation: none; filter: none; }
     .animate-float, .animate-float-delayed { animation: none; }
   }
   ```

2. **Increase touch target sizes for language dropdown items.** Change from `py-2` to `py-3` for dropdown menu items to achieve closer to 48px height:
   ```html
   <a class="... px-4 py-3 text-sm ..." role="menuitem">
   ```

3. **Consider conditionally loading blur orb effects.** On mobile, the 100px blur orbs could be simplified to solid-color gradient circles or removed entirely, reducing GPU load without significantly affecting visual quality on small screens.

4. **Add `active:` states for mobile tap feedback** on interactive cards:
   ```html
   <a class="... hover:-translate-y-1 active:scale-[0.98] ...">
   ```

5. **Audit text size minimums.** Replace `text-[10px]` copyright text with `text-xs` (12px) minimum to avoid mobile usability warnings.

## Validation Commands

```bash
# Verify viewport meta on all pages
grep -rl 'width=device-width' docs/en/ --include="*.html" | wc -l
# Expected: 106

# Check prefers-reduced-motion usage
grep -rl 'prefers-reduced-motion' docs/ --include="*.html" --include="*.css" --include="*.js"

# Count pages with blur(100px) orb elements
grep -rl 'blur(100px)' docs/ --include="*.html" | wc -l
# Expected: 375+

# Check for aurora-bg usage
grep -rl 'aurora-bg' docs/ --include="*.html" | wc -l

# Verify overflow-x-hidden on homepage
grep 'overflow-x-hidden' docs/en/index.html

# Check MobileApplication schema
grep -l 'MobileApplication' docs/en/index.html

# Find very small text sizes
grep -r 'text-\[10px\]' docs/en/ --include="*.html" | wc -l

# Check touch target sizing on dropdown
grep 'py-2 text-sm.*role="menuitem"' docs/en/about.html
```

## Sample Pages Audited

| Page | Type | Status |
|------|------|--------|
| `en/index.html` | Homepage | Viewport correct; aurora-bg + 2 blur orbs + glass-panel navbar = heavy GPU load; overflow-x-hidden present; MobileApplication schema present |
| `en/blog/snake-dreams-meaning.html` | Blog article | Viewport correct; max-w-5xl readable layout; eager loading for hero; no aurora/orb effects (blog template is lighter) |
| `en/symbols/snake.html` | Symbol page | Viewport correct; blur(100px) orb present; glass-panel cards; touch targets need verification |
| `en/about.html` | Utility page | Viewport correct; no heavy animations; glass-panel cards only; language dropdown touch targets small (py-2) |
| `en/blog/index.html` | Blog index | Viewport correct; 22 lazy-loaded thumbnails; responsive grid (1-col mobile, 3-col desktop) |
| `en/guides/most-common-dream-symbols.html` | Guide page | Viewport correct; blur orb present; glass-panel cards; responsive grid layout |
| `en/legal-notice.html` | Legal page | Viewport correct; lightweight page, no animations; glass-panel cards only |
| `en/terms.html` | Terms page | Viewport correct; lightweight; medical notice alert box renders correctly on mobile |
| `fr/index.html` | Homepage (FR) | Mirrors EN: aurora-bg + orbs + glass-panel; same performance concerns |
| `de/traumsymbole/schlange.html` | Symbol page (DE) | Mirrors EN symbol template: blur orb present; glass-panel cards |
