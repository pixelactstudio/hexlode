# Share cards rendered from HTML at build time

Every indexable page has a share card: the 1200×630 picture Open Graph, X, Discord, Slack and
iMessage show when someone posts a link. The cards are one React template,
`src/features/seo/share-card.tsx`, filled from each page's entry in `SEO_PAGES`. `pnpm seo:build`
renders the template to plain HTML, takes a screenshot of each card in Chromium and writes
`public/og/<page>.png`, along with the app icons and the favicon. The images are committed, like
the generated theme files.

Head tags, the sitemap, robots.txt and the web manifest come from the same page list, through
TypeScript server routes (`src/routes/robots[.]txt.ts` and its neighbours). Canonical links and
card URLs always use the production address, and every other deployment asks crawlers to stay
away, so staging never competes with the real site.

## Considered options

- **Rendering cards per request with Satori and resvg**, the way Next.js's `ImageResponse` does.
  Satori supports a subset of CSS, needs fonts as TTF or WOFF rather than the WOFF2 the app ships,
  and resvg adds a native or WebAssembly module to the server image. Hexlode's pages are a fixed
  list, so nothing is gained by drawing a card on each request.
- **Hand-drawn SVG cards.** Social sites do not accept SVG images, and every change means editing
  coordinates instead of layout.

## Consequences

- The template is real HTML and CSS: flexbox, gradients, masks, blur and the Figtree font all
  work, and the card can show the real Studio screenshot.
- The Docker build skips the Chromium download, so it cannot render cards. Rerun
  `pnpm seo:build` and commit the images after changing a card, the template or the logomark. A
  unit test fails when a page in `SEO_PAGES` has no card at the right size.
- Pages that depend on one visitor's data, such as saved pipeline tools, are not in the list and
  ask not to be indexed.
