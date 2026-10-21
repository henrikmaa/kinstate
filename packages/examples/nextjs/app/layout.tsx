import type { ReactNode } from 'react';
import localFont from 'next/font/local';
import './style.css';
// next/font requires SWC: this also guards against accidentally switching Next to Babel.
const font = localFont({ src: './fonts/ibm-plex-sans-latin-400-normal.woff2' });
export const metadata = {
  title: 'Kinstate · Next.js',
  description: 'Ordinary classes. Reactive state.',
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={font.className}>{children}</body>
    </html>
  );
}
