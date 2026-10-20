---
title: Deploy these docs
description: Build the Kinstate documentation locally and deploy the static site to GitHub Pages.
---

# Deploy these docs

This site uses Rspress 2. Its output is static HTML, JavaScript, CSS and locally hosted fonts. Search runs locally in the browser. No application server or search account is required.

## Develop locally

From the repository root:

```sh
npm ci
npm run docs:dev
```

The command builds the Kinstate packages before starting Rspress. The live example uses the real service class, provider and compiler, not a simulated state implementation. Edit content under `website/docs/` and styles in `website/theme/styles.css`.

## Build and check

```sh
npm run docs:build
npm run docs:check
npm run docs:test
npm run docs:preview
```

Build output is `website/doc_build/`. The default base path is `/`. `docs:test` builds an isolated production copy under `website/.test-build/` and serves it at `/kinstate/` by default to catch GitHub Pages asset and deep-link problems. It leaves `doc_build/` intact.

## GitHub Pages

The repository includes `.github/workflows/docs.yml`. In GitHub:

1. Open **henrikmaa/kinstate → Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main`, or run **Deploy documentation** from the Actions tab.

The workflow builds with `DOCS_BASE=/kinstate/`, uploads `website/doc_build/` and deploys using GitHub's Pages artifact actions. The public URL is:

```text
https://henrikmaa.github.io/kinstate/
```

Pull requests build and check the docs without deploying them. Deployment uses the `github-pages` environment, `pages: write` and `id-token: write`; no personal access token or deploy key is needed.

Before Pages is configured, pushes still build and verify the site. The workflow skips publishing and shows the setup step in its summary. It does not change the repository's hosting settings automatically.

## Other repository names and custom domains

The workflow derives the base from the repository name, so a renamed repository does not need hardcoded asset paths. For an `owner.github.io` repository or a custom domain served at its root, set the repository Actions variable `DOCS_BASE` to `/`. For another subpath, set it to a leading- and trailing-slash path such as `/library/`.

You can preview a subpath locally:

```sh
DOCS_BASE=/kinstate/ npm run docs:build
DOCS_BASE=/kinstate/ npm run docs:preview
```

Set the Pages custom domain in GitHub and configure its DNS separately. The base-path variable only controls built URLs; it does not provision a domain.

## Add a guide

Add Markdown or MDX under `website/docs/guide/`. Add the page to the sidebar in `website/rspress.config.ts`; navigation is deliberately explicit so the learning order stays predictable. Use relative Markdown links for internal references. The build rejects broken internal document links. Run the production browser checks before publishing a navigation or theme change.
