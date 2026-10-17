# SIM.Africa — Made for the journey

A warm editorial design system for African travel connectivity. Forest ink, ivory canvas, natural photography, and a small burst of citron. The interface should make choosing a data plan feel clear and unhurried.

## Research and direction

Reviewed 21st.dev’s [Editorial Hero](https://21st.dev/@felipemenezes098/components/hero-05), [Editorial Image Hero](https://21st.dev/@felipemenezes098/components/hero-07), [Editorial Collage Hero](https://21st.dev/@felipemenezes098/components/hero-04), [Pricing Section](https://21st.dev/@aymanch-03/components/pricing-section), and [Green Notes theme](https://21st.dev/community/themes/green-notes-1783614187319).

The resulting design borrows the editorial hierarchy, landscape-led storytelling, restrained surfaces, and clear plan comparisons. The components are implemented for this app; marketplace component source code was not copied or installed. The custom palette replaces the old teal-and-orange gradients. Green Notes provided a useful natural colour reference; its token values were not copied directly.

The local UI/UX skill informed spacing, contrast, focus, responsive layouts, and reduced-motion behavior. Its automated glass/pink recommendation was unsuitable for travel-plan comparison, so the chosen direction prioritizes legibility and real imagery.

## Foundations

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Canvas | `canvas` / `--background` | `#F8F8F2` | Main page background |
| Forest ink | `brand-900` / `--foreground` | `#193426` | Headings, primary buttons, footer |
| Citron | `accent-200` / `--accent` | `#D9EF82` | Sparse highlights; actions on dark surfaces |
| Surface | `white` / `--surface` | `#FFFFFF` | Inputs, cards, elevated panels |
| Muted surface | `brand-50` / `--muted` | `#F0F3EE` | Secondary panels and icon backgrounds |
| Body | `brand-600` | `#4B6148` | Body copy and secondary labels |
| Muted text | `brand-500` / `--muted-foreground` | `#63755E` | Supporting text on light surfaces |
| Border | `brand-100` / `--border` | `#E0E7DD` | Quiet surface divisions |

Citron always carries forest text. Use white text on forest. Do not use light sage (`brand-300/400`) for essential small text on white. Status colours keep their semantic meaning: green success, amber caution, rose errors.

The canonical utility palettes, weights, radii and shadows live in `tailwind.config.ts`. Semantic CSS roles, baseline accessibility rules, and shared editorial classes live in `app/globals.css`.

### Typography

- **DM Sans variable:** Interface, body, headings, navigation, numbers. Self-hosted via `next/font/local`, including weights 100–1000.
- **Instrument Serif italic:** A short expressive phrase in a hero or callout. Do not use for forms, prices, instructions, or long body text.
- Hero: 54–80px; section headings: 32–42px; card headings: 18–20px; body: 14–16px with 1.7–2 line height; labels: 11–12px.
- Use medium/semibold headings and tight tracking. The legacy `font-black` utility resolves to 700 to keep existing screens consistent.
- Uppercase eyebrow labels are short, 11px, and spaced by 0.18em.
- Font licenses are included in `app/fonts/`. Storybook loads the same local files via `.storybook/fonts.css`.

### Layout and components

- Layout: 1280px maximum width; 20px mobile, 32px tablet, 40px desktop side padding. Use `page-container` for new shared layouts.
- Spacing: 4px base scale. Cards use 20–32px padding; sections use 64–96px vertical space. Prefer whitespace and fine dividers to nested cards.
- Radii: 12px inputs, 16px cards, 20px large panels, full rounding for buttons and short badges.
- Shadows: subtle for search/input elevation; `shadow-card` for floating elements. Ordinary cards use a border.
- Buttons: forest primary, outlined secondary, text/ghost tertiary. Citron actions appear on dark backgrounds. Minimum 44px control height.
- Icons: Lucide, normally 16–20px, 1.5–1.7px stroke. No emoji for functional icons.
- Plan cards put data and validity above network facts, followed by the one-time price and selection action. Unknown attributes remain explicit. Recommendation badges continue to derive from real plan data.
- Advanced plan filters are disclosed on demand. Active advanced filters remain counted when collapsed.
- Destination cards use local photography for featured places and a compact country-code treatment for the rest. Availability and prices come from the existing catalogue.
- Search retains keyboard selection, city aliases, regional coverage matches, empty states, and catalogue-driven suggestions.

## Accessibility and interaction

Visible keyboard focus, skip navigation, named mobile controls, Escape-to-close mobile navigation, native disclosure controls, labelled forms, and reduced-motion support are part of the shared system. Mobile navigation remains in document flow. No automatic dark mode: the app’s current supported theme remains light, with deliberately dark editorial sections.

## Included surfaces

Shared navigation, branding, footer, typography, colour palette, buttons, foundational CSS, and Storybook. Specific layout work covers the homepage, destinations index, country pages, search, plan cards, filters, recommender, and sign-in/sign-up. Existing cart, checkout, account, help, business and admin screens inherit the shared token and typography changes.

## Photography and assets

Photographs are downloaded into `public/images/`, served locally, and displayed through Next Image. The homepage image is prioritized; destination cards lazy-load. Do not substitute stock images for a country that is not actually available in the catalogue.

| Asset | Subject | Source |
| --- | --- | --- |
| `namibia-dunes.jpg`, `namibia-portrait.jpg` | Namib Desert, Namibia | [Bernd Dittrich / Unsplash](https://unsplash.com/photos/9IbwU5P5dvw) |
| `south-africa-coast.jpg` | Cape Town, South Africa | [Tobias Reich / Unsplash](https://unsplash.com/photos/1GgWbP74phY) |
| `kenya-savannah.jpg` | African savannah; illustrative travel photography | [Unsplash image](https://images.unsplash.com/photo-1516026672322-bc52d61a55d5) |
| `tanzania-kilimanjaro.jpg` | Mount Kilimanjaro | [Unsplash image](https://images.unsplash.com/photo-1489392191049-fc10c97e64b6) |
| `egypt-pyramids.jpg` | Pyramids of Giza, Egypt | [2H Media / Unsplash](https://unsplash.com/photos/OVofPjTSfOQ) |

The brand mark and favicon are code-native vector artwork in `components/site/Brand.tsx` and `public/favicon.svg`; the PNG is rendered from that SVG.

## Review

Run `npm run storybook` and open **Design System / Foundations / Overview** to review palette, type, actions, inputs, and surfaces together. Existing button, plan-card, destination-search and recommender stories use the new system.

Storybook currently needs a preview-only compatibility shim in `.storybook/main.ts`: Next 16.3+ expects `LayoutRouterContext.parentRenderTree`, while Storybook 10.6 supplies the older context shape. The Vite transform adds a static cache identifier to the mock provider; it never affects the application build. Remove it when the upstream provider supports the new context.

## Verification

- Production build, TypeScript, and ESLint checks pass. The build generated all 31 static pages successfully.
- 14 affected Storybook browser tests pass across buttons, the foundations gallery, plan cards, destination search, and the usage recommender.
- Homepage reviewed at 375, 768, 1024, and 1440px: no horizontal overflow or broken images.
- Mobile checks cover destinations, country pages, sign-in, regional plans, compatibility, and the cart.
- Browser interactions verified city aliases, keyboard destination selection, mobile-menu Escape and focus return, plan filtering, advanced-filter disclosure, adding a plan, and removing it from the cart.
- Core contrast ratios: forest on ivory 12.62:1; body on ivory 6.35:1; muted text on white 4.96:1; forest on citron 10.65:1; white on forest 13.46:1.

[Desktop preview](previews/home-desktop.png) · [Mobile preview](previews/home-mobile.png) · [Full desktop page](previews/home-1440.png) · [Full mobile page](previews/home-375.png)
