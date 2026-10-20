import { defineConfig } from '@rspress/core';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const base = process.env.DOCS_BASE ?? '/';
if (!base.startsWith('/') || !base.endsWith('/')) {
  throw new Error('DOCS_BASE must start and end with /, for example /kinstate/');
}

export default defineConfig({
  root: resolve(root, 'docs'),
  outDir: process.env.DOCS_OUT_DIR ?? 'doc_build',
  base,
  title: 'Kinstate',
  description:
    'Ordinary classes. Reactive state. Class-based services with fine-grained React updates.',
  icon: '/kingfisher.png',
  logo: '/kingfisher.png',
  logoText: 'Kinstate',
  lang: 'en',
  globalStyles: resolve(root, 'theme/styles.css'),
  markdown: { link: { checkDeadLinks: true } },
  themeConfig: {
    darkMode: 'force-dark',
    search: true,
    lastUpdated: false,
    llmsUI: false,
    enableContentAnimation: false,
    nav: [
      { text: 'Learn', link: '/guide/introduction', activeMatch: '^/$|^/guide/' },
      { text: 'API reference', link: '/reference/core', activeMatch: '^/reference/' },
    ],
    sidebar: {
      '/': [
        { text: 'Overview', link: '/' },
        {
          text: 'Start here',
          items: [
            { text: 'Introduction', link: '/guide/introduction' },
            { text: 'Quick start', link: '/guide/quick-start' },
          ],
        },
        {
          text: 'State and services',
          items: [
            { text: 'Updating state', link: '/guide/updating-state' },
            { text: 'Computed state', link: '/guide/computed-state' },
            { text: 'Async actions', link: '/guide/async-actions' },
            { text: 'Service dependencies', link: '/guide/dependency-injection' },
            { text: 'Scopes and lifecycle', link: '/guide/scopes-and-lifecycle' },
          ],
        },
        {
          text: 'Everyday recipes',
          items: [
            { text: 'External React state', link: '/guide/external-state' },
            { text: 'Callbacks from hooks', link: '/guide/callbacks' },
            { text: 'Forms and local drafts', link: '/guide/forms-and-drafts' },
            { text: 'Component composition', link: '/guide/react-composition' },
          ],
        },
        {
          text: 'Shipping an application',
          items: [
            { text: 'Next.js and SSR', link: '/guide/nextjs-and-ssr' },
            { text: 'Testing', link: '/guide/testing' },
            { text: 'Performance', link: '/guide/performance' },
            { text: 'Limits and trade-offs', link: '/guide/limitations' },
            { text: 'Deploy these docs', link: '/deployment' },
          ],
        },
        {
          text: 'API reference',
          items: [
            { text: 'Core', link: '/reference/core' },
            { text: 'React', link: '/reference/react' },
            { text: 'Compiler', link: '/reference/compiler' },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: 'github', mode: 'link', content: 'https://github.com/henrikmaa/kinstate' },
    ],
    editLink: { docRepoBaseUrl: 'https://github.com/henrikmaa/kinstate/edit/main/website/docs' },
    footer: { message: 'Kinstate · Ordinary classes. Reactive state.' },
  },
  builderConfig: {
    tools: {
      rspack(config) {
        config.module ??= {};
        config.module.rules ??= [];
        // The live examples run the same public Babel compiler as an application.
        // Restrict instrumentation to authored demos, never Rspress infrastructure.
        config.module.rules.push({
          test: /\.tsx?$/,
          include: resolve(root, 'components'),
          enforce: 'pre',
          use: [{ loader: resolve(root, 'kinstate-loader.cjs') }],
        });
      },
    },
  },
});
