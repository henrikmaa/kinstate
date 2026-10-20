# Kinstate documentation

Dark-only Rspress 2 documentation, deployed as static files to GitHub Pages.

Run `npm run docs:dev` from the repository root. Production commands and hosting instructions are in [deployment.md](docs/deployment.md).

- `docs/`: Markdown/MDX guides and reference pages.
- `components/`: live examples authored with the public Kinstate API.
- `kinstate-loader.cjs`: a narrow Rspack pre-loader applying the existing Babel compiler to those examples; Rspress internals are excluded.
- `rspress.config.ts`: explicit navigation, forced dark appearance, local search and `DOCS_BASE`.
- `theme/styles.css`: local IBM Plex fonts and shared color/layout tokens.
- `scripts/check-site.mjs`: verifies static pages and local links/assets under the configured base.
- `tests/`: production browser checks for rendering isolation, search, deep links, mobile navigation and dark mode.

The Pages workflow uses Node 24 and npm, without a separately managed docs lockfile. The site uses the same locally built Kinstate packages as the examples. The generated output, caches and browser artifacts are ignored by Git.
